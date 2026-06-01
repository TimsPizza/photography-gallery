"use client";

import { useRef, useState } from "react";
import { analyzePhotoFile } from "@/lib/client-photo-analysis";
import {
  photoUploadResponseSchema,
  StoredPhotoMetadata,
  uploadTicketResponseSchema,
  workerUploadResultSchema,
} from "@/contracts/photo";

type UploadState = {
  displayName: string;
  status: "queued" | "analyzing" | "uploading" | "stored" | "failed";
  message?: string;
  photo?: StoredPhotoMetadata;
};

export function UploadConsole() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadState[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files?.length || isUploading) return;

    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    setItems(imageFiles.map((file) => ({ displayName: file.name, status: "queued" })));
    setIsUploading(true);

    for (const file of imageFiles) {
      updateItem(file.name, { status: "analyzing", message: "Reading EXIF and color fingerprint" });

      try {
        const metadata = await analyzePhotoFile(file);
        updateItem(file.name, {
          status: "uploading",
          message: "Requesting upload ticket",
        });

        const ticketResponse = await fetch("/api/photos/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            metadata,
            fileSize: file.size,
          }),
        });
        const ticketJson = await ticketResponse.json();
        const ticket = uploadTicketResponseSchema.safeParse(ticketJson);

        if (!ticketResponse.ok || !ticket.success) {
          throw new Error(getUploadError(ticketJson, ticketResponse.status));
        }

        updateItem(file.name, {
          status: "uploading",
          message: `${metadata.width}x${metadata.height} · uploading to Worker`,
        });

        const formData = new FormData();
        formData.set("file", file, file.name);

        const workerResponse = await fetch(ticket.data.uploadUrl, {
          method: "POST",
          headers: {
            Authorization: `UploadTicket ${ticket.data.ticket}`,
          },
          body: formData,
        });
        const workerJson = await workerResponse.json();
        const upload = workerUploadResultSchema.safeParse(workerJson);

        if (!workerResponse.ok || !upload.success) {
          throw new Error(getUploadError(workerJson, workerResponse.status));
        }

        updateItem(file.name, {
          status: "uploading",
          message: "Committing metadata",
        });

        const commitResponse = await fetch("/api/photos/upload/commit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            metadata,
            upload: upload.data,
          }),
        });
        const commitJson = await commitResponse.json();
        const payload = photoUploadResponseSchema.safeParse(commitJson);

        if (!commitResponse.ok || !payload.success) {
          throw new Error(getUploadError(commitJson, commitResponse.status));
        }

        updateItem(file.name, {
          status: "stored",
          message:
            payload.data.photo.originalFileName === payload.data.photo.finalFileName
              ? payload.data.photo.fileId
              : `${payload.data.photo.originalFileName} -> ${payload.data.photo.fileId}`,
          photo: payload.data.photo,
        });
      } catch (error) {
        updateItem(file.name, {
          status: "failed",
          message: error instanceof Error ? error.message : "Unknown failure",
        });
      }
    }

    setIsUploading(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function getUploadError(json: unknown, status: number) {
    if (
      json &&
      typeof json === "object" &&
      "error" in json &&
      typeof json.error === "string"
    ) {
      return json.error;
    }

    return `Upload failed with HTTP ${status}`;
  }

  function updateItem(displayName: string, patch: Partial<UploadState>) {
    setItems((current) =>
      current.map((item) => (item.displayName === displayName ? { ...item, ...patch } : item)),
    );
  }

  return (
    <section className="upload-shell">
      <div className="upload-copy">
        <p className="eyebrow">Metadata intake</p>
        <h1>Upload once. Extract once. Browse from metadata.</h1>
        <p>
          Files go to the external image-bed API. This app keeps capture time, dimensions, EXIF
          hints, color fingerprint, mood tags, and the stable returned file URL.
        </p>
      </div>

      <div className="upload-panel">
        <input
          ref={inputRef}
          className="file-input"
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => void handleFiles(event.target.files)}
        />

        <button
          className="upload-button"
          type="button"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
        >
          {isUploading ? "Processing" : "Select photos"}
        </button>

        <p className="upload-note">
          Files upload directly to the gallery Worker. The returned <code>/file/...</code> path is
          the only source of truth for fetching.
        </p>

        <div className="upload-list">
          {items.length === 0 ? (
            <p className="empty-state">No files selected.</p>
          ) : (
            items.map((item) => (
              <article className="upload-item" data-status={item.status} key={item.displayName}>
                <div>
                  <h2>{item.displayName}</h2>
                  <p>{item.message ?? item.status}</p>
                </div>
                <span>{item.status}</span>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
