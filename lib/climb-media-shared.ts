// Client-safe media helpers. The disk-storage module in
// lib/climb-media-storage.ts uses node:fs/promises and crypto — anything
// imported from there will fail in a client bundle. This file holds only
// the pure helpers (URL whitelist, validation) so client components can
// import them without dragging server-only deps in.

// Conservative whitelist of hosts whose URLs we'll render as embedded
// iframes. Everything else renders as a clickable card pointing at the URL.
const EMBEDDABLE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "vimeo.com",
  "player.vimeo.com",
]);

export function isEmbeddableLink(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && EMBEDDABLE_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

// Validate a pasted external URL. Returns the normalized URL or throws.
export function validateLinkUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Paste a URL first");
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("That doesn't look like a valid URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only http(s) links are supported");
  }
  return parsed.toString();
}
