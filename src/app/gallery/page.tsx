import { GalleryShell } from "@/app/gallery-shell";
import { listStoredPhotos } from "@/lib/server/photo-db";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const photos = await listStoredPhotos().catch(() => []);

  return <GalleryShell initialPhotos={photos} />;
}
