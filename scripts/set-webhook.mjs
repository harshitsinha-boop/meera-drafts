// Points the bot at a deployment. Run after the first Vercel deploy (and if the URL changes):
//   node --env-file=.env.local scripts/set-webhook.mjs https://your-app.vercel.app
// The TELEGRAM_WEBHOOK_SECRET in .env.local must match the one set in Vercel.
const [base] = process.argv.slice(2);
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
if (!base?.startsWith("https://") || !token || !secret) {
  console.error("Usage: node --env-file=.env.local scripts/set-webhook.mjs https://your-app.vercel.app");
  process.exit(1);
}
const call = async (method, body) =>
  (await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })).json();

const url = `${base.replace(/\/$/, "")}/api/telegram`;
const res = await call("setWebhook", {
  url,
  secret_token: secret,
  allowed_updates: ["message", "channel_post", "edited_channel_post", "callback_query"],
});
if (!res.ok) {
  console.error(`Failed: ${res.description}`);
  process.exit(1);
}
await call("setMyCommands", {
  commands: [
    { command: "draft", description: "Pick the strongest note and draft it now" },
    { command: "queue", description: "What's waiting" },
    { command: "use", description: "Draft from specific notes, e.g. /use 12 15" },
    { command: "facts", description: "List the fact bank" },
    { command: "fact", description: "Add a fact" },
    { command: "help", description: "How this works" },
  ],
});
console.log(`Webhook set: ${url}`);
