import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$lib/receipt-image", () => ({
  readReceiptFileAsDataUrl: vi.fn(),
}));
vi.mock("$lib/receipt-extraction-client", () => ({
  extractReceiptInfo: vi.fn(),
}));
vi.mock("$lib/storage-upload-client", () => ({
  persistImageDataUrl: vi.fn(),
}));

import { readReceiptFileAsDataUrl } from "$lib/receipt-image";
import { extractReceiptInfo } from "$lib/receipt-extraction-client";
import { persistImageDataUrl } from "$lib/storage-upload-client";
import type { ReceiptExtractedData } from "$lib/receipt-extraction-types";
import { scanReceiptFiles } from "./scan-files";

const extracted: ReceiptExtractedData = {
  verdict: "valid",
  confidence: 0.9,
  summary: "ok",
  senderName: null,
  senderBank: null,
  receiverName: null,
  receiverBank: null,
  amount: 100,
  transactionDate: "2026-10-01",
  referenceNumber: "R1",
  provider: "gemini",
};

const file = (name: string) => new File(["x"], name, { type: "image/png" });
const context = { purpose: "fund_transfer" as const, loanId: 1 };

describe("scanReceiptFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readReceiptFileAsDataUrl).mockImplementation(
      async (f: File) => `data:image/jpeg;base64,${f.name}`,
    );
    vi.mocked(persistImageDataUrl).mockImplementation(
      async (dataUrl: string) => `storage:${dataUrl.split(",")[1]}`,
    );
    vi.mocked(extractReceiptInfo).mockResolvedValue({
      success: true,
      data: extracted,
      warnings: [{ code: "low_confidence" }],
      imageHash: "h1",
    });
  });

  it("scans and uploads each file, keeps input order, and reports progress", async () => {
    const progress: Array<[number, number]> = [];
    const result = await scanReceiptFiles(
      [file("a"), file("b"), file("c"), file("d")],
      context,
      {
        concurrency: 2,
        onProgress: (done, total) => progress.push([done, total]),
      },
    );

    expect(result.map((item) => item.receipt?.imageUrl)).toEqual([
      "storage:a",
      "storage:b",
      "storage:c",
      "storage:d",
    ]);
    expect(result[0]).toMatchObject({
      extracted,
      warnings: [{ code: "low_confidence" }],
      imageHash: "h1",
      error: null,
      receipt: { extractedData: extracted },
    });
    expect(extractReceiptInfo).toHaveBeenCalledWith(
      "data:image/jpeg;base64,a",
      context,
    );
    expect(progress[0]).toEqual([0, 4]);
    expect(progress.at(-1)).toEqual([4, 4]);
  });

  it("keeps the image when AI fails so the user can fill it in", async () => {
    vi.mocked(extractReceiptInfo).mockResolvedValueOnce({
      success: false,
      error: "AI is busy right now. Try again in a minute.",
    });
    const [item] = await scanReceiptFiles([file("a")], context);
    expect(item).toMatchObject({
      receipt: { imageUrl: "storage:a", extractedData: null },
      extracted: null,
      error: "AI is busy right now. Try again in a minute.",
    });
  });

  it("returns an error item (no receipt) when the file can't be read or uploaded", async () => {
    vi.mocked(readReceiptFileAsDataUrl).mockRejectedValueOnce(
      new Error("This browser can't open HEIC photos."),
    );
    vi.mocked(persistImageDataUrl).mockRejectedValueOnce(
      new Error("Failed to upload image."),
    );
    const result = await scanReceiptFiles(
      [file("photo.heic"), file("b")],
      context,
      { concurrency: 1 },
    );
    expect(result[0]).toMatchObject({
      receipt: null,
      error: "This browser can't open HEIC photos.",
    });
    expect(result[1]).toMatchObject({
      receipt: null,
      error: "Failed to upload image.",
    });
  });

  it("skips AI when asked", async () => {
    const [item] = await scanReceiptFiles([file("a")], context, {
      skipAi: true,
    });
    expect(extractReceiptInfo).not.toHaveBeenCalled();
    expect(item.receipt?.imageUrl).toBe("storage:a");
  });
});
