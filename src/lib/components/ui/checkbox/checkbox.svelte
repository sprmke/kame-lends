<script lang="ts">
	import { Checkbox as CheckboxPrimitive } from 'bits-ui';
	import CheckIcon from '@lucide/svelte/icons/check';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import { checkboxIndicatorClassName, checkboxRootClassName } from './checkbox-styles';

	let {
		ref = $bindable(null),
		checked = $bindable(false),
		indeterminate = $bindable(false),
		class: className,
		...restProps
	}: WithoutChildrenOrChild<CheckboxPrimitive.RootProps> = $props();
</script>

<CheckboxPrimitive.Root
	bind:ref
	data-slot="checkbox"
	class={cn(
		'peer relative flex cursor-pointer items-center justify-center outline-none',
		'after:absolute after:-inset-x-3 after:-inset-y-2',
		'group-has-disabled/field:opacity-50',
		'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
		checkboxRootClassName,
		className
	)}
	bind:checked
	bind:indeterminate
	{...restProps}
>
	{#snippet children({ checked, indeterminate })}
		<div data-slot="checkbox-indicator" class={checkboxIndicatorClassName}>
			{#if indeterminate}
				<MinusIcon />
			{:else if checked}
				<CheckIcon />
			{/if}
		</div>
	{/snippet}
</CheckboxPrimitive.Root>
