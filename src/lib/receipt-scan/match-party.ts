export interface PartyCandidate {
  id: number;
  name: string;
}

const HONORIFICS = new Set([
  "mr",
  "mrs",
  "ms",
  "miss",
  "dr",
  "atty",
  "engr",
  "sir",
  "maam",
  "jr",
  "sr",
]);

const MIN_SCORE = 0.7;

/** Lowercase, strip accents and punctuation (keeps `*` used by GCash/Maya masking), drop honorifics. */
export function nameTokens(value: string): string[] {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9*\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !HONORIFICS.has(token));
}

function isMasked(token: string): boolean {
  return token.includes("*");
}

/** `ju**` matches `juan`, `c` matches `cruz`, otherwise exact. */
function tokenMatches(receiptToken: string, nameToken: string): boolean {
  if (isMasked(receiptToken)) {
    const prefix = receiptToken.slice(0, receiptToken.indexOf("*"));
    return (
      prefix.length > 0 &&
      nameToken.startsWith(prefix) &&
      nameToken.length >= prefix.length
    );
  }
  if (receiptToken.length === 1) return nameToken.startsWith(receiptToken);
  return receiptToken === nameToken;
}

/**
 * 0..1 similarity between a name read off a receipt and a CRM name.
 * Order-insensitive so "DELA CRUZ, JUAN" matches "Juan Dela Cruz".
 */
export function nameMatchScore(
  receiptName: string,
  candidateName: string,
): number {
  const receipt = nameTokens(receiptName);
  const candidate = nameTokens(candidateName);
  if (receipt.length === 0 || candidate.length === 0) return 0;

  const receiptJoined = receipt.join(" ");
  const candidateJoined = candidate.join(" ");
  if (receiptJoined === candidateJoined) return 1;

  const masked = receipt.some(isMasked);
  if (
    !masked &&
    receiptJoined.length >= 4 &&
    (candidateJoined.includes(receiptJoined) ||
      receiptJoined.includes(candidateJoined))
  ) {
    return 0.9;
  }

  const unused = [...candidate];
  let matched = 0;
  for (const token of receipt) {
    const index = unused.findIndex((nameToken) =>
      tokenMatches(token, nameToken),
    );
    if (index === -1) continue;
    unused.splice(index, 1);
    matched += 1;
  }
  // Every receipt token must match, and at least two (or the whole name) — a lone
  // initial is too weak.
  if (matched < receipt.length || (matched < 2 && candidate.length > 1)) {
    return 0;
  }
  return masked ? 0.75 : 0.85;
}

/** Best unambiguous match, or null when nothing scores high enough or two candidates tie. */
export function findMatchingParty<T extends PartyCandidate>(
  receiptName: string | null | undefined,
  candidates: T[],
): T | null {
  if (!receiptName) return null;
  let best: T | null = null;
  let bestScore = 0;
  let tied = false;
  for (const candidate of candidates) {
    const score = nameMatchScore(receiptName, candidate.name);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
      tied = false;
    } else if (score === bestScore && score > 0) {
      tied = true;
    }
  }
  return best && bestScore >= MIN_SCORE && !tied ? best : null;
}
