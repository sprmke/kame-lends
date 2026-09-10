<script lang="ts">
	import * as Select from '$lib/components/ui/select';
	import { LIST_FILTER_TRIGGER_CLASS } from '$lib/list-filters';
	import { cn } from '$lib/utils';

	export interface SingleSelectOption {
		value: string;
		label: string;
	}

	interface Props {
		options: readonly SingleSelectOption[] | SingleSelectOption[];
		value: string;
		onChange: (value: string) => void;
		class?: string;
	}

	let { options, value, onChange, class: className }: Props = $props();

	const selectedLabel = $derived(
		options.find((option) => option.value === value)?.label ?? options[0]?.label ?? ''
	);
</script>

<div class={cn(LIST_FILTER_TRIGGER_CLASS, className)}>
	<Select.Root
		type="single"
		{value}
		onValueChange={(next) => {
			if (next) onChange(next);
		}}
	>
		<Select.Trigger class="w-full">{selectedLabel}</Select.Trigger>
		<Select.Content>
			{#each options as option (option.value)}
				<Select.Item value={option.value}>{option.label}</Select.Item>
			{/each}
		</Select.Content>
	</Select.Root>
</div>
