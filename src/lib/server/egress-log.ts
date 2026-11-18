/**
 * Structured egress telemetry for crons and high-cost APIs.
 * Never log bodies, emails, or query strings.
 */

export type EgressLogInput = {
  kind: string;
  path: string;
  ms?: number;
  status?: number;
  /** Approximate UTF-8 byte length of a response/email payload (not Neon wire bytes). */
  approxBytes?: number;
  rows?: number;
  extra?: Record<string, string | number | boolean | null>;
};

export function approxJsonBytes(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return 0;
  }
}

export function logEgress(input: EgressLogInput): void {
  console.info(
    JSON.stringify({
      level: "info",
      kind: input.kind,
      path: input.path,
      ms: input.ms ?? null,
      status: input.status ?? null,
      approxBytes: input.approxBytes ?? null,
      rows: input.rows ?? null,
      sha: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev-local",
      ...(input.extra ?? {}),
    }),
  );
}
