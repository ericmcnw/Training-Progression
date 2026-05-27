"use client";

// Replaces the bare `<Link>view →</Link>` markers used throughout the
// dashboard's "already logged" rows. Opens the ViewLogDrawer with the
// provided log id set instead of navigating away.

import { useViewLogDrawer } from "@/app/contexts/ViewLogDrawerContext";

type Props = {
  logIds: string[];
  title?: string;
  style?: React.CSSProperties;
  label?: string;
};

export default function ViewButton({ logIds, title, style, label = "view →" }: Props) {
  const { openViewer } = useViewLogDrawer();

  if (logIds.length === 0) return null;

  return (
    <button
      type="button"
      onClick={() => openViewer(logIds, title ? { title } : undefined)}
      style={{ ...defaultStyle, ...style }}
    >
      {label}
    </button>
  );
}

const defaultStyle: React.CSSProperties = {
  padding: 0,
  background: "transparent",
  border: "none",
  color: "inherit",
  fontWeight: 800,
  fontSize: 12,
  textDecoration: "none",
  cursor: "pointer",
  opacity: 0.9,
};
