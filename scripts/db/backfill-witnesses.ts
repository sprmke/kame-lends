/**
 * One-shot backfill: create reusable witness contacts from loan contract
 * customization and signing invitations, then link witness_id on invitations
 * and witness1Id / witness2Id in contract JSON.
 *
 * Usage:
 *   bun run db:backfill:witnesses --dry-run
 *   bun run db:backfill:witnesses --use-prod --dry-run
 *   bun run db:backfill:witnesses --email=you@example.com
 *
 * Hosted Neon writes: LENDWAVE=lendwave in the command string. Dry-run is read-only.
 */
import postgres from "postgres";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const emailArg = args.find((a) => a.startsWith("--email="));
const emailFilter =
  emailArg?.slice("--email=".length).trim().toLowerCase() || null;

type Customization = Record<string, unknown>;

interface SigningInvitationRow {
  id: number;
  loan_id: number;
  party_role: "witness_1" | "witness_2";
  party_name: string;
  party_email: string | null;
  witness_id: number | null;
  signature_data_url: string | null;
}

interface ContractRow {
  loan_id: number;
  user_id: string;
  customization: Customization;
}

interface WitnessCandidate {
  userId: string;
  name: string;
  email: string | null;
  address: string | null;
  validIdUrl: string | null;
  eSignatureUrl: string | null;
  existingWitnessId: number | null;
  slot: 1 | 2;
  loanId: number;
  invitationId: number | null;
}

function loadDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL is required (.env.local or env).");
    process.exit(1);
  }
  return url;
}

function assertTargetAllowed(url: string): void {
  const isLocal = /(?:localhost|127\.0\.0\.1)/.test(url);
  const isHosted = url.includes("neon.tech");

  if (isHosted && !dryRun && process.env.LENDWAVE !== "lendwave") {
    console.error(
      "Refusing hosted Neon update without LENDWAVE=lendwave in the command.",
    );
    console.error(
      "Example: LENDWAVE=lendwave bun run db:backfill:witnesses --use-prod",
    );
    process.exit(1);
  }

  if (!isLocal && !isHosted) {
    console.warn(
      "WARN: DATABASE_URL is neither local nor neon.tech — proceed carefully.",
    );
  }
}

async function assertSchemaReady(
  sql: postgres.Sql,
  databaseUrl: string,
): Promise<void> {
  const isLocal = /(?:localhost|127\.0\.0\.1)/.test(databaseUrl);

  const tableCheck = await sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'witnesses'
    ) AS has_witnesses,
    EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'loan_contracts'
    ) AS has_loan_contracts
  `;

  const { has_witnesses, has_loan_contracts } = tableCheck[0] ?? {};
  if (has_witnesses && has_loan_contracts) return;

  console.error("Database is missing witnesses / loan_contracts schema.");
  if (isLocal) {
    console.error("");
    console.error("Local Docker is empty. Load data first, then re-run:");
    console.error("  bun run db:local:sync-prod");
    console.error("  bun run db:backfill:witnesses --dry-run");
    console.error("");
    console.error("Or preview against Neon prod (read-only dry-run):");
    console.error("  bun run db:backfill:witnesses --use-prod --dry-run");
  } else {
    console.error("Run migrations on this database before the backfill.");
  }
  process.exit(1);
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeName(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

function normalizeEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase();
  return trimmed || null;
}

function readString(customization: Customization, key: string): string {
  const value = customization[key];
  return typeof value === "string" ? value.trim() : "";
}

function readNumberOrNull(
  customization: Customization,
  key: string,
): number | null {
  const value = customization[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isPlaceholderWitnessName(name: string): boolean {
  const normalized = normalizeName(name);
  return (
    normalized === "" ||
    normalized === "witness 1" ||
    normalized === "witness 2"
  );
}

function resolveWitnessName(
  customization: Customization,
  slot: 1 | 2,
  invitation: SigningInvitationRow | null,
): string | null {
  const customName =
    slot === 1
      ? readString(customization, "witness1Name")
      : readString(customization, "witness2Name");

  if (customName && !isPlaceholderWitnessName(customName)) {
    return normalizeWhitespace(customName);
  }

  const partyName = invitation?.party_name?.trim() ?? "";
  if (partyName && !isPlaceholderWitnessName(partyName)) {
    return normalizeWhitespace(partyName);
  }

  return null;
}

function witnessSlotIncluded(
  customization: Customization,
  slot: 1 | 2,
): boolean {
  if (customization.includeWitnesses === false) {
    return false;
  }

  if (slot === 1) {
    return true;
  }

  if (customization.includeSecondWitness === true) {
    return true;
  }

  return Boolean(
    readString(customization, "witness2Name") ||
    readString(customization, "witness2Address") ||
    readString(customization, "witness2ValidIdUrl") ||
    readString(customization, "witness2ESignatureUrl"),
  );
}

function buildWitnessCandidate(
  contract: ContractRow,
  slot: 1 | 2,
  invitation: SigningInvitationRow | null,
): WitnessCandidate | null {
  const { customization } = contract;
  if (!witnessSlotIncluded(customization, slot) && !invitation) {
    return null;
  }

  const prefix = slot === 1 ? "witness1" : "witness2";
  const name = resolveWitnessName(customization, slot, invitation);
  const email =
    normalizeEmail(readString(customization, `${prefix}Email`)) ??
    normalizeEmail(invitation?.party_email);
  const address = readString(customization, `${prefix}Address`) || null;
  const validIdUrl = readString(customization, `${prefix}ValidIdUrl`) || null;
  const eSignatureUrl =
    readString(customization, `${prefix}ESignatureUrl`) ||
    invitation?.signature_data_url?.trim() ||
    null;

  const existingWitnessId =
    readNumberOrNull(customization, `${prefix}Id`) ??
    invitation?.witness_id ??
    null;

  const hasSubstantiveData = Boolean(
    name ||
    email ||
    address ||
    validIdUrl ||
    eSignatureUrl ||
    existingWitnessId,
  );

  if (!hasSubstantiveData) {
    return null;
  }

  if (!name) {
    return null;
  }

  return {
    userId: contract.user_id,
    name,
    email,
    address,
    validIdUrl,
    eSignatureUrl,
    existingWitnessId,
    slot,
    loanId: contract.loan_id,
    invitationId: invitation?.id ?? null,
  };
}

function dedupeKey(userId: string, name: string, email: string | null): string {
  return `${userId}|${normalizeName(name)}|${email ?? ""}`;
}

function pickRicherCandidate(
  current: WitnessCandidate,
  next: WitnessCandidate,
): WitnessCandidate {
  const score = (candidate: WitnessCandidate) =>
    Number(Boolean(candidate.email)) +
    Number(Boolean(candidate.address)) +
    Number(Boolean(candidate.validIdUrl)) +
    Number(Boolean(candidate.eSignatureUrl)) +
    Number(Boolean(candidate.existingWitnessId));

  if (score(next) > score(current)) {
    return {
      ...next,
      existingWitnessId: next.existingWitnessId ?? current.existingWitnessId,
    };
  }

  return {
    ...current,
    email: current.email ?? next.email,
    address: current.address ?? next.address,
    validIdUrl: current.validIdUrl ?? next.validIdUrl,
    eSignatureUrl: current.eSignatureUrl ?? next.eSignatureUrl,
    existingWitnessId: current.existingWitnessId ?? next.existingWitnessId,
  };
}

async function main() {
  const databaseUrl = loadDatabaseUrl();
  assertTargetAllowed(databaseUrl);

  const sql = postgres(databaseUrl, { max: 1 });
  await assertSchemaReady(sql, databaseUrl);

  const ownerFilter = emailFilter
    ? await sql`
        SELECT id
        FROM "user"
        WHERE LOWER(TRIM(email)) = ${emailFilter}
      `
    : await sql`
        SELECT DISTINCT l.user_id AS id
        FROM loans l
        INNER JOIN loan_contracts lc ON lc.loan_id = l.id
      `;

  const ownerIds = ownerFilter.map((row) => row.id as string);
  if (ownerIds.length === 0) {
    console.log("No matching workspace owners found.");
    await sql.end();
    return;
  }

  const contracts = await sql<ContractRow[]>`
    SELECT lc.loan_id, l.user_id, lc.customization
    FROM loan_contracts lc
    INNER JOIN loans l ON l.id = lc.loan_id
    WHERE l.user_id = ANY(${ownerIds})
    ORDER BY lc.loan_id
  `;

  const invitations = await sql<SigningInvitationRow[]>`
    SELECT
      i.id,
      i.loan_id,
      i.party_role,
      i.party_name,
      i.party_email,
      i.witness_id,
      i.signature_data_url
    FROM loan_signing_invitations i
    INNER JOIN loans l ON l.id = i.loan_id
    WHERE l.user_id = ANY(${ownerIds})
      AND i.party_role IN ('witness_1', 'witness_2')
    ORDER BY i.loan_id, i.id
  `;

  const invitationsByLoan = new Map<number, SigningInvitationRow[]>();
  for (const invitation of invitations) {
    const list = invitationsByLoan.get(invitation.loan_id) ?? [];
    list.push(invitation);
    invitationsByLoan.set(invitation.loan_id, list);
  }

  const existingWitnesses = await sql<
    {
      id: number;
      user_id: string;
      name: string;
      email: string | null;
    }[]
  >`
    SELECT id, user_id, name, email
    FROM witnesses
    WHERE user_id = ANY(${ownerIds})
  `;

  const witnessById = new Map(existingWitnesses.map((row) => [row.id, row]));
  const witnessByKey = new Map<string, number>();
  for (const row of existingWitnesses) {
    witnessByKey.set(
      dedupeKey(row.user_id, row.name, normalizeEmail(row.email)),
      row.id,
    );
  }

  const canonicalByKey = new Map<string, WitnessCandidate>();
  const links: Array<{
    witnessKey: string;
    loanId: number;
    slot: 1 | 2;
    invitationId: number | null;
    existingWitnessId: number | null;
  }> = [];

  for (const contract of contracts) {
    const loanInvitations = invitationsByLoan.get(contract.loan_id) ?? [];
    const witness1Invitation =
      loanInvitations.find((row) => row.party_role === "witness_1") ?? null;
    const witness2Invitation =
      loanInvitations.find((row) => row.party_role === "witness_2") ?? null;

    for (const slot of [1, 2] as const) {
      const invitation = slot === 1 ? witness1Invitation : witness2Invitation;
      const candidate = buildWitnessCandidate(contract, slot, invitation);
      if (!candidate) continue;

      const key = dedupeKey(candidate.userId, candidate.name, candidate.email);
      const current = canonicalByKey.get(key);
      canonicalByKey.set(
        key,
        current ? pickRicherCandidate(current, candidate) : candidate,
      );

      links.push({
        witnessKey: key,
        loanId: candidate.loanId,
        slot,
        invitationId: candidate.invitationId,
        existingWitnessId: candidate.existingWitnessId,
      });
    }
  }

  let createCount = 0;
  let linkInvitationCount = 0;
  let linkContractCount = 0;
  let portalLinkCount = 0;

  const resolvedWitnessIdByKey = new Map<string, number>();
  let nextDryRunWitnessId = -1;

  function resolveWitnessIdForKey(
    key: string,
    candidate: WitnessCandidate,
  ): number | null {
    let witnessId = candidate.existingWitnessId;

    if (witnessId != null) {
      const existing = witnessById.get(witnessId);
      if (!existing || existing.user_id !== candidate.userId) {
        witnessId = null;
      }
    }

    if (witnessId == null) {
      witnessId = witnessByKey.get(key) ?? null;
    }

    return witnessId;
  }

  for (const [key, candidate] of canonicalByKey) {
    let witnessId = resolveWitnessIdForKey(key, candidate);

    if (witnessId == null) {
      createCount += 1;
      console.log(
        `  + witness "${candidate.name}"${candidate.email ? ` <${candidate.email}>` : ""} (workspace ${candidate.userId.slice(0, 8)}…)`,
      );

      if (dryRun) {
        witnessId = nextDryRunWitnessId;
        nextDryRunWitnessId -= 1;
      } else {
        const inserted = await sql<{ id: number }[]>`
          INSERT INTO witnesses (
            user_id,
            name,
            email,
            contact_number,
            address,
            valid_id_url,
            e_signature_url,
            created_at,
            updated_at
          )
          VALUES (
            ${candidate.userId},
            ${candidate.name},
            ${candidate.email},
            NULL,
            ${candidate.address},
            ${candidate.validIdUrl},
            ${candidate.eSignatureUrl},
            NOW(),
            NOW()
          )
          RETURNING id
        `;
        witnessId = inserted[0]?.id ?? null;
        if (witnessId == null) {
          throw new Error(`Failed to insert witness for key ${key}`);
        }
        witnessByKey.set(key, witnessId);
        witnessById.set(witnessId, {
          id: witnessId,
          user_id: candidate.userId,
          name: candidate.name,
          email: candidate.email,
        });
      }
    } else {
      console.log(
        `  = reuse witness ${witnessId} "${candidate.name}"${candidate.email ? ` <${candidate.email}>` : ""}`,
      );
    }

    if (witnessId != null) {
      resolvedWitnessIdByKey.set(key, witnessId);
    }
  }

  const contractCustomizations = new Map(
    contracts.map((row) => [row.loan_id, row.customization]),
  );

  for (const link of links) {
    const candidate = canonicalByKey.get(link.witnessKey);
    if (!candidate) continue;

    const witnessId =
      resolvedWitnessIdByKey.get(link.witnessKey) ??
      resolveWitnessIdForKey(link.witnessKey, candidate);
    if (witnessId == null) continue;

    if (link.invitationId != null && link.existingWitnessId !== witnessId) {
      linkInvitationCount += 1;
      if (!dryRun) {
        await sql`
          UPDATE loan_signing_invitations
          SET witness_id = ${witnessId}, updated_at = NOW()
          WHERE id = ${link.invitationId}
            AND witness_id IS DISTINCT FROM ${witnessId}
        `;
      }
    }

    const idField = link.slot === 1 ? "witness1Id" : "witness2Id";
    const customization = contractCustomizations.get(link.loanId) ?? {};
    const currentId = readNumberOrNull(customization, idField);
    if (currentId === witnessId) continue;

    linkContractCount += 1;
    if (!dryRun) {
      await sql`
        UPDATE loan_contracts
        SET
          customization = jsonb_set(
            customization,
            ${`{${idField}}`},
            to_jsonb(${witnessId}::int),
            true
          ),
          updated_at = NOW()
        WHERE loan_id = ${link.loanId}
      `;
    }
  }

  if (!dryRun) {
    const portalLinks = await sql<{ id: number }[]>`
      UPDATE witnesses w
      SET witness_user_id = u.id, updated_at = NOW()
      FROM "user" u
      WHERE w.user_id = ANY(${ownerIds})
        AND w.email IS NOT NULL
        AND TRIM(w.email) != ''
        AND LOWER(TRIM(w.email)) = LOWER(TRIM(u.email))
        AND w.witness_user_id IS DISTINCT FROM u.id
      RETURNING w.id
    `;
    portalLinkCount = portalLinks.length;
  } else {
    const portalCandidates = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM witnesses w
      INNER JOIN "user" u
        ON LOWER(TRIM(w.email)) = LOWER(TRIM(u.email))
      WHERE w.user_id = ANY(${ownerIds})
        AND w.email IS NOT NULL
        AND TRIM(w.email) != ''
        AND w.witness_user_id IS DISTINCT FROM u.id
    `;
    portalLinkCount = portalCandidates[0]?.count ?? 0;
  }

  console.log(
    dryRun
      ? `\nDry run for ${ownerIds.length} workspace(s):`
      : `\nApplied for ${ownerIds.length} workspace(s):`,
  );
  console.log(
    `  ${createCount} witness contact(s) ${dryRun ? "would be" : ""} created`,
  );
  console.log(
    `  ${linkInvitationCount} signing invitation(s) ${dryRun ? "would be" : ""} linked`,
  );
  console.log(
    `  ${linkContractCount} contract customization row(s) ${dryRun ? "would be" : ""} updated`,
  );
  console.log(
    `  ${portalLinkCount} witness portal link(s) ${dryRun ? "would be" : ""} set from email`,
  );

  if (!dryRun) {
    console.log("\nRestart the dev server to clear in-memory caches.");
  }

  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
