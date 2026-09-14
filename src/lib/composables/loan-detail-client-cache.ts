import type { LoanWithInvestors, PaymentMethod } from "$lib/types";
import type { LoanAccessContext } from "$lib/loan-access";
import type {
  SigningInvitationRecord,
  SigningInvitationSummary,
} from "$lib/loan-signing";

const CACHE_TTL_MS = 45_000;

type CacheEntry<T> = { at: number; value: T };

const loanDetailCache = new Map<string, CacheEntry<LoanDetailClientPayload>>();
const signingCache = new Map<string, CacheEntry<SigningClientPayload>>();
const contractCache = new Map<string, CacheEntry<ContractClientPayload>>();
const inflight = new Map<string, Promise<unknown>>();

export type LoanDetailClientPayload = LoanWithInvestors & {
  paymentMethods?: PaymentMethod[];
  access?: LoanAccessContext;
};

export type SigningClientPayload = {
  invitations: SigningInvitationSummary[];
  viewerInvitationId: number | null;
  hasContract?: boolean;
};

export type ContractClientPayload = {
  signingInvitations?: SigningInvitationRecord[];
  customization?: unknown;
  contractData?: unknown;
  hasStoredContract?: boolean;
};

function cacheGet<T>(map: Map<string, CacheEntry<T>>, key: string): T | null {
  const hit = map.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    map.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet<T>(map: Map<string, CacheEntry<T>>, key: string, value: T) {
  map.set(key, { at: Date.now(), value });
}

async function cachedFetch<T>(
  cacheKey: string,
  map: Map<string, CacheEntry<T>>,
  url: string,
): Promise<T | null> {
  const cached = cacheGet(map, cacheKey);
  if (cached) return cached;
  const existing = inflight.get(cacheKey);
  if (existing) return (await existing) as T | null;

  const request = (async () => {
    const response = await fetch(url);
    if (!response.ok) return null;
    const value = (await response.json()) as T;
    cacheSet(map, cacheKey, value);
    return value;
  })().finally(() => {
    inflight.delete(cacheKey);
  });

  inflight.set(cacheKey, request);
  return request;
}

export function clearLoanClientCaches(loanId?: number): void {
  if (loanId == null) {
    loanDetailCache.clear();
    signingCache.clear();
    contractCache.clear();
    inflight.clear();
    return;
  }
  const id = String(loanId);
  const prefix = `${id}:`;
  for (const key of [...loanDetailCache.keys()]) {
    if (key.startsWith(prefix)) loanDetailCache.delete(key);
  }
  signingCache.delete(id);
  contractCache.delete(id);
  for (const key of [...inflight.keys()]) {
    if (key === id || key.startsWith(prefix)) inflight.delete(key);
  }
}

export async function fetchLoanDetailClient(
  loanId: number,
  options: { includeContract?: boolean } = {},
): Promise<LoanDetailClientPayload | null> {
  const includeContract = Boolean(options.includeContract);
  const cacheKey = `${loanId}:${includeContract ? "contract" : "slim"}`;
  return cachedFetch(
    cacheKey,
    loanDetailCache,
    `/api/loans/${loanId}${includeContract ? "?include=contract" : ""}`,
  );
}

export async function fetchSigningClient(
  loanId: number,
): Promise<SigningClientPayload | null> {
  return cachedFetch(
    String(loanId),
    signingCache,
    `/api/loans/${loanId}/signing`,
  );
}

export async function fetchContractClient(
  loanId: number,
): Promise<ContractClientPayload | null> {
  return cachedFetch(
    String(loanId),
    contractCache,
    `/api/loans/${loanId}/contract`,
  );
}
