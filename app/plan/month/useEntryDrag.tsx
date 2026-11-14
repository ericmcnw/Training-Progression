"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { DayEntry } from "./data";

export type EntryDrag = { entry: DayEntry; fromYmd: string; x: number; y: number; overYmd: string | null };

const LONG_PRESS_MS = 350;
const TOUCH_SLOP_PX = 10;
const MOUSE_SLOP_PX = 6;

function ymdAt(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  return el?.closest<HTMLElement>("[data-plan-ymd]")?.dataset.planYmd ?? null;
}

// Pointer events handle the mouse; touch uses touch events so the long press
// can block scrolling with a non-passive touchmove, which pointer events can't
// do once the browser has claimed the gesture as a pan.
export function useEntryDrag(onDrop: (entry: DayEntry, fromYmd: string, toYmd: string) => void) {
  const [drag, setDrag] = useState<EntryDrag | null>(null);
  const dragRef = useRef<EntryDrag | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const lastDropAt = useRef(0);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  const update = useCallback((next: EntryDrag | null) => {
    dragRef.current = next;
    setDrag(next);
  }, []);

  const finish = useCallback(() => {
    const current = dragRef.current;
    cleanupRef.current?.();
    cleanupRef.current = null;
    update(null);
    if (!current) return;
    lastDropAt.current = Date.now();
    if (current.overYmd && current.overYmd !== current.fromYmd) {
      onDropRef.current(current.entry, current.fromYmd, current.overYmd);
    }
  }, [update]);

  const moveTo = useCallback(
    (x: number, y: number) => {
      const current = dragRef.current;
      if (!current) return;
      update({ ...current, x, y, overYmd: ymdAt(x, y) });
    },
    [update]
  );

  useEffect(() => () => cleanupRef.current?.(), []);

  const bind = useCallback(
    (entry: DayEntry, fromYmd: string) => ({
      onPointerDown(e: React.PointerEvent) {
        if (e.pointerType !== "mouse" || e.button !== 0) return;
        const startX = e.clientX;
        const startY = e.clientY;
        let started = false;
        const onMove = (ev: PointerEvent) => {
          if (!started) {
            if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < MOUSE_SLOP_PX) return;
            started = true;
          }
          ev.preventDefault();
          if (!dragRef.current) update({ entry, fromYmd, x: ev.clientX, y: ev.clientY, overYmd: fromYmd });
          moveTo(ev.clientX, ev.clientY);
        };
        const onUp = () => (started ? finish() : cleanup());
        const cleanup = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          cleanupRef.current = null;
        };
        cleanupRef.current?.();
        cleanupRef.current = cleanup;
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
      },
      onTouchStart(e: React.TouchEvent) {
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        const startX = t.clientX;
        const startY = t.clientY;
        let lastX = startX;
        let lastY = startY;
        const timer = window.setTimeout(() => {
          navigator.vibrate?.(10);
          update({ entry, fromYmd, x: lastX, y: lastY, overYmd: fromYmd });
        }, LONG_PRESS_MS);
        const onMove = (ev: TouchEvent) => {
          const touch = ev.touches[0];
          if (!touch) return;
          lastX = touch.clientX;
          lastY = touch.clientY;
          if (dragRef.current) {
            ev.preventDefault();
            moveTo(lastX, lastY);
          } else if (Math.hypot(lastX - startX, lastY - startY) > TOUCH_SLOP_PX) {
            cleanup();
          }
        };
        const onEnd = () => (dragRef.current ? finish() : cleanup());
        const cleanup = () => {
          window.clearTimeout(timer);
          window.removeEventListener("touchmove", onMove);
          window.removeEventListener("touchend", onEnd);
          window.removeEventListener("touchcancel", onEnd);
          cleanupRef.current = null;
        };
        cleanupRef.current?.();
        cleanupRef.current = cleanup;
        window.addEventListener("touchmove", onMove, { passive: false });
        window.addEventListener("touchend", onEnd);
        window.addEventListener("touchcancel", onEnd);
      },
      onContextMenu(e: React.MouseEvent) {
        e.preventDefault();
      },
    }),
    [finish, moveTo, update]
  );

  // A drop (or a long press that went nowhere) is followed by a click on the
  // cell underneath; that click shouldn't open the day sheet.
  const justDropped = useCallback(() => Date.now() - lastDropAt.current < 400, []);

  return { drag, bind, justDropped };
}

export function DragGhost({ drag }: { drag: EntryDrag }) {
  return createPortal(
    <div style={{ ...ghost, left: drag.x, top: drag.y }} aria-hidden>
      <span style={{ fontSize: 15 }}>{drag.entry.isIcon ? drag.entry.glyph : "•"}</span>
      <span style={ghostName}>{drag.entry.routineName}</span>
    </div>,
    document.body
  );
}

export const draggableStyle: CSSProperties = {
  cursor: "grab",
  touchAction: "manipulation",
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
};

const ghost: CSSProperties = {
  position: "fixed",
  zIndex: 2000,
  transform: "translate(-50%, -130%)",
  display: "flex",
  alignItems: "center",
  gap: 6,
  maxWidth: 200,
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid rgba(51,255,122,0.6)",
  background: "rgba(17,24,39,0.96)",
  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 800,
  pointerEvents: "none",
};

const ghostName: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
