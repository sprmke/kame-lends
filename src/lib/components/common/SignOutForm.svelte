<script lang="ts">
	import { purgeOfflineState } from '$lib/pwa/purge';
	import type { Snippet } from 'svelte';

	interface Props {
		class?: string;
		children: Snippet;
	}

	let { class: className = 'w-full', children }: Props = $props();

	async function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		await purgeOfflineState();
		form.submit();
	}
</script>

<form method="POST" action="/auth/signout?/signOut" class={className} onsubmit={onSubmit}>
	{@render children()}
</form>
