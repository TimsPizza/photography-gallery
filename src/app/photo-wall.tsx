"use client";

/* eslint-disable @next/next/no-img-element */

import FluidGlass from "@/components/FluidGlass";
import { OriginalPhotoViewer } from "@/components/original-photo-viewer";
import { EmptyState } from "@/components/ui";
import { StoredPhotoMetadata } from "@/contracts/photo";
import { usePhotoWallController } from "@/controllers/use-photo-wall-controller";
import {
  getPhotoDate,
  TimelinePhotoLayout,
  TimelinePhotoRow,
} from "@/lib/photo-layout";
import { getPhotoThumbnailUrl } from "@/lib/photo-url";
import type { CSSProperties } from "react";
import { memo } from "react";

type PhotoWallProps = {
  photos: StoredPhotoMetadata[];
  dimmed?: boolean;
};

export function PhotoWall({ photos, dimmed = false }: PhotoWallProps) {
  const {
    activePhoto,
    closePhoto,
    containerRef,
    isEmpty,
    openPhoto,
    rowsWithMarkers,
  } = usePhotoWallController(photos);

  if (isEmpty) {
    return (
      <EmptyState className="min-h-[42vh]">No photos yet.</EmptyState>
    );
  }

  return (
    <section
      className={`relative transition-[opacity,filter] duration-[260ms] ${
        dimmed ? "opacity-70 saturate-[0.82]" : ""
      }`}
      ref={containerRef}
    >
      <FluidGlass
        className="pointer-events-none absolute top-0 bottom-0 left-[-2.85rem] z-[1] w-[1.55rem] rounded-full border border-white/20 opacity-60"
        mode="bar"
        barProps={{
          scale: 0.08,
          thickness: 8,
          chromaticAberration: 0.05,
          attenuationDistance: 0.3,
        }}
      />
      <div className="grid gap-[clamp(0.55rem,1.4vw,0.95rem)] max-[780px]:gap-[0.65rem]">
        {rowsWithMarkers.map(({ row, label }) => (
          <div className="relative" key={row.key}>
            {label && (
              <div className="pointer-events-none absolute top-4 left-[-2.5rem] z-[11] flex min-h-full flex-col items-center gap-2 text-[#686258] opacity-80 transition-opacity duration-300 hover:opacity-100 dark:text-[#9c9586]">
                <span className="w-px flex-1 bg-gradient-to-b from-[#686258] to-transparent opacity-30 dark:from-[#9c9586]" />
                <p className="rotate-180 text-[0.85rem] font-medium tracking-[0.1em] [writing-mode:vertical-rl]">
                  {label}
                </p>
              </div>
            )}
            <PhotoRow row={row} onOpen={openPhoto} />
          </div>
        ))}
      </div>

      {activePhoto ? (
        <OriginalPhotoViewer photo={activePhoto} onClose={closePhoto} />
      ) : null}
    </section>
  );
}

const PhotoRow = memo(function PhotoRow({
  row,
  onOpen,
}: {
  row: TimelinePhotoRow;
  onOpen: (photo: StoredPhotoMetadata) => void;
}) {
  return (
    <div
      className="flex h-[var(--row-height)] w-full gap-[var(--row-gap)] [contain-intrinsic-size:auto_var(--row-height)] [content-visibility:auto] max-[780px]:gap-[0.65rem]"
      style={
        {
          "--row-gap": `${row.gap}px`,
          "--row-height": `${row.height}px`,
        } as CSSProperties
      }
    >
      {row.photos.map((item) => (
        <PhotoTile item={item} key={item.photo.fileId} onOpen={onOpen} />
      ))}
    </div>
  );
});

const PhotoTile = memo(function PhotoTile({
  item,
  onOpen,
}: {
  item: TimelinePhotoLayout;
  onOpen: (photo: StoredPhotoMetadata) => void;
}) {
  return (
    <button
      className="group relative h-[var(--tile-height)] w-[var(--tile-width)] min-w-0 flex-[0_0_var(--tile-width)] cursor-zoom-in overflow-hidden rounded-sm border-0 bg-[rgb(38_34_28_/_5%)] p-0 shadow-[0_4px_12px_rgb(0_0_0_/_2%)] [backface-visibility:hidden] [transform:translateZ(0)] transition-shadow duration-300 hover:z-[2] hover:shadow-[0_12px_24px_rgb(0_0_0_/_8%)]"
      data-emphasis={item.emphasis}
      onClick={() => onOpen(item.photo)}
      style={
        {
          "--tile-width": `${item.width}px`,
          "--tile-height": `${item.height}px`,
        } as CSSProperties
      }
      type="button"
    >
      <img
        className="block h-full w-full object-cover [backface-visibility:hidden] [transform:translateZ(0)] transition-[transform,filter] duration-[600ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] will-change-transform group-hover:scale-[1.02] group-hover:contrast-[1.02] group-hover:saturate-[1.05]"
        alt={item.photo.originalFileName}
        loading="lazy"
        decoding="async"
        src={getPhotoThumbnailUrl(item.photo)}
      />
      <span className="absolute bottom-3 left-3 translate-y-[0.3rem] rounded-md bg-white/30 px-2 py-1 text-xs font-medium text-[#1d1b18] opacity-0 shadow-[0_2px_8px_rgb(0_0_0_/_5%)] backdrop-blur-xl transition-[opacity,transform] duration-[250ms] group-hover:translate-y-0 group-hover:opacity-100 dark:text-[#eae6db]">
        {formatDayLabel(getPhotoDate(item.photo))}
      </span>
    </button>
  );
});

const dayLabelFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
});

function formatDayLabel(date: Date) {
  return dayLabelFormatter.format(date);
}
