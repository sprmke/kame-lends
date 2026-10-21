export const PAYMENT_NOTES_MAX_LENGTH = 2000;

export function parseOptionalPaymentNotes(
  value: unknown,
): { notes: string | null } | { error: string } {
  if (value == null || value === "") return { notes: null };
  if (typeof value !== "string") return { error: "Notes must be text." };
  const notes = value.trim();
  if (!notes) return { notes: null };
  if (notes.length > PAYMENT_NOTES_MAX_LENGTH) {
    return {
      error: `Notes must be ${PAYMENT_NOTES_MAX_LENGTH} characters or fewer.`,
    };
  }
  return { notes };
}

/** Use after `paymentNotesError` has already rejected invalid notes. */
export function optionalPaymentNotes(value: unknown): string | null {
  const parsed = parseOptionalPaymentNotes(value);
  return "notes" in parsed ? parsed.notes : null;
}

export function paymentNotesError(
  rows: ReadonlyArray<{ notes?: unknown } | null | undefined>,
): string | null {
  for (const row of rows) {
    if (!row) continue;
    const parsed = parseOptionalPaymentNotes(row.notes);
    if ("error" in parsed) return parsed.error;
  }
  return null;
}

export function loanPaymentNotesError(input: {
  investorData?: ReadonlyArray<{ notes?: unknown }>;
  receivedPaymentsByInvestor?: ReadonlyArray<{
    receivedPayments?: ReadonlyArray<{ notes?: unknown }>;
  }>;
}): string | null {
  const rows: Array<{ notes?: unknown } | undefined> = [
    ...(input.investorData ?? []),
  ];
  for (const entry of input.receivedPaymentsByInvestor ?? []) {
    rows.push(...(entry.receivedPayments ?? []));
  }
  return paymentNotesError(rows);
}
