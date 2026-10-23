"use client";

import { Info, BookOpen, Globe, Bug, ExternalLink, Building2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { APP_VERSION_FULL_NUMBER, APP_VERSION_LABEL, APP_BUILD, APP_SHA } from "@/lib/version";

const DOCS_URL = "https://github.com/mrAibo/WEG_HomeManager";
const SITE_URL = "https://github.com/mrAibo/WEG_HomeManager";
const ISSUES_URL = "https://github.com/mrAibo/WEG_HomeManager/issues";
const UPSTREAM_URL = "https://github.com/fgilde/hausverwaltung";

export function InfoDrawer({ tenantName }: { tenantName: string }) {
  const t = useTranslations("about");

  const links = [
    { href: DOCS_URL, icon: BookOpen, label: t("docs") },
    { href: SITE_URL, icon: Globe, label: t("website") },
    { href: ISSUES_URL, icon: Bug, label: t("issues") },
  ];

  return (
    <Sheet>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" aria-label={t("title")} title={t("title")} />}
      >
        <Info className="size-5" />
      </SheetTrigger>
      <SheetContent side="right" className="w-[92vw] gap-0 overflow-y-auto p-0 sm:max-w-sm">
        {/* Kopf: satter Verlauf (unabhängig von der Brandfarbe) + großes Logo */}
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-700 p-6 text-white">
          <div className="pointer-events-none absolute -right-10 -top-12 size-48 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-14 -left-8 size-40 rounded-full bg-fuchsia-500/25 blur-3xl" />
          <div className="relative flex flex-col items-center text-center">
            <div className="grid size-56 place-items-center rounded-3xl bg-white/15 shadow-lg ring-1 ring-white/30 backdrop-blur">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/weg-home-manager.svg" alt="WEG HomeManager" className="size-48 rounded-2xl object-contain" />
            </div>
            <SheetTitle className="mt-4 text-2xl font-semibold tracking-tight text-white">
              WEG HomeManager
            </SheetTitle>
            <p className="text-sm text-white/80">{t("tagline")}</p>
          </div>
          <div className="relative mt-4 flex items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-semibold text-amber-950 shadow-sm">
              <span className="size-1.5 animate-pulse rounded-full bg-amber-950" />
              {t("beta")}
            </span>
            <span className="rounded-full bg-white/15 px-2.5 py-1 font-mono text-xs backdrop-blur">
              {APP_VERSION_LABEL}
            </span>
          </div>
        </div>

        <div className="space-y-5 p-5">
          {/* Beta-Hinweis */}
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
            {t("betaNote")}
          </p>

          {/* Version & Mandant */}
          <dl className="rounded-xl border bg-card">
            <div className="flex items-center justify-between gap-3 border-b px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">{t("version")}</dt>
              <dd className="font-mono text-xs">v{APP_VERSION_FULL_NUMBER}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-b px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">{t("build")}</dt>
              <dd className="font-mono text-xs">
                {APP_BUILD}
                {APP_SHA ? ` · ${APP_SHA}` : ""}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Building2 className="size-3.5" /> {t("tenant")}
              </dt>
              <dd className="truncate text-right text-xs font-medium">{tenantName}</dd>
            </div>
          </dl>

          {/* Links */}
          <nav className="grid gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted"
              >
                <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                  <l.icon className="size-4" />
                </span>
                <span className="font-medium">{l.label}</span>
                <ExternalLink className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </a>
            ))}
          </nav>

          {/* Maintained upstream attribution, not a product promotion. */}
          <p className="rounded-lg border p-3 text-center text-xs text-muted-foreground">
            WEG HomeManager basiert auf{" "}
            <a className="underline" href={UPSTREAM_URL} target="_blank" rel="noopener noreferrer">
              HaVeWa von Florian Gilde
            </a>
            {" "} (AGPL-3.0). Die ursprünglichen Urheberhinweise und Lizenztexte bleiben erhalten.
          </p>
        </div>


      </SheetContent>
    </Sheet>
  );
}
