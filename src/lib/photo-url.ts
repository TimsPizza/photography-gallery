import { StoredPhotoMetadata } from "@/contracts/photo";

export function getPhotoThumbnailUrl(photo: StoredPhotoMetadata) {
  return photo.thumbnailFileUrl;
}

export function getPhotoThumbnailFileName(finalFileName: string) {
  const baseName = finalFileName.includes(".")
    ? finalFileName.substring(0, finalFileName.lastIndexOf("."))
    : finalFileName;

  return `thumbnail_${baseName}.webp`;
}
