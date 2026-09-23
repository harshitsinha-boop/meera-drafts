// Checks the Gemini key and model. Run: node --env-file=.env.local scripts/check-gemini.mjs
import { GoogleGenAI } from "@google/genai";
const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
try {
  const res = await ai.models.generateContent({ model, contents: "Reply with the single word: ready" });
  console.log(`Gemini works (${model}): ${res.text?.trim()}`);
} catch (e) {
  console.error(`Gemini failed (${model}): ${e.message?.slice(0, 400)}`);
  process.exit(1);
}
