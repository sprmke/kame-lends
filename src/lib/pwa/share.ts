import { downloadBlob } from "$lib/pdf-export";
import { supportsWebShare } from "$lib/pwa/capabilities";

export type ShareOrCopyResult = "shared" | "copied" | "cancelled" | "failed";

export async function shareOrCopy(input: {
  title?: string;
  text?: string;
  url: string;
  /** When true, copy to clipboard only (no native share sheet). Use for Copy actions. */
  preferCopy?: boolean;
}): Promise<ShareOrCopyResult> {
  if (!input.preferCopy && supportsWebShare()) {
    try {
      await navigator.share({
        title: input.title,
        text: input.text,
        url: input.url,
      });
      return "shared";
    } catch (err) {
      if ((err as DOMException).name === "AbortError") return "cancelled";
    }
  }

  try {
    await navigator.clipboard.writeText(input.url);
    return "copied";
  } catch {
    return "failed";
  }
}

export async function shareOrDownloadFile(input: {
  blob: Blob;
  filename: string;
  title?: string;
}): Promise<"shared" | "downloaded" | "cancelled" | "failed"> {
  const file = new File([input.blob], input.filename, {
    type: input.blob.type || "application/octet-stream",
  });

  if (
    supportsWebShare() &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        title: input.title ?? input.filename,
        files: [file],
      });
      return "shared";
    } catch (err) {
      if ((err as DOMException).name === "AbortError") return "cancelled";
    }
  }

  try {
    downloadBlob(input.blob, input.filename);
    return "downloaded";
  } catch {
    return "failed";
  }
}
