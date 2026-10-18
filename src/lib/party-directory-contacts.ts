export type DirectoryContact = {
  id: number;
  key: string;
  kind: "Borrower" | "Investor" | "Witness";
  name: string;
  email: string | null;
  contactNumber: string | null;
  address: string | null;
  validIdUrl: string | null;
  eSignatureUrl: string | null;
};

function filled(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * One row per email. Prefer the witness record so contract slots keep a witness id.
 * Contacts with no email stay separate.
 */
export function dedupeDirectoryContacts<T extends DirectoryContact>(
  rows: T[],
): T[] {
  const withoutEmail: T[] = [];
  const byEmail = new Map<string, T>();

  for (const row of rows) {
    const email = filled(row.email)?.toLowerCase();
    if (!email) {
      withoutEmail.push(row);
      continue;
    }

    const current = byEmail.get(email);
    if (!current) {
      byEmail.set(email, row);
      continue;
    }

    const preferred = row.kind === "Witness" ? row : current;
    const extra = preferred === row ? current : row;
    byEmail.set(email, {
      ...preferred,
      name: filled(preferred.name) ?? extra.name,
      email: preferred.email ?? extra.email,
      contactNumber: filled(preferred.contactNumber) ?? extra.contactNumber,
      address: filled(preferred.address) ?? extra.address,
      validIdUrl: filled(preferred.validIdUrl) ?? extra.validIdUrl,
      eSignatureUrl: filled(preferred.eSignatureUrl) ?? extra.eSignatureUrl,
    });
  }

  return [...byEmail.values(), ...withoutEmail];
}
