"use client";

import { StoredPhotoMetadata } from "@/contracts/photo";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type UploadState = {
  id: string;
  displayName: string;
  status:
    | "queued"
    | "analyzing"
    | "waiting"
    | "uploading"
    | "processing"
    | "retrying"
    | "interrupted"
    | "stored"
    | "failed";
  message?: string;
  progress?: number;
  attempt?: number;
  photo?: StoredPhotoMetadata;
  updatedAt: string;
};

type UploadQueueStore = {
  hasHydrated: boolean;
  items: UploadState[];
  clearItems: () => void;
  markActiveItemsInterrupted: () => void;
  replaceItems: (items: UploadState[]) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  updateItem: (itemId: string, patch: Partial<UploadState>) => void;
};

export const useUploadQueueStore = create<UploadQueueStore>()(
  persist(
    (set) => ({
      hasHydrated: false,
      items: [],
      clearItems: () => set({ items: [] }),
      markActiveItemsInterrupted: () =>
        set((state) => ({
          items: state.items.map((item) =>
            [
              "queued",
              "analyzing",
              "waiting",
              "uploading",
              "processing",
              "retrying",
            ].includes(item.status)
              ? {
                  ...item,
                  status: "interrupted",
                  progress: undefined,
                  message:
                    "Interrupted by page reload; select the source file again to retry",
                  updatedAt: new Date().toISOString(),
                }
              : item,
          ),
        })),
      replaceItems: (items) => set({ items }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      updateItem: (itemId, patch) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === itemId
              ? { ...item, ...patch, updatedAt: new Date().toISOString() }
              : item,
          ),
        })),
    }),
    {
      name: "photography-gallery-upload-queue",
      onRehydrateStorage: () => (state) => {
        state?.markActiveItemsInterrupted();
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({ items: state.items }),
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
