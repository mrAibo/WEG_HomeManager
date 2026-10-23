"use client";

import { usePathname } from "@/i18n/navigation";
import { BookOpen, ChevronDown } from "lucide-react";
import { hintForPath } from "@/lib/module-help";

export function ModuleGuide() {
  const pathname = usePathname();
  const hint = hintForPath(pathname);
  if (!hint || pathname === "/dashboard" || pathname.endsWith("/dashboard")) return null;
  return (
    <details className="group mb-6 rounded-2xl border border-teal-200/70 bg-teal-50/70 p-4 text-slate-800 shadow-sm dark:border-teal-900 dark:bg-teal-950/20 dark:text-slate-100">
      <summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden">
        <span className="rounded-xl bg-teal-100 p-2 text-teal-800 dark:bg-teal-900 dark:text-teal-200">
          <BookOpen className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Orientierung · {hint.title}</span>
          <span className="block text-sm text-slate-600 dark:text-slate-300">{hint.why}</span>
        </span>
        <ChevronDown className="mt-2 size-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <p className="mt-3 border-t border-teal-200 pt-3 text-sm dark:border-teal-900">
        <strong>Erster Schritt:</strong> {hint.firstStep}
      </p>
    </details>
  );
}
