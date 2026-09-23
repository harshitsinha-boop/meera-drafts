import { Composer } from "@/components/Composer";

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

export default async function Home() {
  const username = await botUsername();
  return (
    <main>
      <h1>Idea in. LinkedIn post out.</h1>
      <p className="lede">
        Write a sentence or two about an idea. You get back a LinkedIn post in Meera&apos;s voice, ready to copy and paste.
      </p>
      <Composer needsPasscode={!!process.env.APP_PASSCODE} />
      {username && (
        <p className="alt">
          Or send the idea to <a href={`https://t.me/${username}`}>@{username}</a> on Telegram.
        </p>
      )}
    </main>
  );
}
