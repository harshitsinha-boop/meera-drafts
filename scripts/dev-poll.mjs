// Local testing without a public URL: pulls updates from Telegram and forwards
// them to the dev server's webhook route, exactly as Telegram would.
// Run (with `npm run dev` in another terminal):
//   node --env-file=.env.local scripts/dev-poll.mjs
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const target = process.env.LOCAL_WEBHOOK_URL || "http://localhost:3000/api/telegram";
if (!token || !secret) {
  console.error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in .env.local");
  process.exit(1);
}
const api = (m, body) =>
  fetch(`https://api.telegram.org/bot${token}/${m}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  }).then((r) => r.json());

// getUpdates doesn't work while a webhook is set.
const info = await api("getWebhookInfo");
if (info.result?.url) {
  console.log(`Removing webhook ${info.result.url} for local polling (press "Connect webhook" on the deployed dashboard to restore it).`);
  await api("deleteWebhook");
}

console.log(`Polling Telegram, forwarding to ${target}. Message your bot now. Ctrl+C to stop.`);
let offset = 0;
for (;;) {
  const res = await api("getUpdates", {
    offset,
    timeout: 30,
    allowed_updates: ["message", "channel_post", "edited_channel_post", "callback_query"],
  });
  if (!res.ok) {
    console.error(res.description);
    await new Promise((r) => setTimeout(r, 3000));
    continue;
  }
  for (const u of res.result) {
    offset = u.update_id + 1;
    const kind = Object.keys(u).find((k) => k !== "update_id");
    const text = u[kind]?.text ?? u[kind]?.data ?? "";
    try {
      const r = await fetch(target, {
        method: "POST",
        headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": secret },
        body: JSON.stringify(u),
      });
      console.log(`${kind}: ${String(text).slice(0, 60)} -> ${r.status}`);
    } catch {
      console.error(`${kind}: could not reach ${target} - is \`npm run dev\` running?`);
    }
  }
}
