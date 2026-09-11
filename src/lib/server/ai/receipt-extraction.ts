import {
  receiptExtractedDataSchema,
  type ReceiptExtractedData,
  type ReceiptExtractionResult,
} from "$lib/receipt-extraction-types";

const GEMINI_MODEL = "gemini-2.5-flash";
const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const GROQ_SUPPORTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const PROMPT = `You are reading a payment receipt / transfer screenshot for a private lending app in the Philippines.
Analyze the image and return ONLY valid JSON (no markdown) with this exact shape:
{
  "verdict": "valid" | "likely_valid" | "unclear" | "invalid",
  "confidence": number between 0 and 1,
  "summary": "one short sentence for a lender/admin",
  "sender_name": string | null,
  "sender_bank": string | null,
  "receiver_name": string | null,
  "receiver_bank": string | null,
  "amount": number | null,
  "transaction_date": "YYYY-MM-DD" | null,
  "reference_number": string | null
}

This is proof of a fund transfer between two people (an investor funding a loan, or a borrower repaying one) - NOT a purchase receipt.
Accept digital transfer screenshots (GCash, Maya, InstaPay, PESONet, bank-to-bank transfer, bank app screenshots) and clear photos of PHP cash bills.

Rules:
- sender_name / sender_bank: the account/person the money moved FROM (e.g. "Juan Dela Cruz - BDO", "Maria Santos - GCash").
- receiver_name / receiver_bank: the account/person the money moved TO.
- For cash photos, sender/receiver/bank are usually not visible - leave them null; that's OK.
- amount: the numeric Philippine peso amount actually transferred. Ignore fees, running balances, or unrelated numbers.
- transaction_date: normalized to YYYY-MM-DD. If only a partial date is visible, infer the most recent plausible year. Null if not visible.
- reference_number: the transaction/reference ID shown, if any. Null otherwise.
- "valid": clear transfer screenshot with visible amount and date, or a clear PHP cash photo.
- "likely_valid": recognizable proof but partly blurry/cropped.
- "unclear": too ambiguous to tell.
- "invalid": clearly not payment proof (unrelated photo, meme, blank image, chat without a transfer, etc).
- summary must be plain English, max 120 characters, no line breaks.`;

interface RawExtraction {
  verdict?: unknown;
  confidence?: unknown;
  summary?: unknown;
  sender_name?: unknown;
  sender_bank?: unknown;
  receiver_name?: unknown;
  receiver_bank?: unknown;
  amount?: unknown;
  transaction_date?: unknown;
  reference_number?: unknown;
}

function getGeminiApiKeys(): string[] {
  const multi = process.env.GEMINI_API_KEYS?.trim();
  if (multi) {
    return multi
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean);
  }
  const single = process.env.GEMINI_API_KEY?.trim();
  return single ? [single] : [];
}

function getGroqApiKey(): string | null {
  return process.env.GROQ_API_KEY?.trim() || null;
}

function shouldTryNextProvider(status: number): boolean {
  return status === 429 || status === 403 || status >= 500;
}

function parseDataUrl(
  dataUrl: string,
): { mimeType: string; base64: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

function coerceString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function coerceDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function coerceConfidence(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, value));
}

function normalizeExtraction(
  raw: RawExtraction,
  provider: "gemini" | "groq",
): ReceiptExtractedData | null {
  const verdict =
    raw.verdict === "valid" ||
    raw.verdict === "likely_valid" ||
    raw.verdict === "unclear" ||
    raw.verdict === "invalid"
      ? raw.verdict
      : "unclear";

  const candidate = {
    verdict,
    confidence: coerceConfidence(raw.confidence),
    summary: coerceString(raw.summary)?.slice(0, 200) ?? "Receipt scanned.",
    senderName: coerceString(raw.sender_name),
    senderBank: coerceString(raw.sender_bank),
    receiverName: coerceString(raw.receiver_name),
    receiverBank: coerceString(raw.receiver_bank),
    amount: coerceNumber(raw.amount),
    transactionDate: coerceDate(raw.transaction_date),
    referenceNumber: coerceString(raw.reference_number),
    provider,
  };

  const parsed = receiptExtractedDataSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function extractJsonBlock(text: string): RawExtraction | null {
  const match = /\{[\s\S]*\}/.exec(text);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as RawExtraction;
  } catch {
    return null;
  }
}

type VisionCallResult =
  | { ok: true; raw: RawExtraction }
  | { ok: false; status: number };

async function parseVisionResponse(
  response: Response,
  extractText: (body: unknown) => unknown,
): Promise<VisionCallResult> {
  if (!response.ok) {
    return { ok: false, status: response.status };
  }

  const body = await response.json().catch(() => null);
  const text = extractText(body);
  if (typeof text !== "string") {
    return { ok: false, status: 502 };
  }

  const raw = extractJsonBlock(text);
  if (!raw) {
    return { ok: false, status: 502 };
  }

  return { ok: true, raw };
}

async function callGeminiVision(
  apiKey: string,
  base64: string,
  mimeType: string,
): Promise<VisionCallResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    }),
  });

  return parseVisionResponse(
    response,
    (body) =>
      (
        body as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: unknown }> };
          }>;
        }
      )?.candidates?.[0]?.content?.parts?.[0]?.text,
  );
}

async function callGroqVision(
  apiKey: string,
  base64: string,
  mimeType: string,
): Promise<VisionCallResult> {
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64}` },
              },
            ],
          },
        ],
      }),
    },
  );

  return parseVisionResponse(
    response,
    (body) =>
      (
        body as { choices?: Array<{ message?: { content?: unknown } }> }
      )?.choices?.[0]?.message?.content,
  );
}

function friendlyErrorMessage(): string {
  return "Couldn't read this receipt automatically. Please enter the details manually.";
}

/**
 * Reads a payment receipt image with AI and extracts sender/receiver/amount/date.
 * Never throws - AI failures are expected (bad image, rate limits, no keys configured)
 * and the caller should fall back to manual entry.
 */
export async function extractReceiptInfo(
  dataUrl: string,
): Promise<ReceiptExtractionResult> {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    return { success: false, error: "Unsupported image format." };
  }
  const { mimeType, base64 } = parsed;

  const geminiKeys = getGeminiApiKeys();
  for (const apiKey of geminiKeys) {
    try {
      const result = await callGeminiVision(apiKey, base64, mimeType);
      if (result.ok) {
        const data = normalizeExtraction(result.raw, "gemini");
        if (data) return { success: true, data };
        continue;
      }
      if (!shouldTryNextProvider(result.status)) {
        break;
      }
    } catch {
      // network error - try the next key
    }
  }

  const groqKey = getGroqApiKey();
  if (groqKey && GROQ_SUPPORTED_MIME_TYPES.has(mimeType)) {
    try {
      const result = await callGroqVision(groqKey, base64, mimeType);
      if (result.ok) {
        const data = normalizeExtraction(result.raw, "groq");
        if (data) return { success: true, data };
      }
    } catch {
      // fall through to the generic error below
    }
  }

  if (geminiKeys.length === 0 && !groqKey) {
    return {
      success: false,
      error: "AI receipt scanning isn't configured yet.",
    };
  }

  return { success: false, error: friendlyErrorMessage() };
}
