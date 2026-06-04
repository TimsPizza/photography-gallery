"use client";

import { UploadConsole } from "@/app/upload-console";
import { useManagePhotosController } from "@/controllers/use-manage-photos-controller";
import { getPhotoThumbnailUrl } from "@/lib/photo-url";
import * as Checkbox from "@radix-ui/react-checkbox";
import { useState } from "react";

const CheckIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 15 15"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z"
      fill="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
    />
  </svg>
);

const panelClass =
  "rounded-lg border border-white/70 bg-white/55 p-4 shadow-[0_18px_55px_rgb(68_54_29_/_11%)] backdrop-blur-xl";
const inputClass =
  "min-h-10 rounded-md border border-black/10 bg-white/75 px-3 text-sm text-[#211f1b] outline-none focus:border-[#a6752a]";
const lightButtonClass =
  "min-h-10 rounded-md border border-black/10 bg-white/75 px-3 text-sm font-bold text-[#3a342a] disabled:cursor-not-allowed disabled:opacity-50";

export function ManageShell() {
  const [newGalleryTitle, setNewGalleryTitle] = useState("");
  const [newGalleryUrlSlug, setNewGalleryUrlSlug] = useState("");
  const [newGalleryDescription, setNewGalleryDescription] = useState("");
  const {
    batchGalleryIds,
    batchTagInput,
    createGallery,
    currentPage,
    deletePhoto,
    deleteSelectedPhotos,
    deletingId,
    filteredCount,
    galleries,
    galleryDrafts,
    galleryFilter,
    handleStored,
    isDeletingBatch,
    isLoading,
    isMutating,
    isRebuildingMood,
    isSelectAllChecked,
    moodRebuildResult,
    nextPage,
    pageSize,
    paginatedPhotos,
    photos,
    previousPage,
    rebuildMoodGroups,
    savePhotoGalleries,
    savePhotoUserTags,
    searchQuery,
    selectedCount,
    selectedIds,
    setBatchGalleryIds,
    setBatchTagInput,
    setGalleryFilter,
    setPhotoGalleryDraft,
    setPhotoTagDraft,
    setSearchQuery,
    setTagFilter,
    tagDrafts,
    tagFilter,
    toggleSelect,
    toggleSelectAll,
    totalPages,
    updateSelectedGalleries,
    updateSelectedTags,
    userTags,
  } = useManagePhotosController();

  async function handleCreateGallery() {
    await createGallery({
      title: newGalleryTitle,
      urlSlug: newGalleryUrlSlug || null,
      description: newGalleryDescription || null,
    });
    setNewGalleryTitle("");
    setNewGalleryUrlSlug("");
    setNewGalleryDescription("");
  }

  return (
    <main className="mx-auto grid min-h-screen w-[min(1280px,calc(100%-2rem))] content-start gap-6 py-8">
      <section className="manage-header">
        <p className="eyebrow">Manage</p>
        <h1>Photo intake</h1>
        <p>
          Upload, classify, and place photos into galleries before they appear
          in the public wall.
        </p>
      </section>

      <UploadConsole onStored={handleStored} />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.7fr)]">
        <div className={panelClass}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Gallery</p>
              <h2 className="mt-1 text-xl font-bold text-[#211f1b]">
                Gallery management
              </h2>
            </div>
            <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-bold text-[#686258]">
              {galleries.length} total
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto]">
            <input
              className={inputClass}
              type="text"
              placeholder="Gallery title"
              value={newGalleryTitle}
              onChange={(event) => setNewGalleryTitle(event.target.value)}
            />
            <input
              className={inputClass}
              type="text"
              placeholder="url_slug"
              value={newGalleryUrlSlug}
              onChange={(event) => setNewGalleryUrlSlug(event.target.value)}
            />
            <button
              type="button"
              className="upload-button"
              disabled={isMutating || !newGalleryTitle.trim()}
              onClick={() => void handleCreateGallery()}
            >
              Create
            </button>
            <input
              className={`${inputClass} md:col-span-3`}
              type="text"
              placeholder="Description"
              value={newGalleryDescription}
              onChange={(event) => setNewGalleryDescription(event.target.value)}
            />
          </div>

          <div className="mt-4 grid max-h-44 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
            {galleries.length === 0 ? (
              <span className="muted-chip">No galleries yet</span>
            ) : (
              galleries.map((gallery) => (
                <article
                  className="rounded-md border border-black/10 bg-white/65 p-3"
                  key={gallery.id}
                >
                  <h3 className="truncate text-sm font-bold text-[#211f1b]">
                    {gallery.title}
                  </h3>
                  <p className="mt-1 truncate text-xs text-[#686258]">
                    {gallery.urlSlug ?? "no url_slug"}
                  </p>
                  <span className="mt-3 inline-flex rounded-full bg-black/5 px-2 py-1 text-xs font-bold text-[#686258]">
                    {gallery.photoCount ?? 0} photos
                  </span>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="grid gap-4">
          <div className={panelClass}>
            <p className="eyebrow">Mood</p>
            <h2 className="mt-1 text-xl font-bold text-[#211f1b]">
              Color groups
            </h2>
            <button
              type="button"
              className="upload-button mt-4 w-full"
              disabled={isRebuildingMood}
              onClick={() => void rebuildMoodGroups()}
            >
              {isRebuildingMood ? "Rebuilding..." : "Rebuild mood groups"}
            </button>
            {moodRebuildResult && (
              <p className="mt-3 text-sm font-semibold text-[#686258]">
                v{moodRebuildResult.version}:{" "}
                {moodRebuildResult.clustersCreated} groups,{" "}
                {moodRebuildResult.assignmentsCreated} photos
              </p>
            )}
          </div>

          <div className={panelClass}>
            <p className="eyebrow">Defaults</p>
            <h2 className="mt-1 text-xl font-bold text-[#211f1b]">
              User tag options
            </h2>
            <div className="mt-4 flex max-h-52 flex-wrap content-start gap-2 overflow-y-auto">
              {userTags.length === 0 ? (
                <span className="muted-chip">No user tags yet</span>
              ) : (
                userTags.map((tag) => (
                  <span className="tag-chip user-tag" key={tag}>
                    {tag}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className={panelClass}>
        <div className="grid gap-4">
          <header className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="eyebrow">Files</p>
                {isLoading && <span className="loading-tag">Loading...</span>}
              </div>
              <h2 className="mt-1 text-2xl font-bold text-[#211f1b]">
                All files
              </h2>
              <p className="mt-1 text-sm text-[#686258]">
                Showing {filteredCount} of {photos.length}; page {currentPage} of{" "}
                {totalPages}.
              </p>
            </div>

            {photos.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm font-bold text-[#3a342a]">
                  <Checkbox.Root
                    className="CheckboxRoot"
                    checked={isSelectAllChecked}
                    onCheckedChange={(checked) =>
                      toggleSelectAll(checked === true)
                    }
                  >
                    <Checkbox.Indicator className="CheckboxIndicator">
                      <CheckIcon />
                    </Checkbox.Indicator>
                  </Checkbox.Root>
                  Select all
                </label>
                <button
                  type="button"
                  className="delete-button !m-0 !w-auto px-4"
                  disabled={selectedCount === 0 || isDeletingBatch}
                  onClick={deleteSelectedPhotos}
                >
                  {isDeletingBatch
                    ? "Deleting..."
                    : `Delete (${selectedCount})`}
                </button>
              </div>
            )}
          </header>

          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(180px,0.5fr)_minmax(180px,0.5fr)_auto]">
            <input
              className={inputClass}
              type="search"
              placeholder="Search filename, fileId, tag, gallery"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <select
              className={inputClass}
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
            >
              <option value="">All tags</option>
              {userTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
            <select
              className={inputClass}
              value={galleryFilter}
              onChange={(event) => setGalleryFilter(event.target.value)}
            >
              <option value="">All galleries</option>
              {galleries.map((gallery) => (
                <option key={gallery.id} value={gallery.id}>
                  {gallery.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={lightButtonClass}
              onClick={() => {
                setSearchQuery("");
                setTagFilter("");
                setGalleryFilter("");
              }}
            >
              Reset
            </button>
          </div>

          {selectedCount > 0 && (
            <div className="grid gap-3 rounded-lg border border-black/10 bg-white/60 p-3 lg:grid-cols-2">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                <input
                  className={inputClass}
                  list="user-tag-options"
                  type="text"
                  placeholder="comma-separated user tags"
                  value={batchTagInput}
                  onChange={(event) => setBatchTagInput(event.target.value)}
                />
                <button
                  type="button"
                  className={lightButtonClass}
                  disabled={isMutating || !batchTagInput.trim()}
                  onClick={() => void updateSelectedTags("add")}
                >
                  Add
                </button>
                <button
                  type="button"
                  className={lightButtonClass}
                  disabled={isMutating || !batchTagInput.trim()}
                  onClick={() => void updateSelectedTags("remove")}
                >
                  Remove
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                <select
                  className={`${inputClass} h-10`}
                  multiple
                  value={batchGalleryIds}
                  onChange={(event) =>
                    setBatchGalleryIds(
                      Array.from(event.target.selectedOptions).map(
                        (option) => option.value,
                      ),
                    )
                  }
                >
                  {galleries.map((gallery) => (
                    <option key={gallery.id} value={gallery.id}>
                      {gallery.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={lightButtonClass}
                  disabled={isMutating || batchGalleryIds.length === 0}
                  onClick={() => void updateSelectedGalleries("add")}
                >
                  Add
                </button>
                <button
                  type="button"
                  className={lightButtonClass}
                  disabled={isMutating || batchGalleryIds.length === 0}
                  onClick={() => void updateSelectedGalleries("remove")}
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          <datalist id="user-tag-options">
            {userTags.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {paginatedPhotos.map((photo) => (
              <article
                key={photo.fileId}
                className="relative grid h-[34rem] overflow-hidden rounded-lg border border-black/10 bg-white/70"
              >
                <div className="absolute left-3 top-3 z-10">
                  <Checkbox.Root
                    className="CheckboxRoot item-checkbox"
                    checked={selectedIds.has(photo.fileId)}
                    onCheckedChange={(checked) =>
                      toggleSelect(photo.fileId, checked === true)
                    }
                  >
                    <Checkbox.Indicator className="CheckboxIndicator">
                      <CheckIcon />
                    </Checkbox.Indicator>
                  </Checkbox.Root>
                </div>

                <div className="h-44 overflow-hidden bg-black/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="h-full w-full object-cover"
                    src={getPhotoThumbnailUrl(photo)}
                    alt={photo.originalFileName}
                  />
                </div>

                <div className="grid min-h-0 gap-3 overflow-y-auto p-3">
                  <div>
                    <strong className="block truncate text-sm text-[#211f1b]">
                      {photo.originalFileName}
                    </strong>
                    <span className="mt-1 block break-all text-xs text-[#686258]">
                      {photo.fileId}
                    </span>
                  </div>

                  <div className="photo-tags">
                    {photo.tags.map((tag) => (
                      <span
                        className={`tag-chip ${tag.kind === "color" ? "color-tag" : "user-tag"}`}
                        key={`${tag.kind}:${tag.name}`}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>

                  <label className="grid gap-1 text-xs font-bold text-[#686258]">
                    User tags
                    <input
                      className={inputClass}
                      list="user-tag-options"
                      type="text"
                      value={tagDrafts[photo.fileId] ?? ""}
                      onChange={(event) =>
                        setPhotoTagDraft(photo.fileId, event.target.value)
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className={lightButtonClass}
                    disabled={isMutating}
                    onClick={() => void savePhotoUserTags(photo.fileId)}
                  >
                    Save tags
                  </button>

                  <label className="grid gap-1 text-xs font-bold text-[#686258]">
                    Added to gallery
                    <select
                      className={`${inputClass} h-24`}
                      multiple
                      value={galleryDrafts[photo.fileId] ?? []}
                      onChange={(event) =>
                        setPhotoGalleryDraft(
                          photo.fileId,
                          Array.from(event.target.selectedOptions).map(
                            (option) => option.value,
                          ),
                        )
                      }
                    >
                      {galleries.map((gallery) => (
                        <option key={gallery.id} value={gallery.id}>
                          {gallery.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className={lightButtonClass}
                    disabled={isMutating}
                    onClick={() => void savePhotoGalleries(photo.fileId)}
                  >
                    Save galleries
                  </button>

                  <button
                    type="button"
                    className="delete-button"
                    disabled={deletingId === photo.fileId || isDeletingBatch}
                    onClick={() => void deletePhoto(photo.fileId)}
                  >
                    {deletingId === photo.fileId ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </article>
            ))}
            {!isLoading && filteredCount === 0 && (
              <p className="empty-state sm:col-span-2 xl:col-span-3 2xl:col-span-4">
                No photos match the current filters.
              </p>
            )}
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4">
            <span className="text-sm font-semibold text-[#686258]">
              {pageSize} per page
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={lightButtonClass}
                disabled={currentPage <= 1}
                onClick={previousPage}
              >
                Previous
              </button>
              <span className="rounded-md bg-black/5 px-3 py-2 text-sm font-bold text-[#3a342a]">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                className={lightButtonClass}
                disabled={currentPage >= totalPages}
                onClick={nextPage}
              >
                Next
              </button>
            </div>
          </footer>
        </div>
      </section>
    </main>
  );
}
