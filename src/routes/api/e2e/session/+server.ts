import { json, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { sessions, users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { normalizeEmail } from '$lib/loan-signing';

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;

function isE2EAuthEnabled() {
	const secret = env.E2E_AUTH_SECRET?.trim();
	if (!secret) return false;
	if (env.VERCEL_ENV === 'production') return false;
	return true;
}

export const POST: RequestHandler = async ({ request }) => {
	if (!isE2EAuthEnabled()) {
		return json({ error: 'E2E auth is disabled' }, { status: 404 });
	}

	const provided = request.headers.get('x-e2e-auth-secret');
	if (!provided || provided !== env.E2E_AUTH_SECRET) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	let bodyEmail: string | undefined;
	const contentType = request.headers.get('content-type') || '';
	if (contentType.includes('application/json')) {
		try {
			const body = (await request.json()) as { email?: unknown };
			if (typeof body.email === 'string') {
				bodyEmail = normalizeEmail(body.email) || undefined;
			}
		} catch {
			bodyEmail = undefined;
		}
	}

	const email = bodyEmail || env.E2E_USER_EMAIL?.trim();
	let user = email ? await db.query.users.findFirst({ where: eq(users.email, email) }) : null;

	if (!user && !bodyEmail) {
		const candidates = await db.query.users.findMany({
			where: eq(users.role, 'admin'),
			with: { loans: { columns: { id: true } } }
		});
		user =
			candidates.sort((a, b) => (b.loans?.length ?? 0) - (a.loans?.length ?? 0))[0] ??
			candidates[0] ??
			null;
	}

	if (!user) {
		return json({ error: 'No user found for E2E session' }, { status: 404 });
	}

	const sessionToken = crypto.randomUUID();
	const expires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

	await db.insert(sessions).values({
		sessionToken,
		userId: user.id,
		expires
	});

	const secure = request.url.startsWith('https://');
	const cookieName = secure ? '__Secure-authjs.session-token' : 'authjs.session-token';
	const cookie = `${cookieName}=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${
		secure ? '; Secure' : ''
	}`;

	return new Response(
		JSON.stringify({ userId: user.id, email: user.email, role: user.role }),
		{
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Set-Cookie': cookie
			}
		}
	);
};
