"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { navGroups } from "@/lib/nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { APP_VERSION_LABEL, APP_VERSION_FULL } from "@/lib/version";
import { ChevronDown } from "lucide-react";
import { moduleHints } from "@/lib/module-help";

export function AppSidebar({ logoUrl, superAdmin = false }: { logoUrl?: string; superAdmin?: boolean }) {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl ?? "/weg-home-manager-icon.svg"} alt="WEG HomeManager" className="size-8 rounded-md object-contain" />
          <div className="grid leading-tight">
            <span className="font-semibold">{t("app.name")}</span>
            <span className="text-xs text-muted-foreground">{t("app.tagline")}</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group) => {
          const advanced = group.labelKey === "nav.groupMore" || group.labelKey === "nav.groupAdmin";
          const inThisGroup = group.items.some(item => pathname === item.href || pathname.startsWith(item.href + "/"));
          return (
          <SidebarGroup key={group.labelKey} className={advanced ? "border-t border-sidebar-border/70 pt-2" : ""}>
            <details key={group.labelKey + pathname} className="group/nav" open={!advanced || inThisGroup}>
              <summary className="flex cursor-pointer list-none items-center justify-between pr-3 [&::-webkit-details-marker]:hidden">
                <SidebarGroupLabel>{t(group.labelKey)}</SidebarGroupLabel>
                {advanced && <ChevronDown className="size-3.5 text-muted-foreground transition group-open/nav:rotate-180" />}
              </summary>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.filter((item) => !item.superAdmin || superAdmin).map((item) => {
                  const active =
                    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} title={moduleHints[item.href]?.why} />}
                        isActive={active}
                        tooltip={moduleHints[item.href]?.why ?? t(item.key)}
                      >
                        <item.icon />
                        <span>{t(item.key)}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
            </details>
          </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 py-1 text-xs text-muted-foreground" title={APP_VERSION_FULL}>
          {APP_VERSION_LABEL}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
