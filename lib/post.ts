import { generateText } from "./llm";
import { VOICE_SYSTEM_PROMPT } from "./voice";
import { scriptChecks, normaliseDashes } from "./qa";

// Numbers the post may use: whatever is in her message, plus her stated background.
const PERSONA_FACTS = "2 years in pharmaceutical formulation";

function clean(post: string) {
  return normaliseDashes(post.replace(/\*\*|__/g, "").replace(/^#+\s*/gm, "").trim());
}

// Idea in, finished LinkedIn post out. Rewrites once if the post breaks a hard
// voice rule (banned punctuation, reader questions, banned words, invented numbers).
export async function writePost(idea: string) {
  const prompt = `Meera's idea:\n"""\n${idea}\n"""\n\nWrite the LinkedIn post.`;
  let post = clean(await generateText("post", { system: VOICE_SYSTEM_PROMPT, prompt }));

  const failures = scriptChecks(post, `${idea}\n${PERSONA_FACTS}`).checks.filter((c) => !c.pass && c.id !== 3);
  if (failures.length) {
    const fix = `${prompt}\n\nYour previous version broke these rules. Rewrite it and fix them:\n${failures
      .map((c) => `- ${c.name}: ${c.detail}`)
      .join("\n")}\n\nPrevious version:\n"""\n${post}\n"""`;
    post = clean(await generateText("post rewrite", { system: VOICE_SYSTEM_PROMPT, prompt: fix }));
  }
  return post;
}
