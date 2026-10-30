"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-line px-4 text-sm font-medium text-fg transition-colors hover:border-brand hover:text-brand"
    >
      <Printer className="h-4 w-4" />
      Print / Save PDF
    </button>
  );
}
