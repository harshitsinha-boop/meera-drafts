import { after } from "next/server";
import { safeEqual } from "@/lib/auth";
import { writePost } from "@/lib/post";
import { tg, send, type TgUpdate } from "@/lib/telegram";

export const maxDuration = 120;

const WELCOME = "Send me an idea in a sentence or two, and I'll send back a LinkedIn post in your voice, ready to copy and paste.";

export async function POST(req: Request) {
  if (!safeEqual(req.headers.get("x-telegram-bot-api-secret-token"), process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const m = ((await req.json()) as TgUpdate).message;
  const idea = (m?.text ?? m?.caption ?? "").trim();
  if (!m || m.chat.type !== "private") return Response.json({ ok: true });

  if (!idea) {
    await send(m.chat.id, "Send your idea as text.");
  } else if (idea.startsWith("/")) {
    await send(m.chat.id, WELCOME);
  } else {
    // Reply after Telegram gets its 200, so slow generations never cause redelivery.
    after(async () => {
      const typing = () => tg("sendChatAction", { chat_id: m.chat.id, action: "typing" }).catch(() => {});
      await typing();
      const timer = setInterval(typing, 4500);
      try {
        await send(m.chat.id, await writePost(idea));
      } catch (e) {
        console.error("post failed", e);
        await send(m.chat.id, "Sorry, I couldn't write that one. Please send it again.").catch(() => {});
      } finally {
        clearInterval(timer);
      }
    });
  }
  return Response.json({ ok: true });
}
