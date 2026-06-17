"use client";

// Renders the input control for one per-sport extra field (everything except
// its surrounding label). Shared by the create sheet (SportQuickLogRow) and
// the edit form (EditSportLogForm) so the new select/person field types stay
// in one place. Callers own the <label> + grid placement.

import { inputStyle, textareaStyle } from "@/app/routines/[id]/log/form-ui";
import PersonCombobox from "@/app/components/log/PersonCombobox";
import type { ExtraFieldConfig } from "./sportLogConfig";

export default function SportExtraControl({
  field,
  value,
  onChange,
  people,
}: {
  field: ExtraFieldConfig;
  value: string;
  onChange: (next: string) => void;
  people: string[];
}) {
  if (field.type === "textarea") {
    return (
      <textarea
        placeholder={field.placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={textareaStyle}
      />
    );
  }

  if (field.type === "select") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
        <option value="">— select —</option>
        {(field.options ?? []).map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  if (field.type === "person") {
    return (
      <PersonCombobox
        value={value}
        onChange={onChange}
        people={people}
        placeholder={field.placeholder ?? "Search or add a person"}
      />
    );
  }

  return (
    <input
      type={field.type === "number" ? "number" : "text"}
      inputMode={
        field.type === "number"
          ? field.numericHint === "decimal" ? "decimal" : "numeric"
          : undefined
      }
      placeholder={field.placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={inputStyle}
    />
  );
}
