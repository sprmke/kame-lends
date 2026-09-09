export const APP_NAME = 'Kame Lends';
export const APP_NAME_SLUG = 'kame-lends';
export const APP_NAME_UPPER = 'KAME LENDS';
export const APP_DEFAULT_URL = 'https://kame-lends.vercel.app';
export const APP_DOMAIN = 'kame-lends.vercel.app';

export function backupFilename(date: Date, includeTime = true): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');

	if (!includeTime) {
		return `${APP_NAME_SLUG}-backup-${year}-${month}-${day}.json`;
	}

	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	const seconds = String(date.getSeconds()).padStart(2, '0');

	return `${APP_NAME_SLUG}-backup-${year}-${month}-${day}-${hours}${minutes}${seconds}.json`;
}
