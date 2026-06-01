import { StoredPhotoMetadata } from "@/contracts/photo";
import { PhotoWall } from "@/app/photo-wall";

type GalleryShellProps = {
  initialPhotos: StoredPhotoMetadata[];
};

export function GalleryShell({ initialPhotos }: GalleryShellProps) {
  return (
    <main className="gallery-shell">
      <header className="gallery-topbar">
        <a className="gallery-brand" href="#timeline">
          Photo Wall
        </a>
        <nav aria-label="Gallery modes">
          <a href="#timeline">Timeline</a>
          <button type="button">Mood</button>
          <button type="button">Tags</button>
          <button type="button">Albums</button>
        </nav>
      </header>

      <section className="gallery-stage" id="timeline">
        <PhotoWall photos={initialPhotos} />
      </section>
    </main>
  );
}
