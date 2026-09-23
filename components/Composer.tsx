"use client";
import { useEffect, useState } from "react";

const KEY = "ntp-passcode";

export function Composer({ needsPasscode }: { needsPasscode: boolean }) {
  const [idea, setIdea] = useState("");
  const [post, setPost] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [copied, setCopied] = useState(false);
  const [passcode, setPasscode] = useState(() => {
    try {
      return typeof window === "undefined" ? "" : localStorage.getItem(KEY) ?? "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  async function write() {
    setSeconds(0);
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const res = await fetch("/api/post", {
        method: "POST",
        headers: { "content-type": "application/json", "x-passcode": passcode },
        body: JSON.stringify({ idea }),
      });
      const data = (await res.json().catch(() => ({}))) as { post?: string; error?: string };
      if (!res.ok || !data.post) throw new Error(data.error || `Something went wrong (HTTP ${res.status}).`);
      setPost(data.post);
      try {
        localStorage.setItem(KEY, passcode);
      } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(post);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const words = post ? post.split(/\s+/).filter(Boolean).length : 0;

  return (
    <section className="composer">
      <label htmlFor="idea">Your idea</label>
      <textarea
        id="idea"
        rows={4}
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        placeholder="e.g. Our sunscreen tested at SPF 42 in the lab but we label it SPF 30. Customers keep asking why we don't print the higher number."
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && idea.trim() && !busy) write();
        }}
      />
      <div className="row">
        {needsPasscode && (
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Passcode"
            aria-label="Passcode"
            className="passcode"
            suppressHydrationWarning
          />
        )}
        <button className="primary" onClick={write} disabled={busy || !idea.trim() || (needsPasscode && !passcode)}>
          {busy ? `Writing... ${seconds}s` : post ? "Write another version" : "Write the post"}
        </button>
      </div>
      {busy && <p className="hint">Usually takes about a minute.</p>}
      {error && <p className="error">{error}</p>}

      {post && (
        <div className="result">
          <div className="result-head">
            <span>{words} words</span>
            <button onClick={copy}>{copied ? "Copied" : "Copy post"}</button>
          </div>
          <div className="post">{post}</div>
        </div>
      )}
    </section>
  );
}
