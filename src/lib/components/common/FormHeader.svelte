<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { formatText } from '$lib/format';

	interface Props {
		title: string;
		description?: string;
		onCancel: () => void;
		onSubmit: () => void;
		isSubmitting: boolean;
		isEditMode: boolean;
		submitLabel?: string;
		cancelLabel?: string;
	}

	let {
		title,
		description,
		onCancel,
		onSubmit,
		isSubmitting,
		isEditMode,
		submitLabel,
		cancelLabel = 'Cancel'
	}: Props = $props();

	const formBtnClass = 'touch-target h-11 flex-1 px-3 text-sm md:h-8 md:flex-none md:text-sm';

	const defaultSubmitLabel = $derived(
		isSubmitting ? (isEditMode ? 'Updating...' : 'Creating...') : isEditMode ? 'Update' : 'Create'
	);

	const displayTitle = $derived(isEditMode ? formatText(`Edit - ${title}`) : formatText(title));
</script>

<div class="mb-4 flex flex-col items-start justify-between gap-2.5 md:flex-row md:gap-3">
	<div class="flex-1">
		<h1 class="text-lg font-semibold md:text-xl">{displayTitle}</h1>
		{#if description}
			<p class="mt-1 text-sm text-muted-foreground">{formatText(description)}</p>
		{/if}
	</div>
	<div
		class="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-border/80 bg-card/95 p-3 mobile-sticky-actions-with-tabs backdrop-blur-md md:static md:z-auto md:w-auto md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none"
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
		<Button type="button" size="sm" onclick={onSubmit} disabled={isSubmitting} class={formBtnClass}>
			{submitLabel ?? defaultSubmitLabel}
		</Button>
	</div>
	<!-- Spacer so content clears the sticky mobile bar -->
	<div class="h-16 w-full md:hidden" aria-hidden="true"></div>
</div>
