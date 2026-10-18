import { and, eq, or, sql } from "drizzle-orm";
import { db } from "$lib/server/db";
import { borrowers, investors, witnesses } from "$lib/server/db/schema";
import { normalizeEmail } from "$lib/loan-signing";
import {
  findOrCreatePartyUser,
  type PartyUserRole,
} from "$lib/server/party-user";
import {
  invalidateBorrowerData,
  invalidateInvestorData,
  invalidateWitnessData,
} from "$lib/server/cache-invalidation";

export class PartyEmailConflictError extends Error {
  readonly role: PartyUserRole;

  constructor(role: PartyUserRole) {
    const label =
      role === "borrower"
        ? "borrower"
        : role === "investor"
          ? "investor"
          : "witness";
    super(`A ${label} with this email already exists`);
    this.name = "PartyEmailConflictError";
    this.role = role;
  }
}

type ContactInput = {
  workspaceOwnerId: string;
  name: string;
  email: string;
  contactNumber: string | null;
  address: string | null;
  /** Undefined leaves borrower notes unchanged. */
  notes?: string | null;
  validIdUrl?: string | null;
  eSignatureUrl?: string | null;
  /** Write valid ID and signature onto every role row. */
  syncDocuments?: boolean;
};

type UpsertInput = ContactInput & {
  role: PartyUserRole;
  anchorId?: number;
};

type InvestorRow = typeof investors.$inferSelect;
type BorrowerRow = typeof borrowers.$inferSelect;
type WitnessRow = typeof witnesses.$inferSelect;
type PartyRow = InvestorRow | BorrowerRow | WitnessRow;

function emailEquals(
  column:
    typeof investors.email | typeof borrowers.email | typeof witnesses.email,
  email: string,
) {
  return sql`lower(btrim(${column})) = ${email}`;
}

function canonical<T extends { id: number }>(rows: T[]): T | null {
  if (rows.length === 0) return null;
  return rows.reduce((best, row) => (row.id < best.id ? row : best));
}

function invalidatePartyLists() {
  invalidateInvestorData();
  invalidateBorrowerData();
  invalidateWitnessData();
}

async function loadInvestorMatches(
  workspaceOwnerId: string,
  partyUserId: string,
  email: string,
  anchorId?: number,
) {
  return db.query.investors.findMany({
    where: and(
      eq(investors.userId, workspaceOwnerId),
      or(
        eq(investors.investorUserId, partyUserId),
        emailEquals(investors.email, email),
        ...(anchorId ? [eq(investors.id, anchorId)] : []),
      ),
    ),
  });
}

async function loadBorrowerMatches(
  workspaceOwnerId: string,
  partyUserId: string,
  email: string,
  anchorId?: number,
) {
  return db.query.borrowers.findMany({
    where: and(
      eq(borrowers.userId, workspaceOwnerId),
      or(
        eq(borrowers.borrowerUserId, partyUserId),
        emailEquals(borrowers.email, email),
        ...(anchorId ? [eq(borrowers.id, anchorId)] : []),
      ),
    ),
  });
}

async function loadWitnessMatches(
  workspaceOwnerId: string,
  partyUserId: string,
  email: string,
  anchorId?: number,
) {
  return db.query.witnesses.findMany({
    where: and(
      eq(witnesses.userId, workspaceOwnerId),
      or(
        eq(witnesses.witnessUserId, partyUserId),
        emailEquals(witnesses.email, email),
        ...(anchorId ? [eq(witnesses.id, anchorId)] : []),
      ),
    ),
  });
}

/**
 * Save one contact and make that person available as investor, borrower, and witness.
 * The same email is one Auth.js user, including a later Google sign-in.
 */
export async function upsertWorkspacePartyContact(
  input: UpsertInput,
): Promise<PartyRow> {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  if (!email) throw new Error("Email is required");
  if (name.length < 2) throw new Error("Name is required (min 2 characters)");

  const partyUser = await findOrCreatePartyUser({
    email,
    name,
    role: input.role,
  });
  if (!partyUser) throw new Error("Email is required");

  const anchorFor = (role: PartyUserRole) =>
    input.role === role ? input.anchorId : undefined;

  const [investorMatches, borrowerMatches, witnessMatches] = await Promise.all([
    loadInvestorMatches(
      input.workspaceOwnerId,
      partyUser.id,
      email,
      anchorFor("investor"),
    ),
    loadBorrowerMatches(
      input.workspaceOwnerId,
      partyUser.id,
      email,
      anchorFor("borrower"),
    ),
    loadWitnessMatches(
      input.workspaceOwnerId,
      partyUser.id,
      email,
      anchorFor("witness"),
    ),
  ]);

  const matches = {
    investor: investorMatches,
    borrower: borrowerMatches,
    witness: witnessMatches,
  };

  let anchorId = input.anchorId;
  const roleMatches = matches[input.role];
  if (anchorId) {
    const others = roleMatches.filter((row) => row.id !== anchorId);
    if (others.length > 0) throw new PartyEmailConflictError(input.role);
    if (!roleMatches.some((row) => row.id === anchorId)) {
      throw new Error("Not found");
    }
  } else if (input.role === "investor") {
    anchorId = canonical(investorMatches)?.id;
  } else if (input.role === "borrower") {
    anchorId = canonical(borrowerMatches)?.id;
  } else {
    anchorId = canonical(witnessMatches)?.id;
  }

  const documentSource = [
    ...investorMatches,
    ...borrowerMatches,
    ...witnessMatches,
  ];
  const copiedValidId =
    documentSource.find((row) => row.validIdUrl)?.validIdUrl ?? null;
  const copiedSignature =
    documentSource.find((row) => row.eSignatureUrl)?.eSignatureUrl ?? null;
  const validIdUrl = input.syncDocuments
    ? (input.validIdUrl ?? null)
    : copiedValidId;
  const eSignatureUrl = input.syncDocuments
    ? (input.eSignatureUrl ?? null)
    : copiedSignature;

  const shared = {
    name,
    email,
    contactNumber: input.contactNumber,
    address: input.address,
    updatedAt: new Date(),
  };

  const saved = await db.transaction(async (tx) => {
    const investor = await writeInvestor(tx, {
      workspaceOwnerId: input.workspaceOwnerId,
      partyUserId: partyUser.id,
      anchorId:
        input.role === "investor" ? anchorId : canonical(investorMatches)?.id,
      insertIfMissing: input.role !== "investor" || !anchorId,
      patch: {
        ...shared,
        ...(input.syncDocuments || input.role !== "investor"
          ? { validIdUrl, eSignatureUrl }
          : input.role === "investor" && !anchorId
            ? { validIdUrl, eSignatureUrl }
            : {}),
        investorUserId: partyUser.id,
      },
      insertDocuments: { validIdUrl, eSignatureUrl },
      syncDocuments: Boolean(input.syncDocuments) || input.role !== "investor",
    });

    const borrower = await writeBorrower(tx, {
      workspaceOwnerId: input.workspaceOwnerId,
      partyUserId: partyUser.id,
      anchorId:
        input.role === "borrower" ? anchorId : canonical(borrowerMatches)?.id,
      patch: {
        ...shared,
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.syncDocuments ? { validIdUrl, eSignatureUrl } : {}),
        borrowerUserId: partyUser.id,
      },
      insertDocuments: { validIdUrl, eSignatureUrl },
      insertNotes: input.notes ?? null,
      syncDocuments: Boolean(input.syncDocuments),
    });

    const witness = await writeWitness(tx, {
      workspaceOwnerId: input.workspaceOwnerId,
      partyUserId: partyUser.id,
      anchorId:
        input.role === "witness" ? anchorId : canonical(witnessMatches)?.id,
      patch: {
        ...shared,
        ...(input.syncDocuments ? { validIdUrl, eSignatureUrl } : {}),
        witnessUserId: partyUser.id,
      },
      insertDocuments: { validIdUrl, eSignatureUrl },
      syncDocuments: Boolean(input.syncDocuments),
    });

    const row =
      input.role === "investor"
        ? investor
        : input.role === "borrower"
          ? borrower
          : witness;
    if (!row) throw new Error("Not found");
    return row;
  });

  invalidatePartyLists();
  return saved;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function writeInvestor(
  tx: Tx,
  input: {
    workspaceOwnerId: string;
    partyUserId: string;
    anchorId: number | undefined;
    insertIfMissing: boolean;
    patch: Partial<typeof investors.$inferInsert> & {
      name: string;
      email: string;
    };
    insertDocuments: {
      validIdUrl: string | null;
      eSignatureUrl: string | null;
    };
    syncDocuments: boolean;
  },
): Promise<InvestorRow | null> {
  if (input.anchorId) {
    const patch = input.syncDocuments
      ? input.patch
      : omitDocuments(input.patch);
    const [row] = await tx
      .update(investors)
      .set(patch)
      .where(
        and(
          eq(investors.id, input.anchorId),
          eq(investors.userId, input.workspaceOwnerId),
        ),
      )
      .returning();
    return row ?? null;
  }
  if (!input.insertIfMissing) return null;
  const [row] = await tx
    .insert(investors)
    .values({
      userId: input.workspaceOwnerId,
      investorUserId: input.partyUserId,
      name: input.patch.name,
      email: input.patch.email,
      contactNumber: input.patch.contactNumber ?? null,
      address: input.patch.address ?? null,
      validIdUrl: input.insertDocuments.validIdUrl,
      eSignatureUrl: input.insertDocuments.eSignatureUrl,
    })
    .returning();
  return row ?? null;
}

async function writeBorrower(
  tx: Tx,
  input: {
    workspaceOwnerId: string;
    partyUserId: string;
    anchorId: number | undefined;
    patch: Partial<typeof borrowers.$inferInsert> & {
      name: string;
      email: string;
    };
    insertDocuments: {
      validIdUrl: string | null;
      eSignatureUrl: string | null;
    };
    insertNotes: string | null;
    syncDocuments: boolean;
  },
): Promise<BorrowerRow | null> {
  if (input.anchorId) {
    const patch = input.syncDocuments
      ? input.patch
      : omitDocuments(input.patch);
    const [row] = await tx
      .update(borrowers)
      .set(patch)
      .where(
        and(
          eq(borrowers.id, input.anchorId),
          eq(borrowers.userId, input.workspaceOwnerId),
        ),
      )
      .returning();
    return row ?? null;
  }
  const [row] = await tx
    .insert(borrowers)
    .values({
      userId: input.workspaceOwnerId,
      borrowerUserId: input.partyUserId,
      name: input.patch.name,
      email: input.patch.email,
      contactNumber: input.patch.contactNumber ?? null,
      address: input.patch.address ?? null,
      notes: input.insertNotes,
      validIdUrl: input.insertDocuments.validIdUrl,
      eSignatureUrl: input.insertDocuments.eSignatureUrl,
    })
    .returning();
  return row ?? null;
}

async function writeWitness(
  tx: Tx,
  input: {
    workspaceOwnerId: string;
    partyUserId: string;
    anchorId: number | undefined;
    patch: Partial<typeof witnesses.$inferInsert> & {
      name: string;
      email: string;
    };
    insertDocuments: {
      validIdUrl: string | null;
      eSignatureUrl: string | null;
    };
    syncDocuments: boolean;
  },
): Promise<WitnessRow | null> {
  if (input.anchorId) {
    const patch = input.syncDocuments
      ? input.patch
      : omitDocuments(input.patch);
    const [row] = await tx
      .update(witnesses)
      .set(patch)
      .where(
        and(
          eq(witnesses.id, input.anchorId),
          eq(witnesses.userId, input.workspaceOwnerId),
        ),
      )
      .returning();
    return row ?? null;
  }
  const [row] = await tx
    .insert(witnesses)
    .values({
      userId: input.workspaceOwnerId,
      witnessUserId: input.partyUserId,
      name: input.patch.name,
      email: input.patch.email,
      contactNumber: input.patch.contactNumber ?? null,
      address: input.patch.address ?? null,
      validIdUrl: input.insertDocuments.validIdUrl,
      eSignatureUrl: input.insertDocuments.eSignatureUrl,
    })
    .returning();
  return row ?? null;
}

function omitDocuments<
  T extends { validIdUrl?: string | null; eSignatureUrl?: string | null },
>(patch: T): Omit<T, "validIdUrl" | "eSignatureUrl"> {
  const {
    validIdUrl: _validIdUrl,
    eSignatureUrl: _eSignatureUrl,
    ...rest
  } = patch;
  return rest;
}

/**
 * Insert investor, borrower, and witness rows that this workspace is missing
 * for an existing party user. Does not overwrite rows that already exist.
 */
export async function ensureMissingPartyRoles(
  input: ContactInput & { partyUserId: string },
) {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  if (!email || name.length < 2) return;

  const [investorMatches, borrowerMatches, witnessMatches] = await Promise.all([
    loadInvestorMatches(input.workspaceOwnerId, input.partyUserId, email),
    loadBorrowerMatches(input.workspaceOwnerId, input.partyUserId, email),
    loadWitnessMatches(input.workspaceOwnerId, input.partyUserId, email),
  ]);
  if (
    investorMatches.length > 0 &&
    borrowerMatches.length > 0 &&
    witnessMatches.length > 0
  ) {
    return;
  }

  const documentSource = [
    ...investorMatches,
    ...borrowerMatches,
    ...witnessMatches,
  ];
  const validIdUrl =
    input.validIdUrl ??
    documentSource.find((row) => row.validIdUrl)?.validIdUrl ??
    null;
  const eSignatureUrl =
    input.eSignatureUrl ??
    documentSource.find((row) => row.eSignatureUrl)?.eSignatureUrl ??
    null;

  await db.transaction(async (tx) => {
    if (investorMatches.length === 0) {
      await tx.insert(investors).values({
        userId: input.workspaceOwnerId,
        investorUserId: input.partyUserId,
        name,
        email,
        contactNumber: input.contactNumber,
        address: input.address,
        validIdUrl,
        eSignatureUrl,
      });
    }
    if (borrowerMatches.length === 0) {
      await tx.insert(borrowers).values({
        userId: input.workspaceOwnerId,
        borrowerUserId: input.partyUserId,
        name,
        email,
        contactNumber: input.contactNumber,
        address: input.address,
        notes: input.notes ?? null,
        validIdUrl,
        eSignatureUrl,
      });
    }
    if (witnessMatches.length === 0) {
      await tx.insert(witnesses).values({
        userId: input.workspaceOwnerId,
        witnessUserId: input.partyUserId,
        name,
        email,
        contactNumber: input.contactNumber,
        address: input.address,
        validIdUrl,
        eSignatureUrl,
      });
    }
  });
  invalidatePartyLists();
}
