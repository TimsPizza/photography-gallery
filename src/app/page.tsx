import { GalleryShell } from "@/app/gallery-shell";
import { SmoothScroll } from "@/app/smooth-scroll";
import { listStoredPhotos } from "@/lib/server/photo-db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const photos = await listStoredPhotos().catch(() => []);

  return (
    <SmoothScroll>
      <GalleryShell initialPhotos={photos} />
    </SmoothScroll>
  );
}
