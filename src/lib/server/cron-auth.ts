import { timingSafeEqual } from "node:crypto";
import { env } from "$env/dynamic/private";

function readCronSecret(): string | undefined {
  const secret = env.CRON_SECRET ?? process.env.CRON_SECRET;
  return secret && secret.length > 0 ? secret : undefined;
}

/** Fail closed: missing secret or wrong bearer is unauthorized. */
export function isCronAuthorized(request: Request): boolean {
  const secret = readCronSecret();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const headerBuf = Buffer.from(header);
  const expectedBuf = Buffer.from(expected);
  if (headerBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(headerBuf, expectedBuf);
}
