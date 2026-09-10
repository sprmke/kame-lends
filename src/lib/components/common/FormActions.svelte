<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';

	interface Props {
		onCancel: () => void;
		formId?: string;
		isSubmitting: boolean;
		submitLabel: string;
		cancelLabel?: string;
		/** stacked = full-width column (sheet / phone). inline = row. responsive = column below sm, row at sm+. */
		layout?: 'stacked' | 'inline' | 'responsive';
		class?: string;
	}

	let {
		onCancel,
		formId,
		isSubmitting,
		submitLabel,
		cancelLabel = 'Cancel',
		layout = 'responsive',
		class: className
	}: Props = $props();

	const isStacked = $derived(layout === 'stacked');
	const isInline = $derived(layout === 'inline');
	const isResponsive = $derived(layout === 'responsive');

	const buttonClass = $derived(
		cn(
			'touch-target shrink-0 text-base',
			isStacked && 'h-12 w-full',
			isInline && 'h-11 w-auto text-sm',
			isResponsive && 'h-12 w-full sm:h-11 sm:flex-1 sm:text-sm lg:h-11 lg:w-auto lg:flex-none'
		)
	);
</script>

<div
	class={cn(
		'form-actions flex gap-3',
		isStacked && 'mt-4 w-full flex-col-reverse border-t border-border/60 pt-4 pb-safe',
		isInline && 'w-auto shrink-0 flex-row items-center',
		isResponsive &&
			'mt-4 w-full flex-col-reverse border-t border-border/60 pt-4 pb-safe sm:flex-row sm:items-center sm:border-t-0 sm:pt-0 sm:pb-0',
		className
	)}
>
	<Button
		type="button"
		variant="outline"
		onclick={onCancel}
		disabled={isSubmitting}
		class={buttonClass}
	>
		{cancelLabel}
	</Button>
	<Button type="submit" form={formId} disabled={isSubmitting} class={buttonClass}>
		{submitLabel}
	</Button>
</div>
