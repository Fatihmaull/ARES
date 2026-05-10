/**
 * Safe attachment names for Content-Disposition and <a download>.
 * HTTP `filename="..."` must be ASCII-only here — Unicode (e.g. … or —) can
 * cause Node/Next to throw when setting headers → opaque 500 for clients.
 */
export function sanitizePdfFilename(title: string, fallbackId: string): string {
  const trimmed = title.trim();
  let base =
    trimmed.length > 0
      ? trimmed
          .replace(/\u2026/g, "...")
          .replace(/[\u2013\u2014]/g, "-")
          .replace(/[/\\<>:"|?*\x00-\x1f]/g, "-")
          .replace(/\s+/g, " ")
          .trim()
      : "";
  base = base.replace(/[^\x20-\x7E]/g, "_");
  if (!base.replace(/_/g, "").trim()) base = "";
  if (!base) base = `ARES-findings-${fallbackId.slice(0, 8)}`;
  const max = 160;
  if (base.length > max) base = base.slice(0, max).trim();
  if (!base.toLowerCase().endsWith(".pdf")) base += ".pdf";
  return base;
}

/** ASCII-safe Content-Disposition attachment header value (filename only). */
export function contentDispositionAttachment(filename: string): string {
  const safe = filename.replace(/[^\x20-\x7E]/g, "_").replace(/[\r\n"]/g, "_");
  return `attachment; filename="${safe}"`;
}
