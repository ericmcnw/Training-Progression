"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

export type ProgressSearchSuggestion = {
  href: string;
  title: string;
  subtitle: string;
  keywords?: string[];
};

export default function ProgressSearchTrigger({
  initialQuery,
  suggestions,
}: {
  initialQuery: string;
  suggestions: ProgressSearchSuggestion[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(initialQuery.length > 0);
  const [query, setQuery] = useState(initialQuery);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);

  const trimmedQuery = query.trim();
  const normalizedQuery = trimmedQuery.toLowerCase();
  const filteredSuggestions = useMemo(() => {
    if (!normalizedQuery) return suggestions.slice(0, 8);
    return suggestions
      .filter((suggestion) => {
        const haystack = [suggestion.title, suggestion.subtitle, ...(suggestion.keywords ?? [])]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .slice(0, 8);
  }, [normalizedQuery, suggestions]);
  const highlightedIndex = Math.min(activeIndex, Math.max(filteredSuggestions.length - 1, 0));

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [open]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!shellRef.current?.contains(event.target as Node)) {
        setOpen(trimmedQuery.length > 0);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [trimmedQuery.length]);

  function progressHref(nextQuery: string) {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    if (nextQuery.trim()) {
      next.set("q", nextQuery.trim());
    } else {
      next.delete("q");
    }
    next.delete("section");
    return `/progress${next.toString() ? `?${next.toString()}` : ""}`;
  }

  function submit(nextQuery = query) {
    router.push(progressHref(nextQuery));
  }

  function clear() {
    setQuery("");
    setOpen(false);
    router.push(progressHref(""));
  }

  function selectSuggestion(suggestion: ProgressSearchSuggestion) {
    setQuery(suggestion.title);
    setOpen(false);
    router.push(suggestion.href);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search progress"
        style={triggerButtonStyle}
      >
        <SearchIcon />
        <span>Search progress</span>
      </button>
    );
  }

  return (
    <div ref={shellRef} style={searchWrapStyle}>
      <form
        action={() => submit()}
        style={searchShellStyle}
        onSubmit={(event) => {
          event.preventDefault();
          const selectedSuggestion = filteredSuggestions[highlightedIndex];
          if (selectedSuggestion && normalizedQuery) {
            const exactMatch =
              selectedSuggestion.title.toLowerCase() === normalizedQuery ||
              selectedSuggestion.keywords?.some((keyword) => keyword.toLowerCase() === normalizedQuery);
            if (exactMatch) {
              selectSuggestion(selectedSuggestion);
              return;
            }
          }
          submit();
        }}
      >
        <SearchIcon />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((current) => Math.min(current + 1, Math.max(filteredSuggestions.length - 1, 0)));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((current) => Math.max(current - 1, 0));
            }
            if (event.key === "Escape") {
              event.preventDefault();
              if (trimmedQuery) {
                clear();
              } else {
                setOpen(false);
              }
            }
          }}
          placeholder="Search routines, exercises, and coverage"
          aria-label="Search progress"
          aria-controls="progress-search-suggestions"
          style={searchInputStyle}
        />
        <button type="submit" style={searchActionStyle}>
          Search
        </button>
        <button type="button" onClick={clear} style={searchActionStyle}>
          Clear
        </button>
      </form>

      {filteredSuggestions.length > 0 ? (
        <div id="progress-search-suggestions" role="listbox" style={suggestionListStyle}>
          {filteredSuggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.href}-${suggestion.title}`}
              type="button"
              onClick={() => selectSuggestion(suggestion)}
              style={{
                ...suggestionItemStyle,
                ...(index === highlightedIndex ? suggestionItemActiveStyle : {}),
              }}
            >
              <span style={suggestionTitleStyle}>{suggestion.title}</span>
              <span style={suggestionSubtitleStyle}>{suggestion.subtitle}</span>
            </button>
          ))}
        </div>
      ) : normalizedQuery ? (
        <div style={suggestionEmptyStyle}>No progress areas match that search yet.</div>
      ) : null}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12.5 12.5L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const triggerButtonStyle: React.CSSProperties = {
  minHeight: 42,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  padding: "0 14px",
  borderRadius: 999,
  border: "1px solid rgba(120,190,255,0.28)",
  background: "rgba(120,190,255,0.12)",
  color: "inherit",
  fontWeight: 900,
  fontSize: 13,
};

const searchWrapStyle: React.CSSProperties = {
  position: "relative",
  width: "min(100%, 420px)",
};

const searchShellStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  padding: "9px 10px",
  borderRadius: 14,
  border: "1px solid rgba(120,190,255,0.24)",
  background: "rgba(8,14,25,0.88)",
  minWidth: "min(100%, 380px)",
  boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
};

const searchInputStyle: React.CSSProperties = {
  flex: "1 1 180px",
  minWidth: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  color: "inherit",
  fontSize: 13,
};

const searchActionStyle: React.CSSProperties = {
  padding: "7px 9px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "inherit",
  fontSize: 12,
  fontWeight: 800,
};

const suggestionListStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  left: 0,
  right: 0,
  display: "grid",
  gap: 6,
  padding: 8,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(10,16,27,0.98)",
  boxShadow: "0 18px 38px rgba(0,0,0,0.28)",
  zIndex: 20,
};

const suggestionItemStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.03)",
  color: "inherit",
  textAlign: "left",
};

const suggestionItemActiveStyle: React.CSSProperties = {
  borderColor: "rgba(120,190,255,0.3)",
  background: "rgba(120,190,255,0.12)",
};

const suggestionTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  lineHeight: 1.35,
};

const suggestionSubtitleStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.4,
  opacity: 0.74,
};

const suggestionEmptyStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  left: 0,
  right: 0,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(10,16,27,0.98)",
  fontSize: 12,
  opacity: 0.78,
  boxShadow: "0 18px 38px rgba(0,0,0,0.28)",
  zIndex: 20,
};
