/** Process-local TTL cache. Per Vercel isolate; not shared across instances. */
export const CACHE_TTL_MS = 45_000;

type Entry = { value: unknown; expires: number };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const versions = new Map<string, number>();

function versionOf(key: string): number {
	return versions.get(key) ?? 0;
}

function bumpVersion(key: string): void {
	versions.set(key, versionOf(key) + 1);
}

export function memoryCacheGet<T>(key: string): T | undefined {
	const entry = store.get(key);
	if (!entry) return undefined;
	if (entry.expires <= Date.now()) {
		store.delete(key);
		return undefined;
	}
	return entry.value as T;
}

export function memoryCacheSet<T>(key: string, value: T, ttlMs = CACHE_TTL_MS): void {
	store.set(key, { value, expires: Date.now() + ttlMs });
}

export function memoryCacheInvalidatePrefix(prefix: string): void {
	const keys = new Set<string>();
	for (const key of store.keys()) {
		if (key.startsWith(prefix)) keys.add(key);
	}
	for (const key of inflight.keys()) {
		if (key.startsWith(prefix)) keys.add(key);
	}
	for (const key of versions.keys()) {
		if (key.startsWith(prefix)) keys.add(key);
	}
	for (const key of keys) {
		store.delete(key);
		inflight.delete(key);
		bumpVersion(key);
	}
}

export function memoryCacheClear(): void {
	store.clear();
	inflight.clear();
	versions.clear();
}

export async function remember<T>(
	key: string,
	fn: () => Promise<T>,
	ttlMs = CACHE_TTL_MS
): Promise<T> {
	const hit = memoryCacheGet<T>(key);
	if (hit !== undefined) return hit;

	const pending = inflight.get(key);
	if (pending) return pending as Promise<T>;

	const startedAt = versionOf(key);
	const task = fn()
		.then((value) => {
			if (versionOf(key) === startedAt) {
				memoryCacheSet(key, value, ttlMs);
			}
			return value;
		})
		.finally(() => {
			inflight.delete(key);
		});

	inflight.set(key, task);
	return task;
}
