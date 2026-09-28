<script lang="ts">
	import type { Snippet } from 'svelte';
	import { groupHubLoanExportActions } from '$lib/stores/group-hub-loan-export.svelte';

	interface Props {
		actions: Snippet;
		active?: boolean;
	}

	let { actions, active = true }: Props = $props();

	$effect(() => {
		if (!active) {
			if (groupHubLoanExportActions.snippet === actions) {
				groupHubLoanExportActions.clear();
			}
			return;
		}
		groupHubLoanExportActions.set(actions);
		return () => {
			if (groupHubLoanExportActions.snippet === actions) {
				groupHubLoanExportActions.clear();
			}
		};
	});
</script>
