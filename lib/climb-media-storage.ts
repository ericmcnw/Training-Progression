// Blob storage for climbing media. Owns the physical file lifecycle; the DB
// schema (ClimbMedia) only ever references the returned URL.
//
// Files live in the Vercel Blob store under climbing/{yyyy}/{mm}/{id}.{ext}
// and are served from the store's own CDN domain.
//
// Why not the filesystem: this wrote to public/uploads/climbing until
// 2026-10-13. That works locally and silently does nothing in production —
// Vercel's filesystem is read-only outside /tmp, and public/ is baked at
// build time, so a runtime write is neither persisted nor served. The app
// shipped with photo upload for months and stored exactly zero of them.
//
// Uploads are `public`: the URL carries a random suffix so it isn't
// enumerable, and the gallery renders plain <img> tags. Private blobs would
// mean minting and expiring signed URLs on every render to protect photos in
// an app that has no auth on anything else.

// Server-only module. Client code should import the pure helpers from
// ./climb-media-shared instead.

import { del, put } from "@vercel/blob";
import { randomBytes } from "node:crypto";

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

/** Path prefix inside the blob store. Also the marker that tells
 *  deleteClimbPhoto a URL is ours to remove rather than someone else's link. */
export const CLIMB_UPLOAD_PATH_PREFIX = "climbing/";

/** Legacy on-disk prefix. Rows created before the blob migration still carry
 *  URLs shaped like this; they point at files that never survived a deploy,
 *  so deletion skips them rather than failing. */
export const CLIMB_UPLOAD_URL_PREFIX = "/uploads/climbing/";

export type SavedClimbPhoto = {
  url: string;
  sizeBytes: number;
};

export class ClimbMediaStorageError extends Error {
  constructor(message: string, readonly code: "TOO_LARGE" | "BAD_EXTENSION" | "WRITE_FAILED") {
    super(message);
  }
}

function pickExtension(filename: string, mimeType: string): string {
  const fromName = filename.toLowerCase().split(".").pop() ?? "";
  if (ALLOWED_EXTENSIONS.has(fromName)) return fromName === "jpeg" ? "jpg" : fromName;
  // Fall back to a MIME-based guess. Only the common types — anything exotic
  // fails out cleanly via BAD_EXTENSION below.
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return "";
}

function randomFileId(): string {
  return randomBytes(12).toString("base64url");
}

export async function saveClimbPhotoToDisk(file: File): Promise<SavedClimbPhoto> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ClimbMediaStorageError(
      `File is ${(file.size / 1024 / 1024).toFixed(1)} MB — max is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`,
      "TOO_LARGE"
    );
  }

  const ext = pickExtension(file.name, file.type);
  if (!ext) {
    throw new ClimbMediaStorageError(
      `Unsupported file type. Use JPG, PNG, WebP, or GIF.`,
      "BAD_EXTENSION"
    );
  }

  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const pathname = `${CLIMB_UPLOAD_PATH_PREFIX}${yyyy}/${mm}/${randomFileId()}.${ext}`;

  try {
    // addRandomSuffix keeps two uploads of the same name from colliding and
    // makes the final URL unguessable.
    const blob = await put(pathname, file, { access: "public", addRandomSuffix: true });
    return { url: blob.url, sizeBytes: file.size };
  } catch (err) {
    throw new ClimbMediaStorageError(
      `Couldn't save file: ${err instanceof Error ? err.message : "unknown error"}`,
      "WRITE_FAILED"
    );
  }
}

// Remove the stored blob backing a ClimbMedia.url. No-ops for external URLs
// (LINK kind) and for legacy /uploads/climbing/ paths, whose files never
// survived a deploy. Delete errors are swallowed — an orphaned blob is
// harmless, and failing here would block removing the DB row.
export async function deleteClimbPhotoFromDisk(url: string): Promise<void> {
  if (url.startsWith(CLIMB_UPLOAD_URL_PREFIX)) return;
  if (!url.includes(`/${CLIMB_UPLOAD_PATH_PREFIX}`)) return;
  try {
    await del(url);
  } catch {
    // Already gone, or the store is unreachable — fine either way.
  }
}
