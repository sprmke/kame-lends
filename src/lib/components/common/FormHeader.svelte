<script lang="ts">
	import FormActions from '$lib/components/common/FormActions.svelte';
	import { formatText } from '$lib/format';
	import { cn } from '$lib/utils';

	interface Props {
		title: string;
		description?: string;
		onCancel: () => void;
		onSubmit?: () => void;
		/** When set, submit uses the `form` attribute (header actions outside the form). */
		formId?: string;
		isSubmitting: boolean;
		isEditMode: boolean;
		submitLabel?: string;
		cancelLabel?: string;
		/**
		 * page: title on full routes; actions sit in the form body on phone.
		 * embedded: title in sheet/dialog chrome; actions in the header at `lg+`.
		 */
		variant?: 'page' | 'embedded';
	}

	let {
		title,
		description,
		onCancel,
		onSubmit: _onSubmit,
		formId,
		isSubmitting,
		isEditMode,
		submitLabel,
		cancelLabel = 'Cancel',
		variant = 'page'
	}: Props = $props();

	const isEmbedded = $derived(variant === 'embedded');

	const defaultSubmitLabel = $derived(
		isSubmitting ? (isEditMode ? 'Updating...' : 'Creating...') : isEditMode ? 'Update' : 'Create'
	);

	const displayTitle = $derived(isEditMode ? formatText(`Edit - ${title}`) : formatText(title));
	const resolvedSubmitLabel = $derived(submitLabel ?? defaultSubmitLabel);
</script>

<div
	class={cn(
		'flex w-full min-w-0 flex-col items-start justify-between gap-3',
		isEmbedded ? 'md:flex-row md:items-center md:gap-4' : 'mb-6 lg:flex-row lg:items-center lg:gap-4'
	)}
>
	<div class="min-w-0 flex-1">
		{#if isEmbedded}
			<h1 class="text-base font-medium tracking-tight">{displayTitle}</h1>
		{:else}
			<h1 class="text-lg font-medium tracking-tight">{displayTitle}</h1>
		{/if}
		{#if description}
			<p class="mt-1 text-sm text-muted-foreground">{formatText(description)}</p>
		{/if}
	</div>

	<FormActions
		{onCancel}
		{formId}
		{isSubmitting}
		submitLabel={resolvedSubmitLabel}
		{cancelLabel}
		layout="inline"
		class={cn(
			'shrink-0',
			isEmbedded
				? 'hidden md:flex md:justify-end'
				: 'hidden lg:flex lg:justify-end'
		)}
	/>
</div>
