/**
 * Manual Google Calendar smoke (not run by default Vitest include).
 * Run: bun run test:unit src/lib/server/google-calendar.smoke.manual.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { describe, expect, it } from 'vitest';
import {
	createCalendarEvent,
	updateCalendarEvent,
	deleteCalendarEvent
} from './google-calendar';

describe('google-calendar smoke', () => {
	it(
		'creates updates and deletes an event',
		async () => {
			const calendarId = process.env.GOOGLE_CALENDAR_ID || '';
			expect(calendarId).not.toBe('primary');
			expect(calendarId.includes('@group.calendar.google.com')).toBe(true);

			const date = new Date();
			date.setUTCHours(0, 0, 0, 0);

			const id = await createCalendarEvent({
				type: 'due',
				date
			});
			if (!id) {
				throw new Error(
					'createCalendarEvent returned null. Check service account (invalid_grant / account not found) and calendar sharing.'
				);
			}
			const updated = await updateCalendarEvent(id, { type: 'due', date });
			expect(updated).toBe(true);
			const deleted = await deleteCalendarEvent(id);
			expect(deleted).toBe(true);
		},
		60_000
	);
});
