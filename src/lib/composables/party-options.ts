import type { Borrower, Investor, Witness } from "$lib/types";

export type PartyOptions = {
  investors: Investor[];
  borrowers: Borrower[];
  witnesses: Witness[];
};

const CACHE_TTL_MS = 45_000;

let cache: PartyOptions | null = null;
let cacheAt = 0;
let inflight: Promise<PartyOptions> | null = null;

async function fetchJsonArray<T>(url: string): Promise<T[]> {
  const response = await fetch(url);
  const data: unknown = await response.json();
  return Array.isArray(data) ? (data as T[]) : [];
}

/** One in-flight / cached fetch of id+name party lists for filters and forms. */
export async function loadPartyOptions(): Promise<PartyOptions> {
  if (cache && Date.now() - cacheAt < CACHE_TTL_MS) return cache;
  if (inflight) return inflight;

  inflight = Promise.all([
    fetchJsonArray<Investor>("/api/investors?simple=true"),
    fetchJsonArray<Borrower>("/api/borrowers?simple=true"),
    fetchJsonArray<Witness>("/api/witnesses?simple=true"),
  ])
    .then(([investors, borrowers, witnesses]) => {
      cache = { investors, borrowers, witnesses };
      cacheAt = Date.now();
      return cache;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function clearPartyOptionsCache(): void {
  cache = null;
  cacheAt = 0;
  inflight = null;
}
