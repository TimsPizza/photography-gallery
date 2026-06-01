"use client";

import { StoredPhotoMetadata } from "@/contracts/photo";
import {
  calculateTimelineRows,
  getPhotoDate,
  TimelinePhotoRow,
} from "@/lib/photo-layout";
import { useEffect, useMemo, useRef, useState } from "react";

type TimelineRowWithMarker = {
  row: TimelinePhotoRow;
  label: string | null;
};

const monthLabelFormatter = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
});

export function usePhotoWallController(photos: StoredPhotoMetadata[]) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1120);
  const [activePhoto, setActivePhoto] = useState<StoredPhotoMetadata | null>(
    null,
  );

  const rows = useMemo(
    () => calculateTimelineRows(photos, containerWidth),
    [containerWidth, photos],
  );

  const rowsWithMarkers = useMemo<TimelineRowWithMarker[]>(() => {
    type AccType = TimelineRowWithMarker & { markerKey?: string };

    return rows.map((row, index) => {
      if (!row.photos.length) {
        return { row, label: null };
      }

      const date = getPhotoDate(row.photos[0].photo);
      const markerKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const previous = index > 0 ? rows[index - 1] : null;
      const previousDate = previous?.photos[0]
        ? getPhotoDate(previous.photos[0].photo)
        : null;
      const previousKey = previousDate
        ? `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}`
        : "";

      return {
        row,
        label:
          markerKey === previousKey ? null : monthLabelFormatter.format(date),
        markerKey,
      } satisfies AccType;
    });
  }, [rows]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  return {
    activePhoto,
    closePhoto: () => setActivePhoto(null),
    containerRef,
    isEmpty: photos.length === 0,
    openPhoto: setActivePhoto,
    rowsWithMarkers,
  };
}
