import { isInternal } from "@/lib/auth";
import { triage } from "@/lib/pipeline";
import { baseUrl, triggerDraft } from "@/lib/trigger";
import { notifyOwner } from "@/lib/telegram";

export const maxDuration = 120;

// Vercel Cron calls this Mon/Wed/Fri (vercel.json) with the CRON_SECRET bearer token.
export async function GET(req: Request) {
  if (!isInternal(req)) return new Response("Unauthorized", { status: 401 });
  const count = Math.min(Math.max(Number(process.env.DRAFTS_PER_RUN) || 1, 1), 3);
  const ids = await triage(count);
  for (const id of ids) await triggerDraft(baseUrl(req), id);
  if (!ids.length) await notifyOwner("No notes worth drafting this run. Drop a few into the channel and I'll look again next time.");
  return Response.json({ drafts: ids });
}
