import { readFileSync } from "node:fs";
import { parse } from "dotenv";

/**
 * Env for standalone Bun scripts. Values in `.env.local` win over `process.env`
 * so Bun's partial inject (e.g. empty strings) does not clobber secrets.
 */
export function envForScript(
  path = ".env.local",
): Record<string, string | undefined> {
  let fromFile: Record<string, string> = {};
  try {
    fromFile = parse(readFileSync(path, "utf8")) as Record<string, string>;
  } catch {
    /* missing file */
  }
  return { ...process.env, ...fromFile };
}
