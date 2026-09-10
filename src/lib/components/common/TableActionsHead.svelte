<script lang="ts">
	import * as Table from '$lib/components/ui/table';
	import { TABLE_COL_ACTIONS } from '$lib/table-styles';
	import { cn } from '$lib/utils';

	interface Props {
		class?: string;
	}

	let { class: className }: Props = $props();
</script>

<Table.Head class={cn(TABLE_COL_ACTIONS, className)}>
	<span class="sr-only">Actions</span>
</Table.Head>
