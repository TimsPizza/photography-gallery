"use client";

import { StoredPhotoMetadata } from "@/contracts/photo";
import { useUploadController } from "@/controllers/use-upload-controller";

type UploadConsoleProps = {
  onStored?: (photo: StoredPhotoMetadata) => void;
};

export function UploadConsole({ onStored }: UploadConsoleProps) {
  const {
    clearItems,
    handleInputChange,
    hasHydrated,
    inputRef,
    isUploading,
    items,
    openFilePicker,
  } = useUploadController({ onStored });

  return (
    <section className="rounded-lg border border-white/70 bg-white/55 p-4 shadow-[0_20px_70px_rgb(68_54_29_/_14%)] backdrop-blur-xl">
      <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.36fr)_minmax(0,1fr)]">
        <div className="grid content-between gap-4">
          <div>
            <p className="eyebrow">Upload</p>
            <h2 className="mt-2 text-2xl font-bold text-[#211f1b]">
              Intake queue
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#686258]">
              Queue state is kept locally across refreshes. Active uploads do
              not resume after reload.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              className="file-input"
              type="file"
              accept="image/*"
              multiple
              onChange={handleInputChange}
            />
            <button
              className="upload-button"
              type="button"
              disabled={isUploading}
              onClick={openFilePicker}
            >
              {isUploading ? "Processing" : "Select photos"}
            </button>
            <button
              className="rounded-md border border-black/10 bg-white/70 px-4 text-sm font-bold text-[#4f493f] disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={isUploading || items.length === 0}
              onClick={clearItems}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="h-[18rem] overflow-hidden rounded-lg border border-black/10 bg-white/60">
          <div className="flex h-11 items-center justify-between border-b border-black/10 px-3">
            <span className="text-sm font-bold text-[#3a342a]">
              {items.length} item{items.length === 1 ? "" : "s"}
            </span>
            {!hasHydrated && (
              <span className="text-xs font-semibold text-[#686258]">
                Restoring
              </span>
            )}
          </div>

          <div className="grid h-[calc(18rem-2.75rem)] gap-2 overflow-y-auto p-3">
            {items.length === 0 ? (
              <p className="empty-state">No files selected.</p>
            ) : (
              items.map((item) => (
                <article
                  className="upload-item"
                  data-status={item.status}
                  key={item.id}
                >
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
      </div>
    </section>
  );
}
