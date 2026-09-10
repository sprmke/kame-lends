<script lang="ts">
	import type { Snippet } from 'svelte';
	import FormHeader from '$lib/components/common/FormHeader.svelte';
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		title: string;
		description?: string;
		formId?: string;
		isSubmitting: boolean;
		isEditMode: boolean;
		submitLabel?: string;
		contentClass?: string;
		children: Snippet;
	}

	let {
		open,
		onOpenChange,
		title,
		description,
		formId,
		isSubmitting,
		isEditMode,
		submitLabel,
		contentClass = 'dashboard-dialog-wide !max-w-4xl',
		children
	}: Props = $props();
</script>

<ResponsiveModal {open} {onOpenChange} showCloseButton={false} {contentClass}>
	{#snippet header()}
		<FormHeader
			{title}
			{description}
			{formId}
			onCancel={() => onOpenChange(false)}
			{isSubmitting}
			{isEditMode}
			{submitLabel}
			variant="embedded"
		/>
	{/snippet}

	{@render children()}
</ResponsiveModal>
