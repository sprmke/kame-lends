/**
 * Typed errors for the AI gateway. Feature code catches `AiGatewayError` and maps
 * `code` to a friendly message with `aiErrorMessage` — never surface provider text.
 */
export const AI_ERROR_CODES = [
  "not_configured",
  "disabled",
  "quota_exceeded",
  "rate_limited",
  "timeout",
  "provider_error",
  "invalid_output",
  "unsupported_input",
] as const;

export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

export class AiGatewayError extends Error {
  readonly code: AiErrorCode;
  readonly provider: "gemini" | "groq" | null;
  readonly status: number | null;

  constructor(
    code: AiErrorCode,
    message?: string,
    options: { provider?: "gemini" | "groq"; status?: number } = {},
  ) {
    super(message ?? code);
    this.name = "AiGatewayError";
    this.code = code;
    this.provider = options.provider ?? null;
    this.status = options.status ?? null;
  }
}

export function isAiGatewayError(value: unknown): value is AiGatewayError {
  return value instanceof AiGatewayError;
}

const FRIENDLY_MESSAGES: Record<AiErrorCode, string> = {
  not_configured: "AI receipt scanning isn't configured yet.",
  disabled: "AI scanning is turned off right now.",
  quota_exceeded:
    "You've reached today's AI scan limit. Enter the details manually.",
  rate_limited: "AI is busy right now. Try again in a minute.",
  timeout: "AI took too long to read this. Try again or enter it manually.",
  provider_error:
    "Couldn't read this receipt automatically. Please enter the details manually.",
  invalid_output:
    "Couldn't read this receipt automatically. Please enter the details manually.",
  unsupported_input: "Please upload a JPEG, PNG, WebP, or HEIC image.",
};

export function aiErrorMessage(code: AiErrorCode): string {
  return FRIENDLY_MESSAGES[code];
}
