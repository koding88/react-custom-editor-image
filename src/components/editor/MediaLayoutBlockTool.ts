import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import GridLayout, {
  WidthProvider,
  type Layout,
  type LayoutItem,
} from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import type { MediaItem, MediaLayoutData } from "../../types/blog";
import { compressImageDataUrl, toDataUrl } from "../../lib/media";
import {
  MediaTile,
  mediaTileContentClassName,
  mediaTileFrameClassName,
} from "../shared/MediaTile";

export type MediaLayoutToolConfig = {
  onChange?: (data: MediaLayoutData) => void;
};

type MediaLayoutToolData = MediaLayoutData;

const ensureData = (data?: Partial<MediaLayoutData>): MediaLayoutData => ({
  items: Array.isArray(data?.items) ? (data.items as MediaItem[]) : [],
  layout: Array.isArray(data?.layout) ? (data.layout as Layout) : [],
});

const buildSafeLayout = (items: MediaItem[], layout: Layout): Layout => {
  const ids = new Set(items.map((item) => item.id));
  return layout.filter((entry) => ids.has(entry.i));
};

const getImageDimensions = (
  url: string,
): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      });
    };
    image.onerror = () => reject(new Error("Khong doc duoc kich thuoc anh."));
    image.src = url;
  });

const pickDefaultLayout = async (
  id: string,
  url: string,
): Promise<LayoutItem> => {
  try {
    const { width, height } = await getImageDimensions(url);
    const ratio = width / Math.max(height, 1);

    if (ratio >= 1.45) {
      return { i: id, x: 0, y: Infinity, w: 7, h: 6 };
    }

    if (ratio <= 0.82) {
      return { i: id, x: 0, y: Infinity, w: 5, h: 10 };
    }

    return { i: id, x: 0, y: Infinity, w: 6, h: 8 };
  } catch {
    return { i: id, x: 0, y: Infinity, w: 6, h: 8 };
  }
};

class MediaLayoutTool {
  private data: MediaLayoutToolData;
  private config: MediaLayoutToolConfig;
  private container: HTMLDivElement | null = null;
  private fileEl: HTMLInputElement | null = null;
  private messageEl: HTMLDivElement | null = null;
  private reactMountEl: HTMLDivElement | null = null;
  private reactRoot: Root | null = null;
  private dragging = false;

  static get toolbox() {
    return {
      title: "Media Layout",
      icon: `<svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M3 3h18v18H3V3m2 2v6h6V5H5m8 0v6h6V5h-6M5 13v6h6v-6H5m8 6h6v-6h-6v6Z"/></svg>`,
    };
  }

  constructor({
    data,
    config,
  }: {
    data?: Partial<MediaLayoutData>;
    config?: MediaLayoutToolConfig;
  }) {
    this.data = ensureData(data);
    this.config = config ?? {};
  }

  render() {
    this.container = document.createElement("div");
    this.container.className = "ce-media-layout";

    this.fileEl = document.createElement("input");
    this.fileEl.type = "file";
    this.fileEl.accept = "image/*";
    this.fileEl.multiple = true;
    this.fileEl.className = "ce-media-layout__file";
    this.fileEl.hidden = true;
    this.fileEl.onchange = () => {
      void this.handleUploadLocal(Array.from(this.fileEl?.files ?? []));
    };

    this.messageEl = document.createElement("div");
    this.messageEl.className = "ce-media-layout__message";

    this.reactMountEl = document.createElement("div");
    this.reactMountEl.className = "ce-media-layout__react";

    this.container.appendChild(this.fileEl);
    this.container.appendChild(this.messageEl);
    this.container.appendChild(this.reactMountEl);
    this.renderReact();
    return this.container;
  }

  private publishChange() {
    const safeLayout = buildSafeLayout(this.data.items, this.data.layout);
    this.data.layout = safeLayout;
    this.config.onChange?.(this.data);
  }

  private showMessage(text: string) {
    if (!this.messageEl) return;
    this.messageEl.textContent = text;
  }

  private async appendItem(kind: MediaItem["kind"], url: string) {
    const id = `${kind}-${Date.now()}-${Math.floor(Math.random() * 99999)}`;
    const nextItem = await pickDefaultLayout(id, url);
    this.data.items.push({ id, kind, url });
    this.data.layout = [...this.data.layout, nextItem];
    this.renderReact();
    this.publishChange();
  }

  private async handleUploadLocal(files: File[]) {
    if (files.length === 0) return;

    try {
      for (const file of files) {
        const dataUrl = await toDataUrl(file);
        const compressed = await compressImageDataUrl(dataUrl);
        await this.appendItem("image", compressed);
      }
      this.showMessage(`Da them ${files.length} anh local.`);
    } catch {
      this.showMessage("Khong the xu ly file anh. Anh thu file khac nhe.");
    } finally {
      if (this.fileEl) this.fileEl.value = "";
    }
  }

  private remove(id: string) {
    this.data.items = this.data.items.filter((item) => item.id !== id);
    this.data.layout = this.data.layout.filter((entry) => entry.i !== id);
    this.renderReact();
    this.publishChange();
  }

  private renderReact() {
    if (!this.reactMountEl) return;
    if (!this.reactRoot) {
      this.reactRoot = createRoot(this.reactMountEl);
    }

    const EditableGrid = WidthProvider(GridLayout);

    const uploadBox = createElement(
      "button",
      {
        type: "button",
        className: `ce-dropzone ${this.dragging ? "ce-dropzone--active" : ""}`,
        onClick: () => this.fileEl?.click(),
        onDragOver: (event: unknown) => {
          const e = event as DragEvent;
          e.preventDefault();
          if (!this.dragging) {
            this.dragging = true;
            this.renderReact();
          }
        },
        onDragLeave: (event: unknown) => {
          const e = event as DragEvent;
          e.preventDefault();
          if (this.dragging) {
            this.dragging = false;
            this.renderReact();
          }
        },
        onDrop: (event: unknown) => {
          const e = event as DragEvent;
          e.preventDefault();
          this.dragging = false;
          const droppedFiles = Array.from(e.dataTransfer?.files ?? []);
          void this.handleUploadLocal(droppedFiles);
          this.renderReact();
        },
      },
      createElement(
        "span",
        { className: "ce-dropzone__title" },
        "Drop image files",
      ),
      createElement(
        "span",
        { className: "ce-dropzone__sub" },
        "Click de chon nhieu anh • Drag/resize media ngay trong block",
      ),
    );

    const gridChildren = this.data.items.map((item) =>
      createElement(
        "div",
        { key: item.id, className: "ce-grid-item" },
        createElement(
          "div",
          { className: "ce-grid-overlay" },
          createElement(
            "button",
            {
              type: "button",
              className: "ce-grid-remove",
              onClick: () => this.remove(item.id),
            },
            "×",
          ),
        ),
        createElement(MediaTile, {
          item,
          className: `${mediaTileFrameClassName} ce-grid-media-frame`,
          mediaClassName: `${mediaTileContentClassName} ce-grid-media`,
        }),
      ),
    );

    const grid = createElement(EditableGrid, {
      layout: this.data.layout,
      cols: 12,
      rowHeight: 26,
      margin: [12, 12],
      containerPadding: [0, 0],
      compactType: "vertical",
      preventCollision: false,
      onLayoutChange: (nextLayout: Layout) => {
        this.data.layout = nextLayout;
        this.publishChange();
      },
      draggableCancel: ".ce-grid-remove",
      resizeHandles: ["nw", "ne", "sw", "se"],
      children: gridChildren,
    });

    this.reactRoot.render(
      createElement(
        "div",
        { className: "ce-media-layout__content" },
        uploadBox,
        grid,
      ),
    );
  }

  save(): MediaLayoutToolData {
    return {
      items: this.data.items,
      layout: buildSafeLayout(this.data.items, this.data.layout),
    };
  }

  destroy() {
    this.reactRoot?.unmount();
    this.reactRoot = null;
  }
}

export default MediaLayoutTool;
