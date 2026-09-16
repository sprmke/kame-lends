/**
 * Pure ACL diff for Google Calendar reader shares.
 */
export type AclRule = {
  ruleId?: string;
  email: string;
  role: string;
};

export function normalizeAclEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function diffCalendarAcl(options: {
  desiredEmails: string[];
  actualRules: AclRule[];
  serviceAccountEmail: string;
}): { toInsert: string[]; toDelete: AclRule[] } {
  const service = normalizeAclEmail(options.serviceAccountEmail);
  const desired = new Set(
    options.desiredEmails.map(normalizeAclEmail).filter(Boolean),
  );
  desired.delete(service);

  const actualReaders = options.actualRules.filter(
    (r) =>
      r.role === "reader" &&
      normalizeAclEmail(r.email) &&
      normalizeAclEmail(r.email) !== service,
  );

  const actualEmails = new Set(
    actualReaders.map((r) => normalizeAclEmail(r.email)),
  );

  const toInsert = [...desired].filter((e) => !actualEmails.has(e));
  const toDelete = actualReaders.filter(
    (r) => !desired.has(normalizeAclEmail(r.email)),
  );

  return { toInsert, toDelete };
}
