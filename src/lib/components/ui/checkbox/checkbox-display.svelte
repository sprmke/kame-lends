<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import { cn } from '$lib/utils.js';
	import { checkboxIndicatorClassName, checkboxRootClassName } from './checkbox-styles';

	interface Props {
		checked: boolean;
		class?: string;
	}

	let { checked, class: className }: Props = $props();
</script>

<span
	aria-hidden="true"
	class={cn(
		'inline-flex items-center justify-center',
		checkboxRootClassName,
		checked &&
			'border-primary bg-primary text-primary-foreground shadow-[0_1px_3px_color-mix(in_oklch,var(--primary)_35%,transparent)]',
		className
	)}
>
	{#if checked}
		<span class={checkboxIndicatorClassName}>
			<CheckIcon />
		</span>
	{/if}
</span>
