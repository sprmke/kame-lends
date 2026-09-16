<script lang="ts" generics="T">
	import { Button } from '$lib/components/ui/button';
	import ResponsiveOverflowMenu from '$lib/components/common/ResponsiveOverflowMenu.svelte';
	import type { RowActionItem } from '$lib/components/common/action-buttons';
	import ExportColumnsModal from '$lib/components/common/ExportColumnsModal.svelte';
	import { toast } from '$lib/toast';
	import { CheckSquare, FileText, Filter, Loader2 } from 'lucide-svelte';
	import type { PDFSection } from '$lib/pdf-export';

	type ExportScope = 'all' | 'filtered' | 'selected';

	interface Props {
		data: T[];
		filteredData: T[];
		selectedData?: T[];
		sections: PDFSection<T>[];
		onGeneratePDF: (data: T[], enabledSectionKeys: string[]) => Promise<void>;
		variant?: 'default' | 'outline' | 'ghost' | 'secondary';
		size?: 'default' | 'sm' | 'lg' | 'icon';
		class?: string;
	}

	let {
		data,
		filteredData,
		selectedData = [],
		sections,
		onGeneratePDF,
		variant = 'outline',
		size = 'default',
		class: className = ''
	}: Props = $props();

	let showModal = $state(false);
	let exportScope = $state<ExportScope>('all');
	let isGenerating = $state(false);

	const hasFilters = $derived(data.length !== filteredData.length);
	const hasSelection = $derived(selectedData.length > 0);

	const dataCount = $derived(
		exportScope === 'all'
			? data.length
			: exportScope === 'filtered'
				? filteredData.length
				: selectedData.length
	);

	const modalDescription = $derived(
		`Choose which sections to include in the exported PDF. (${dataCount} ${dataCount === 1 ? 'item' : 'items'})`
	);

	const showDropdown = $derived((hasFilters ? 1 : 0) + (hasSelection ? 1 : 0) + 1 > 1);

	const exportMenuItems = $derived.by((): RowActionItem[] => {
		const items: RowActionItem[] = [
			{
				label: `Export All Data (${data.length} ${data.length === 1 ? 'item' : 'items'})`,
				lucideIcon: FileText,
				onClick: () => handleExportClick('all')
			}
		];
		if (hasFilters) {
			items.push({
				label: `Export Filtered Data (${filteredData.length} ${filteredData.length === 1 ? 'item' : 'items'})`,
				lucideIcon: Filter,
				onClick: () => handleExportClick('filtered')
			});
		}
		if (hasSelection) {
			items.push({
				label: `Export Selected (${selectedData.length} ${selectedData.length === 1 ? 'item' : 'items'})`,
				lucideIcon: CheckSquare,
				onClick: () => handleExportClick('selected')
			});
		}
		return items;
	});

	function handleExportClick(scope: ExportScope) {
		exportScope = scope;
		showModal = true;
	}

	async function handleExport(selected: PDFSection<T>[]) {
		const dataToExport =
			exportScope === 'all' ? data : exportScope === 'filtered' ? filteredData : selectedData;

		if (dataToExport.length === 0) {
			toast.error('No data to export');
			return;
		}

		if (selected.length === 0) {
			toast.error('Please select at least one section to export');
			return;
		}

		const enabledKeys = selected.map((section) => section.key);
		isGenerating = true;
		try {
			await onGeneratePDF(dataToExport, enabledKeys);
			showModal = false;
			toast.success('PDF exported successfully');
		} catch (error) {
			console.error('PDF generation error:', error);
			toast.error('Failed to generate PDF. Please try again.');
		} finally {
			isGenerating = false;
		}
	}
</script>

{#if showDropdown}
	<ResponsiveOverflowMenu
		items={exportMenuItems}
		ariaLabel="Export PDF"
		sheetTitle="Export PDF"
	>
		{#snippet trigger({ props })}
			<Button
				{...props}
				{variant}
				{size}
				class={className}
				adaptToMobileHero
				disabled={isGenerating}
				aria-label="Export PDF"
			>
				{#if isGenerating}
					<Loader2 class="h-4 w-4 animate-spin md:mr-2" />
				{:else}
					<FileText class="h-4 w-4 md:mr-2" />
				{/if}
				<span class="hidden md:inline">Export PDF</span>
			</Button>
		{/snippet}
	</ResponsiveOverflowMenu>
{:else}
	<Button
		{variant}
		{size}
		class={className}
		adaptToMobileHero
		onclick={() => handleExportClick('all')}
		disabled={isGenerating}
		aria-label="Export PDF"
	>
		{#if isGenerating}
			<Loader2 class="h-4 w-4 animate-spin xl:mr-2" />
		{:else}
			<FileText class="h-4 w-4 xl:mr-2" />
		{/if}
		<span class="hidden xl:inline">Export PDF</span>
	</Button>
{/if}

<ExportColumnsModal
	open={showModal}
	onOpenChange={(open) => (showModal = open)}
	{sections}
	onExport={handleExport}
	description={modalDescription}
	{isGenerating}
/>
