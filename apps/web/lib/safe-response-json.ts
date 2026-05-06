/**
 * Parse a fetch Response as JSON. Returns null when the server returned HTML
 * (e.g. 404/500 document, SPA fallback, dev error overlay) or invalid JSON.
 */
export async function safeResponseJson<T = unknown>(
  res: Response,
): Promise<T | null> {
  const text = await res.text();
  const t = text.trim();
  if (
    !t ||
    t.startsWith("<") ||
    (t[0] !== "{" && t[0] !== "[")
  ) {
    if (process.env.NODE_ENV === "development") {
      const loc = res.url ? res.url.slice(0, 120) : "(no url)";
      console.warn(
        `[safeResponseJson] expected JSON, got ${res.status} ${loc}`,
        t.slice(0, 160),
      );
    }
    return null;
  }
  try {
    return JSON.parse(t) as T;
  } catch {
    return null;
  }
}
