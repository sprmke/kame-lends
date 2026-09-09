<script lang="ts" generics="T">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import * as ScrollArea from '$lib/components/ui/scroll-area';
	import { FileText, CheckSquare, Square, Loader2 } from 'lucide-svelte';
	import type { PDFSection } from '$lib/pdf-export';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		sections: PDFSection<T>[];
		onExport: (selectedSections: PDFSection<T>[]) => void | Promise<void>;
		title?: string;
		description?: string;
		isGenerating?: boolean;
	}

	let {
		open,
		onOpenChange,
		sections,
		onExport,
		title = 'Configure PDF Export',
		description = 'Choose which sections to include in the exported PDF.',
		isGenerating = false
	}: Props = $props();

	let selectedIndices = $state<Set<number>>(new Set());

	$effect(() => {
		if (open) {
			selectedIndices = new Set(sections.map((_, index) => index));
		}
	});

	const allSelected = $derived(selectedIndices.size === sections.length);
	const noneSelected = $derived(selectedIndices.size === 0);

	function toggleSection(index: number) {
		const next = new Set(selectedIndices);
		if (next.has(index)) next.delete(index);
		else next.add(index);
		selectedIndices = next;
	}

	function selectAll() {
		selectedIndices = new Set(sections.map((_, index) => index));
	}

	function deselectAll() {
		selectedIndices = new Set();
	}

	async function handleExport() {
		const selected = sections.filter((_, index) => selectedIndices.has(index));
		await onExport(selected);
	}
</script>

<Dialog.Root
	{open}
	onOpenChange={(next) => {
		if (!isGenerating) onOpenChange(next);
	}}
>
	<Dialog.Content class="sm:max-w-[480px]">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<FileText class="h-5 w-5 text-primary" />
				{title}
			</Dialog.Title>
			<Dialog.Description>{description}</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4">
			<div class="flex items-center gap-2 border-b pb-3">
				<Button
					variant="outline"
					size="sm"
					class="flex-1"
					onclick={selectAll}
					disabled={allSelected || isGenerating}
				>
					<CheckSquare class="mr-2 h-4 w-4" />
					Select All
				</Button>
				<Button
					variant="outline"
					size="sm"
					class="flex-1"
					onclick={deselectAll}
					disabled={noneSelected || isGenerating}
				>
					<Square class="mr-2 h-4 w-4" />
					Deselect All
				</Button>
			</div>

			<ScrollArea.Root class="h-[280px] pr-4">
				<div class="space-y-1">
					{#each sections as section, index (section.key)}
						<button
							type="button"
							class="flex w-full items-start space-x-3 rounded-lg p-2.5 text-left transition-colors hover:bg-muted/50"
							onclick={() => toggleSection(index)}
							disabled={isGenerating}
						>
							<Checkbox checked={selectedIndices.has(index)} class="mt-0.5" />
							<div class="space-y-0.5">
								<Label class="cursor-pointer font-medium">{section.header}</Label>
								{#if section.description}
									<p class="text-xs text-muted-foreground">{section.description}</p>
								{/if}
							</div>
						</button>
					{/each}
				</div>
			</ScrollArea.Root>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => onOpenChange(false)} disabled={isGenerating}>
				Cancel
			</Button>
			<Button onclick={handleExport} disabled={noneSelected || isGenerating}>
				{#if isGenerating}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{/if}
				Export PDF
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
