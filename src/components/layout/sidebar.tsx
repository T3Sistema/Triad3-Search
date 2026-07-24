"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PLAYGROUND_ITEMS, SECONDARY_ITEMS, findActiveNavKey } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const activeKey = findActiveNavKey(pathname);

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 shrink-0 border-r border-border bg-sidebar transition-transform duration-200 lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Navegação principal"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-5 py-5">
            <Link href="/" className="flex min-w-0 items-center" onClick={onClose}>
              <Image
                src="/branding/triad3-search-logo.png"
                alt="Triad3 Search"
                width={1983}
                height={793}
                priority
                className="h-8 w-auto max-w-full"
              />
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-text-secondary hover:bg-black/5 lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-2">
            <p className="px-2 pb-2 pt-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Playground
            </p>
            <ul className="flex flex-col gap-1">
              {PLAYGROUND_ITEMS.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    aria-current={activeKey === item.key ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      activeKey === item.key
                        ? "bg-primary-bg text-primary"
                        : "text-text-primary hover:bg-black/5",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="my-4 h-px bg-border" role="separator" />

            <ul className="flex flex-col gap-1">
              {SECONDARY_ITEMS.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    aria-current={activeKey === item.key ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      activeKey === item.key
                        ? "bg-primary-bg text-primary"
                        : "text-text-primary hover:bg-black/5",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </aside>
    </>
  );
}
