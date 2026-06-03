"use client";

// Two-tab uploader: native file picker for photos, paste-link tab for
// YouTube/Imgur/etc. Lives inside the location detail page (and later
// inside problem rows). Renders inline — no modal — so the gallery
// remains visible while uploading.
//
// Mobile: the file input deliberately omits `capture` so iOS/Android
// show the full chooser sheet (Take Photo + Photo Library + Choose
// Files). With `capture="environment"` the OS jumps straight to the
// camera and never offers a library pick — that broke uploading shots
// you already took.

import { useRef, useState, useTransition } from "react";
import { addClimbLink, uploadClimbPhoto } from "@/app/activities/climbing/media/actions";

type Target =
  | { kind: "location"; locationId: string }
  | { kind: "problem"; problemId: string };

export default function MediaUploader({
  target,
  onUploaded,
}: {
  target: Target;
  onUploaded?: () => void;
}) {
  const [tab, setTab] = useState<"photo" | "link">("photo");
  const [error, setError] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkCaption, setLinkCaption] = useState("");
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function attachTargetFormData(formData: FormData) {
    if (target.kind === "location") formData.set("locationId", target.locationId);
    else formData.set("problemId", target.problemId);
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    // Upload files sequentially so server actions don't fight over the same
    // sortOrder lookup. Each upload is fast (single file write); the cost
    // is negligible and the code stays simple.
    startTransition(async () => {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.set("file", file);
        attachTargetFormData(formData);
        try {
          await uploadClimbPhoto(formData);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Upload failed");
          break;
        }
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
      onUploaded?.();
    });
  }

  function handleAddLink() {
    if (!linkUrl.trim()) {
      setError("Paste a URL first");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await addClimbLink({
          url: linkUrl,
          caption: linkCaption || null,
          ...(target.kind === "location" ? { locationId: target.locationId } : { problemId: target.problemId }),
        });
        setLinkUrl("");
        setLinkCaption("");
        onUploaded?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't add link");
      }
    });
  }

  return (
    <div style={containerStyle}>
      <div style={tabsStyle}>
        <button
          type="button"
          onClick={() => setTab("photo")}
          style={tab === "photo" ? tabActiveStyle : tabStyle}
        >
          📷 Upload photo
        </button>
        <button
          type="button"
          onClick={() => setTab("link")}
          style={tab === "link" ? tabActiveStyle : tabStyle}
        >
          🔗 Paste link
        </button>
      </div>

      {tab === "photo" ? (
        <label style={dropzoneStyle}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            disabled={isPending}
            style={{ display: "none" }}
          />
          <span style={{ fontSize: 22 }}>📷</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.85)" }}>
            {isPending ? "Uploading…" : "Tap to add photos"}
          </span>
          <span style={{ fontSize: 11, opacity: 0.6, textAlign: "center" }}>
            Camera or photo library · JPG · PNG · WebP · GIF · up to 20 MB
          </span>
        </label>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=… or https://imgur.com/…"
            style={inputStyle}
            type="url"
            inputMode="url"
          />
          <input
            value={linkCaption}
            onChange={(e) => setLinkCaption(e.target.value)}
            placeholder="Optional caption"
            style={inputStyle}
          />
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button type="button" onClick={handleAddLink} disabled={isPending || !linkUrl.trim()} style={primaryBtn}>
              {isPending ? "Adding…" : "Add link"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={errorStyle}>{error}</div>
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 10,
  borderRadius: 12,
  border: "1px dashed rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.02)",
};

const tabsStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const tabStyle: React.CSSProperties = {
  flex: "1 1 140px",
  padding: "8px 12px",
  borderRadius: 10,
  // Long-hand so `tabActiveStyle` can override `borderColor` without
  // React's mixed-shorthand rerender warning.
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.03)",
  color: "rgba(255,255,255,0.75)",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const tabActiveStyle: React.CSSProperties = {
  ...tabStyle,
  background: "rgba(120,190,255,0.15)",
  borderColor: "rgba(120,190,255,0.45)",
  color: "rgba(191,219,254,0.98)",
};

const dropzoneStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  placeItems: "center",
  padding: "20px 12px",
  borderRadius: 10,
  border: "1px dashed rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.02)",
  cursor: "pointer",
  minHeight: 110,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 13,
  fontWeight: 600,
  outline: "none",
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(120,190,255,0.45)",
  background: "rgba(120,190,255,0.18)",
  color: "rgba(191,219,254,0.98)",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const errorStyle: React.CSSProperties = {
  fontSize: 11.5,
  padding: "7px 10px",
  borderRadius: 8,
  background: "rgba(248,113,113,0.10)",
  border: "1px solid rgba(248,113,113,0.32)",
  color: "rgba(248,113,113,0.95)",
};
