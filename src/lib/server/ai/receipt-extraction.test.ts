import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractReceiptInfo } from "./receipt-extraction";

const SAMPLE_DATA_URL =
  "data:image/jpeg;base64," + Buffer.from("fake-image-bytes").toString("base64");

function geminiResponse(json: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }],
    }),
  };
}

function groqResponse(json: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify(json) } }],
    }),
  };
}

const VALID_JSON = {
  verdict: "valid",
  confidence: 0.92,
  summary: "GCash transfer of PHP 5000 from Juan to Maria.",
  sender_name: "Juan Dela Cruz",
  sender_bank: "GCash",
  receiver_name: "Maria Santos",
  receiver_bank: "BDO",
  amount: 5000,
  transaction_date: "2026-07-04",
  reference_number: "REF123",
};

describe("extractReceiptInfo", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.GEMINI_API_KEYS = "";
    process.env.GEMINI_API_KEY = "";
    process.env.GROQ_API_KEY = "";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("returns 'not configured' when no API keys are set", async () => {
    const result = await extractReceiptInfo(SAMPLE_DATA_URL);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/configured/i);
    }
  });

  it("returns unsupported-format error for a non data-url input", async () => {
    process.env.GEMINI_API_KEY = "key-1";
    const result = await extractReceiptInfo("not-a-data-url");
    expect(result.success).toBe(false);
  });

  it("extracts data successfully via Gemini on the first key", async () => {
    process.env.GEMINI_API_KEYS = "key-1,key-2";
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse(VALID_JSON));
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractReceiptInfo(SAMPLE_DATA_URL);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(5000);
      expect(result.data.senderName).toBe("Juan Dela Cruz");
      expect(result.data.transactionDate).toBe("2026-07-04");
      expect(result.data.provider).toBe("gemini");
    }
  });

  it("rotates to the next Gemini key on a 429 and still succeeds", async () => {
    process.env.GEMINI_API_KEYS = "key-1,key-2";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce(geminiResponse(VALID_JSON));
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractReceiptInfo(SAMPLE_DATA_URL);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
  });

  it("falls back to Groq once all Gemini keys fail", async () => {
    process.env.GEMINI_API_KEYS = "key-1";
    process.env.GROQ_API_KEY = "groq-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce(groqResponse(VALID_JSON));
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractReceiptInfo(SAMPLE_DATA_URL);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.provider).toBe("groq");
    }
  });

  it("returns a friendly error when every provider fails", async () => {
    process.env.GEMINI_API_KEYS = "key-1";
    process.env.GROQ_API_KEY = "groq-key";
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractReceiptInfo(SAMPLE_DATA_URL);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/manually/i);
    }
  });

  it("treats malformed JSON output as a soft failure, not a throw", async () => {
    process.env.GEMINI_API_KEY = "key-1";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "not json at all" }] } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(extractReceiptInfo(SAMPLE_DATA_URL)).resolves.toMatchObject({
      success: false,
    });
  });

  it("clamps an out-of-range confidence and defaults an unknown verdict", async () => {
    process.env.GEMINI_API_KEY = "key-1";
    const fetchMock = vi.fn().mockResolvedValue(
      geminiResponse({
        ...VALID_JSON,
        verdict: "surely_valid",
        confidence: 1.5,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractReceiptInfo(SAMPLE_DATA_URL);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.verdict).toBe("unclear");
      expect(result.data.confidence).toBe(1);
    }
  });

  it("nulls out an unparseable transaction date instead of failing", async () => {
    process.env.GEMINI_API_KEY = "key-1";
    const fetchMock = vi.fn().mockResolvedValue(
      geminiResponse({ ...VALID_JSON, transaction_date: "not-a-date" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractReceiptInfo(SAMPLE_DATA_URL);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.transactionDate).toBeNull();
    }
  });
});
