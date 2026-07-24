"use client";

import { storageGet, storageSet } from "@/lib/storage";

export interface RecentItem {
  id: string;
  label: string;
  createdAt: string;
}

const MAX_ITEMS = 8;

export function pushRecentItem(key: string, item: RecentItem) {
  const existing = storageGet<RecentItem[]>(key, []);
  const next = [item, ...existing.filter((entry) => entry.id !== item.id)].slice(0, MAX_ITEMS);
  storageSet(key, next);
}

export function useRecentItemsSnapshot(key: string): RecentItem[] {
  return storageGet<RecentItem[]>(key, []);
}
