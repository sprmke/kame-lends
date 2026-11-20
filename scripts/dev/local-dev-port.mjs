import { createHash } from "node:crypto";

/** Primary checkout port. Other Orca worktrees get a sticky port in this range. */
const DEFAULT_DEV_PORT = 3200;
const PORT_RANGE = 100;

/** Playwright webServer port (separate from day-to-day dev). */
export const E2E_DEV_PORT = 4174;

function stickyPort() {
  const worktree = process.env.ORCA_WORKTREE_PATH;
  const root = process.env.ORCA_ROOT_PATH;
  if (!worktree || worktree === root) return DEFAULT_DEV_PORT;
  const hash = createHash("sha1").update(worktree).digest().readUInt16BE(0);
  return DEFAULT_DEV_PORT + (hash % PORT_RANGE);
}

/**
 * Local Vite port. Set `LOCAL_DEV_PORT` to override (the worktree launcher bumps
 * it on a collision). The primary checkout keeps :3200.
 */
export const LOCAL_DEV_PORT =
  Number(process.env.LOCAL_DEV_PORT) || stickyPort();
