<script lang="ts">
	import type { Snippet } from 'svelte';
	import { mobileHeaderActions } from '$lib/stores/mobile-header-actions.svelte';

	interface Props {
		snippet: Snippet;
		active: boolean;
	}

	let { snippet, active }: Props = $props();

	$effect(() => {
		if (active) {
			mobileHeaderActions.set(snippet);
		} else if (mobileHeaderActions.snippet === snippet) {
			mobileHeaderActions.clear();
		}
		return () => {
			if (mobileHeaderActions.snippet === snippet) {
				mobileHeaderActions.clear();
			}
		};
	});
</script>
