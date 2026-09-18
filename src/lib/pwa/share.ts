import { downloadBlob } from "$lib/pdf-export";
import { supportsWebShare } from "$lib/pwa/capabilities";

export async function shareOrCopy(input: {
  title?: string;
  text?: string;
  url: string;
}): Promise<"shared" | "copied" | "failed"> {
  if (supportsWebShare()) {
    try {
      await navigator.share({
        title: input.title,
        text: input.text,
        url: input.url,
      });
      return "shared";
    } catch (err) {
      if ((err as DOMException).name === "AbortError") return "failed";
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
}): Promise<"shared" | "downloaded" | "failed"> {
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
      if ((err as DOMException).name === "AbortError") return "failed";
    }
  }

  try {
    downloadBlob(input.blob, input.filename);
    return "downloaded";
  } catch {
    return "failed";
  }
}
