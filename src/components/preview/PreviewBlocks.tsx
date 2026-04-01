import type { OutputData } from "@editorjs/editorjs";
import type { MediaLayoutData } from "../../types/blog";
import { renderInlineHtml } from "../../lib/richText";

type PreviewBlocksProps = {
  content: OutputData;
  renderMediaLayout?: (
    data: MediaLayoutData,
    blockId: string,
  ) => React.ReactNode;
};

type ListItemNode = {
  content?: string;
  items?: ListItemNode[];
  meta?: {
    checked?: boolean;
  };
};

const normalizeListItem = (item: unknown): ListItemNode => {
  if (typeof item === "string") {
    return { content: item, items: [] };
  }
  const node = item as ListItemNode;
  return {
    content: typeof node?.content === "string" ? node.content : "",
    items: Array.isArray(node?.items) ? node.items : [],
    meta:
      node?.meta && typeof node.meta === "object"
        ? { checked: node.meta.checked === true }
        : undefined,
  };
};

const getYouTubeEmbedUrl = (source?: string, embed?: string): string | null => {
  if (typeof source === "string") {
    const match = source.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&?/]+)/,
    );
    if (match?.[1]) {
      return `https://www.youtube-nocookie.com/embed/${match[1]}?rel=0&modestbranding=1`;
    }
  }

  if (typeof embed === "string" && embed.length > 0) {
    return embed.replace("https://www.youtube.com/embed/", "https://www.youtube-nocookie.com/embed/");
  }

  return null;
};

const renderListItems = (
  items: unknown[],
  style: "ordered" | "unordered" | "checklist",
  blockId: string,
  depth = 0,
): React.ReactNode => {
  if (style === "checklist") {
    return (
      <ul className="my-4 space-y-3">
        {items.map((item, idx) => {
          const parsed = normalizeListItem(item);
          const key = `${blockId}-${depth}-${idx}`;
          return (
            <li key={key} className="flex gap-3 text-slate-700">
              <span
                aria-hidden="true"
                className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-xl border text-sm ${
                  parsed.meta?.checked
                    ? "border-sky-500 bg-sky-500 text-white"
                    : "border-slate-300 bg-white text-transparent"
                }`}
              >
                ✓
              </span>
              <span className="min-w-0 flex-1">
                {renderInlineHtml(parsed.content ?? "")}
                {Array.isArray(parsed.items) && parsed.items.length > 0
                  ? renderListItems(parsed.items, style, blockId, depth + 1)
                  : null}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  const Tag = style === "ordered" ? "ol" : "ul";
  const listClass =
    style === "ordered"
      ? "my-4 list-decimal space-y-2 pl-6 text-slate-700 marker:text-slate-400"
      : "my-4 list-disc space-y-2 pl-6 text-slate-700 marker:text-slate-400";

  return (
    <Tag className={listClass}>
      {items.map((item, idx) => {
        const parsed = normalizeListItem(item);
        const key = `${blockId}-${depth}-${idx}`;
        return (
          <li key={key}>
            {renderInlineHtml(parsed.content ?? "")}
            {Array.isArray(parsed.items) && parsed.items.length > 0
              ? renderListItems(parsed.items, style, blockId, depth + 1)
              : null}
          </li>
        );
      })}
    </Tag>
  );
};

export function PreviewBlocks({
  content,
  renderMediaLayout,
}: PreviewBlocksProps) {
  return (
    <>
      {content.blocks.map((block, index) => {
        const blockId = block.id ?? `block-${index}`;
        if (block.type === "mediaLayout") {
          if (!renderMediaLayout) {
            return null;
          }
          return renderMediaLayout(block.data as MediaLayoutData, blockId);
        }

        if (block.type === "header") {
          const level = Number((block.data as { level?: number }).level ?? 2);
          const rich = renderInlineHtml(
            String((block.data as { text?: string }).text ?? ""),
          );
          const tag = Math.min(Math.max(level, 1), 6);
          if (tag === 1)
            return (
              <h1
                key={blockId}
                className="mb-4 text-4xl font-semibold tracking-tight text-slate-950"
              >
                {rich}
              </h1>
            );
          if (tag === 2)
            return (
              <h2
                key={blockId}
                className="mb-4 text-3xl font-semibold tracking-tight text-slate-950"
              >
                {rich}
              </h2>
            );
          if (tag === 3)
            return (
              <h3
                key={blockId}
                className="mb-3 text-2xl font-semibold tracking-tight text-slate-900"
              >
                {rich}
              </h3>
            );
          if (tag === 4)
            return (
              <h4 key={blockId} className="mb-3 text-xl font-semibold text-slate-900">
                {rich}
              </h4>
            );
          if (tag === 5)
            return (
              <h5 key={blockId} className="mb-3 text-lg font-semibold text-slate-900">
                {rich}
              </h5>
            );
          return (
            <h6
              key={blockId}
              className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500"
            >
              {rich}
            </h6>
          );
        }

        if (block.type === "list") {
          const listData = block.data as {
            style?: "ordered" | "unordered" | "checklist";
            items?: unknown[];
          };
          const items = listData.items ?? [];
          const style = listData.style ?? "unordered";
          return (
            <div key={blockId}>
              {renderListItems(items, style, blockId)}
            </div>
          );
        }

        if (block.type === "youtube" || block.type === "embed") {
          const embedData = block.data as {
            service?: string;
            source?: string;
            embed?: string;
            caption?: string;
          };

          const youtubeUrl =
            embedData.service === "youtube" || block.type === "youtube"
              ? getYouTubeEmbedUrl(embedData.source, embedData.embed)
              : null;

          if (youtubeUrl) {
            return (
              <figure key={blockId} className="my-6">
                <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-950 shadow-[0_18px_50px_rgba(15,23,42,0.14)]">
                  <div className="relative w-full pt-[56.25%]">
                    <iframe
                      src={youtubeUrl}
                      title={embedData.caption || "YouTube video"}
                      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute inset-0 h-full w-full border-0"
                    />
                  </div>
                </div>
                {embedData.caption ? (
                  <figcaption className="mt-3 text-sm leading-6 text-slate-500">
                    {renderInlineHtml(embedData.caption)}
                  </figcaption>
                ) : null}
              </figure>
            );
          }
        }

        const rich = renderInlineHtml(
          String((block.data as { text?: string }).text ?? ""),
        );
        return (
          <p key={blockId} className="mb-4 text-[15px] leading-8 text-slate-700">
            {rich}
          </p>
        );
      })}
    </>
  );
}
