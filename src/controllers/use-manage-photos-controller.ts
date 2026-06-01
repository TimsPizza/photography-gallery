"use client";

import {
  Gallery,
  galleryListResponseSchema,
  gallerySchema,
  photoListResponseSchema,
  StoredPhotoMetadata,
  tagListResponseSchema,
} from "@/contracts/photo";
import { useEffect, useMemo, useState } from "react";

const FILES_PAGE_SIZE = 12;

export function useManagePhotosController() {
  const [photos, setPhotos] = useState<StoredPhotoMetadata[]>([]);
  const [userTags, setUserTags] = useState<string[]>([]);
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});
  const [galleryDrafts, setGalleryDrafts] = useState<Record<string, string[]>>(
    {},
  );
  const [batchTagInput, setBatchTagInput] = useState("");
  const [batchGalleryIds, setBatchGalleryIds] = useState<string[]>([]);
  const [galleryFilter, setGalleryFilterState] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQueryState] = useState("");
  const [tagFilter, setTagFilterState] = useState("");

  const filteredPhotos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const tag = tagFilter.trim().toLowerCase();

    return photos.filter((photo) => {
      const matchesQuery =
        !query ||
        [
          photo.originalFileName,
          photo.finalFileName,
          photo.fileId,
          ...photo.tags.map((item) => item.name),
          ...photo.galleries.map((gallery) => gallery.title),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesTag =
        !tag || photo.tags.some((item) => item.name.toLowerCase() === tag);
      const matchesGallery =
        !galleryFilter ||
        photo.galleries.some((gallery) => gallery.id === galleryFilter);

      return matchesQuery && matchesTag && matchesGallery;
    });
  }, [galleryFilter, photos, searchQuery, tagFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPhotos.length / FILES_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedPhotos = filteredPhotos.slice(
    (currentPage - 1) * FILES_PAGE_SIZE,
    currentPage * FILES_PAGE_SIZE,
  );

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const [nextPhotos, nextUserTags, nextGalleries] = await Promise.all([
          fetchPhotos(),
          fetchUserTags(),
          fetchGalleries(),
        ]);

        if (isMounted) {
          const drafts = createDraftsFromPhotos(nextPhotos);
          setPhotos(nextPhotos);
          setUserTags(nextUserTags);
          setGalleries(nextGalleries);
          setTagDrafts(drafts.tagDrafts);
          setGalleryDrafts(drafts.galleryDrafts);
        }
      } catch (error) {
        console.error("Failed to load manage data:", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleStored(photo: StoredPhotoMetadata) {
    setPhotos((current) => [photo, ...current]);
    setTagDrafts((current) => ({
      ...current,
      [photo.fileId]: formatUserTags(photo),
    }));
    setGalleryDrafts((current) => ({
      ...current,
      [photo.fileId]: photo.galleries.map((gallery) => gallery.id),
    }));
  }

  async function refreshManageData() {
    const [nextPhotos, nextUserTags, nextGalleries] = await Promise.all([
      fetchPhotos(),
      fetchUserTags(),
      fetchGalleries(),
    ]);

    setPhotos(nextPhotos);
    setUserTags(nextUserTags);
    setGalleries(nextGalleries);
    const drafts = createDraftsFromPhotos(nextPhotos);
    setTagDrafts(drafts.tagDrafts);
    setGalleryDrafts(drafts.galleryDrafts);
  }

  async function deletePhoto(fileId: string) {
    if (
      !confirm(
        "Are you sure you want to delete this photo? This cannot be undone.",
      )
    ) {
      return;
    }

    setDeletingId(fileId);
    try {
      await deletePhotoById(fileId);
      setPhotos((current) =>
        current.filter((photo) => photo.fileId !== fileId),
      );
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(fileId);
        return next;
      });
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete photo. Check console for details.");
    } finally {
      setDeletingId(null);
    }
  }

  async function deleteSelectedPhotos() {
    if (selectedIds.size === 0) return;
    if (
      !confirm(
        `Are you sure you want to delete ${selectedIds.size} photos? This cannot be undone.`,
      )
    ) {
      return;
    }

    setIsDeletingBatch(true);
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map((id) => deletePhotoById(id)));
      setPhotos((current) =>
        current.filter((photo) => !selectedIds.has(photo.fileId)),
      );
      setSelectedIds(new Set());
    } catch (error) {
      console.error("Batch delete failed:", error);
      alert("Failed to delete some photos. Check console for details.");
    } finally {
      setIsDeletingBatch(false);
    }
  }

  async function savePhotoUserTags(fileId: string) {
    setIsMutating(true);
    try {
      await fetchJson("/api/photos/tags", {
        method: "PUT",
        body: JSON.stringify({
          fileId,
          tags: parseTagInput(tagDrafts[fileId] ?? ""),
        }),
      });
      await refreshManageData();
    } catch (error) {
      console.error("Failed to save tags:", error);
      alert("Failed to save tags. Check console for details.");
    } finally {
      setIsMutating(false);
    }
  }

  async function updateSelectedTags(action: "add" | "remove") {
    const tags = parseTagInput(batchTagInput);
    if (selectedIds.size === 0 || tags.length === 0) return;

    setIsMutating(true);
    try {
      await fetchJson("/api/photos/tags", {
        method: "POST",
        body: JSON.stringify({
          action,
          fileIds: Array.from(selectedIds),
          tags,
        }),
      });
      setBatchTagInput("");
      await refreshManageData();
    } catch (error) {
      console.error("Failed to update selected tags:", error);
      alert("Failed to update selected tags. Check console for details.");
    } finally {
      setIsMutating(false);
    }
  }

  async function createGallery(input: {
    title: string;
    urlSlug?: string | null;
    description?: string | null;
  }) {
    if (!input.title.trim()) return;

    setIsMutating(true);
    try {
      const json = await fetchJson("/api/galleries", {
        method: "POST",
        body: JSON.stringify(input),
      });
      const gallery = gallerySchema.parse((json as { gallery: unknown }).gallery);
      setGalleries((current) => [gallery, ...current]);
    } catch (error) {
      console.error("Failed to create gallery:", error);
      alert("Failed to create gallery. Check console for details.");
    } finally {
      setIsMutating(false);
    }
  }

  async function updateSelectedGalleries(action: "add" | "remove") {
    if (selectedIds.size === 0 || batchGalleryIds.length === 0) return;

    setIsMutating(true);
    try {
      await updateGalleryMembership({
        action,
        fileIds: Array.from(selectedIds),
        galleryIds: batchGalleryIds,
      });
      setBatchGalleryIds([]);
      await refreshManageData();
    } catch (error) {
      console.error("Failed to update selected galleries:", error);
      alert("Failed to update selected galleries. Check console for details.");
    } finally {
      setIsMutating(false);
    }
  }

  async function savePhotoGalleries(fileId: string) {
    const photo = photos.find((item) => item.fileId === fileId);
    if (!photo) return;

    const currentIds = new Set(photo.galleries.map((gallery) => gallery.id));
    const nextIds = new Set(galleryDrafts[fileId] ?? []);
    const addIds = [...nextIds].filter((id) => !currentIds.has(id));
    const removeIds = [...currentIds].filter((id) => !nextIds.has(id));

    setIsMutating(true);
    try {
      if (addIds.length) {
        await updateGalleryMembership({
          action: "add",
          fileIds: [fileId],
          galleryIds: addIds,
        });
      }
      if (removeIds.length) {
        await updateGalleryMembership({
          action: "remove",
          fileIds: [fileId],
          galleryIds: removeIds,
        });
      }
      await refreshManageData();
    } catch (error) {
      console.error("Failed to save galleries:", error);
      alert("Failed to save galleries. Check console for details.");
    } finally {
      setIsMutating(false);
    }
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(
      checked ? new Set(photos.map((photo) => photo.fileId)) : new Set(),
    );
  }

  function setPhotoTagDraft(fileId: string, value: string) {
    setTagDrafts((current) => ({ ...current, [fileId]: value }));
  }

  function setPhotoGalleryDraft(fileId: string, galleryIds: string[]) {
    setGalleryDrafts((current) => ({ ...current, [fileId]: galleryIds }));
  }

  function setGalleryFilter(value: string) {
    setGalleryFilterState(value);
    setPage(1);
  }

  function setSearchQuery(value: string) {
    setSearchQueryState(value);
    setPage(1);
  }

  function setTagFilter(value: string) {
    setTagFilterState(value);
    setPage(1);
  }

  return {
    batchGalleryIds,
    batchTagInput,
    createGallery,
    currentPage,
    deletePhoto,
    deleteSelectedPhotos,
    deletingId,
    galleries,
    galleryFilter,
    galleryDrafts,
    handleStored,
    isDeletingBatch,
    isLoading,
    isMutating,
    isSelectAllChecked: photos.length > 0 && selectedIds.size === photos.length,
    filteredCount: filteredPhotos.length,
    nextPage: () => setPage((current) => Math.min(totalPages, current + 1)),
    pageSize: FILES_PAGE_SIZE,
    paginatedPhotos,
    photos,
    previousPage: () => setPage((current) => Math.max(1, current - 1)),
    savePhotoGalleries,
    savePhotoUserTags,
    selectedCount: selectedIds.size,
    selectedIds,
    setBatchGalleryIds,
    setBatchTagInput,
    setGalleryFilter,
    setPage,
    setPhotoGalleryDraft,
    setPhotoTagDraft,
    setSearchQuery,
    setTagFilter,
    searchQuery,
    tagDrafts,
    tagFilter,
    toggleSelect,
    toggleSelectAll,
    totalPages,
    updateSelectedGalleries,
    updateSelectedTags,
    userTags,
  };
}

async function fetchPhotos() {
  const json = await fetchJson("/api/photos");
  const payload = photoListResponseSchema.parse(json);
  return payload.photos;
}

async function fetchUserTags() {
  const json = await fetchJson("/api/tags?kind=user");
  const payload = tagListResponseSchema.parse(json);
  return payload.tags.map((tag) => tag.name);
}

async function fetchGalleries() {
  const json = await fetchJson("/api/galleries");
  const payload = galleryListResponseSchema.parse(json);
  return payload.galleries;
}

async function deletePhotoById(id: string) {
  await fetchJson(`/api/photos?fileId=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

async function updateGalleryMembership(input: {
  action: "add" | "remove";
  fileIds: string[];
  galleryIds: string[];
}) {
  await fetchJson("/api/galleries/photos", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(getResponseError(json, response.status));
  }

  return json;
}

function getResponseError(json: unknown, status: number) {
  if (
    json &&
    typeof json === "object" &&
    "error" in json &&
    typeof json.error === "string"
  ) {
    return json.error;
  }

  return `Request failed with HTTP ${status}`;
}

function parseTagInput(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

function formatUserTags(photo: StoredPhotoMetadata) {
  return photo.tags
    .filter((tag) => tag.kind === "user")
    .map((tag) => tag.name)
    .join(", ");
}

function createDraftsFromPhotos(nextPhotos: StoredPhotoMetadata[]) {
  return {
    tagDrafts: Object.fromEntries(
      nextPhotos.map((photo) => [photo.fileId, formatUserTags(photo)]),
    ),
    galleryDrafts: Object.fromEntries(
      nextPhotos.map((photo) => [
        photo.fileId,
        photo.galleries.map((gallery) => gallery.id),
      ]),
    ),
  };
}
