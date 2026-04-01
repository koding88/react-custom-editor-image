import type { CSSProperties } from "react";
import type { Layout } from "react-grid-layout/legacy";
import type { MediaItem } from "../../types/blog";
import {
  MediaTile,
  mediaTileContentClassName,
  mediaTileFrameClassName,
} from "../shared/MediaTile";

type PreviewMediaProps = {
  media: MediaItem[];
  layout: Layout;
};

const ROW_HEIGHT = 26;
const GAP = 12;

const compareLayout = (
  a?: { x?: number; y?: number },
  b?: { x?: number; y?: number },
) => {
  const yDiff = (a?.y ?? 0) - (b?.y ?? 0);
  if (yDiff !== 0) {
    return yDiff;
  }

  return (a?.x ?? 0) - (b?.x ?? 0);
};

export function PreviewMedia({ media, layout }: PreviewMediaProps) {
  if (media.length === 0) {
    return null;
  }

  const layoutMap = new Map(layout.map((entry) => [entry.i, entry]));
  const sortedMedia = [...media].sort((first, second) =>
    compareLayout(layoutMap.get(first.id), layoutMap.get(second.id)),
  );

  return (
    <div
      className="grid grid-cols-12"
      style={{
        gap: `${GAP}px`,
        gridAutoRows: `${ROW_HEIGHT}px`,
      }}
    >
      {sortedMedia.map((item) => {
        const entry = layoutMap.get(item.id);
        const style: CSSProperties | undefined = entry
          ? {
              gridColumn: `${entry.x + 1} / span ${entry.w}`,
              gridRow: `${entry.y + 1} / span ${entry.h}`,
            }
          : undefined;
        return (
          <div key={item.id} style={style} className="min-w-0">
            <MediaTile
              item={item}
              className={mediaTileFrameClassName}
              mediaClassName={mediaTileContentClassName}
            />
          </div>
        );
      })}
    </div>
  );
}
