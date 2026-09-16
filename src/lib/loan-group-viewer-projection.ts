/**
 * Redacts PII and sensitive artifacts for group-only viewers
 * (party membership absent; access via group only).
 */

const PARTY_PII_KEYS = [
  "email",
  "contactNumber",
  "address",
  "validIdUrl",
  "eSignatureUrl",
] as const;

function redactParty<T extends Record<string, unknown> | null | undefined>(
  party: T,
): T {
  if (!party || typeof party !== "object") return party;
  const next = { ...party };
  for (const key of PARTY_PII_KEYS) {
    if (key in next) (next as Record<string, unknown>)[key] = null;
  }
  if ("notes" in next) (next as Record<string, unknown>).notes = null;
  return next as T;
}

function redactAllocation(
  alloc: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...alloc };
  delete next.receiptImageUrl;
  delete next.receipts;
  delete next.receiptExtractedData;
  if (next.investor && typeof next.investor === "object") {
    next.investor = redactParty(next.investor as Record<string, unknown>);
  }
  return next;
}

function redactPayment<T extends Record<string, unknown>>(payment: T): T {
  const next = { ...payment };
  delete next.receiptImageUrl;
  delete next.receipts;
  delete next.receiptExtractedData;
  return next;
}

/**
 * Deep-clones enough of a loan entity for JSON and strips fields group viewers
 * must not see. Keeps names, amounts, dates, rates, periods, status.
 */
export function projectLoanForGroupViewer<T>(entity: T): T {
  if (!entity || typeof entity !== "object") return entity;
  const loan = structuredClone(entity) as Record<string, unknown>;

  delete loan.signingInvitations;
  delete loan.loanContract;
  delete loan.paymentMethods;
  delete loan.googleCalendarEventIds;

  if (loan.borrower && typeof loan.borrower === "object") {
    loan.borrower = redactParty(loan.borrower as Record<string, unknown>);
  }

  if (Array.isArray(loan.loanInvestors)) {
    loan.loanInvestors = loan.loanInvestors.map((row) => {
      if (!row || typeof row !== "object") return row;
      const alloc = redactAllocation(row as Record<string, unknown>);
      if (Array.isArray(alloc.receivedPayments)) {
        alloc.receivedPayments = alloc.receivedPayments.map((p) =>
          p && typeof p === "object"
            ? redactPayment(p as Record<string, unknown>)
            : p,
        );
      }
      return alloc;
    });
  }

  if (Array.isArray(loan.loanWitnesses)) {
    loan.loanWitnesses = loan.loanWitnesses.map((row) => {
      if (!row || typeof row !== "object") return row;
      const lw = { ...(row as Record<string, unknown>) };
      if (lw.witness && typeof lw.witness === "object") {
        lw.witness = redactParty(lw.witness as Record<string, unknown>);
      }
      return lw;
    });
  }

  return loan as T;
}

/** Fields that must never appear in a projected payload (for tests). */
export const GROUP_VIEWER_FORBIDDEN_PATHS = [
  "borrower.email",
  "borrower.contactNumber",
  "borrower.address",
  "borrower.validIdUrl",
  "borrower.eSignatureUrl",
  "borrower.notes",
  "signingInvitations",
  "loanContract",
  "paymentMethods",
  "googleCalendarEventIds",
] as const;

export function collectForbiddenHits(
  entity: unknown,
  paths: readonly string[] = GROUP_VIEWER_FORBIDDEN_PATHS,
): string[] {
  const hits: string[] = [];
  for (const path of paths) {
    const parts = path.split(".");
    let cur: unknown = entity;
    for (const part of parts) {
      if (cur == null || typeof cur !== "object") {
        cur = undefined;
        break;
      }
      cur = (cur as Record<string, unknown>)[part];
    }
    if (cur != null && cur !== "") hits.push(path);
  }
  if (entity && typeof entity === "object") {
    const loan = entity as Record<string, unknown>;
    for (const li of (loan.loanInvestors as unknown[]) ?? []) {
      if (!li || typeof li !== "object") continue;
      const row = li as Record<string, unknown>;
      if (row.receipts != null) hits.push("loanInvestors.receipts");
      if (row.receiptImageUrl != null)
        hits.push("loanInvestors.receiptImageUrl");
      const inv = row.investor as Record<string, unknown> | undefined;
      if (inv?.email) hits.push("loanInvestors.investor.email");
    }
  }
  return [...new Set(hits)];
}
