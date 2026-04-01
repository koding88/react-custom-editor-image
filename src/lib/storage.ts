import type { Layout, LayoutItem } from "react-grid-layout/legacy";
import { initialContent, STORAGE_KEY } from "./constants";
import type { PersistedState } from "../types/blog";

const isLayoutItem = (item: unknown): item is LayoutItem => {
  const value = item as LayoutItem | null;
  return Boolean(
    value &&
    typeof value.i === "string" &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    typeof value.w === "number" &&
    typeof value.h === "number",
  );
};

const isMediaLayoutBlock = (block: unknown): boolean => {
  const value = block as {
    type?: string;
    data?: { items?: unknown[]; layout?: unknown[] };
  } | null;
  if (!value || value.type !== "mediaLayout") {
    return false;
  }
  const items = value.data?.items;
  const layout = value.data?.layout;
  if (!Array.isArray(items) || !Array.isArray(layout)) {
    return false;
  }
  return layout.every(isLayoutItem);
};

export const loadPersistedState = (): PersistedState | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const content = parsed.content?.blocks ? parsed.content : initialContent;

    const normalizedBlocks = content.blocks.map((block) => {
      if (!isMediaLayoutBlock(block)) {
        return block;
      }
      const data = block.data as { items: unknown[]; layout: Layout };
      const items = (data.items ?? []).filter(
        (
          item,
        ): item is { id: string; kind: "image" | "youtube"; url: string } =>
          typeof (item as { id?: string }).id === "string" &&
          typeof (item as { url?: string }).url === "string" &&
          ((item as { kind?: string }).kind === "image" ||
            (item as { kind?: string }).kind === "youtube"),
      );
      const layout = (data.layout ?? []).filter(isLayoutItem);
      const ids = new Set(items.map((item) => item.id));
      return {
        ...block,
        data: {
          items,
          layout: layout.filter((entry) => ids.has(entry.i)),
        },
      };
    });

    return { content: { ...content, blocks: normalizedBlocks } };
  } catch {
    return null;
  }
};

export const persistState = (snapshot: PersistedState): string | null => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    return null;
  } catch {
    const fallbackContent = {
      ...snapshot.content,
      blocks: snapshot.content.blocks.map((block) => {
        if (block.type !== "mediaLayout") {
          return block;
        }
        const data = block.data as {
          items?: Array<{ id: string; kind: "image" | "youtube"; url: string }>;
          layout?: Layout;
        };
        const filteredItems = (data.items ?? []).filter(
          (item) => !item.url.startsWith("data:"),
        );
        const ids = new Set(filteredItems.map((item) => item.id));
        const filteredLayout = (data.layout ?? []).filter((entry) =>
          ids.has(entry.i),
        );
        return {
          ...block,
          data: {
            items: filteredItems,
            layout: filteredLayout,
          },
        };
      }),
    };

    const fallbackPayload: PersistedState = { content: fallbackContent };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackPayload));
      return "Bo nho localStorage day: anh local khong duoc giu sau khi reload.";
    } catch {
      return "Khong the luu localStorage. Anh thu giam media hoac dung link.";
    }
  }
};

export const clearPersistedState = () => {
  window.localStorage.removeItem(STORAGE_KEY);
};
