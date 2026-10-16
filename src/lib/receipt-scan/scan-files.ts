import { readReceiptFileAsDataUrl } from "$lib/receipt-image";
import {
  extractReceiptInfo,
  type ReceiptScanContext,
} from "$lib/receipt-extraction-client";
import { persistImageDataUrl } from "$lib/storage-upload-client";
import type { ScannedReceipt } from "./group-transactions";

export interface ScanFilesOptions {
  /** Parallel scans. Kept low to stay under the per-user API rate limit. */
  concurrency?: number;
  /** Skip AI and only upload (AI turned off or not configured). */
  skipAi?: boolean;
  onProgress?: (done: number, total: number) => void;
}

async function scanOne(
  file: File,
  context: ReceiptScanContext,
  skipAi: boolean,
): Promise<ScannedReceipt> {
  const base = {
    id: crypto.randomUUID(),
    fileName: file.name,
    extracted: null,
    warnings: [],
    imageHash: null,
  };

  let dataUrl: string;
  try {
    dataUrl = await readReceiptFileAsDataUrl(file);
  } catch (error) {
    return {
      ...base,
      receipt: null,
      error:
        error instanceof Error ? error.message : "Couldn't open this image.",
    };
  }

  // Scan the in-memory image and upload it at the same time.
  const [scan, stored] = await Promise.all([
    skipAi ? Promise.resolve(null) : extractReceiptInfo(dataUrl, context),
    persistImageDataUrl(dataUrl).then(
      (imageUrl) => ({ imageUrl, error: null as string | null }),
      (error: unknown) => ({
        imageUrl: null,
        error:
          error instanceof Error ? error.message : "Failed to upload receipt.",
      }),
    ),
  ]);

  if (!stored.imageUrl) {
    return { ...base, receipt: null, error: stored.error };
  }

  if (!scan || !scan.success) {
    return {
      ...base,
      receipt: { imageUrl: stored.imageUrl, extractedData: null },
      error: scan?.error ?? null,
    };
  }

  return {
    ...base,
    receipt: { imageUrl: stored.imageUrl, extractedData: scan.data },
    extracted: scan.data,
    warnings: scan.warnings,
    imageHash: scan.imageHash,
    error: null,
  };
}

/**
 * Compress → (AI scan ∥ upload) for each file, a few at a time. One request per
 * file keeps every call well inside the serverless time limit. Results keep the
 * input order and never throw — failures come back as items with `error`.
 */
export async function scanReceiptFiles(
  files: File[],
  context: ReceiptScanContext,
  options: ScanFilesOptions = {},
): Promise<ScannedReceipt[]> {
  const concurrency = Math.max(1, options.concurrency ?? 3);
  const results: ScannedReceipt[] = new Array(files.length);
  let next = 0;
  let done = 0;
  options.onProgress?.(0, files.length);

  async function worker() {
    while (next < files.length) {
      const index = next;
      next += 1;
      results[index] = await scanOne(
        files[index],
        context,
        options.skipAi ?? false,
      );
      done += 1;
      options.onProgress?.(done, files.length);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, files.length) }, worker),
  );
  return results;
}
