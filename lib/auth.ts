import { timingSafeEqual } from "node:crypto";

export function safeEqual(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// Vercel Cron and the internal draft trigger authenticate with CRON_SECRET.
export function isInternal(req: Request) {
  const secret = process.env.CRON_SECRET;
  return !!secret && safeEqual(req.headers.get("authorization"), `Bearer ${secret}`);
}
