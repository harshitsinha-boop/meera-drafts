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
        Send the bot a sentence or two about an idea. It sends back a LinkedIn post in Meera&apos;s voice, ready to copy and paste.
      </p>
      {username && <a className="cta" href={`https://t.me/${username}`}>Open @{username} in Telegram</a>}
    </main>
  );
}
