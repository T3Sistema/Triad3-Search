import type { LucideIcon } from "lucide-react";
import { Activity, BookOpen, FileSearch, Globe, History, Search, Sparkles, Waypoints } from "lucide-react";

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

export const NEO_ITEM: NavItem = {
  key: "neo",
  label: "Neo",
  href: "/neo",
  icon: Sparkles,
  description: "Análise conversacional inteligente",
};

export const PLAYGROUND_ITEMS: NavItem[] = [
  { key: "scrape", label: "Capturar", href: "/", icon: Globe, description: "Captura páginas em múltiplos formatos" },
  { key: "extract", label: "Extrair", href: "/extract", icon: FileSearch, description: "Extração estruturada com IA" },
  { key: "search", label: "Pesquisar", href: "/search", icon: Search, description: "Busca na web com resultados processados" },
  { key: "crawl", label: "Mapear site", href: "/crawl", icon: Waypoints, description: "Rastreamento de múltiplas páginas" },
  { key: "monitor", label: "Monitorar", href: "/monitor", icon: Activity, description: "Monitoramento agendado de páginas" },
];

export const SECONDARY_ITEMS: NavItem[] = [
  { key: "history", label: "Histórico", href: "/history", icon: History, description: "Requisições realizadas" },
  { key: "docs", label: "Ajuda", href: "/docs", icon: BookOpen, description: "Como usar o Triad3 Search" },
];

export const ALL_NAV_ITEMS = [NEO_ITEM, ...PLAYGROUND_ITEMS, ...SECONDARY_ITEMS];

export function findActiveNavKey(pathname: string): string {
  const exactMatch = ALL_NAV_ITEMS.find((item) => item.href === pathname);
  if (exactMatch) return exactMatch.key;
  const prefixMatch = ALL_NAV_ITEMS
    .filter((item) => item.href !== "/")
    .find((item) => pathname.startsWith(item.href));
  return prefixMatch?.key ?? "scrape";
}
