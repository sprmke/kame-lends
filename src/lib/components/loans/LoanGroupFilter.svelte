<script lang="ts">
	import SingleSelectFilter from '$lib/components/common/SingleSelectFilter.svelte';
	import { buildGroupFilterOptions, type GroupFilterOptionInput } from '$lib/groups/loan-group-filter';
	import type { GroupChipSelection } from '$lib/components/groups/types';
	import { LIST_FILTER_DESKTOP_TRIGGER_CLASS } from '$lib/list-filters';
	import { cn } from '$lib/utils';

	interface Props {
		groups: GroupFilterOptionInput[];
		selected: GroupChipSelection;
		showUngrouped?: boolean;
		ungroupedCount?: number;
		onChange: (value: GroupChipSelection) => void;
		triggerClassName?: string;
		class?: string;
	}

	let {
		groups,
		selected,
		showUngrouped = false,
		ungroupedCount = 0,
		onChange,
		triggerClassName = LIST_FILTER_DESKTOP_TRIGGER_CLASS,
		class: className
	}: Props = $props();

	const options = $derived(
		buildGroupFilterOptions({
			groups,
			showUngrouped,
			ungroupedCount
		})
	);

	const value = $derived(
		selected === 'all'
			? 'all'
			: selected === 'ungrouped'
				? 'ungrouped'
				: String(selected)
	);

	function handleChange(next: string) {
		if (next === 'all') onChange('all');
		else if (next === 'ungrouped') onChange('ungrouped');
		else {
			const id = Number(next);
			if (Number.isFinite(id)) onChange(id);
		}
	}
</script>

<SingleSelectFilter
	{options}
	{value}
	onChange={handleChange}
	class={cn(triggerClassName, className)}
/>
