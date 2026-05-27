// Local-filesystem storage helper for climbing media. Owns the physical file
// lifecycle; the DB schema (ClimbMedia) only references the URL. Swapping
// this module out for Vercel Blob or R2 later changes nothing else.
//
// Files live at public/uploads/climbing/{yyyy}/{mm}/{cuid}.{ext} and are
// served by Next.js at /uploads/climbing/{yyyy}/{mm}/{cuid}.{ext}.
//
// SECURITY: deleteClimbPhotoFromDisk validates the URL against this exact
// prefix before unlinking, so a malicious or buggy caller can't traverse
// out of the uploads directory and delete arbitrary files.

// Server-only module. Imports node:fs / node:crypto, so importing this from
// a client component would fail the bundle. Client code should import the
// pure helpers from ./climb-media-shared instead.

import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

export const CLIMB_UPLOAD_URL_PREFIX = "/uploads/climbing/";
const UPLOAD_DISK_ROOT = join(process.cwd(), "public", "uploads", "climbing");

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
  // Fall back to MIME-based guess. Only the most common types — anything
  // exotic fails out cleanly via BAD_EXTENSION below.
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return "";
}

// Generate a short cuid-like id without pulling in the cuid package — we
// just need URL-safe randomness for filenames.
function randomFileId(): string {
  return randomBytes(12).toString("base64url");
}

export async function saveClimbPhotoToDisk(
  file: File
): Promise<SavedClimbPhoto> {
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
  const id = randomFileId();
  const filename = `${id}.${ext}`;
  const dir = join(UPLOAD_DISK_ROOT, yyyy, mm);
  const fullPath = join(dir, filename);

  try {
    await mkdir(dir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(fullPath, buffer);
  } catch (err) {
    throw new ClimbMediaStorageError(
      `Couldn't save file: ${err instanceof Error ? err.message : "unknown error"}`,
      "WRITE_FAILED"
    );
  }

  return {
    url: `${CLIMB_UPLOAD_URL_PREFIX}${yyyy}/${mm}/${filename}`,
    sizeBytes: file.size,
  };
}

// Remove the on-disk file backing a ClimbMedia.url. Silently no-ops for
// external URLs (LINK kind) or anything outside our upload tree. Errors
// during unlink are caught and ignored — orphan files are harmless.
export async function deleteClimbPhotoFromDisk(url: string): Promise<void> {
  if (!url.startsWith(CLIMB_UPLOAD_URL_PREFIX)) return;
  // Strip the URL prefix; what's left is the path relative to public/uploads/climbing.
  const relative = url.slice(CLIMB_UPLOAD_URL_PREFIX.length);
  // Reject any traversal attempt or absolute path.
  if (relative.includes("..") || relative.startsWith("/")) return;
  const fullPath = join(UPLOAD_DISK_ROOT, relative);
  try {
    await unlink(fullPath);
  } catch {
    // Already gone or never existed — fine.
  }
}

