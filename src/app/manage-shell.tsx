"use client";

import { UploadConsole } from "@/app/upload-console";
import {
  Button,
  Checkbox,
  Chip,
  EmptyState,
  Eyebrow,
  FieldLabel,
  Input,
  Panel,
  Select,
} from "@/components/ui";
import { useManagePhotosController } from "@/controllers/use-manage-photos-controller";
import { getPhotoThumbnailUrl } from "@/lib/photo-url";
import { useState } from "react";

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
    <main className="mx-auto grid min-h-screen w-[min(1280px,calc(100%-2rem))] content-start gap-6 bg-[radial-gradient(circle_at_12%_8%,rgb(255_231_177_/_25%),transparent_35rem),linear-gradient(135deg,#f6f2e8_0%,#e7e4dc_55%,#d8d5ce_100%)] bg-fixed py-8 dark:bg-[radial-gradient(circle_at_12%_8%,rgb(255_231_177_/_5%),transparent_35rem),linear-gradient(135deg,#12100d_0%,#1a1714_55%,#161310_100%)]">
      <section className="grid gap-3">
        <Eyebrow>Manage</Eyebrow>
        <h1 className="text-[clamp(2.4rem,7vw,5rem)] leading-[0.96] font-[720]">
          Photo intake
        </h1>
        <p className="max-w-2xl leading-[1.7] text-[#686258] dark:text-[#9c9586]">
          Upload, classify, and place photos into galleries before they appear
          in the public wall.
        </p>
      </section>

      <UploadConsole onStored={handleStored} />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.7fr)]">
        <Panel>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <Eyebrow>Gallery</Eyebrow>
              <h2 className="mt-1 text-xl font-bold text-[#211f1b]">
                Gallery management
              </h2>
            </div>
            <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-bold text-[#686258]">
              {galleries.length} total
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto]">
            <Input
              type="text"
              placeholder="Gallery title"
              value={newGalleryTitle}
              onChange={(event) => setNewGalleryTitle(event.target.value)}
            />
            <Input
              type="text"
              placeholder="url_slug"
              value={newGalleryUrlSlug}
              onChange={(event) => setNewGalleryUrlSlug(event.target.value)}
            />
            <Button
              variant="primary"
              disabled={isMutating || !newGalleryTitle.trim()}
              onClick={() => void handleCreateGallery()}
            >
              Create
            </Button>
            <Input
              className="md:col-span-3"
              type="text"
              placeholder="Description"
              value={newGalleryDescription}
              onChange={(event) => setNewGalleryDescription(event.target.value)}
            />
          </div>

          <div className="mt-4 grid max-h-44 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
            {galleries.length === 0 ? (
              <Chip>No galleries yet</Chip>
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
                  <Chip className="mt-3 px-2 text-xs" variant="count">
                    {gallery.photoCount ?? 0} photos
                  </Chip>
                </article>
              ))
            )}
          </div>
        </Panel>

        <div className="grid gap-4">
          <Panel>
            <Eyebrow>Mood</Eyebrow>
            <h2 className="mt-1 text-xl font-bold text-[#211f1b]">
              Color groups
            </h2>
            <Button
              className="mt-4 w-full"
              variant="primary"
              disabled={isRebuildingMood}
              onClick={() => void rebuildMoodGroups()}
            >
              {isRebuildingMood ? "Rebuilding..." : "Rebuild mood groups"}
            </Button>
            {moodRebuildResult && (
              <p className="mt-3 text-sm font-semibold text-[#686258]">
                v{moodRebuildResult.version}:{" "}
                {moodRebuildResult.clustersCreated} groups,{" "}
                {moodRebuildResult.assignmentsCreated} photos
              </p>
            )}
          </Panel>

          <Panel>
            <Eyebrow>Defaults</Eyebrow>
            <h2 className="mt-1 text-xl font-bold text-[#211f1b]">
              User tag options
            </h2>
            <div className="mt-4 flex max-h-52 flex-wrap content-start gap-2 overflow-y-auto">
              {userTags.length === 0 ? (
                <Chip>No user tags yet</Chip>
              ) : (
                userTags.map((tag) => (
                  <Chip variant="user" key={tag}>
                    {tag}
                  </Chip>
                ))
              )}
            </div>
          </Panel>
        </div>
      </section>

      <Panel as="section">
        <div className="grid gap-4">
          <header className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <Eyebrow>Files</Eyebrow>
                {isLoading && (
                  <span className="rounded-sm bg-black/5 px-2 py-[0.2rem] text-[0.8rem] text-[#686258] dark:text-[#9c9586]">
                    Loading...
                  </span>
                )}
              </div>
              <h2 className="mt-1 text-2xl font-bold text-[#211f1b]">
                All files
              </h2>
              <p className="mt-1 text-sm text-[#686258]">
                Showing {filteredCount} of {photos.length}; page {currentPage}{" "}
                of {totalPages}.
              </p>
            </div>

            {photos.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm font-bold text-[#3a342a]">
                  <Checkbox
                    checked={isSelectAllChecked}
                    onCheckedChange={(checked) =>
                      toggleSelectAll(checked === true)
                    }
                  />
                  Select all
                </label>
                <Button
                  className="px-4"
                  variant="danger"
                  disabled={selectedCount === 0 || isDeletingBatch}
                  onClick={deleteSelectedPhotos}
                >
                  {isDeletingBatch
                    ? "Deleting..."
                    : `Delete (${selectedCount})`}
                </Button>
              </div>
            )}
          </header>

          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(180px,0.5fr)_minmax(180px,0.5fr)_auto]">
            <Input
              type="search"
              placeholder="Search filename, fileId, tag, gallery"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <Select
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
            >
              <option value="">All tags</option>
              {userTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </Select>
            <Select
              value={galleryFilter}
              onChange={(event) => setGalleryFilter(event.target.value)}
            >
              <option value="">All galleries</option>
              {galleries.map((gallery) => (
                <option key={gallery.id} value={gallery.id}>
                  {gallery.title}
                </option>
              ))}
            </Select>
            <Button
              onClick={() => {
                setSearchQuery("");
                setTagFilter("");
                setGalleryFilter("");
              }}
            >
              Reset
            </Button>
          </div>

          {selectedCount > 0 && (
            <div className="grid gap-3 rounded-lg border border-black/10 bg-white/60 p-3 lg:grid-cols-2">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                <Input
                  list="user-tag-options"
                  type="text"
                  placeholder="comma-separated user tags"
                  value={batchTagInput}
                  onChange={(event) => setBatchTagInput(event.target.value)}
                />
                <Button
                  disabled={isMutating || !batchTagInput.trim()}
                  onClick={() => void updateSelectedTags("add")}
                >
                  Add
                </Button>
                <Button
                  disabled={isMutating || !batchTagInput.trim()}
                  onClick={() => void updateSelectedTags("remove")}
                >
                  Remove
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                <Select
                  className="h-10"
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
                </Select>
                <Button
                  disabled={isMutating || batchGalleryIds.length === 0}
                  onClick={() => void updateSelectedGalleries("add")}
                >
                  Add
                </Button>
                <Button
                  disabled={isMutating || batchGalleryIds.length === 0}
                  onClick={() => void updateSelectedGalleries("remove")}
                >
                  Remove
                </Button>
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
                <div className="absolute top-3 left-3 z-10">
                  <Checkbox
                    className="border-[#ccc] shadow-[0_2px_8px_rgb(0_0_0_/_15%)]"
                    checked={selectedIds.has(photo.fileId)}
                    onCheckedChange={(checked) =>
                      toggleSelect(photo.fileId, checked === true)
                    }
                  />
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
                    <span className="mt-1 block text-xs break-all text-[#686258]">
                      {photo.fileId}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-[0.4rem]">
                    {photo.tags.map((tag) => (
                      <Chip
                        variant={tag.kind === "color" ? "color" : "user"}
                        key={`${tag.kind}:${tag.name}`}
                      >
                        {tag.name}
                      </Chip>
                    ))}
                  </div>

                  <FieldLabel>
                    User tags
                    <Input
                      list="user-tag-options"
                      type="text"
                      value={tagDrafts[photo.fileId] ?? ""}
                      onChange={(event) =>
                        setPhotoTagDraft(photo.fileId, event.target.value)
                      }
                    />
                  </FieldLabel>
                  <Button
                    disabled={isMutating}
                    onClick={() => void savePhotoUserTags(photo.fileId)}
                  >
                    Save tags
                  </Button>

                  <FieldLabel>
                    Added to gallery
                    <Select
                      className="h-24"
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
                    </Select>
                  </FieldLabel>
                  <Button
                    disabled={isMutating}
                    onClick={() => void savePhotoGalleries(photo.fileId)}
                  >
                    Save galleries
                  </Button>

                  <Button
                    className="mt-2 w-full"
                    variant="danger"
                    disabled={deletingId === photo.fileId || isDeletingBatch}
                    onClick={() => void deletePhoto(photo.fileId)}
                  >
                    {deletingId === photo.fileId ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </article>
            ))}
            {!isLoading && filteredCount === 0 && (
              <EmptyState className="sm:col-span-2 xl:col-span-3 2xl:col-span-4">
                No photos match the current filters.
              </EmptyState>
            )}
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4">
            <span className="text-sm font-semibold text-[#686258]">
              {pageSize} per page
            </span>
            <div className="flex items-center gap-2">
              <Button disabled={currentPage <= 1} onClick={previousPage}>
                Previous
              </Button>
              <span className="rounded-md bg-black/5 px-3 py-2 text-sm font-bold text-[#3a342a]">
                {currentPage} / {totalPages}
              </span>
              <Button disabled={currentPage >= totalPages} onClick={nextPage}>
                Next
              </Button>
            </div>
          </footer>
        </div>
      </Panel>
    </main>
  );
}
