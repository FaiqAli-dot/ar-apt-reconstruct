import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { Photo, PhotoDirection } from "@viewra/types";
import { REQUIRED_PHOTO_DIRECTIONS } from "@viewra/types";
import { api, ApiError } from "@/lib/api";
import { photoUrl } from "@/lib/utils";
import { ErrorBanner, StatusBadge } from "@/components/ui/primitives";

type Props = {
  nodeId: string;
  photos: Photo[];
  onChanged: () => Promise<unknown> | void;
};

type UploadMime =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/heic"
  | "image/heif";

const MIME_MAP: Record<string, UploadMime> = {
  "image/jpeg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
  "image/heic": "image/heic",
  "image/heif": "image/heif",
};

export function PhotoManager({ nodeId, photos, onChanged }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const byDirection = (direction: PhotoDirection) =>
    photos.find((p) => p.direction === direction);

  const uploadMutation = useMutation({
    mutationFn: async ({
      direction,
      file,
    }: {
      direction: PhotoDirection;
      file: File;
    }) => {
      const mimeType = MIME_MAP[file.type];
      if (!mimeType) {
        throw new ApiError("Unsupported image type", 400);
      }
      const upload = await api.requestPhotoUpload(nodeId, {
        direction,
        mimeType,
        fileSize: file.size,
        originalFilename: file.name,
      });
      const put = await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) {
        throw new ApiError("Upload to storage failed", put.status);
      }
      return api.completePhotoUpload(upload.photoId);
    },
    onSuccess: async () => {
      setError(null);
      await onChanged();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    },
  });

  const reprocessMutation = useMutation({
    mutationFn: (photoId: string) => api.reprocessPhoto(photoId),
    onSuccess: async () => {
      await onChanged();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Reprocess failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (photoId: string) => api.deletePhoto(photoId),
    onSuccess: async () => {
      await onChanged();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    },
  });

  return (
    <div>
      <p className="label">Photos</p>
      {error ? <ErrorBanner message={error} /> : null}
      <div className="grid gap-2">
        {REQUIRED_PHOTO_DIRECTIONS.map((direction) => {
          const photo = byDirection(direction);
          const url =
            photoUrl(photo?.thumbnailKey) ??
            photoUrl(photo?.processedKey) ??
            photoUrl(photo?.originalKey);
          return (
            <div
              key={direction}
              className="rounded-xl border border-line bg-cream-soft/50 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold tracking-wide">
                  {direction}
                </span>
                {photo ? (
                  <StatusBadge status={photo.processingStatus} />
                ) : (
                  <span className="chip bg-ink/10 text-ink-muted">MISSING</span>
                )}
              </div>

              {url ? (
                <button
                  type="button"
                  className="mb-2 block w-full overflow-hidden rounded-lg border border-line"
                  onClick={() => setPreview(url)}
                >
                  <img
                    src={url}
                    alt={`${direction} preview`}
                    className="h-28 w-full object-cover"
                  />
                </button>
              ) : (
                <div className="mb-2 flex h-20 items-center justify-center rounded-lg border border-dashed border-line text-xs text-ink-muted">
                  No preview
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                <input
                  ref={(el) => {
                    fileRefs.current[direction] = el;
                  }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      uploadMutation.mutate({ direction, file });
                    }
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className="btn-secondary px-2 py-1 text-xs"
                  disabled={uploadMutation.isPending}
                  onClick={() => fileRefs.current[direction]?.click()}
                >
                  {photo ? "Replace" : "Upload"}
                </button>
                {photo ? (
                  <>
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1 text-xs"
                      disabled={reprocessMutation.isPending}
                      onClick={() => reprocessMutation.mutate(photo.id)}
                    >
                      Reprocess
                    </button>
                    <button
                      type="button"
                      className="btn-danger px-2 py-1 text-xs"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (confirm(`Delete ${direction} photo?`)) {
                          deleteMutation.mutate(photo.id);
                        }
                      }}
                    >
                      Delete
                    </button>
                  </>
                ) : null}
              </div>
              {photo?.processingError ? (
                <p className="mt-2 text-xs text-danger">
                  {photo.processingError}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close preview"
            onClick={() => setPreview(null)}
          />
          <img
            src={preview}
            alt="Photo preview"
            className="relative z-10 max-h-[85vh] max-w-full rounded-xl shadow-panel"
          />
        </div>
      ) : null}
    </div>
  );
}
