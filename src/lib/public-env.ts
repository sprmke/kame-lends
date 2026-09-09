import { env } from '$env/dynamic/public';

export function publicAppUrl(): string {
	return env.PUBLIC_APP_URL ?? '';
}

export function publicContractDisputeVenue(): string {
	return env.PUBLIC_CONTRACT_DISPUTE_VENUE ?? 'Pampanga, Philippines';
}
