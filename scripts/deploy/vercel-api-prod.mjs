#!/usr/bin/env node
/**
 * Production deploy for GitHub Actions.
 *
 * `vercel pull` / `vercel deploy` call the team endpoint before the project
 * endpoint. A project token can read this project and still get 403 on the
 * team, which the CLI reports as "Could not retrieve Project Settings".
 * Upload the git tree and create the deployment through the API instead.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const token = process.env.VERCEL_TOKEN;
const orgId = process.env.VERCEL_ORG_ID;
const projectId = process.env.VERCEL_PROJECT_ID;

if (!token || !orgId || !projectId) {
  console.error("VERCEL_TOKEN, VERCEL_ORG_ID, and VERCEL_PROJECT_ID are required.");
  process.exit(1);
}

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();
const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const message = execFileSync("git", ["log", "-1", "--format=%s"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const files = execFileSync("git", ["ls-files", "-z"], { cwd: root })
  .toString()
  .split("\0")
  .filter(Boolean);

const api = "https://api.vercel.com";

async function vercel(pathname, { method = "GET", body, headers } = {}) {
  const response = await fetch(`${api}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...headers,
    },
    body,
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (!response.ok) {
    const error = payload?.error;
    const detail =
      (error && `${error.code || ""} ${error.message || ""}`.trim()) ||
      (typeof payload === "string" ? payload.slice(0, 400) : JSON.stringify(payload));
    throw new Error(`${method} ${pathname} failed (${response.status}): ${detail}`);
  }
  return payload;
}

async function mapPool(items, limit, worker) {
  const queue = items.slice();
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      await worker(item);
    }
  });
  await Promise.all(runners);
}

console.log(`→ upload ${files.length} files from ${sha.slice(0, 7)}`);

const uploaded = [];
let done = 0;
await mapPool(files, 12, async (file) => {
  const absolute = path.join(root, file);
  const bytes = readFileSync(absolute);
  const digest = createHash("sha1").update(bytes).digest("hex");
  await vercel(`/v2/files?teamId=${encodeURIComponent(orgId)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "x-vercel-digest": digest,
    },
    body: bytes,
  });
  uploaded.push({ file, sha: digest, size: bytes.length });
  done += 1;
  if (done % 200 === 0 || done === files.length) {
    console.log(`  uploaded ${done}/${files.length}`);
  }
});

console.log("→ create production deployment");
const deployment = await vercel(
  `/v13/deployments?teamId=${encodeURIComponent(orgId)}&forceNew=1`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "pawn-tracker",
      project: projectId,
      target: "production",
      files: uploaded,
      meta: {
        githubCommitSha: sha,
        githubCommitRef: "main",
        githubCommitOrg: "sprmke",
        githubCommitRepo: "kame-lends",
        githubCommitMessage: message,
      },
    }),
  },
);

const id = deployment.id || deployment.deploymentId;
if (!id) {
  throw new Error("Deployment response did not include an id.");
}
console.log(`  ${id} ${deployment.url || ""}`.trim());

const deadline = Date.now() + 15 * 60 * 1000;
let ready = deployment;
while (Date.now() < deadline) {
  const state = ready.readyState || ready.status;
  if (state === "READY") break;
  if (state === "ERROR" || state === "CANCELED") {
    throw new Error(
      `Deployment ${id} ${state}: ${ready.errorMessage || ready.error?.message || "no message"}`,
    );
  }
  await new Promise((resolve) => setTimeout(resolve, 5000));
  ready = await vercel(
    `/v13/deployments/${encodeURIComponent(id)}?teamId=${encodeURIComponent(orgId)}`,
  );
  console.log(`  ${ready.readyState || ready.status}`);
}

if ((ready.readyState || ready.status) !== "READY") {
  throw new Error(`Deployment ${id} did not become ready.`);
}

console.log(`✓ Production deploy ready: https://${ready.url}`);
