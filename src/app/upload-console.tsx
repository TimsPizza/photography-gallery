"use client";

import { Button, EmptyState, Eyebrow, Panel, cx } from "@/components/ui";
import { StoredPhotoMetadata } from "@/contracts/photo";
import { useUploadController } from "@/controllers/use-upload-controller";

type UploadConsoleProps = {
  onStored?: (photo: StoredPhotoMetadata) => void;
};

const statusBadgeClass =
  "min-w-[5.6rem] rounded-full bg-[rgb(33_31_27_/_8%)] px-[0.65rem] py-[0.36rem] text-center text-[0.78rem] font-bold text-[#3a342a]";

function getStatusBadgeClass(status: string) {
  if (status === "stored") {
    return "bg-[rgb(63_128_82_/_16%)] text-[#285437]";
  }
  if (status === "failed" || status === "interrupted") {
    return "bg-[rgb(164_52_48_/_15%)] text-[#89312d]";
  }
  if (status === "waiting" || status === "retrying") {
    return "bg-[rgb(159_112_30_/_15%)] text-[#71501e]";
  }
  return "";
}

function StatusBadge({
  attempt,
  status,
}: {
  attempt?: number;
  status: string;
}) {
  return (
    <span className={cx(statusBadgeClass, getStatusBadgeClass(status))}>
      {status}
      {attempt && attempt > 1 ? ` ${attempt}` : ""}
    </span>
  );
}

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
    <Panel as="section" elevated>
      <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.36fr)_minmax(0,1fr)]">
        <div className="grid content-between gap-4">
          <div>
            <Eyebrow>Upload</Eyebrow>
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
              className="absolute size-px overflow-hidden [clip:rect(0,0,0,0)]"
              type="file"
              accept="image/*"
              multiple
              onChange={handleInputChange}
            />
            <Button
              variant="primary"
              disabled={isUploading}
              onClick={openFilePicker}
            >
              {isUploading ? "Processing" : "Select photos"}
            </Button>
            <Button
              className="px-4 text-[#4f493f]"
              disabled={isUploading || items.length === 0}
              onClick={clearItems}
            >
              Clear
            </Button>
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
              <EmptyState>No files selected.</EmptyState>
            ) : (
              items.map((item) => (
                <article
                  className="grid min-h-[3.1rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-lg border border-white/60 bg-white/45 px-3 py-[0.6rem]"
                  data-status={item.status}
                  key={item.id}
                >
                  <div>
                    <h2 className="wrap-anywhere text-[0.92rem] font-bold">
                      {item.displayName}
                    </h2>
                    <p className="wrap-anywhere mt-1 text-sm text-[#686258] dark:text-[#9c9586]">
                      {item.message ?? item.status}
                    </p>
                    {typeof item.progress === "number" && (
                      <div
                        aria-label={`${item.progress}% uploaded`}
                        className="mt-[0.55rem] h-[3px] w-[min(18rem,100%)] overflow-hidden rounded-full bg-[rgb(33_31_27_/_10%)]"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={item.progress}
                      >
                        <span
                          className="block h-full min-w-0 rounded-[inherit] bg-[#4d7564] text-transparent transition-[width] duration-[180ms] ease-linear"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <StatusBadge
                    attempt={item.attempt}
                    status={item.status}
                  />
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}
