import { json } from "@sveltejs/kit";
import { z } from "zod";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import { isStorageRef } from "$lib/storage-reference";
import {
  decodeImageDataUrl,
  extractReceipt,
  MAX_RECEIPT_IMAGE_BYTES,
} from "$lib/server/ai/receipt-extraction";
import { aiErrorMessage } from "$lib/server/ai/errors";
import {
  assertStorageRef,
  canReadStorageRef,
} from "$lib/server/storage/access";
import { getObjectAsDataUrl, isR2Configured } from "$lib/server/storage/r2";
import { findRecordedReferences } from "$lib/server/receipt-references";
import { resolveReceiptScanParties } from "$lib/server/receipt-scan-context";
import { receiptSanityWarnings } from "$lib/receipt-scan/sanity";
import {
  RECEIPT_SCAN_PURPOSES,
  receiptTransactions,
  type ReceiptExtractionResult,
  type ReceiptWarning,
} from "$lib/receipt-extraction-types";

const positiveId = z.number().int().positive();

const bodySchema = z.object({
  /** `data:image/...;base64,` (preferred — avoids an R2 round trip) or a `storage:` ref. */
  imageDataUrl: z.string().min(1).max(2_200_000),
  context: z
    .object({
      purpose: z.enum(RECEIPT_SCAN_PURPOSES),
      loanId: positiveId.optional(),
      investorIds: z.array(positiveId).max(50).optional(),
      borrowerId: positiveId.optional(),
    })
    .optional(),
});

function failure(error: string, status = 200, code?: string): Response {
  const body: ReceiptExtractionResult = { success: false, error, code };
  return json(body, { status });
}

export const POST: RequestHandler = async (event) => {
  const session = await getSession(event);
  const userId = session?.user?.id;
  if (!userId) {
    return json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(
    await event.request.json().catch(() => null),
  );
  if (!parsed.success) {
    return failure(aiErrorMessage("unsupported_input"), 400, "bad_request");
  }
  const { context } = parsed.data;
  let imageDataUrl = parsed.data.imageDataUrl;

  try {
    if (isStorageRef(imageDataUrl)) {
      if (!isR2Configured()) {
        return failure("Object storage is not configured.", 503);
      }
      if (!(await canReadStorageRef(userId, imageDataUrl))) {
        return failure("Forbidden", 403);
      }
      imageDataUrl = await getObjectAsDataUrl(assertStorageRef(imageDataUrl));
    }

    const image = decodeImageDataUrl(imageDataUrl);
    if (!image) {
      return failure(aiErrorMessage("unsupported_input"), 400, "bad_request");
    }
    if (Math.floor((image.base64.length * 3) / 4) > MAX_RECEIPT_IMAGE_BYTES) {
      return failure(
        "Image is too large. Please upload a smaller photo.",
        413,
        "too_large",
      );
    }

    const parties = await resolveReceiptScanParties(userId, {
      loanId: context?.loanId,
      investorIds: context?.investorIds,
      borrowerId: context?.borrowerId,
    });

    const result = await extractReceipt({
      userId,
      image,
      purpose: context?.purpose ?? "fund_transfer",
      lenderNames: parties.lenderNames,
      borrowerName: parties.borrowerName,
    });
    if (!result.success) {
      return failure(result.error, 200, result.code);
    }

    const warnings: ReceiptWarning[] = receiptSanityWarnings(result.data);
    const references = receiptTransactions(result.data)
      .map((transaction) => transaction.referenceNumber)
      .filter((ref): ref is string => Boolean(ref));
    const recorded = await findRecordedReferences(userId, references).catch(
      (error) => {
        console.warn(
          "[ai.receipt_extraction] reference lookup failed",
          (error as Error).message,
        );
        return [];
      },
    );
    for (const match of recorded) {
      warnings.push({
        code: "already_recorded",
        loanId: match.loanId,
        detail: match.loanName,
        referenceNumber: match.referenceNumber,
      });
    }

    const body: ReceiptExtractionResult = {
      success: true,
      data: result.data,
      warnings,
      imageHash: result.imageHash,
    };
    return json(body);
  } catch (error) {
    console.error("[ai.receipt_extraction] endpoint error", error);
    return failure("Failed to scan the receipt.", 500);
  }
};
