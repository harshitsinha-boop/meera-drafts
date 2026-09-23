import { read, mutate } from "./store";
import type { QAReport } from "./qa";

export type NoteStatus = "new" | "used" | "parked" | "skipped";

export type Note = {
  id: number;
  source: string;
  external_id: string | null;
  text: string;
  captured_at: string;
  status: NoteStatus;
  score: number | null;
  verdict: string | null;
  triage_reason: string | null;
  created_at: string;
};

export type NewsAngle = {
  headline: string;
  publisher: string;
  url: string;
  published: string;
  summary: string;
  facts: { text: string; quote: string }[];
};

export type DraftStatus = "queued" | "running" | "ready" | "failed" | "approved" | "posted" | "rejected";

export type Draft = {
  id: number;
  note_ids: number[];
  pillar: string | null;
  angle: string | null;
  why: string | null;
  instruction: string | null;
  status: DraftStatus;
  stage: string | null;
  news: NewsAngle | null;
  body: string | null;
  edited_body: string | null;
  facts_used: { text: string; source: string }[] | null;
  qa: QAReport | null;
  attempts: number;
  error: string | null;
  tg_message_id: number | null;
  created_at: string;
  updated_at: string;
};

export type Fact = { id: number; text: string; source: string | null };

const now = () => new Date().toISOString();

// ---------------------------------------------------------------- facts

// Only facts stated unambiguously in the voice spec. The founding-timeline and
// humid-city-returns figures are contradictory in the source material and are
// deliberately left out until Meera confirms them.
const SEED_FACTS = (): Fact[] =>
  [
    { text: "Meera Pillai is the founder of Skinstinct, an Indian D2C skincare brand.", source: "voice spec" },
    { text: "Before Skinstinct, Meera spent 2 years in pharmaceutical formulation.", source: "voice spec" },
    { text: "Meera is not a dermatologist and does not have a medical degree.", source: "voice spec" },
    { text: "Skinstinct's repeat purchase rate is 67%. Meera can't separate the causes of it.", source: "voice spec" },
  ].map((f, i) => ({ id: i + 1, ...f }));

export async function getFacts() {
  return (await read<Fact>("facts", SEED_FACTS)).items;
}

export async function addFact(text: string, source: string | null) {
  await mutate<Fact, void>("facts", (c) => {
    c.items.push({ id: c.nextId++, text, source });
  }, SEED_FACTS);
}

export async function updateFact(id: number, text: string, source: string | null) {
  await mutate<Fact, void>("facts", (c) => {
    if (!text) c.items = c.items.filter((f) => f.id !== id);
    else c.items = c.items.map((f) => (f.id === id ? { ...f, text, source } : f));
  }, SEED_FACTS);
}

// ---------------------------------------------------------------- notes

export async function allNotes() {
  return (await read<Note>("notes")).items;
}

export async function getNotes(ids: number[]) {
  const set = new Set(ids);
  return (await allNotes())
    .filter((n) => set.has(n.id))
    .sort((a, b) => a.captured_at.localeCompare(b.captured_at));
}

export async function insertNote(n: {
  source: string;
  externalId?: string | null;
  text: string;
  capturedAt?: Date | string | null;
}) {
  const text = n.text.trim();
  if (!text) return null;
  return insertNotes([n]).then((ids) => ids[0] ?? null);
}

// Bulk insert in one write (imports). Returns ids of notes actually added;
// notes whose externalId already exists are skipped.
export async function insertNotes(
  input: { source: string; externalId?: string | null; text: string; capturedAt?: Date | string | null }[],
) {
  return mutate<Note, number[]>("notes", (c) => {
    const seen = new Set(c.items.map((x) => x.external_id).filter(Boolean));
    const added: number[] = [];
    for (const n of input) {
      const text = n.text.trim();
      if (!text || (n.externalId && seen.has(n.externalId))) continue;
      if (n.externalId) seen.add(n.externalId);
      const id = c.nextId++;
      c.items.push({
        id,
        source: n.source,
        external_id: n.externalId ?? null,
        text,
        captured_at: n.capturedAt ? new Date(n.capturedAt).toISOString() : now(),
        status: "new",
        score: null,
        verdict: null,
        triage_reason: null,
        created_at: now(),
      });
      added.push(id);
    }
    return added;
  });
}

export async function updateNoteText(externalId: string, text: string) {
  await mutate<Note, void>("notes", (c) => {
    const n = c.items.find((x) => x.external_id === externalId);
    if (n && (n.status === "new" || n.status === "parked")) n.text = text;
  });
}

export async function setNoteStatus(ids: number[], status: NoteStatus) {
  const set = new Set(ids);
  await mutate<Note, void>("notes", (c) => {
    for (const n of c.items) if (set.has(n.id)) n.status = status;
  });
}

export async function applyTriage(
  assessments: { id: number; score: number; verdict: string; reason: string }[],
) {
  const byId = new Map(assessments.map((a) => [a.id, a]));
  await mutate<Note, void>("notes", (c) => {
    for (const n of c.items) {
      const a = byId.get(n.id);
      if (!a || (n.status !== "new" && n.status !== "parked")) continue;
      n.score = a.score;
      n.verdict = a.verdict;
      n.triage_reason = a.reason;
      if (a.verdict === "skip") n.status = "skipped";
      else if (a.verdict === "park") n.status = "parked";
    }
  });
}

// ---------------------------------------------------------------- drafts

export async function allDrafts() {
  return (await read<Draft>("drafts")).items.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getDraft(id: number) {
  return (await read<Draft>("drafts")).items.find((d) => d.id === id) ?? null;
}

export async function createDraft(d: Pick<Draft, "note_ids" | "pillar" | "angle" | "why" | "instruction">) {
  return mutate<Draft, number>("drafts", (c) => {
    const id = c.nextId++;
    c.items.push({
      ...d,
      id,
      status: "queued",
      stage: null,
      news: null,
      body: null,
      edited_body: null,
      facts_used: null,
      qa: null,
      attempts: 0,
      error: null,
      tg_message_id: null,
      created_at: now(),
      updated_at: now(),
    });
    return id;
  });
}

// Applies a patch; if `onlyFrom` is given, only when the current status is in it.
// Returns whether the draft was updated.
export async function updateDraft(id: number, patch: Partial<Draft>, onlyFrom?: DraftStatus[]) {
  return mutate<Draft, boolean>("drafts", (c) => {
    const d = c.items.find((x) => x.id === id);
    if (!d || (onlyFrom && !onlyFrom.includes(d.status))) return false;
    Object.assign(d, patch, { updated_at: now() });
    return true;
  });
}

// ---------------------------------------------------------------- owner

// TELEGRAM_OWNER_ID wins if set. Otherwise the first person to message the bot
// claims it, and everyone after that is turned away.
type Setting = { id: number; owner_id: number | null };

export async function getOwnerId(): Promise<number | null> {
  if (process.env.TELEGRAM_OWNER_ID) return Number(process.env.TELEGRAM_OWNER_ID);
  return (await read<Setting>("settings")).items[0]?.owner_id ?? null;
}

export async function claimOwner(userId: number): Promise<number> {
  if (process.env.TELEGRAM_OWNER_ID) return Number(process.env.TELEGRAM_OWNER_ID);
  return mutate<Setting, number>("settings", (c) => {
    if (!c.items[0]) c.items.push({ id: 1, owner_id: userId });
    else if (c.items[0].owner_id == null) c.items[0].owner_id = userId;
    return c.items[0].owner_id!;
  });
}
