const API = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function tg<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; result: T; description?: string };
  if (!json.ok) throw new Error(`Telegram ${method}: ${json.description}`);
  return json.result;
}

export function ownerId() {
  const id = process.env.TELEGRAM_OWNER_ID;
  return id ? Number(id) : null;
}

export async function send(chatId: number, text: string, extra: Record<string, unknown> = {}) {
  return tg<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text: text.slice(0, 4096),
    link_preview_options: { is_disabled: true },
    ...extra,
  });
}

export async function notifyOwner(text: string, extra: Record<string, unknown> = {}) {
  const id = ownerId();
  if (!id || !process.env.TELEGRAM_BOT_TOKEN) return null;
  return send(id, text, extra);
}

// Files sent to the bot (Telegram export JSON, .docx drafts). Bot API limit is 20 MB.
export async function downloadFile(fileId: string) {
  const file = await tg<{ file_path: string }>("getFile", { file_id: fileId });
  const res = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`);
  if (!res.ok) throw new Error(`Could not download file: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// Telegram delivers text either as a string or, in exports, as an array of
// plain strings and entity objects ({ type, text }).
export function flattenText(t: unknown): string {
  if (typeof t === "string") return t;
  if (Array.isArray(t)) return t.map((p) => (typeof p === "string" ? p : (p as { text?: string }).text ?? "")).join("");
  return "";
}

export type TgMessage = {
  message_id: number;
  date: number;
  chat: { id: number; type: string; title?: string };
  from?: { id: number; first_name?: string };
  text?: string;
  caption?: string;
  document?: { file_id: string; file_name?: string; file_size?: number };
  reply_to_message?: TgMessage;
  forward_origin?: { type: string; chat?: { id: number; title?: string }; message_id?: number };
};

export type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  channel_post?: TgMessage;
  edited_channel_post?: TgMessage;
  callback_query?: { id: string; from: { id: number }; data?: string; message?: TgMessage };
};
