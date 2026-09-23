import { after } from "next/server";
import mammoth from "mammoth";
import {
  insertNote, insertNotes, updateNoteText, allNotes, allDrafts, getDraft, updateDraft,
  getFacts, addFact, updateFact,
} from "./db";
import { triage, draftFromNotes } from "./pipeline";
import { triggerDraft } from "./trigger";
import { tg, send, ownerId, downloadFile, flattenText, type TgUpdate, type TgMessage } from "./telegram";

const HELP = `I turn the notes you drop into your channel into LinkedIn drafts. Nothing is ever posted for you.

Capturing
- Post in your channel as usual. I pick up every message.
- Or message me here. Anything you send me is saved as a note.

Drafting (automatic Mon, Wed, Fri at 7am)
/draft - pick the strongest note(s) and draft now (add a number, up to 3)
/queue - what's waiting, and the best-scoring notes
/use 12 15 - draft from specific notes

On a draft
Approve / Redo / Skip buttons, or reply to the draft with what to change.

Facts (the only numbers a draft may use)
/facts - list them
/fact <text> - add one
/unfact <id> - remove one

Backlog
Send me your Telegram export (result.json) or old drafts (.docx, .txt, .md) as files and I'll import them.`;

const text = (m: TgMessage) => (m.text ?? m.caption ?? "").trim();

export async function handleUpdate(update: TgUpdate, base: string) {
  const owner = ownerId();
  const channelId = process.env.TELEGRAM_CHANNEL_ID;

  // Notes posted in Meera's channel
  const post = update.channel_post ?? update.edited_channel_post;
  if (post) {
    if (!channelId || String(post.chat.id) !== channelId || !text(post)) return;
    const externalId = `tgch:${post.message_id}`;
    if (update.edited_channel_post) await updateNoteText(externalId, text(post));
    else await insertNote({ source: "telegram", externalId, text: text(post), capturedAt: new Date(post.date * 1000) });
    return;
  }

  if (update.callback_query) return handleButton(update.callback_query, base, owner);

  const m = update.message;
  if (!m || m.chat.type !== "private") return;
  const chat = m.chat.id;

  if (m.from?.id !== owner) {
    await send(
      chat,
      owner
        ? "This bot is private."
        : `Your Telegram user id is ${m.from?.id}.\nSet TELEGRAM_OWNER_ID to this number (in .env.local or Vercel), restart, and send /start again.`,
    );
    return;
  }

  if (m.document) return importFile(chat, m.document);

  const body = text(m);
  const [cmd, ...args] = body.split(/\s+/);

  switch (cmd) {
    case "/start":
    case "/help":
      return void (await send(chat, HELP));

    case "/queue":
      return queue(chat);

    case "/draft": {
      const count = Math.min(Math.max(Number(args[0]) || 1, 1), 3);
      await send(chat, `Reading your notes and picking ${count === 1 ? "the strongest one" : `the ${count} strongest`}. Each draft takes a few minutes.`);
      after(async () => {
        try {
          const ids = await triage(count);
          if (!ids.length) return void (await send(chat, "Nothing in the queue is ready to draft. Drop a few more notes and try again."));
          for (const id of ids) await triggerDraft(base, id);
        } catch (e) {
          await send(chat, `Triage failed: ${e instanceof Error ? e.message : e}`);
        }
      });
      return;
    }

    case "/use": {
      const ids = args.map(Number).filter(Number.isInteger);
      if (!ids.length) return void (await send(chat, "Give me note numbers, e.g. /use 12 15. /queue shows them."));
      try {
        const id = await draftFromNotes(ids);
        await triggerDraft(base, id);
        await send(chat, `Drafting #${id} from note ${ids.join(", ")}. It'll arrive in a few minutes.`);
      } catch (e) {
        await send(chat, e instanceof Error ? e.message : String(e));
      }
      return;
    }

    case "/facts": {
      const facts = await getFacts();
      return void (await send(chat, facts.length ? facts.map((f) => `${f.id}. ${f.text}`).join("\n") : "No facts yet. Add one with /fact <text>."));
    }

    case "/fact": {
      const fact = body.slice(cmd.length).trim();
      if (!fact) return void (await send(chat, "Usage: /fact Our Vitamin C serum is tested at pH 3.2 in every batch."));
      await addFact(fact, "added in Telegram");
      return void (await send(chat, "Added to the fact bank."));
    }

    case "/unfact": {
      const id = Number(args[0]);
      if (!Number.isInteger(id)) return void (await send(chat, "Usage: /unfact 3 (see /facts for numbers)"));
      await updateFact(id, "", null);
      return void (await send(chat, `Removed fact ${id}.`));
    }
  }

  if (cmd?.startsWith("/")) return void (await send(chat, HELP));
  if (!body) return void (await send(chat, "I can only read text and files for now."));

  // A reply to a delivered draft is a redo instruction.
  const replyTo = m.reply_to_message?.message_id;
  if (replyTo) {
    const draft = (await allDrafts()).find((d) => d.tg_message_id === replyTo);
    if (draft) {
      await updateDraft(draft.id, { instruction: body });
      after(() => triggerDraft(base, draft.id));
      return void (await send(chat, `Redrafting #${draft.id} with your changes. A few minutes.`));
    }
  }

  // Anything else is a note. A forward from her channel also reveals the channel id.
  const fwd = m.forward_origin?.chat;
  const externalId =
    fwd && m.forward_origin?.message_id && String(fwd.id) === channelId ? `tgch:${m.forward_origin.message_id}` : `tgdm:${m.message_id}`;
  const id = await insertNote({ source: "telegram", externalId, text: body, capturedAt: new Date(m.date * 1000) });
  const lines = [id ? `Saved as note #${id}.` : "Already had that one."];
  if (fwd && !channelId) lines.push(`That channel's id is ${fwd.id}. Set TELEGRAM_CHANNEL_ID to it so I read the channel directly.`);
  await send(chat, lines.join("\n"));
}

async function handleButton(cb: NonNullable<TgUpdate["callback_query"]>, base: string, owner: number | null) {
  if (cb.from.id !== owner) return;
  const [action, raw] = (cb.data ?? "").split(":");
  const id = Number(raw);
  const chat = cb.message?.chat.id ?? owner;
  let toast = "";

  if (action === "approve") {
    const ok = await updateDraft(id, { status: "approved" }, ["ready"]);
    const d = await getDraft(id);
    toast = ok ? "Approved" : "Already handled";
    // Send the post on its own so it's one long-press to copy.
    if (ok && d?.body) await send(chat, d.body);
  } else if (action === "reject") {
    toast = (await updateDraft(id, { status: "rejected" }, ["ready", "failed"])) ? "Skipped" : "Already handled";
  } else if (action === "redo") {
    after(() => triggerDraft(base, id));
    toast = "Redrafting";
    await send(chat, `Redrafting #${id}. Tip: reply to the draft with what to change and I'll use it.`);
  }

  await tg("answerCallbackQuery", { callback_query_id: cb.id, text: toast });
  if (cb.message && action !== "redo") {
    await tg("editMessageReplyMarkup", {
      chat_id: cb.message.chat.id,
      message_id: cb.message.message_id,
      reply_markup: { inline_keyboard: [] },
    }).catch(() => {});
  }
}

async function queue(chat: number) {
  const [notes, drafts] = await Promise.all([allNotes(), allDrafts()]);
  const open = notes.filter((n) => n.status === "new" || n.status === "parked");
  const top = [...open].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).slice(0, 5);
  const count = (s: string) => drafts.filter((d) => d.status === s).length;
  const lines = [
    `${notes.filter((n) => n.status === "new").length} new note(s), ${notes.filter((n) => n.status === "parked").length} parked, ${notes.filter((n) => n.status === "used").length} used.`,
    `${count("ready")} draft(s) waiting for you, ${count("queued") + count("running")} in progress, ${count("approved")} approved.`,
  ];
  if (top.length) {
    lines.push("", "Top notes:");
    for (const n of top) {
      const first = n.text.replace(/\s+/g, " ").slice(0, 90);
      lines.push(`#${n.id}${n.score != null ? ` (${n.score}/5)` : ""} ${first}${n.text.length > 90 ? "..." : ""}`);
    }
    lines.push("", "Draft one with /use <number>.");
  }
  await send(chat, lines.join("\n"));
}

async function importFile(chat: number, doc: NonNullable<TgMessage["document"]>) {
  const name = doc.file_name ?? "file";
  if ((doc.file_size ?? 0) > 20_000_000) return void (await send(chat, "That file is over Telegram's 20 MB bot limit."));
  const buf = await downloadFile(doc.file_id);

  if (/\.json$/i.test(name)) {
    let data: { messages?: { id: number; type: string; date: string; text: unknown }[] };
    try {
      data = JSON.parse(buf.toString("utf8"));
    } catch {
      return void (await send(chat, 'That isn\'t valid JSON. In Telegram Desktop, export with format "Machine-readable JSON".'));
    }
    const rows = (data.messages ?? [])
      .filter((m) => m.type === "message")
      .map((m) => ({ source: "telegram_import", externalId: `tgch:${m.id}`, text: flattenText(m.text), capturedAt: m.date }))
      .filter((r) => r.text.trim());
    const added = await insertNotes(rows);
    return void (await send(chat, `Imported ${added.length} note(s) from ${rows.length} message(s). Duplicates skipped. Send /draft when ready.`));
  }

  let content = "";
  if (/\.docx$/i.test(name)) content = (await mammoth.extractRawText({ buffer: buf })).value;
  else if (/\.(txt|md)$/i.test(name)) content = buf.toString("utf8");
  else return void (await send(chat, "I can import result.json (Telegram export), .docx, .txt or .md files."));

  const title = name.replace(/\.(docx|txt|md)$/i, "");
  const added = await insertNotes([
    { source: "drive_draft", externalId: `drive:${name}:${doc.file_size ?? buf.length}`, text: `[Abandoned draft: ${title}]\n\n${content.trim()}` },
  ]);
  await send(chat, added.length ? `Imported "${title}" as note #${added[0]}.` : `Already had "${title}".`);
}
