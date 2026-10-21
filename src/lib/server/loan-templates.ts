import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "$lib/server/db";
import {
  borrowers,
  investors,
  loanGroups,
  loanTemplates,
} from "$lib/server/db/schema";
import {
  MAX_LOAN_TEMPLATES_PER_USER,
  normalizeGroupIds,
  normalizeTemplateInvestors,
  parseLoanTemplateInput,
  type LoanTemplate,
  type LoanTemplateInput,
  type LoanTemplateInvestor,
} from "$lib/loan-templates";

type MutationResult =
  | { ok: true; template: LoanTemplate }
  | { ok: false; error: string; status: number };

type Row = {
  id: number;
  name: string;
  loanName: string;
  nameMode: string;
  type: LoanTemplate["type"];
  borrowerId: number | null;
  borrowerIds: unknown;
  investors: unknown;
  groupIds: unknown;
  interestType: string;
  interestValue: string;
  termDays: number | null;
  notes: string | null;
  freeLotSqm: number | null;
};

function toPublic(
  row: Row,
  borrowerNames: Map<number, string>,
  investorNames: Map<number, string>,
): LoanTemplate {
  const borrowerIds = normalizeGroupIds(row.borrowerIds);
  const ids = borrowerIds.length
    ? borrowerIds
    : row.borrowerId != null
      ? [row.borrowerId]
      : [];
  const templateBorrowers = ids.flatMap((id) => {
    const name = borrowerNames.get(id);
    return name ? [{ id, name }] : [];
  });
  const templateInvestors: LoanTemplateInvestor[] = normalizeTemplateInvestors(
    row.investors,
  ).flatMap((investor) => {
    const name = investorNames.get(investor.investorId);
    return name ? [{ ...investor, name }] : [];
  });
  return {
    id: row.id,
    name: row.name,
    loanName: row.loanName,
    nameMode: row.nameMode === "date_range" ? "date_range" : "static",
    type: row.type,
    borrowerId: templateBorrowers[0]?.id ?? null,
    borrowerName: templateBorrowers[0]?.name ?? null,
    borrowerIds: templateBorrowers.map((borrower) => borrower.id),
    borrowers: templateBorrowers,
    investors: templateInvestors,
    groupIds: normalizeGroupIds(row.groupIds),
    interestType: row.interestType === "fixed" ? "fixed" : "rate",
    interestValue: String(row.interestValue),
    termDays: row.termDays,
    notes: row.notes,
    freeLotSqm: row.freeLotSqm,
  };
}

function isUniqueViolation(error: unknown): boolean {
  const pending: unknown[] = [error];
  for (let index = 0; index < pending.length && index < 4; index += 1) {
    const current = pending[index];
    if (!current || typeof current !== "object") continue;
    if ("code" in current && current.code === "23505") return true;
    if ("cause" in current) pending.push(current.cause);
  }
  return false;
}

async function ownedReferenceError(
  userId: string,
  input: LoanTemplateInput,
): Promise<string | null> {
  if (input.borrowerIds.length > 0) {
    const ownedBorrowers = await db
      .select({ id: borrowers.id })
      .from(borrowers)
      .where(
        and(
          eq(borrowers.userId, userId),
          inArray(borrowers.id, input.borrowerIds),
        ),
      );
    if (ownedBorrowers.length !== input.borrowerIds.length) {
      return "Borrower not found";
    }
  }

  if (input.investors.length > 0) {
    const investorIds = input.investors.map((investor) => investor.investorId);
    const ownedInvestors = await db
      .select({ id: investors.id })
      .from(investors)
      .where(
        and(eq(investors.userId, userId), inArray(investors.id, investorIds)),
      );
    if (ownedInvestors.length !== investorIds.length)
      return "Investor not found";
  }

  if (input.groupIds.length === 0) return null;
  const groups = await db
    .select({ id: loanGroups.id })
    .from(loanGroups)
    .where(
      and(
        eq(loanGroups.creatorUserId, userId),
        inArray(loanGroups.id, input.groupIds),
      ),
    );
  if (groups.length !== input.groupIds.length) return "Group not found";
  return null;
}

async function nameTaken(
  userId: string,
  name: string,
  ignoreId?: number,
): Promise<boolean> {
  const existing = await db.query.loanTemplates.findFirst({
    where: and(eq(loanTemplates.userId, userId), eq(loanTemplates.name, name)),
    columns: { id: true },
  });
  return Boolean(existing && existing.id !== ignoreId);
}

const templateColumns = {
  id: loanTemplates.id,
  name: loanTemplates.name,
  loanName: loanTemplates.loanName,
  nameMode: loanTemplates.nameMode,
  type: loanTemplates.type,
  borrowerId: loanTemplates.borrowerId,
  borrowerIds: loanTemplates.borrowerIds,
  investors: loanTemplates.investors,
  groupIds: loanTemplates.groupIds,
  interestType: loanTemplates.interestType,
  interestValue: loanTemplates.interestValue,
  termDays: loanTemplates.termDays,
  notes: loanTemplates.notes,
  freeLotSqm: loanTemplates.freeLotSqm,
};

async function withNames(userId: string, rows: Row[]): Promise<LoanTemplate[]> {
  const borrowerIds = [
    ...new Set(
      rows.flatMap((row) =>
        normalizeGroupIds(row.borrowerIds).concat(
          row.borrowerId != null ? [row.borrowerId] : [],
        ),
      ),
    ),
  ];
  const investorIds = [
    ...new Set(
      rows.flatMap((row) =>
        normalizeTemplateInvestors(row.investors).map(
          (investor) => investor.investorId,
        ),
      ),
    ),
  ];
  const [borrowerRows, investorRows] = await Promise.all([
    borrowerIds.length
      ? db
          .select({ id: borrowers.id, name: borrowers.name })
          .from(borrowers)
          .where(
            and(
              eq(borrowers.userId, userId),
              inArray(borrowers.id, borrowerIds),
            ),
          )
      : [],
    investorIds.length
      ? db
          .select({ id: investors.id, name: investors.name })
          .from(investors)
          .where(
            and(
              eq(investors.userId, userId),
              inArray(investors.id, investorIds),
            ),
          )
      : [],
  ]);
  const borrowerNames = new Map(borrowerRows.map((row) => [row.id, row.name]));
  const investorNames = new Map(investorRows.map((row) => [row.id, row.name]));
  return rows.map((row) => toPublic(row, borrowerNames, investorNames));
}

export async function listLoanTemplatesForUser(
  userId: string,
): Promise<LoanTemplate[]> {
  const rows = await db
    .select(templateColumns)
    .from(loanTemplates)
    .where(eq(loanTemplates.userId, userId))
    .orderBy(asc(loanTemplates.name));
  return withNames(userId, rows);
}

async function loadOwnedTemplate(
  userId: string,
  id: number,
): Promise<LoanTemplate | null> {
  const [row] = await db
    .select(templateColumns)
    .from(loanTemplates)
    .where(and(eq(loanTemplates.id, id), eq(loanTemplates.userId, userId)))
    .limit(1);
  const [template] = row ? await withNames(userId, [row]) : [];
  return template ?? null;
}

function valuesFromInput(userId: string, input: LoanTemplateInput) {
  return {
    userId,
    name: input.name,
    loanName: input.loanName,
    nameMode: input.nameMode,
    type: input.type,
    borrowerId: input.borrowerId,
    borrowerIds: input.borrowerIds,
    investors: input.investors,
    groupIds: input.groupIds,
    interestType: input.interestType,
    interestValue: input.interestValue,
    termDays: input.termDays,
    notes: input.notes,
    freeLotSqm: input.freeLotSqm,
  };
}

export async function createLoanTemplate(
  userId: string,
  raw: unknown,
): Promise<MutationResult> {
  const parsed = parseLoanTemplateInput(raw);
  if (!parsed.ok) return { ok: false, error: parsed.error, status: 400 };

  const [countRow] = await db
    .select({ value: count() })
    .from(loanTemplates)
    .where(eq(loanTemplates.userId, userId));
  if (Number(countRow?.value ?? 0) >= MAX_LOAN_TEMPLATES_PER_USER) {
    return {
      ok: false,
      error: `Limit is ${MAX_LOAN_TEMPLATES_PER_USER} templates`,
      status: 400,
    };
  }

  if (await nameTaken(userId, parsed.value.name)) {
    return {
      ok: false,
      error: "A template with this name already exists",
      status: 400,
    };
  }

  const referenceError = await ownedReferenceError(userId, parsed.value);
  if (referenceError) return { ok: false, error: referenceError, status: 400 };

  try {
    const [created] = await db
      .insert(loanTemplates)
      .values(valuesFromInput(userId, parsed.value))
      .returning();
    if (!created) {
      return { ok: false, error: "Failed to save template", status: 500 };
    }
    const template = await loadOwnedTemplate(userId, created.id);
    if (!template) {
      return { ok: false, error: "Failed to save template", status: 500 };
    }
    return { ok: true, template };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        error: "A template with this name already exists",
        status: 400,
      };
    }
    throw error;
  }
}

export async function updateLoanTemplate(
  userId: string,
  id: number,
  raw: unknown,
): Promise<MutationResult> {
  const parsed = parseLoanTemplateInput(raw);
  if (!parsed.ok) return { ok: false, error: parsed.error, status: 400 };

  const current = await db.query.loanTemplates.findFirst({
    where: and(eq(loanTemplates.id, id), eq(loanTemplates.userId, userId)),
    columns: { id: true },
  });
  if (!current) return { ok: false, error: "Template not found", status: 404 };

  if (await nameTaken(userId, parsed.value.name, id)) {
    return {
      ok: false,
      error: "A template with this name already exists",
      status: 400,
    };
  }

  const referenceError = await ownedReferenceError(userId, parsed.value);
  if (referenceError) return { ok: false, error: referenceError, status: 400 };

  try {
    await db
      .update(loanTemplates)
      .set({
        ...valuesFromInput(userId, parsed.value),
        updatedAt: new Date(),
      })
      .where(and(eq(loanTemplates.id, id), eq(loanTemplates.userId, userId)));
    const template = await loadOwnedTemplate(userId, id);
    if (!template) {
      return { ok: false, error: "Failed to save template", status: 500 };
    }
    return { ok: true, template };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        error: "A template with this name already exists",
        status: 400,
      };
    }
    throw error;
  }
}

export async function deleteLoanTemplate(
  userId: string,
  id: number,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const [deleted] = await db
    .delete(loanTemplates)
    .where(and(eq(loanTemplates.id, id), eq(loanTemplates.userId, userId)))
    .returning();
  if (!deleted) return { ok: false, error: "Template not found", status: 404 };
  return { ok: true };
}
