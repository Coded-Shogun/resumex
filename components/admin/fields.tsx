"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-[13px] font-medium text-fg-muted">
      {label}
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="field" />
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 3,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  hint?: string;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-[13px] font-medium text-fg-muted">
      <span>
        {label}
        {hint && <span className="ml-2 font-normal text-fg-subtle">{hint}</span>}
      </span>
      <textarea value={value} rows={rows} onChange={(e) => onChange(e.target.value)} className="field" />
    </label>
  );
}

// One item per line. Blank lines are kept while typing and dropped on save
// (see normalize() in editor.tsx).
export function LinesField({ label, value, onChange, rows = 4 }: { label: string; value: string[]; onChange: (v: string[]) => void; rows?: number }) {
  return <TextArea label={label} hint="one per line" value={value.join("\n")} onChange={(v) => onChange(v.split("\n"))} rows={rows} />;
}

function move<T>(list: T[], from: number, to: number) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// Generic add / remove / reorder wrapper for every repeating section.
export function ListEditor<T>({
  items,
  onChange,
  create,
  addLabel,
  title,
  render,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  create: () => T;
  addLabel: string;
  title: (item: T, index: number) => string;
  render: (item: T, update: (item: T) => void) => React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      {items.map((item, i) => (
        <div key={i} className="flex flex-col gap-4 rounded-[18px] border border-line-subtle bg-page p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-[15px] font-medium text-fg">{title(item, i) || `Item ${i + 1}`}</span>
            <div className="flex shrink-0 items-center">
              <button type="button" className="btn-ghost" aria-label="Move up" disabled={i === 0} onClick={() => onChange(move(items, i, i - 1))}>
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" className="btn-ghost" aria-label="Move down" disabled={i === items.length - 1} onClick={() => onChange(move(items, i, i + 1))}>
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="btn-ghost hover:!text-destructive"
                aria-label="Remove"
                onClick={() => {
                  if (confirm(`Remove "${title(item, i) || `item ${i + 1}`}"?`)) onChange(items.filter((_, j) => j !== i));
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          {render(item, (next) => onChange(items.map((it, j) => (j === i ? next : it))))}
        </div>
      ))}
      <button type="button" className="btn-secondary self-start" onClick={() => onChange([...items, create()])}>
        <Plus className="h-4 w-4" />
        {addLabel}
      </button>
    </div>
  );
}
