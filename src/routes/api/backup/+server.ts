import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSession } from '$lib/server/session';
import { backupFilename } from '$lib/brand';
import { fetchBackupDataForUser, type BackupData } from '$lib/server/backup-data';

/**
 * GET /api/backup
 * Exports all business data for the signed-in user (same scope as dashboard).
 * Optional ?download=true returns a JSON file attachment.
 *
 * Note: This is an application-level export (investors, loans, loan_investors,
 * interest_periods, received_payments, transactions). It does not include
 * NextAuth tables (OAuth tokens, sessions). For a full Postgres snapshot use Neon backups / PITR.
 */
export const GET: RequestHandler = async (event) => {
	const request = event.request;
	try {
		const session = await getSession(event);
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const backupData: BackupData = await fetchBackupDataForUser({
			userId: session.user.id,
			exportedByLabel: session.user.email || session.user.name || session.user.id
		});

		const { searchParams } = new URL(request.url);
		const download = searchParams.get('download') === 'true';

		if (download) {
			const filename = backupFilename(new Date());

			return new Response(JSON.stringify(backupData, null, 2), {
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'Content-Disposition': `attachment; filename="${filename}"`
				}
			});
		}

		return json(backupData);
	} catch (error) {
		console.error('Error creating backup:', error);
		return json({ error: 'Failed to create backup' }, { status: 500 });
	}
};
