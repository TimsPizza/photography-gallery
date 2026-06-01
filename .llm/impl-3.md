# Implementation Log 3

- Time: 2026-05-31T21:19:00Z
- Base Commit: 290202864cfaf49939c104eda60a42f23647c898
- Head Commit: Working Tree (Uncommitted)

## Tasks Completed in this Cycle (3)

1. Fix timeline indicator layout and unified photo grid rows
2. Fix scrolling jank and checkerboarding by forcing GPU compositing on photo tiles
3. Integrate ReactLenis and optimize rendering: async img decode, React.memo, and content-visibility

## High-level Summary

- Rewrote the CSS for `timeline-wall` to use `position: relative` instead of grid columns, preventing space starvation.
- Altered `PhotoTile` tiles to use strict 3D transforms to force GPU compositing, eliminating the white flash on scrolling.
- Lifted `Intl.DateTimeFormat` constructors out of hot rendering paths to stop aggressive layout thrashing.
- Introduced `lenis` for smooth scrolling wrapper (`SmoothScroll`).
- Wrapped `PhotoRow` and `PhotoTile` in `React.memo` to kill cascading re-renders when setting active photos.
- Appended `content-visibility: auto` to photo rows to clip DOM cost offscreen.

## Changes Since Last Snapshot

### File Changes

```
 M src/app/globals.css
 M src/app/layout.tsx
 M src/app/page.tsx
 M package.json
 M pnpm-lock.yaml
?? src/app/smooth-scroll.tsx
?? src/app/photo-wall.tsx
?? src/lib/photo-layout.ts
```

### Key Patches (Trimmed)

```diff
--- a/src/app/globals.css
+++ b/src/app/globals.css
+.timeline-marker {
+  position: absolute;
+  left: 1rem;
+  top: 1rem;
+  z-index: 10;
+}
+
+.photo-row {
+  display: flex;
+  gap: var(--row-gap);
+  width: 100%;
+  height: var(--row-height);
+  content-visibility: auto;
+  contain-intrinsic-size: auto var(--row-height);
+}
+
+.photo-tile img {
+  width: 100%;
+  height: 100%;
+  display: block;
+  object-fit: cover;
+  transform: translateZ(0);
+  backface-visibility: hidden;
+  will-change: transform;
+}
--- a/src/app/photo-wall.tsx
+++ b/src/app/photo-wall.tsx
+const PhotoTile = memo(function PhotoTile(...) { ... })
+const PhotoRow = memo(function PhotoRow(...) { ... })
+      <img decoding="async" loading="lazy" ... />
```

## Decisions & Rationale

- Grid calculation with timelines was pointlessly splitting visual rows based on month boundaries, so grid was unified into a single stream, and markers are absolutely positioned over it.
- `next/image` was explicitly disabled by eslint rules in `.tsx`, so native `<img>` with `decoding="async"` alongside `content-visibility: auto` on row containers serves as the most idiomatic standard performance alternative.
- `lenis` installed directly to wrap `RootLayout`.

## Risks & Follow-ups

- Need to monitor if `content-visibility: auto` produces any scroll position shifts, though predefined `--row-height` intrinsic sizing should mostly guard against it.

## References

- timeline wall layout
