import { and, eq, or } from "drizzle-orm";
import { db } from "$lib/server/db";
import { borrowers, investors, witnesses } from "$lib/server/db/schema";
import {
  normalizeSignatureImageUrl,
  normalizeValidIdUrl,
} from "$lib/valid-id-document";
import { normalizeEmail } from "$lib/loan-signing";
import { findOrCreatePartyUser } from "$lib/server/party-user";
import { listPaymentMethodsForUser } from "$lib/server/payment-methods";
import type {
  PartyEntityType,
  PartyIdentityDocuments,
  PartyIdentityDocumentsSaveInput,
  PartyProfileSaveInput,
  PartyUserProfile,
} from "$lib/party-profile";
import {
  invalidateBorrowerData,
  invalidateInvestorData,
  invalidateWitnessData,
} from "$lib/server/cache-invalidation";

type ContactRow = {
  name: string;
  email: string | null;
  contactNumber: string | null;
  address: string | null;
  notes?: string | null;
  validIdUrl: string | null;
  eSignatureUrl: string | null;
};

function pickString(...values: (string | null | undefined)[]): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function mergeContactRows(
  rows: ContactRow[],
): Omit<PartyUserProfile, "partyUserId" | "paymentMethods" | "linkedRoles"> {
  return {
    name: pickString(...rows.map((r) => r.name)) ?? "",
    email: pickString(...rows.map((r) => r.email)),
    contactNumber: pickString(...rows.map((r) => r.contactNumber)),
    address: pickString(...rows.map((r) => r.address)),
    notes: pickString(...rows.map((r) => r.notes)),
    validIdUrl: pickString(...rows.map((r) => r.validIdUrl)),
    eSignatureUrl: pickString(...rows.map((r) => r.eSignatureUrl)),
  };
}

async function loadWorkspacePartyContacts(
  workspaceOwnerId: string,
  partyUserId: string | null,
  normalizedEmail: string | null,
) {
  const investorWhere = partyUserId
    ? and(
        eq(investors.userId, workspaceOwnerId),
        eq(investors.investorUserId, partyUserId),
      )
    : normalizedEmail
      ? and(
          eq(investors.userId, workspaceOwnerId),
          eq(investors.email, normalizedEmail),
        )
      : null;

  const borrowerWhere = partyUserId
    ? and(
        eq(borrowers.userId, workspaceOwnerId),
        eq(borrowers.borrowerUserId, partyUserId),
      )
    : normalizedEmail
      ? and(
          eq(borrowers.userId, workspaceOwnerId),
          eq(borrowers.email, normalizedEmail),
        )
      : null;

  const witnessWhere = partyUserId
    ? and(
        eq(witnesses.userId, workspaceOwnerId),
        eq(witnesses.witnessUserId, partyUserId),
      )
    : normalizedEmail
      ? and(
          eq(witnesses.userId, workspaceOwnerId),
          eq(witnesses.email, normalizedEmail),
        )
      : null;

  const [investorRows, borrowerRows, witnessRows] = await Promise.all([
    investorWhere
      ? db.query.investors.findMany({ where: investorWhere })
      : Promise.resolve([]),
    borrowerWhere
      ? db.query.borrowers.findMany({ where: borrowerWhere })
      : Promise.resolve([]),
    witnessWhere
      ? db.query.witnesses.findMany({ where: witnessWhere })
      : Promise.resolve([]),
  ]);

  return { investorRows, borrowerRows, witnessRows };
}

async function resolveSourceEntity(
  entityType: PartyEntityType,
  entityId: number,
  workspaceOwnerId: string,
) {
  if (entityType === "investor") {
    return db.query.investors.findFirst({
      where: and(
        eq(investors.id, entityId),
        eq(investors.userId, workspaceOwnerId),
      ),
    });
  }
  if (entityType === "borrower") {
    return db.query.borrowers.findFirst({
      where: and(
        eq(borrowers.id, entityId),
        eq(borrowers.userId, workspaceOwnerId),
      ),
    });
  }
  return db.query.witnesses.findFirst({
    where: and(
      eq(witnesses.id, entityId),
      eq(witnesses.userId, workspaceOwnerId),
    ),
  });
}

export async function loadPartyProfileForEntity(
  entityType: PartyEntityType,
  entityId: number,
  workspaceOwnerId: string,
): Promise<PartyUserProfile | null> {
  const source = await resolveSourceEntity(
    entityType,
    entityId,
    workspaceOwnerId,
  );
  if (!source) return null;

  const partyUserId =
    entityType === "investor"
      ? (source as typeof investors.$inferSelect).investorUserId
      : entityType === "borrower"
        ? (source as typeof borrowers.$inferSelect).borrowerUserId
        : (source as typeof witnesses.$inferSelect).witnessUserId;

  const email =
    entityType === "investor"
      ? (source as typeof investors.$inferSelect).email
      : ((source as typeof borrowers.$inferSelect).email ??
        (source as typeof witnesses.$inferSelect).email);

  const normalizedEmail = normalizeEmail(email ?? "");
  const { investorRows, borrowerRows, witnessRows } =
    await loadWorkspacePartyContacts(
      workspaceOwnerId,
      partyUserId,
      normalizedEmail,
    );

  const linkedRoles: PartyEntityType[] = [];
  if (investorRows.length > 0) linkedRoles.push("investor");
  if (borrowerRows.length > 0) linkedRoles.push("borrower");
  if (witnessRows.length > 0) linkedRoles.push("witness");

  const contactRows: ContactRow[] = [
    ...investorRows.map((row) => ({
      name: row.name,
      email: row.email,
      contactNumber: row.contactNumber,
      address: row.address,
      validIdUrl: row.validIdUrl,
      eSignatureUrl: row.eSignatureUrl,
    })),
    ...borrowerRows.map((row) => ({
      name: row.name,
      email: row.email,
      contactNumber: row.contactNumber,
      address: row.address,
      notes: row.notes,
      validIdUrl: row.validIdUrl,
      eSignatureUrl: row.eSignatureUrl,
    })),
    ...witnessRows.map((row) => ({
      name: row.name,
      email: row.email,
      contactNumber: row.contactNumber,
      address: row.address,
      validIdUrl: row.validIdUrl,
      eSignatureUrl: row.eSignatureUrl,
    })),
  ];

  const merged = mergeContactRows(contactRows);
  const paymentMethods = partyUserId
    ? await listPaymentMethodsForUser(partyUserId)
    : [];

  return {
    ...merged,
    partyUserId,
    paymentMethods,
    linkedRoles,
  };
}

export async function isPartyUserLinkedToWorkspace(
  workspaceOwnerId: string,
  partyUserId: string,
): Promise<boolean> {
  const [investorHit, borrowerHit, witnessHit] = await Promise.all([
    db.query.investors.findFirst({
      where: and(
        eq(investors.userId, workspaceOwnerId),
        eq(investors.investorUserId, partyUserId),
      ),
      columns: { id: true },
    }),
    db.query.borrowers.findFirst({
      where: and(
        eq(borrowers.userId, workspaceOwnerId),
        eq(borrowers.borrowerUserId, partyUserId),
      ),
      columns: { id: true },
    }),
    db.query.witnesses.findFirst({
      where: and(
        eq(witnesses.userId, workspaceOwnerId),
        eq(witnesses.witnessUserId, partyUserId),
      ),
      columns: { id: true },
    }),
  ]);

  return Boolean(investorHit || borrowerHit || witnessHit);
}

export async function hasPartyUserCrmLinks(
  partyUserId: string,
): Promise<boolean> {
  const [investorHit, borrowerHit, witnessHit] = await Promise.all([
    db.query.investors.findFirst({
      where: eq(investors.investorUserId, partyUserId),
      columns: { id: true },
    }),
    db.query.borrowers.findFirst({
      where: eq(borrowers.borrowerUserId, partyUserId),
      columns: { id: true },
    }),
    db.query.witnesses.findFirst({
      where: eq(witnesses.witnessUserId, partyUserId),
      columns: { id: true },
    }),
  ]);

  return Boolean(investorHit || borrowerHit || witnessHit);
}

export async function loadPartyUserIdentityDocuments(
  partyUserId: string,
): Promise<PartyIdentityDocuments> {
  const [investorRows, borrowerRows, witnessRows] = await Promise.all([
    db.query.investors.findMany({
      where: eq(investors.investorUserId, partyUserId),
      columns: { validIdUrl: true, eSignatureUrl: true },
    }),
    db.query.borrowers.findMany({
      where: eq(borrowers.borrowerUserId, partyUserId),
      columns: { validIdUrl: true, eSignatureUrl: true },
    }),
    db.query.witnesses.findMany({
      where: eq(witnesses.witnessUserId, partyUserId),
      columns: { validIdUrl: true, eSignatureUrl: true },
    }),
  ]);

  const rows = [...investorRows, ...borrowerRows, ...witnessRows];
  return {
    validIdUrl: pickString(...rows.map((row) => row.validIdUrl)),
    eSignatureUrl: pickString(...rows.map((row) => row.eSignatureUrl)),
  };
}

export async function savePartyUserIdentityDocuments(
  partyUserId: string,
  input: PartyIdentityDocumentsSaveInput,
): Promise<PartyIdentityDocuments> {
  const validIdUrl = normalizeValidIdUrl(input.validIdUrl);
  const eSignatureUrl = normalizeSignatureImageUrl(input.eSignatureUrl);
  const patch = {
    validIdUrl,
    eSignatureUrl,
    updatedAt: new Date(),
  };

  const [investorRows, borrowerRows, witnessRows] = await Promise.all([
    db
      .update(investors)
      .set(patch)
      .where(eq(investors.investorUserId, partyUserId))
      .returning(),
    db
      .update(borrowers)
      .set(patch)
      .where(eq(borrowers.borrowerUserId, partyUserId))
      .returning(),
    db
      .update(witnesses)
      .set(patch)
      .where(eq(witnesses.witnessUserId, partyUserId))
      .returning(),
  ]);

  if (investorRows.length + borrowerRows.length + witnessRows.length === 0) {
    throw new Error("No linked contact records");
  }

  if (investorRows.length > 0) invalidateInvestorData();
  if (borrowerRows.length > 0) invalidateBorrowerData();
  if (witnessRows.length > 0) invalidateWitnessData();

  return { validIdUrl, eSignatureUrl };
}

export async function savePartyProfileForEntity(
  entityType: PartyEntityType,
  entityId: number,
  workspaceOwnerId: string,
  input: PartyProfileSaveInput,
): Promise<PartyUserProfile | null> {
  const source = await resolveSourceEntity(
    entityType,
    entityId,
    workspaceOwnerId,
  );
  if (!source) return null;

  const name = input.name.trim();
  if (name.length < 2) {
    throw new Error("Name is required (min 2 characters)");
  }

  const email = input.email?.trim() ? normalizeEmail(input.email) : null;
  const contactNumber = input.contactNumber?.trim() || null;
  const address = input.address?.trim() || null;
  const notes = input.notes?.trim() || null;
  const validIdUrl = normalizeValidIdUrl(input.validIdUrl);
  const eSignatureUrl = normalizeSignatureImageUrl(input.eSignatureUrl);

  const partyRole =
    entityType === "investor"
      ? "investor"
      : entityType === "borrower"
        ? "borrower"
        : "witness";

  const partyUser = email
    ? await findOrCreatePartyUser({ email, name, role: partyRole })
    : null;
  const partyUserId = partyUser?.id ?? null;

  const sharedPatch = {
    name,
    contactNumber,
    address,
    validIdUrl,
    eSignatureUrl,
    updatedAt: new Date(),
  };

  const previousEmail =
    entityType === "investor"
      ? (source as typeof investors.$inferSelect).email
      : ((source as typeof borrowers.$inferSelect).email ??
        (source as typeof witnesses.$inferSelect).email);
  const previousPartyUserId =
    entityType === "investor"
      ? (source as typeof investors.$inferSelect).investorUserId
      : entityType === "borrower"
        ? (source as typeof borrowers.$inferSelect).borrowerUserId
        : (source as typeof witnesses.$inferSelect).witnessUserId;

  const lookupPartyUserId = partyUserId ?? previousPartyUserId;
  const lookupEmail = email ?? normalizeEmail(previousEmail ?? "");

  const { investorRows, borrowerRows, witnessRows } =
    await loadWorkspacePartyContacts(
      workspaceOwnerId,
      lookupPartyUserId,
      lookupEmail || null,
    );

  const investorIds = new Set(investorRows.map((row) => row.id));
  const borrowerIds = new Set(borrowerRows.map((row) => row.id));
  const witnessIds = new Set(witnessRows.map((row) => row.id));

  if (entityType === "investor") investorIds.add(entityId);
  if (entityType === "borrower") borrowerIds.add(entityId);
  if (entityType === "witness") witnessIds.add(entityId);

  const investorEmail =
    email ??
    investorRows.find((row) => row.email)?.email ??
    (entityType === "investor"
      ? (source as typeof investors.$inferSelect).email
      : null);

  if (investorIds.size > 0) {
    if (!investorEmail) {
      throw new Error("Email is required for investor contacts");
    }
    await db
      .update(investors)
      .set({
        ...sharedPatch,
        email: investorEmail,
        investorUserId: partyUserId,
      })
      .where(
        and(
          eq(investors.userId, workspaceOwnerId),
          or(...[...investorIds].map((id) => eq(investors.id, id))),
        ),
      );
    invalidateInvestorData();
  }

  if (borrowerIds.size > 0) {
    await db
      .update(borrowers)
      .set({
        ...sharedPatch,
        email,
        notes,
        borrowerUserId: partyUserId,
      })
      .where(
        and(
          eq(borrowers.userId, workspaceOwnerId),
          or(...[...borrowerIds].map((id) => eq(borrowers.id, id))),
        ),
      );
    invalidateBorrowerData();
  }

  if (witnessIds.size > 0) {
    await db
      .update(witnesses)
      .set({
        ...sharedPatch,
        email,
        witnessUserId: partyUserId,
      })
      .where(
        and(
          eq(witnesses.userId, workspaceOwnerId),
          or(...[...witnessIds].map((id) => eq(witnesses.id, id))),
        ),
      );
    invalidateWitnessData();
  }

  return loadPartyProfileForEntity(entityType, entityId, workspaceOwnerId);
}
