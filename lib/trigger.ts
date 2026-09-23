export function baseUrl(req: Request) {
  return (process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, "");
}

// Each draft runs in its own function invocation so it gets the full
// maxDuration instead of sharing one with triage or other drafts.
export async function triggerDraft(base: string, id: number) {
  const res = await fetch(`${base}/api/drafts/${id}/run`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  if (!res.ok) throw new Error(`Could not start draft #${id}: HTTP ${res.status}`);
}
