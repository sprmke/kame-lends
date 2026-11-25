/**
 * Production AI probe. Run only in CI after `vercel env pull` so the Gemini key
 * comes from the production environment. Never prints a key or a raw error.
 *
 *   node --env-file=.env.production scripts/ci/probe-ai.mjs
 */
const keys = [];
const seen = new Set();
for (const value of (process.env.GEMINI_API_KEYS ?? "").split(",")) {
  const key = value.trim();
  if (key && !seen.has(key)) {
    seen.add(key);
    keys.push({ key, source: "GEMINI_API_KEYS" });
  }
}
const single = (process.env.GEMINI_API_KEY ?? "").trim();
if (single && !seen.has(single)) {
  seen.add(single);
  keys.push({ key: single, source: "GEMINI_API_KEY" });
}
if (keys.length === 0) {
  console.error(JSON.stringify({ ok: false, error: "no Gemini key in env" }));
  process.exit(1);
}

const BASE = "https://generativelanguage.googleapis.com/v1beta";
// 1x1 transparent PNG, enough to exercise the image path.
const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nH0AAAAASUVORK5CYII=";

async function probe({ key, model, body }) {
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
    const rawMessage = String(parsed?.error?.message ?? "");
    return {
      model,
      ok: response.ok,
      status: response.status,
      finishReason: candidate?.finishReason ?? null,
      errorCode: parsed?.error?.status ?? null,
      errorMessage: rawMessage
        .replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]")
        .slice(0, 240),
      ms: Date.now() - started,
    };
  } catch (error) {
    return {
      model,
      ok: false,
      status: null,
      finishReason: null,
      errorCode: error?.name === "TimeoutError" ? "timeout" : "network",
      errorMessage: "",
      ms: Date.now() - started,
    };
  }
}

const keyChecks = [];
for (const [index, entry] of keys.entries()) {
  const result = await probe({
    key: entry.key,
    model: "gemini-3.8-flash",
    body: {
      contents: [{ role: "user", parts: [{ text: "Reply with OK." }] }],
      generationConfig: { maxOutputTokens: 8 },
    },
  });
  keyChecks.push({ index, source: entry.source, ...result });
}

const working = keyChecks.find((check) => check.ok);
if (!working) {
  console.log(
    JSON.stringify({ keys: keyChecks, assistant: null, receipts: null }),
  );
  process.exit(1);
}

const key = keys[working.index].key;
const assistant = await probe({
  key,
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
  key,
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

console.log(JSON.stringify({ keyChecks, assistant, receipts }));
if (!assistant.ok || !receipts.ok) process.exit(1);
