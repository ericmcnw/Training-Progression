"use client";

// Grid of photo thumbnails + external links for a ClimbLocation or
// ClimbProblem. Click a tile to open a fullscreen lightbox; tap the ✕ on a
// tile to delete (with confirm). Captions are inline-editable from the
// lightbox view to keep the grid clean.
//
// Mobile: 3 columns at <720px, 4 at >=720px, 5 at >=1100px (see the
// .climbing-media-grid CSS class). Tap targets are at least 44px tall.
// The lightbox uses 100dvh to handle iOS Safari's collapsing chrome.

import { useState, useTransition } from "react";
import { deleteClimbMedia, updateClimbMediaCaption } from "@/app/activities/climbing/media/actions";
import { isEmbeddableLink } from "@/lib/climb-media-shared";

export type GalleryMediaItem = {
  id: string;
  kind: "PHOTO" | "LINK";
  url: string;
  thumbnailUrl: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
};

export default function MediaGallery({
  items,
  canEdit = true,
  emptyHint = "No photos yet.",
}: {
  items: GalleryMediaItem[];
  canEdit?: boolean;
  emptyHint?: string;
}) {
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const lightboxItem = items.find((m) => m.id === lightboxId) ?? null;

  if (items.length === 0) {
    return (
      <div
        style={{
          fontSize: 12,
          opacity: 0.55,
          padding: "12px 4px",
          textAlign: "center",
        }}
      >
        {emptyHint}
      </div>
    );
  }

  return (
    <>
      <div className="climbing-media-grid">
        {items.map((item) => (
          <MediaTile
            key={item.id}
            item={item}
            onOpen={() => setLightboxId(item.id)}
          />
        ))}
      </div>

      {lightboxItem && (
        <Lightbox
          item={lightboxItem}
          canEdit={canEdit}
          onClose={() => setLightboxId(null)}
          onDeleted={() => setLightboxId(null)}
        />
      )}
    </>
  );
}

function MediaTile({ item, onOpen }: { item: GalleryMediaItem; onOpen: () => void }) {
  // Thumbnail source: photos use the file URL directly (no separate thumb
  // until we add sharp resizing); LINK tiles render an icon + host name so
  // YouTube and Imgur are visually distinct from photos.
  if (item.kind === "PHOTO") {
    return (
      <button type="button" onClick={onOpen} className="climbing-media-tile" aria-label={item.caption ?? "Photo"}>
        <img src={item.url} alt={item.caption ?? ""} loading="lazy" />
      </button>
    );
  }

  // LINK tile
  let host = item.url;
  try {
    host = new URL(item.url).hostname.replace(/^www\./, "");
  } catch {
    // leave host as the raw URL
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="climbing-media-tile"
      style={{ display: "grid", placeItems: "center", padding: 8 }}
      aria-label={`Link to ${host}`}
    >
      <div style={{ display: "grid", gap: 4, placeItems: "center", textAlign: "center" }}>
        <span style={{ fontSize: 22 }} aria-hidden>
          🔗
        </span>
        <span style={{ fontSize: 10, fontWeight: 800, opacity: 0.75, wordBreak: "break-word" }}>
          {host}
        </span>
      </div>
    </button>
  );
}

function Lightbox({
  item,
  canEdit,
  onClose,
  onDeleted,
}: {
  item: GalleryMediaItem;
  canEdit: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [captionDraft, setCaptionDraft] = useState(item.caption ?? "");
  const [editingCaption, setEditingCaption] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!window.confirm("Delete this media? This can't be undone.")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteClimbMedia(item.id);
        onDeleted();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't delete");
      }
    });
  }

  function saveCaption() {
    startTransition(async () => {
      try {
        await updateClimbMediaCaption({ id: item.id, caption: captionDraft });
        setEditingCaption(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save caption");
      }
    });
  }

  return (
    <div
      className="climbing-lightbox"
      onClick={(e) => {
        // Backdrop click closes; clicks inside the content shouldn't.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={{ display: "grid", gap: 12, maxWidth: 1100, width: "100%" }}>
        {item.kind === "PHOTO" ? (
          <img src={item.url} alt={item.caption ?? ""} style={{ maxHeight: "70vh", width: "100%", objectFit: "contain", borderRadius: 12 }} />
        ) : isEmbeddableLink(item.url) ? (
          <EmbeddedLink url={item.url} />
        ) : (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "grid",
              gap: 8,
              padding: 24,
              borderRadius: 12,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              textAlign: "center",
              color: "inherit",
              textDecoration: "none",
            }}
          >
            <span style={{ fontSize: 28 }}>🔗</span>
            <span style={{ fontWeight: 800, wordBreak: "break-all" }}>{item.url}</span>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Open in new tab →</span>
          </a>
        )}

        {/* Caption + actions */}
        <div style={{ display: "grid", gap: 8, padding: 8 }}>
          {editingCaption ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <input
                value={captionDraft}
                onChange={(e) => setCaptionDraft(e.target.value)}
                placeholder="Add a caption"
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "9px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.04)",
                  color: "inherit",
                  fontSize: 13,
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={saveCaption}
                disabled={isPending}
                style={primaryBtn}
              >
                {isPending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCaptionDraft(item.caption ?? "");
                  setEditingCaption(false);
                }}
                style={ghostBtn}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "rgba(255,255,255,0.85)",
                fontSize: 14,
                minHeight: 24,
              }}
            >
              <span style={{ flex: 1, fontStyle: item.caption ? undefined : "italic", opacity: item.caption ? 1 : 0.55 }}>
                {item.caption || "No caption"}
              </span>
              {canEdit && (
                <button type="button" onClick={() => setEditingCaption(true)} style={ghostBtn} aria-label="Edit caption">
                  ✎
                </button>
              )}
            </div>
          )}

          {error && (
            <div
              style={{
                fontSize: 11.5,
                padding: "7px 10px",
                borderRadius: 8,
                background: "rgba(248,113,113,0.10)",
                border: "1px solid rgba(248,113,113,0.32)",
                color: "rgba(248,113,113,0.95)",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
            <button type="button" onClick={onClose} style={ghostBtn}>
              Close
            </button>
            {canEdit && (
              <button type="button" onClick={handleDelete} disabled={isPending} style={dangerBtn}>
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmbeddedLink({ url }: { url: string }) {
  // YouTube + Vimeo only for now (whitelisted by isEmbeddableLink). Build a
  // proper embed URL from the watch URL.
  let embedSrc: string | null = null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) embedSrc = `https://www.youtube.com/embed/${v}`;
    } else if (u.hostname === "youtu.be") {
      const id = u.pathname.replace(/^\//, "");
      if (id) embedSrc = `https://www.youtube.com/embed/${id}`;
    } else if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.replace(/^\//, "");
      if (id) embedSrc = `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    // fall through to fallback below
  }

  if (!embedSrc) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "rgba(160,200,255,0.95)" }}>
        {url}
      </a>
    );
  }
  return (
    <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 12, overflow: "hidden" }}>
      <iframe
        src={embedSrc}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="Embedded video"
      />
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(120,190,255,0.45)",
  background: "rgba(120,190,255,0.18)",
  color: "rgba(191,219,254,0.98)",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "transparent",
  color: "rgba(255,255,255,0.85)",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const dangerBtn: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(248,113,113,0.45)",
  background: "rgba(248,113,113,0.12)",
  color: "rgba(252,165,165,0.98)",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

