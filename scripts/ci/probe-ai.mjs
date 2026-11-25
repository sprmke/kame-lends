/**
 * Production AI probe. Run only in CI after `vercel env pull` so the Gemini key
 * comes from the production environment. Never prints a key or a full error.
 *
 *   node --env-file=.env.production scripts/ci/probe-ai.mjs
 */
const raw = process.env.GEMINI_API_KEYS ?? process.env.GEMINI_API_KEY ?? "";
const key = raw
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)[0];
if (!key) {
  console.error(JSON.stringify({ ok: false, error: "no Gemini key in env" }));
  process.exit(1);
}

const BASE = "https://generativelanguage.googleapis.com/v1beta";
// 1x1 transparent PNG, enough to exercise the image path.
const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nH0AAAAASUVORK5CYII=";

async function probe({ model, body }) {
  const started = Date.now();
  try {
    const response = await fetch(`${BASE}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const parsed = await response.json().catch(() => null);
    const candidate = parsed?.candidates?.[0];
    return {
      model,
      ok: response.ok,
      status: response.status,
      finishReason: candidate?.finishReason ?? null,
      errorCode: parsed?.error?.status ?? null,
      ms: Date.now() - started,
    };
  } catch (error) {
    return {
      model,
      ok: false,
      status: null,
      finishReason: null,
      errorCode: error?.name === "TimeoutError" ? "timeout" : "network",
      ms: Date.now() - started,
    };
  }
}

const assistant = await probe({
  model: "gemini-3.8-flash",
  body: {
    contents: [{ role: "user", parts: [{ text: "Reply with the word OK." }] }],
    generationConfig: {
      maxOutputTokens: 16,
      temperature: 0.2,
      thinkingConfig: { thinkingBudget: 512 },
    },
  },
});

const receipts = await probe({
  model: "gemini-3.5-flash-lite",
  body: {
    contents: [
      {
        role: "user",
        parts: [
          { text: "Return JSON with ok set to yes." },
          { inlineData: { mimeType: "image/png", data: TINY_PNG } },
        ],
      },
    ],
    generationConfig: {
      maxOutputTokens: 32,
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: { ok: { type: "STRING" } },
        required: ["ok"],
      },
      thinkingConfig: { thinkingBudget: 0 },
    },
  },
});

console.log(JSON.stringify({ assistant, receipts }));
if (!assistant.ok || !receipts.ok) process.exit(1);
