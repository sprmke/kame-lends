<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { formatText } from '$lib/format';
	import { cn } from '$lib/utils';
	import { mobilePageTitle } from '$lib/stores/mobile-page-title.svelte';

	interface Props {
		title: string;
		description?: string;
		onCancel: () => void;
		onSubmit: () => void;
		isSubmitting: boolean;
		isEditMode: boolean;
		submitLabel?: string;
		cancelLabel?: string;
		/**
		 * page: sticky bottom actions under the mobile tab bar (full routes).
		 * embedded: inline actions for sheets/dialogs (never viewport-fixed).
		 */
		variant?: 'page' | 'embedded';
	}

	let {
		title,
		description,
		onCancel,
		onSubmit,
		isSubmitting,
		isEditMode,
		submitLabel,
		cancelLabel = 'Cancel',
		variant = 'page'
	}: Props = $props();

	const isEmbedded = $derived(variant === 'embedded');

	const formBtnClass = $derived(
		isEmbedded
			? 'h-10 flex-1 px-3 text-sm lg:h-8 lg:flex-none'
			: 'touch-target h-11 flex-1 px-3 text-sm lg:h-8 lg:flex-none lg:text-sm'
	);

	const defaultSubmitLabel = $derived(
		isSubmitting ? (isEditMode ? 'Updating...' : 'Creating...') : isEditMode ? 'Update' : 'Create'
	);

	const displayTitle = $derived(isEditMode ? formatText(`Edit - ${title}`) : formatText(title));

	$effect(() => {
		if (isEmbedded) return;
		mobilePageTitle.set(displayTitle);
		return () => mobilePageTitle.clear();
	});
</script>

<div
	class={cn(
		'mb-4 flex flex-col items-start justify-between gap-2.5',
		isEmbedded ? 'gap-3' : 'lg:flex-row lg:gap-3'
	)}
>
	<div class="flex-1">
		{#if isEmbedded}
			<p class="text-base font-semibold lg:text-lg">{displayTitle}</p>
		{:else}
			<!-- Title lives in MobileTopBar under lg. -->
			<h1 class="hidden text-lg font-semibold lg:block lg:text-xl">{displayTitle}</h1>
		{/if}
		{#if description}
			<p class={cn('mt-1 text-sm text-muted-foreground', !isEmbedded && 'hidden lg:block')}>
				{formatText(description)}
			</p>
		{/if}
	</div>

	{#if isEmbedded}
		<div class="flex w-full items-center gap-2">
			<Button
				type="button"
				variant="outline"
				size="sm"
				onclick={onCancel}
				disabled={isSubmitting}
				class={formBtnClass}
			>
				{cancelLabel}
			</Button>
			<Button
				type="button"
				size="sm"
				onclick={onSubmit}
				disabled={isSubmitting}
				class={formBtnClass}
			>
				{submitLabel ?? defaultSubmitLabel}
			</Button>
		</div>
	{:else}
		<div
			class="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-border/80 bg-card/95 p-3 mobile-sticky-actions-with-tabs backdrop-blur-md lg:static lg:z-auto lg:w-auto lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
		>
			<Button
				type="button"
				variant="outline"
				size="sm"
				onclick={onCancel}
				disabled={isSubmitting}
				class={formBtnClass}
			>
				{cancelLabel}
			</Button>
			<Button
				type="button"
				size="sm"
				onclick={onSubmit}
				disabled={isSubmitting}
				class={formBtnClass}
			>
				{submitLabel ?? defaultSubmitLabel}
			</Button>
		</div>
		<div
			class="w-full lg:hidden"
			style="height: calc(var(--mobile-tab-height) + var(--safe-area-bottom) + 4.25rem)"
			aria-hidden="true"
		></div>
	{/if}
</div>
