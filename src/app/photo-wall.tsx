"use client";

/* eslint-disable @next/next/no-img-element */

import { StoredPhotoMetadata } from "@/contracts/photo";
import {
  calculateTimelineRows,
  getPhotoDate,
  TimelinePhotoLayout,
  TimelinePhotoRow,
} from "@/lib/photo-layout";
import type { CSSProperties } from "react";
import { memo, useEffect, useMemo, useRef, useState } from "react";

type PhotoWallProps = {
  photos: StoredPhotoMetadata[];
};

const monthLabelFormatter = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
});

export function PhotoWall({ photos }: PhotoWallProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1120);
  const [activePhoto, setActivePhoto] = useState<StoredPhotoMetadata | null>(
    null,
  );

  const rows = useMemo(
    () => calculateTimelineRows(photos, containerWidth),
    [containerWidth, photos],
  );

  const rowsWithMarkers = useMemo(() => {
    type AccType = { row: TimelinePhotoRow; label: string | null; _key?: string };
    return rows.reduce<AccType[]>(
      (acc, row) => {
        if (!row.photos.length) {
          acc.push({ row, label: null });
          return acc;
        }
        const date = getPhotoDate(row.photos[0].photo);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const lastKey = acc.length > 0 ? acc[acc.length - 1]._key : "";
        let label = null;
        if (key !== lastKey) {
          label = monthLabelFormatter.format(date);
        }
        acc.push({ row, label, _key: key });
        return acc;
      },
      [],
    );
  }, [rows]);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  if (photos.length === 0) {
    return (
      <section className="timeline-empty">
        <p>No photos yet.</p>
      </section>
    );
  }

  return (
    <section className="timeline-wall" ref={containerRef}>
      <div className="photo-grid">
        {rowsWithMarkers.map(({ row, label }) => (
          <div key={row.key} style={{ position: "relative" }}>
            {label && (
              <div className="timeline-marker">
                <span />
                <p>{label}</p>
              </div>
            )}
            <PhotoRow row={row} onOpen={setActivePhoto} />
          </div>
        ))}
      </div>

      {activePhoto ? (
        <PhotoOverlay
          photo={activePhoto}
          onClose={() => setActivePhoto(null)}
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
        <PhotoTile item={item} key={item.photo.id} onOpen={onOpen} />
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
        src={getThumbnailUrl(item.photo)}
      />
      <span>{formatDayLabel(getPhotoDate(item.photo))}</span>
    </button>
  );
});

function getThumbnailUrl(photo: StoredPhotoMetadata) {
  const finalName = photo.finalFileName;
  const baseName = finalName.includes(".")
    ? finalName.substring(0, finalName.lastIndexOf("."))
    : finalName;
  const thumbName = `thumbnail_${baseName}.webp`;
  return photo.fileUrl.replace(finalName, thumbName);
}

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
