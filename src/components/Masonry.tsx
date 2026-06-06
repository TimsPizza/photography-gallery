"use client";

/* eslint-disable @next/next/no-img-element */

import { gsap } from "gsap";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const COLUMN_QUERIES = [
  "(min-width: 1500px)",
  "(min-width: 1000px)",
  "(min-width: 600px)",
  "(min-width: 400px)",
];
const COLUMN_VALUES = [5, 4, 3, 2];
const GRID_GAP = 16;

export type MasonryItem = {
  id: string;
  img: string;
  height: number;
  aspectRatio?: number;
  alt?: string;
};

type GridItem = MasonryItem & {
  x: number;
  y: number;
  width: number;
  renderedHeight: number;
};

type AnimateFrom = "bottom" | "top" | "left" | "right" | "center" | "random";

type MasonryProps = {
  items: MasonryItem[];
  ease?: string;
  duration?: number;
  stagger?: number;
  animateFrom?: AnimateFrom;
  scaleOnHover?: boolean;
  hoverScale?: number;
  blurToFocus?: boolean;
  colorShiftOnHover?: boolean;
  onItemClick?: (item: MasonryItem) => void;
};

function getColumnCount() {
  if (typeof window === "undefined") return 1;

  const index = COLUMN_QUERIES.findIndex((query) => matchMedia(query).matches);
  return index === -1 ? 1 : COLUMN_VALUES[index];
}

function useColumnCount() {
  const [columns, setColumns] = useState(getColumnCount);

  useEffect(() => {
    const mediaQueries = COLUMN_QUERIES.map((query) => matchMedia(query));
    const update = () => setColumns(getColumnCount());

    mediaQueries.forEach((query) => query.addEventListener("change", update));
    return () => {
      mediaQueries.forEach((query) =>
        query.removeEventListener("change", update),
      );
    };
  }, []);

  return columns;
}

function useMeasure<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

function preloadImages(urls: string[]) {
  return Promise.all(
    urls.map(
      (src) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          image.onload = image.onerror = () => resolve();
          image.src = src;
        }),
    ),
  );
}

function chooseAnimationDirection(direction: AnimateFrom) {
  if (direction !== "random") return direction;
  const directions = ["top", "bottom", "left", "right"] as const;
  return directions[Math.floor(Math.random() * directions.length)];
}

export default function Masonry({
  items,
  ease = "power3.out",
  duration = 0.6,
  stagger = 0.05,
  animateFrom = "bottom",
  scaleOnHover = true,
  hoverScale = 0.96,
  blurToFocus = true,
  colorShiftOnHover = false,
  onItemClick,
}: MasonryProps) {
  const columns = useColumnCount();
  const [containerRef, width] = useMeasure<HTMLDivElement>();
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const hasMounted = useRef(false);
  const imageSignature = useMemo(
    () => items.map((item) => item.img).join("\n"),
    [items],
  );
  const [readySignature, setReadySignature] = useState("");
  const imagesReady = readySignature === imageSignature;

  useEffect(() => {
    let active = true;
    void preloadImages(items.map((item) => item.img)).then(() => {
      if (active) setReadySignature(imageSignature);
    });
    return () => {
      active = false;
    };
  }, [imageSignature, items]);

  const { grid, height } = useMemo(() => {
    if (!width || items.length === 0) {
      return { grid: [] as GridItem[], height: 0 };
    }

    const columnHeights = new Array(columns).fill(0) as number[];
    const columnWidth = (width - (columns - 1) * GRID_GAP) / columns;
    const nextGrid = items.map((item) => {
      const column = columnHeights.indexOf(Math.min(...columnHeights));
      const renderedHeight = item.aspectRatio
        ? columnWidth / item.aspectRatio
        : item.height / 2;
      const gridItem = {
        ...item,
        x: column * (columnWidth + GRID_GAP),
        y: columnHeights[column],
        width: columnWidth,
        renderedHeight,
      };

      columnHeights[column] += renderedHeight + GRID_GAP;
      return gridItem;
    });

    return {
      grid: nextGrid,
      height: Math.max(...columnHeights, 0) - GRID_GAP,
    };
  }, [columns, items, width]);

  useLayoutEffect(() => {
    if (!imagesReady || grid.length === 0) return;

    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const container = containerRef.current;
    const animations: gsap.core.Tween[] = [];

    grid.forEach((item, index) => {
      const element = itemRefs.current.get(item.id);
      if (!element) return;

      const destination = {
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.renderedHeight,
      };

      if (!hasMounted.current && !reduceMotion) {
        const direction = chooseAnimationDirection(animateFrom);
        const bounds = container?.getBoundingClientRect();
        const start = {
          x:
            direction === "left"
              ? -item.width - 80
              : direction === "right"
                ? (bounds?.width ?? window.innerWidth) + 80
                : direction === "center"
                  ? ((bounds?.width ?? 0) - item.width) / 2
                  : item.x,
          y:
            direction === "top"
              ? -item.renderedHeight - 80
              : direction === "bottom"
                ? window.innerHeight + 120
                : direction === "center"
                  ? ((bounds?.height ?? 0) - item.renderedHeight) / 2
                  : item.y,
        };

        animations.push(
          gsap.fromTo(
            element,
            {
              ...start,
              opacity: 0,
              filter: blurToFocus ? "blur(10px)" : "none",
            },
            {
              ...destination,
              opacity: 1,
              filter: "blur(0px)",
              duration: 0.8,
              ease: "power3.out",
              delay: index * stagger,
            },
          ),
        );
      } else {
        animations.push(
          gsap.to(element, {
            ...destination,
            opacity: 1,
            filter: "blur(0px)",
            duration: reduceMotion ? 0 : duration,
            ease,
            overwrite: "auto",
          }),
        );
      }
    });

    hasMounted.current = true;
    return () => animations.forEach((animation) => animation.kill());
  }, [
    animateFrom,
    blurToFocus,
    containerRef,
    duration,
    ease,
    grid,
    imagesReady,
    stagger,
  ]);

  return (
    <div
      className="relative min-h-[40vh] w-full transition-[height] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
      ref={containerRef}
      style={{ height: height > 0 ? `${height}px` : undefined }}
    >
      {grid.map((item) => (
        <button
          aria-label={`Open ${item.alt ?? "photo"}`}
          className="absolute top-0 left-0 origin-center cursor-zoom-in overflow-hidden rounded-md border-0 bg-[rgb(255_252_244_/_68%)] p-0 shadow-[0_14px_42px_rgb(30_25_19_/_12%)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1d1b18] dark:bg-[rgb(34_31_27_/_68%)] dark:focus-visible:outline-[#eae6db]"
          key={item.id}
          onClick={() => onItemClick?.(item)}
          onMouseEnter={(event) => {
            if (scaleOnHover) {
              gsap.to(event.currentTarget, {
                scale: hoverScale,
                duration: 0.3,
                ease: "power2.out",
              });
            }
            if (colorShiftOnHover) {
              gsap.to(event.currentTarget.querySelector(".color-overlay"), {
                opacity: 0.3,
                duration: 0.3,
              });
            }
          }}
          onMouseLeave={(event) => {
            if (scaleOnHover) {
              gsap.to(event.currentTarget, {
                scale: 1,
                duration: 0.3,
                ease: "power2.out",
              });
            }
            if (colorShiftOnHover) {
              gsap.to(event.currentTarget.querySelector(".color-overlay"), {
                opacity: 0,
                duration: 0.3,
              });
            }
          }}
          ref={(element) => {
            if (element) itemRefs.current.set(item.id, element);
            else itemRefs.current.delete(item.id);
          }}
          style={{
            width: item.width,
            height: item.renderedHeight,
            willChange: "transform, width, height, opacity, filter",
          }}
          type="button"
        >
          <img
            className="block h-full w-full object-cover"
            alt={item.alt ?? ""}
            decoding="async"
            loading="lazy"
            src={item.img}
          />
          {colorShiftOnHover ? (
            <span className="color-overlay pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(45deg,rgb(236_72_153_/_50%),rgb(14_165_233_/_50%))] opacity-0" />
          ) : null}
        </button>
      ))}
    </div>
  );
}
