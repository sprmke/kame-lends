<script lang="ts">
	import * as Select from '$lib/components/ui/select';
	import {
		PAYMENT_PROVIDER_GROUP_LABELS,
		PAYMENT_PROVIDER_GROUP_ORDER,
		paymentProviderLabel,
		providersByGroup
	} from '$lib/payment-providers';
	import { cn } from '$lib/utils';

	interface Props {
		id?: string;
		value: string;
		disabled?: boolean;
		onValueChange: (value: string) => void;
		class?: string;
	}

	let { id, value, disabled = false, onValueChange, class: className }: Props = $props();

	const selectedLabel = $derived(
		value ? paymentProviderLabel(value) : 'Select bank or e-wallet'
	);
</script>

<Select.Root
	type="single"
	{value}
	onValueChange={(next) => {
		if (next) onValueChange(next);
	}}
	{disabled}
>
	<Select.Trigger {id} class={cn('min-h-11 w-full', className)}>
		{selectedLabel}
	</Select.Trigger>
	<Select.Content class="max-h-[min(60vh,22rem)] max-w-[calc(100vw-24px)]">
		{#each PAYMENT_PROVIDER_GROUP_ORDER as group, groupIndex (group)}
			{@const options = providersByGroup(group)}
			{#if options.length > 0}
				<Select.Group class={cn(groupIndex > 0 && 'mt-1 border-t border-border/50 pt-1')}>
					<Select.GroupHeading
						class="px-2 py-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
					>
						{PAYMENT_PROVIDER_GROUP_LABELS[group]}
					</Select.GroupHeading>
					{#each options as option (option.value)}
						<Select.Item value={option.value}>
							{option.label}
						</Select.Item>
					{/each}
				</Select.Group>
			{/if}
		{/each}
	</Select.Content>
</Select.Root>
