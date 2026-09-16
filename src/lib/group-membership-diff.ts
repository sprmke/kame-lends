export type PartyRole = "owner" | "investor" | "borrower" | "witness";

export type MemberSnapshot = {
  userId: string;
  roles: Set<PartyRole> | PartyRole[];
  name?: string;
  email?: string | null;
};

export type AccessPerson = {
  userId: string;
  name: string;
  roles: PartyRole[];
  hasEmail: boolean;
};

function rolesOf(member: MemberSnapshot): PartyRole[] {
  const roles = member.roles instanceof Set ? [...member.roles] : member.roles;
  return [...new Set(roles)].sort() as PartyRole[];
}

export function toAccessPerson(member: MemberSnapshot): AccessPerson {
  return {
    userId: member.userId,
    name: member.name?.trim() || "Unknown",
    roles: rolesOf(member),
    hasEmail: Boolean(member.email?.trim()),
  };
}

export type MemberDiff = {
  gained: AccessPerson[];
  lost: AccessPerson[];
  unchanged: number;
};

/** Pure diff of desired vs current membership maps keyed by userId. */
export function diffGroupMembers(
  current: Map<string, MemberSnapshot> | MemberSnapshot[],
  desired: Map<string, MemberSnapshot> | MemberSnapshot[],
): MemberDiff {
  const currentMap =
    current instanceof Map
      ? current
      : new Map(current.map((m) => [m.userId, m]));
  const desiredMap =
    desired instanceof Map
      ? desired
      : new Map(desired.map((m) => [m.userId, m]));

  const gained: AccessPerson[] = [];
  const lost: AccessPerson[] = [];
  let unchanged = 0;

  for (const [userId, member] of desiredMap) {
    if (currentMap.has(userId)) {
      unchanged += 1;
    } else {
      gained.push(toAccessPerson(member));
    }
  }
  for (const [userId, member] of currentMap) {
    if (!desiredMap.has(userId)) {
      lost.push(toAccessPerson(member));
    }
  }

  gained.sort((a, b) => a.name.localeCompare(b.name));
  lost.sort((a, b) => a.name.localeCompare(b.name));
  return { gained, lost, unchanged };
}

export function rolesChanged(
  a: Iterable<string>,
  b: Iterable<string>,
): boolean {
  const left = [...new Set(a)].sort().join(",");
  const right = [...new Set(b)].sort().join(",");
  return left !== right;
}
