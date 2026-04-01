import type { OutputData } from "@editorjs/editorjs";
import type { Layout } from "react-grid-layout/legacy";
import type { MediaItem } from "../types/blog";

export const STORAGE_KEY = "react-editor:blog-state-v2";

export const initialContent: OutputData = {
  time: Date.now(),
  blocks: [
    {
      id: "intro-header",
      type: "header",
      data: { text: "Blog editor canvas", level: 2 },
    },
    {
      id: "intro-paragraph",
      type: "paragraph",
      data: {
        text: "Ben trai la khu vuc editor (text + media). Ben phai la preview tuong ung theo dung bo cuc.",
      },
    },
    {
      id: "media-layout-block",
      type: "mediaLayout",
      data: {
        items: [],
        layout: [],
      },
    },
  ],
};

export const defaultMedia: MediaItem[] = [];

export const defaultLayout: Layout = [];
