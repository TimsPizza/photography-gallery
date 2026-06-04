"use client";

/* eslint-disable @next/next/no-img-element */

import { StoredPhotoMetadata } from "@/contracts/photo";
import { usePhotoWallController } from "@/controllers/use-photo-wall-controller";
import { getPhotoDate, TimelinePhotoLayout, TimelinePhotoRow } from "@/lib/photo-layout";
import { getPhotoThumbnailUrl } from "@/lib/photo-url";
import FluidGlass from "@/components/FluidGlass";
import type { CSSProperties } from "react";
import { memo } from "react";

type PhotoWallProps = {
  photos: StoredPhotoMetadata[];
};

export function PhotoWall({ photos }: PhotoWallProps) {
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
      <section className="timeline-empty">
        <p>No photos yet.</p>
      </section>
    );
  }

  return (
    <section className="timeline-wall" ref={containerRef}>
      <FluidGlass
        className="timeline-rail-glass"
        mode="bar"
        barProps={{
          scale: 0.08,
          thickness: 8,
          chromaticAberration: 0.05,
          attenuationDistance: 0.3,
        }}
      />
      <div className="photo-grid">
        {rowsWithMarkers.map(({ row, label }) => (
          <div key={row.key} style={{ position: "relative" }}>
            {label && (
              <div className="timeline-marker">
                <span />
                <p>{label}</p>
              </div>
            )}
            <PhotoRow row={row} onOpen={openPhoto} />
          </div>
        ))}
      </div>

      {activePhoto ? (
        <PhotoOverlay
          photo={activePhoto}
          onClose={closePhoto}
        />
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
      className="photo-row"
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
      className="photo-tile"
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
        alt={item.photo.originalFileName}
        loading="lazy"
        decoding="async"
        src={getPhotoThumbnailUrl(item.photo)}
      />
      <span>{formatDayLabel(getPhotoDate(item.photo))}</span>
    </button>
  );
});

function PhotoOverlay({
  photo,
  onClose,
}: {
  photo: StoredPhotoMetadata;
  onClose: () => void;
}) {
  return (
    <div className="photo-overlay" role="dialog" aria-modal="true">
      <button
        className="overlay-backdrop"
        aria-label="Close photo"
        onClick={onClose}
        type="button"
      />
      <figure>
        <img alt={photo.originalFileName} src={photo.fileUrl} />
        <figcaption>
          <span>{formatFullDate(getPhotoDate(photo))}</span>
          <strong>{photo.originalFileName}</strong>
        </figcaption>
      </figure>
    </div>
  );
}

const dayLabelFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
});

function formatDayLabel(date: Date) {
  return dayLabelFormatter.format(date);
}

const fullDateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatFullDate(date: Date) {
  return fullDateFormatter.format(date);
}
