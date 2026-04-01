import type { MediaItem } from "../../types/blog";

export const mediaTileFrameClassName =
  "h-full w-full overflow-hidden rounded-none border-0 bg-transparent shadow-none";

export const mediaTileContentClassName =
  "h-full w-full min-h-0 object-cover";

type MediaTileProps = {
  item: MediaItem;
  className?: string;
  mediaClassName?: string;
};

export function MediaTile({
  item,
  className = mediaTileFrameClassName,
  mediaClassName = mediaTileContentClassName,
}: MediaTileProps) {
  return (
    <div className={className}>
      {item.kind === "youtube" ? (
        <iframe
          src={item.url}
          title="YouTube video"
          className={mediaClassName}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <img
          src={item.url}
          alt="Media"
          className={mediaClassName}
        />
      )}
    </div>
  );
}
