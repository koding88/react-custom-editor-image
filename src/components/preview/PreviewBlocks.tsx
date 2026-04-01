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
};

const normalizeListItem = (item: unknown): ListItemNode => {
  if (typeof item === "string") {
    return { content: item, items: [] };
  }
  const node = item as ListItemNode;
  return {
    content: typeof node?.content === "string" ? node.content : "",
    items: Array.isArray(node?.items) ? node.items : [],
  };
};

const renderListItems = (
  items: unknown[],
  ordered: boolean,
  blockId: string,
  depth = 0,
): React.ReactNode => {
  const Tag = ordered ? "ol" : "ul";
  const listClass = ordered
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
              ? renderListItems(parsed.items, ordered, blockId, depth + 1)
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
            style?: "ordered" | "unordered";
            items?: unknown[];
          };
          const items = listData.items ?? [];
          return (
            <div key={blockId}>
              {renderListItems(items, listData.style === "ordered", blockId)}
            </div>
          );
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
