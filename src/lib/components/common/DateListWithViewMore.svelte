<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import { formatCount, formatDateShort, formatText } from '$lib/format';

	interface Props {
		dates: Date[];
		limit?: number;
		class?: string;
		itemClassName?: string | ((date: Date, index: number) => string);
		dialogTitle?: string;
		title?: string;
		formatDate?: (date: Date) => string;
		getItemClassName?: (date: Date, hasUnpaid?: boolean) => string;
		checkUnpaid?: (date: Date) => boolean;
	}

	let {
		dates,
		limit = 3,
		class: className = '',
		itemClassName = '',
		dialogTitle = 'All Dates',
		title,
		formatDate: formatDateProp,
		getItemClassName,
		checkUnpaid
	}: Props = $props();

	let showAllModal = $state(false);

	const formatDateFn = formatDateProp ?? ((date: Date) => formatDateShort(date));
	const dialogHeading = title ? formatText(`${dialogTitle} - ${title}`) : formatText(dialogTitle);
	const displayedDates = $derived(dates.slice(0, limit));
	const hasMore = $derived(dates.length > limit);

	function resolveClassName(date: Date, index: number) {
		if (typeof itemClassName === 'function') return itemClassName(date, index);
		if (getItemClassName) {
			const hasUnpaid = checkUnpaid ? checkUnpaid(date) : false;
			return getItemClassName(date, hasUnpaid);
		}
		return itemClassName;
	}
</script>

<div class="flex flex-col items-start gap-0.5 {className}">
	{#each displayedDates as date, index (date.toISOString() + index)}
		<span class={resolveClassName(date, index)}>{formatDateFn(date)}</span>
	{/each}
	{#if hasMore}
		<Button
			variant="link"
			size="sm"
			class="h-auto min-h-11 p-0 px-2 text-xs text-primary hover:underline"
			onclick={(event) => {
				event.preventDefault();
				event.stopPropagation();
				showAllModal = true;
			}}
		>
			View {formatCount(dates.length - limit)} more
		</Button>
	{/if}
</div>

<ResponsiveModal
	open={showAllModal}
	onOpenChange={(open) => (showAllModal = open)}
	title={dialogHeading}
	contentClass="sm:max-w-md"
>
	<div class="flex flex-col gap-2">
		{#each dates as date, index (date.toISOString() + index)}
			<span class={resolveClassName(date, index)}>{formatDateFn(date)}</span>
		{/each}
	</div>
</ResponsiveModal>
