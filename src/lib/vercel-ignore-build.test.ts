import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const script = path.resolve(
  "scripts/deploy/vercel-ignore-git-production-build.sh",
);

function exitCode(env: Record<string, string>) {
  const result = spawnSync("bash", [script], {
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  return result.status;
}

describe("vercel ignore build step", () => {
  it("skips Git production builds on main", () => {
    expect(
      exitCode({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" }),
    ).toBe(0);
  });

  it("builds previews and production branches other than main", () => {
    expect(
      exitCode({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "main" }),
    ).toBe(1);
    expect(
      exitCode({
        VERCEL_ENV: "production",
        VERCEL_GIT_COMMIT_REF: "feat/example",
      }),
    ).toBe(1);
  });
});
