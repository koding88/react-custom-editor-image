import type { OutputData } from "@editorjs/editorjs";
import type { Layout } from "react-grid-layout/legacy";

export type MediaKind = "image" | "youtube";

export type MediaItem = {
  id: string;
  kind: MediaKind;
  url: string;
};

export type MediaLayoutData = {
  items: MediaItem[];
  layout: Layout;
};

export type PersistedState = {
  content: OutputData;
};
