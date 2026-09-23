import { get, put, BlobPreconditionFailedError } from "@vercel/blob";
import { promises as fs } from "node:fs";
import path from "node:path";

// A tiny JSON document store. Each collection is one file:
// - on Vercel: a private Vercel Blob (needs BLOB_READ_WRITE_TOKEN, set automatically
//   when a Blob store is connected to the project)
// - locally without a token: .data/<collection>.json
// Writes are read-modify-write with ETag compare-and-swap, retried on conflict, so a
// Telegram note arriving while a draft is saving can't overwrite it.

export type Collection<T> = { nextId: number; items: T[] };

const blobEnabled = () => !!process.env.BLOB_READ_WRITE_TOKEN;
const LOCAL_DIR = path.join(process.cwd(), ".data");

async function readBlob<T>(name: string): Promise<{ data: Collection<T> | null; etag: string | null }> {
  const res = await get(`${name}.json`, { access: "private", useCache: false });
  if (!res || res.statusCode !== 200) return { data: null, etag: null };
  const text = await new Response(res.stream).text();
  return { data: JSON.parse(text) as Collection<T>, etag: res.blob.etag };
}

async function writeBlob<T>(name: string, data: Collection<T>, etag: string | null) {
  await put(`${name}.json`, JSON.stringify(data), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    cacheControlMaxAge: 60,
    ...(etag ? { ifMatch: etag } : { allowOverwrite: false }),
  });
}

async function readLocal<T>(name: string): Promise<Collection<T> | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(LOCAL_DIR, `${name}.json`), "utf8"));
  } catch {
    return null;
  }
}

async function writeLocal<T>(name: string, data: Collection<T>) {
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  const file = path.join(LOCAL_DIR, `${name}.json`);
  await fs.writeFile(`${file}.tmp`, JSON.stringify(data, null, 1));
  await fs.rename(`${file}.tmp`, file);
}

// Serialises local writes within the dev server process.
const localLocks = new Map<string, Promise<unknown>>();

export async function read<T>(name: string, seed: () => T[] = () => []): Promise<Collection<T>> {
  const data = blobEnabled() ? (await readBlob<T>(name)).data : await readLocal<T>(name);
  if (data) return data;
  const items = seed();
  return { nextId: items.length + 1, items };
}

export async function mutate<T, R>(
  name: string,
  fn: (c: Collection<T>) => R,
  seed: () => T[] = () => [],
): Promise<R> {
  const fresh = (): Collection<T> => {
    const items = seed();
    return { nextId: items.length + 1, items };
  };

  if (!blobEnabled()) {
    const prev = localLocks.get(name) ?? Promise.resolve();
    const run = prev.then(async () => {
      const c = (await readLocal<T>(name)) ?? fresh();
      const result = fn(c);
      await writeLocal(name, c);
      return result;
    });
    localLocks.set(name, run.catch(() => {}));
    return run;
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, etag } = await readBlob<T>(name);
    const c = data ?? fresh();
    const result = fn(c);
    try {
      await writeBlob(name, c, etag);
      return result;
    } catch (e) {
      // Someone else wrote first (or created the file first): re-read and retry.
      const conflict = e instanceof BlobPreconditionFailedError || (!etag && /exist/i.test(String(e)));
      if (!conflict) throw e;
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 200 * (attempt + 1)));
    }
  }
  throw new Error(`Could not save ${name}: too many concurrent writes`);
}
