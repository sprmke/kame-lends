import { APP_NAME_SLUG } from '$lib/brand';

const OVERDUE_CHECK_KEY = `${APP_NAME_SLUG}:last-overdue-check`;
const OVERDUE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
/** Wait until primary page data has had time to load before competing for DB. */
const OVERDUE_CHECK_DELAY_MS = 3_000;

export function runOverdueCheckOnce(enabled = true) {
	if (!enabled || typeof window === 'undefined') return;

	const lastCheck = Number(localStorage.getItem(OVERDUE_CHECK_KEY) ?? 0);
	if (Date.now() - lastCheck < OVERDUE_CHECK_INTERVAL_MS) return;

	window.setTimeout(() => {
		const lastRun = Number(localStorage.getItem(OVERDUE_CHECK_KEY) ?? 0);
		if (Date.now() - lastRun < OVERDUE_CHECK_INTERVAL_MS) return;

		localStorage.setItem(OVERDUE_CHECK_KEY, String(Date.now()));

		fetch('/api/loans/check-overdue', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' }
		}).catch(() => {
			localStorage.removeItem(OVERDUE_CHECK_KEY);
		});
	}, OVERDUE_CHECK_DELAY_MS);
}
