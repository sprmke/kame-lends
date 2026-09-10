<script lang="ts" generics="T">
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
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
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
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
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end">
			<DropdownMenu.Item onclick={() => handleExportClick('all')}>
				<FileText class="h-4 w-4" />
				Export All Data ({data.length}
				{data.length === 1 ? 'item' : 'items'})
			</DropdownMenu.Item>
			{#if hasFilters}
				<DropdownMenu.Item onclick={() => handleExportClick('filtered')}>
					<Filter class="h-4 w-4" />
					Export Filtered Data ({filteredData.length}
					{filteredData.length === 1 ? 'item' : 'items'})
				</DropdownMenu.Item>
			{/if}
			{#if hasSelection}
				<DropdownMenu.Item onclick={() => handleExportClick('selected')}>
					<CheckSquare class="h-4 w-4" />
					Export Selected ({selectedData.length}
					{selectedData.length === 1 ? 'item' : 'items'})
				</DropdownMenu.Item>
			{/if}
		</DropdownMenu.Content>
	</DropdownMenu.Root>
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
