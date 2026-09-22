"use client";

export type PresignUploadResult<T> =
  | { status: "ok"; data: T }
  | { status: "not_configured" }
  | { status: "error"; message: string };

/**
 * Uploads a file straight from the browser to cloud storage via a
 * presigned URL, bypassing our server for the file bytes so files aren't
 * capped by a serverless platform's request body limit. Falls back to
 * `{ status: "not_configured" }` when cloud storage isn't set up (e.g.
 * local dev's disk fallback), so the caller can use the classic proxied
 * upload instead.
 */
export async function uploadViaPresign<T>(params: {
  file: File;
  presignPath: string;
  confirmPath: string;
  presignExtra?: Record<string, unknown>;
  confirmExtra?: Record<string, unknown>;
  onProgress?: (fraction: number) => void;
}): Promise<PresignUploadResult<T>> {
  const { file } = params;

  const presignRes = await fetch(params.presignPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size,
      ...params.presignExtra,
    }),
  });

  if (presignRes.status === 501) {
    return { status: "not_configured" };
  }
  if (!presignRes.ok) {
    const data = await presignRes.json().catch(() => ({}));
    return { status: "error", message: data.error || "Couldn't prepare upload." };
  }

  const { uploadUrl, key } = (await presignRes.json()) as {
    uploadUrl: string;
    key: string;
  };

  try {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) params.onProgress?.(e.loaded / e.total);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload to storage failed (status ${xhr.status}).`));
      };
      xhr.onerror = () => reject(new Error("Network error while uploading."));
      xhr.send(file);
    });
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Upload failed.",
    };
  }

  const confirmRes = await fetch(params.confirmPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key,
      fileName: file.name,
      contentType: file.type,
      ...params.confirmExtra,
    }),
  });

  const data = await confirmRes.json().catch(() => ({}));
  if (!confirmRes.ok) {
    return { status: "error", message: data.error || "Couldn't finalize upload." };
  }

  return { status: "ok", data };
}
