"use client";

import { useEffect, useState } from "react";
import { StoredPhotoMetadata } from "@/contracts/photo";
import { UploadConsole } from "@/app/upload-console";
import * as Checkbox from "@radix-ui/react-checkbox";

function getThumbnailUrl(photo: StoredPhotoMetadata) {
  const finalName = photo.finalFileName;
  const baseName = finalName.includes(".")
    ? finalName.substring(0, finalName.lastIndexOf("."))
    : finalName;
  const thumbName = `thumbnail_${baseName}.webp`;
  return photo.fileUrl.replace(finalName, thumbName);
}

const CheckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
  </svg>
);

export function ManageShell() {
  const [photos, setPhotos] = useState<StoredPhotoMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

  useEffect(() => {
    async function fetchPhotos() {
      try {
        const response = await fetch("/api/photos");
        const data = (await response.json()) as { photos: StoredPhotoMetadata[] };
        if (data.photos) {
          setPhotos(data.photos);
        }
      } catch (error) {
        console.error("Failed to fetch photos:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPhotos();
  }, []);

  const handleStored = (photo: StoredPhotoMetadata) => {
    setPhotos((current) => [photo, ...current]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this photo? This cannot be undone.")) {
      return;
    }

    setDeletingId(id);
    try {
      const response = await fetch(`/api/photos/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete photo");
      }

      setPhotos((current) => current.filter((p) => p.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete photo. Check console for details.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteBatch = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} photos? This cannot be undone.`)) {
      return;
    }

    setIsDeletingBatch(true);
    try {
      await Promise.all(Array.from(selectedIds).map(async (id) => {
        const response = await fetch(`/api/photos/${id}`, { method: "DELETE" });
        if (!response.ok) throw new Error(`Failed to delete ${id}`);
      }));
      setPhotos((current) => current.filter((p) => !selectedIds.has(p.id)));
      setSelectedIds(new Set());
    } catch (error) {
      console.error("Batch delete failed:", error);
      alert("Failed to delete some photos. Check console for details.");
    } finally {
      setIsDeletingBatch(false);
    }
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(photos.map(p => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  return (
    <main className="manage-shell">
      <section className="manage-header">
        <p className="eyebrow">Manage</p>
        <h1>Photo intake</h1>
        <p>
          Uploads are kept off the public wall. Authentication belongs here before this route is
          exposed outside local development.
        </p>
      </section>

      <UploadConsole onStored={handleStored} />

      <section className="manage-list-section">
        <header className="section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <h2>Existing photos</h2>
            {isLoading && <span className="loading-tag">Loading...</span>}
          </div>
          
          {photos.length > 0 && (
            <div className="batch-actions" style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Checkbox.Root 
                  className="CheckboxRoot" 
                  id="selectAll"
                  checked={photos.length > 0 && selectedIds.size === photos.length}
                  onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                >
                  <Checkbox.Indicator className="CheckboxIndicator">
                    <CheckIcon />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                <label htmlFor="selectAll" style={{ fontSize: "0.9rem", cursor: "pointer" }}>Select All</label>
              </div>
              <button 
                type="button"
                className="delete-button" 
                disabled={selectedIds.size === 0 || isDeletingBatch}
                onClick={handleDeleteBatch}
              >
                {isDeletingBatch ? "Deleting..." : `Delete (${selectedIds.size})`}
              </button>
            </div>
          )}
        </header>

        <div className="manage-photo-grid">
          {photos.map((photo) => (
            <article key={photo.id} className="manage-photo-item" style={{ position: "relative" }}>
              <div style={{ position: "absolute", top: "0.75rem", left: "0.75rem", zIndex: 10 }}>
                <Checkbox.Root 
                  className="CheckboxRoot item-checkbox" 
                  checked={selectedIds.has(photo.id)}
                  onCheckedChange={(checked) => toggleSelect(photo.id, checked === true)}
                >
                  <Checkbox.Indicator className="CheckboxIndicator">
                    <CheckIcon />
                  </Checkbox.Indicator>
                </Checkbox.Root>
              </div>
              
              <div className="photo-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getThumbnailUrl(photo)} alt={photo.originalFileName} />
              </div>
              <div className="photo-info">
                <strong>{photo.originalFileName}</strong>
                <span>{photo.fileId}</span>
                <button
                  type="button"
                  className="delete-button"
                  disabled={deletingId === photo.id || isDeletingBatch}
                  onClick={() => handleDelete(photo.id)}
                >
                  {deletingId === photo.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </article>
          ))}
          {!isLoading && photos.length === 0 && (
            <p className="empty-state">No photos uploaded yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
