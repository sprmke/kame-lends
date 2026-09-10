<script lang="ts">
	import * as Table from '$lib/components/ui/table';
	import { TABLE_COL_NUMERIC_HEAD } from '$lib/table-styles';
	import { cn } from '$lib/utils';
	import { ArrowUpDown } from 'lucide-svelte';

	interface Props {
		label: string;
		active?: boolean;
		align?: 'left' | 'right';
		class?: string;
		onclick?: () => void;
	}

	let { label, active = false, align = 'left', class: className, onclick }: Props = $props();
</script>

<Table.Head class={cn(align === 'right' && TABLE_COL_NUMERIC_HEAD, className)}>
	<button
		type="button"
		class={cn(
			'inline-flex items-center gap-1 font-medium hover:text-foreground',
			align === 'right' && 'w-full justify-end'
		)}
		{onclick}
	>
		{label}
		<ArrowUpDown
			class={cn('h-3.5 w-3.5', active ? 'text-foreground' : 'text-muted-foreground/50')}
		/>
	</button>
</Table.Head>
