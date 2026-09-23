import { safeEqual } from "@/lib/auth";
import { writePost } from "@/lib/post";

export const maxDuration = 120;

// Web version of the bot: idea in, post out. Protected by APP_PASSCODE so the
// public URL can't be used to spend the Gemini quota.
export async function POST(req: Request) {
  const passcode = process.env.APP_PASSCODE;
  if (passcode && !safeEqual(req.headers.get("x-passcode"), passcode)) {
    return Response.json({ error: "Wrong passcode." }, { status: 401 });
  }
  const { idea } = (await req.json().catch(() => ({}))) as { idea?: string };
  const text = (idea ?? "").trim();
  if (!text) return Response.json({ error: "Write your idea first." }, { status: 400 });
  if (text.length > 4000) return Response.json({ error: "Keep the idea under 4,000 characters." }, { status: 400 });
  try {
    return Response.json({ post: await writePost(text) });
  } catch (e) {
    console.error("web post failed", e);
    return Response.json({ error: "Couldn't write that one. Please try again." }, { status: 502 });
  }
}
