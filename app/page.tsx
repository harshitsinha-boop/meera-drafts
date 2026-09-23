import { connection } from "next/server";

async function botUsername() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, { next: { revalidate: 3600 } });
    const json = (await res.json()) as { ok: boolean; result?: { username: string } };
    return json.ok ? json.result!.username : null;
  } catch {
    return null;
  }
}

const COMMANDS: [string, string][] = [
  ["/draft", "Pick the strongest note and draft it now (/draft 3 for three)"],
  ["/queue", "What's waiting, with the best-scoring notes"],
  ["/use 12 15", "Draft from specific notes"],
  ["/facts", "List the fact bank: the only figures a draft may use"],
  ["/fact <text>", "Add a fact"],
  ["/unfact <id>", "Remove a fact"],
];

export default async function Home() {
  await connection();
  const username = await botUsername();
  const env = (k: string) => !!process.env[k];
  const checks: [string, boolean, string][] = [
    ["Bot token", env("TELEGRAM_BOT_TOKEN") && !!username, "TELEGRAM_BOT_TOKEN"],
    ["Webhook secret", env("TELEGRAM_WEBHOOK_SECRET"), "TELEGRAM_WEBHOOK_SECRET"],
    ["Owner linked", env("TELEGRAM_OWNER_ID"), "TELEGRAM_OWNER_ID - send the bot /start to get it"],
    ["Notes channel linked", env("TELEGRAM_CHANNEL_ID"), "TELEGRAM_CHANNEL_ID - forward a channel post to the bot to get it"],
    ["Gemini", env("GEMINI_API_KEY"), "GEMINI_API_KEY"],
    ["Schedule", env("CRON_SECRET"), "CRON_SECRET"],
    ["Storage", env("BLOB_READ_WRITE_TOKEN") || !process.env.VERCEL, "Connect a Blob store in the Vercel Storage tab"],
  ];

  return (
    <main>
      <h1>Notes in. Drafts back.<br />Nothing posts without you.</h1>
      <p className="lede">
        Drop observations into your Telegram channel the way you already do. Three mornings a week, the strongest one
        comes back as a LinkedIn draft in your voice, with a current news angle, ready to edit.
      </p>
      {username && <a className="cta" href={`https://t.me/${username}`}>Open @{username} in Telegram</a>}

      <h2>How it works</h2>
      <ol className="steps">
        <li><strong>Capture</strong><span>Post in your channel, or message the bot directly. Old notes and abandoned drafts can be sent as files.</span></li>
        <li><strong>Pick</strong><span>Every Mon, Wed and Fri at 7am, each note is scored. Weak notes on the same theme are combined.</span></li>
        <li><strong>Ground</strong><span>A search finds one current news item or data point that genuinely fits, or none.</span></li>
        <li><strong>Draft and check</strong><span>The post is written to the voice spec, then scored on a 10-point rubric. Every number must come from your notes, the fact bank or the cited source. Below 8, it rewrites once.</span></li>
        <li><strong>Deliver</strong><span>It arrives in Telegram with Approve, Redo and Skip. Reply to a draft with what to change.</span></li>
      </ol>

      <h2>Commands</h2>
      <table>
        <tbody>
          {COMMANDS.map(([c, d]) => (
            <tr key={c}><td>{c}</td><td>{d}</td></tr>
          ))}
        </tbody>
      </table>

      <h2>Setup status</h2>
      <ul className="status">
        {checks.map(([label, ok, hint]) => (
          <li key={label}>
            <span className={`pill ${ok ? "ok" : "todo"}`}>{ok ? "Ready" : "To do"}</span>
            <span>{label}{!ok && <span className="muted"> - {hint}</span>}</span>
          </li>
        ))}
      </ul>

      <footer>Private bot. It only responds to its owner.</footer>
    </main>
  );
}
