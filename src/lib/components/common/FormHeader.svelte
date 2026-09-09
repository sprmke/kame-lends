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

	const formBtnClass = 'h-8 flex-1 px-3 text-xs md:flex-none md:text-sm';

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
	<div class="flex w-full items-center gap-1.5 md:w-auto md:gap-2">
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
</div>
