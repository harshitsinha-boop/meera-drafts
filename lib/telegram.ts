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


export async function send(chatId: number, text: string, extra: Record<string, unknown> = {}) {
  return tg<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text: text.slice(0, 4096),
    link_preview_options: { is_disabled: true },
    ...extra,
  });
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
