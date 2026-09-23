import { safeEqual } from "@/lib/auth";
import { handleUpdate } from "@/lib/bot";
import { baseUrl } from "@/lib/trigger";
import type { TgUpdate } from "@/lib/telegram";

export const maxDuration = 120;

export async function POST(req: Request) {
  if (!safeEqual(req.headers.get("x-telegram-bot-api-secret-token"), process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    await handleUpdate((await req.json()) as TgUpdate, baseUrl(req));
  } catch (e) {
    // Always 200 so Telegram doesn't redeliver the same update forever.
    console.error("telegram update failed", e);
  }
  return Response.json({ ok: true });
}
