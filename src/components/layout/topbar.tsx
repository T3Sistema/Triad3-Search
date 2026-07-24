"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { ALL_NAV_ITEMS, findActiveNavKey } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { ConnectionStatus } from "@/components/layout/connection-status";
import { CreditsWidget } from "@/components/layout/credits-widget";
import { SettingsInfoDialog } from "@/components/layout/settings-info-dialog";

interface TopbarProps {
  onOpenMobileMenu: () => void;
}

export function Topbar({ onOpenMobileMenu }: TopbarProps) {
  const pathname = usePathname();
  const activeKey = findActiveNavKey(pathname);
  const activeItem = ALL_NAV_ITEMS.find((item) => item.key === activeKey);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onOpenMobileMenu}
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="min-w-0 truncate text-lg font-semibold text-text-primary">{activeItem?.label ?? "Triad3 Search"}</h1>
          <p className="hidden truncate text-xs text-text-secondary sm:block">{activeItem?.description}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="hidden sm:block">
          <ConnectionStatus />
        </div>
        <CreditsWidget />
        <SettingsInfoDialog />
      </div>
    </header>
  );
}
