// Checks the bot token and shows the bot's current setup.
// Run: node --env-file=.env.local scripts/check-bot.mjs
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token || token.includes("paste")) {
  console.error("TELEGRAM_BOT_TOKEN is missing from .env.local");
  process.exit(1);
}
const call = async (method) => (await fetch(`https://api.telegram.org/bot${token}/${method}`)).json();

const me = await call("getMe");
if (!me.ok) {
  console.error(`Token rejected by Telegram: ${me.description}`);
  process.exit(1);
}
console.log(`Token works. Bot: @${me.result.username} (${me.result.first_name}), id ${me.result.id}`);
console.log(`Can join groups/channels: ${me.result.can_join_groups}`);

const hook = await call("getWebhookInfo");
console.log(hook.result.url ? `Webhook: ${hook.result.url}` : "Webhook: none set (fine for local testing)");
if (hook.result.last_error_message) console.log(`Last webhook error: ${hook.result.last_error_message}`);
