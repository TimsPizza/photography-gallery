"use client";

import { StoredPhotoMetadata } from "@/contracts/photo";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type UploadState = {
  id: string;
  displayName: string;
  status: "queued" | "analyzing" | "uploading" | "stored" | "failed";
  message?: string;
  photo?: StoredPhotoMetadata;
  updatedAt: string;
};

type UploadQueueStore = {
  hasHydrated: boolean;
  items: UploadState[];
  clearItems: () => void;
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
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({ items: state.items }),
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
