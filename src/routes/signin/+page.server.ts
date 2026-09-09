import { signIn } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.session?.user) {
		throw redirect(303, url.searchParams.get('callbackUrl') ?? '/dashboard');
	}
	return { callbackUrl: url.searchParams.get('callbackUrl') ?? '/dashboard' };
};

export const actions: Actions = {
	default: signIn
};
