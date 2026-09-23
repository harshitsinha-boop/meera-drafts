# Note to Post

A Telegram bot for Meera: she keeps dropping notes into her Telegram channel, and three mornings a week the strongest one comes back **in Telegram** as a LinkedIn draft in her voice, with a current news angle. She approves, redoes or skips it there. Nothing is ever posted automatically.

The Vercel site is a public page for the bot: what it does, the commands, and a setup checklist.

```
channel post / DM / file ──▶ /api/telegram ──▶ notes (Vercel Blob)
                                                    │
        Mon/Wed/Fri 7am cron, or /draft ──▶ triage: score every note, pick or combine
                                                    │
        /api/drafts/[id]/run ──▶ Google Search news angle ──▶ Gemini draft (voice spec + fact bank)
                                                    │
                     QA: script checks + Gemini judge, rewrite once if < 8/10
                                                    │
                     Telegram: draft + Approve / Redo / Skip, reply to it to redirect
```

## In Telegram

| | |
|---|---|
| Post in the channel, or message the bot | Saved as a note |
| Send `result.json` (Telegram Desktop export) | Imports the channel backlog |
| Send `.docx` / `.txt` / `.md` | Imports an abandoned draft |
| `/draft`, `/draft 3` | Pick the strongest note(s) and draft now |
| `/queue` | Counts and the best-scoring notes |
| `/use 12 15` | Draft from specific notes |
| `/facts`, `/fact <text>`, `/unfact <id>` | The fact bank: the only figures a draft may use |
| Reply to a draft | Redraft with your instructions |

## Code

| | |
|---|---|
| `lib/bot.ts` | Every Telegram interaction |
| `lib/pipeline.ts` | Triage, news angle, drafting, QA loop, delivery |
| `lib/voice.ts` | The voice spec as a system prompt |
| `lib/qa.ts` | Automated rubric checks 1, 2, 3, 6, 7 |
| `lib/llm.ts` | Gemini: JSON output validated with zod, Google Search grounding |
| `lib/store.ts`, `lib/db.ts` | JSON collections in Vercel Blob (or `./.data` locally) with safe concurrent writes |
| `app/page.tsx` | The public page |

## Run locally

```bash
cp .env.example .env.local      # fill in the Telegram token, secrets, Gemini key
npm install
npm run dev
node --env-file=.env.local scripts/dev-poll.mjs   # second terminal: relays Telegram to localhost
```

Locally, notes are stored in `./.data`. `scripts/check-bot.mjs` checks the token.

## Deploy to Vercel

1. Put this folder in a GitHub repo and import it at vercel.com/new.
2. **Storage** tab → **Create** → **Blob** → connect it to the project. This sets `BLOB_READ_WRITE_TOKEN`.
3. **Settings → Environment Variables**: everything in `.env.example`. Use the same `TELEGRAM_WEBHOOK_SECRET` as your `.env.local`.
4. Redeploy, then point the bot at it:
   ```bash
   node --env-file=.env.local scripts/set-webhook.mjs https://your-app.vercel.app
   ```
   (Stop `dev-poll.mjs` first. Polling and the webhook can't run at the same time.)
5. Open the site. The setup checklist should be all "Ready".
