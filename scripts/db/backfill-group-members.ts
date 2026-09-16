/**
 * Recompute derived group membership for every group.
 *
 * Usage:
 *   bun run db:backfill:group-members
 *   DATABASE_URL=... bun scripts/db/backfill-group-members.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../../src/lib/server/db/index.ts");
  const { loanGroups } = await import("../../src/lib/server/db/schema.ts");
  const { recomputeGroupMembers } =
    await import("../../src/lib/server/group-access.ts");

  const groups = await db.select({ id: loanGroups.id }).from(loanGroups);
  console.log(`Recomputing members for ${groups.length} group(s)…`);
  for (const { id } of groups) {
    const result = await recomputeGroupMembers(id);
    console.log(
      `  group ${id}: changed=${result.changed} gained=${result.gained.length} lost=${result.lost.length}`,
    );
  }
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
