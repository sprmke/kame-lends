<script lang="ts">
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import AccessPreview from '$lib/components/groups/AccessPreview.svelte';
	import GroupBadge from '$lib/components/groups/GroupBadge.svelte';
	import GroupColorSwatches from '$lib/components/groups/GroupColorSwatches.svelte';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Button } from '$lib/components/ui/button';
	import { nextGroupColor, type GroupColorKey } from '$lib/groups/group-colors';
	import {
		filterDropdownOptions,
		shouldShowDropdownSearch
	} from '$lib/dropdown-ux';
	import type { AccessPreviewData, GroupPickerItem } from '$lib/components/groups/types';
	import { formatCount } from '$lib/format';
	import { cn } from '$lib/utils';
	import { Plus, Search } from 'lucide-svelte';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		title?: string;
		groups: GroupPickerItem[];
		selectedIds: number[];
		onSelectedIdsChange: (ids: number[]) => void;
		multiple?: boolean;
		usedColorKeys?: string[];
		previewGroupId?: number;
		previewAddLoanIds?: number[];
		previewRemoveLoanIds?: number[];
		onSave: (selectedIds: number[]) => void | Promise<void>;
		onCreateInlineGroup?: (payload: {
			name: string;
			color: GroupColorKey;
		}) => Promise<{ id: number; name: string; color: string }>;
		skipPreview?: boolean;
	}

	let {
		open,
		onOpenChange,
		title = 'Groups',
		groups,
		selectedIds,
		onSelectedIdsChange,
		multiple = true,
		usedColorKeys = [],
		previewGroupId,
		previewAddLoanIds = [],
		previewRemoveLoanIds = [],
		onSave,
		onCreateInlineGroup,
		skipPreview = false
	}: Props = $props();

	let step = $state<'pick' | 'preview'>('pick');
	let query = $state('');
	let showNewForm = $state(false);
	let newName = $state('');
	let newColor = $state<GroupColorKey>('orange');
	let isSaving = $state(false);
	let preview = $state<AccessPreviewData | null>(null);
	let previewLoading = $state(false);
	let previewError = $state<string | null>(null);
	let saveError = $state<string | null>(null);

	const showSearch = $derived(shouldShowDropdownSearch(groups.length, true));
	const filteredGroups = $derived(filterDropdownOptions(
		groups.map((g) => ({ value: String(g.id), label: g.name })),
		query
	));

	const filteredItems = $derived(
		filteredGroups
			.map((option) => groups.find((g) => String(g.id) === option.value))
			.filter((g): g is GroupPickerItem => Boolean(g))
	);

	$effect(() => {
		if (!open) {
			step = 'pick';
			query = '';
			showNewForm = false;
			newName = '';
			newColor = nextGroupColor(usedColorKeys);
			preview = null;
			previewError = null;
			saveError = null;
		} else if (groups.length === 0 && onCreateInlineGroup) {
			showNewForm = true;
			newColor = nextGroupColor(usedColorKeys);
		}
	});

	function toggleGroup(id: number) {
		if (multiple) {
			if (selectedIds.includes(id)) {
				onSelectedIdsChange(selectedIds.filter((value) => value !== id));
			} else {
				onSelectedIdsChange([...selectedIds, id]);
			}
		} else {
			onSelectedIdsChange(selectedIds[0] === id ? [] : [id]);
		}
	}

	async function fetchPreview(): Promise<AccessPreviewData | null> {
		const targetGroupId =
			previewGroupId ??
			(previewAddLoanIds.length > 0 && selectedIds.length === 1
				? selectedIds[0]
				: undefined);
		const body = {
			addLoanIds: previewAddLoanIds,
			removeLoanIds: previewRemoveLoanIds
		};
		const url = targetGroupId
			? `/api/groups/${targetGroupId}/access-preview`
			: '/api/groups/access-preview';
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			throw new Error(data.error || 'Access preview failed');
		}
		return (await response.json()) as AccessPreviewData;
	}

	async function handleContinue() {
		saveError = null;
		if (selectedIds.length === 0) return;

		if (skipPreview) {
			await confirmSave();
			return;
		}

		previewLoading = true;
		previewError = null;
		try {
			preview = await fetchPreview();
			step = 'preview';
		} catch (error) {
			previewError = error instanceof Error ? error.message : 'Access preview failed';
		} finally {
			previewLoading = false;
		}
	}

	async function confirmSave() {
		isSaving = true;
		saveError = null;
		try {
			await onSave(selectedIds);
			onOpenChange(false);
		} catch (error) {
			saveError = error instanceof Error ? error.message : 'Save failed';
		} finally {
			isSaving = false;
		}
	}

	async function handleCreateInline() {
		if (!onCreateInlineGroup || !newName.trim()) return;
		isSaving = true;
		saveError = null;
		try {
			const created = await onCreateInlineGroup({
				name: newName.trim(),
				color: newColor
			});
			onSelectedIdsChange(multiple ? [...selectedIds, created.id] : [created.id]);
			showNewForm = false;
			newName = '';
		} catch (error) {
			saveError = error instanceof Error ? error.message : 'Create failed';
		} finally {
			isSaving = false;
		}
	}
</script>

<ResponsiveModal
	{open}
	{onOpenChange}
	title={step === 'pick' ? title : 'Review access'}
	contentClass="sm:max-w-lg"
	bodyClass="pb-2"
>
	{#if step === 'pick'}
		<div class="space-y-3">
			{#if showSearch}
				<div class="relative">
					<Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						class="pl-9"
						placeholder="Search groups"
						value={query}
						oninput={(event) => (query = event.currentTarget.value)}
					/>
				</div>
			{/if}

			<ul class="max-h-[min(50dvh,360px)] space-y-1 overflow-y-auto">
				{#each filteredItems as group (group.id)}
					<li>
						<label
							class={cn(
								'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-transparent px-2 py-2 hover:bg-muted/50',
								selectedIds.includes(group.id) && 'border-primary/30 bg-primary/5'
							)}
						>
							<Checkbox
								checked={selectedIds.includes(group.id)}
								onCheckedChange={() => toggleGroup(group.id)}
							/>
							<GroupBadge name={group.name} color={group.color} size="md" class="min-w-0 flex-1" />
							{#if group.loanCount != null}
								<span class="text-xs tabular-nums text-muted-foreground">
									{formatCount(group.loanCount)}
								</span>
							{/if}
						</label>
					</li>
				{:else}
					<li class="px-2 py-6 text-center text-sm text-muted-foreground">
						{groups.length === 0 ? 'No groups yet.' : 'No groups match.'}
					</li>
				{/each}
			</ul>

			{#if onCreateInlineGroup}
				<div class="border-t border-border/60 pt-3">
					{#if !showNewForm}
						<Button
							type="button"
							variant="ghost"
							class="touch-target w-full justify-start gap-2"
							onclick={() => (showNewForm = true)}
						>
							<Plus class="size-4" aria-hidden="true" />
							New group
						</Button>
					{:else}
						<div class="space-y-3 rounded-lg border border-border/60 p-3">
							<div class="space-y-2">
								<Label for="inline-group-name">Name</Label>
								<Input
									id="inline-group-name"
									bind:value={newName}
									disabled={isSaving}
								/>
							</div>
							<GroupColorSwatches
								value={newColor}
								disabled={isSaving}
								onValueChange={(value) => (newColor = value)}
							/>
							<div class="flex gap-2">
								<Button
									type="button"
									variant="outline"
									class="flex-1"
									onclick={() => (showNewForm = false)}
								>
									Cancel
								</Button>
								<Button
									type="button"
									class="flex-1"
									disabled={!newName.trim() || isSaving}
									onclick={handleCreateInline}
								>
									Add
								</Button>
							</div>
						</div>
					{/if}
				</div>
			{/if}

			{#if saveError}
				<p class="text-sm text-destructive">{saveError}</p>
			{/if}
		</div>
	{:else}
		<AccessPreview {preview} loading={previewLoading} error={previewError} />
		{#if saveError}
			<p class="mt-3 text-sm text-destructive">{saveError}</p>
		{/if}
	{/if}

	{#snippet footer()}
		<Button
			type="button"
			variant="outline"
			class="touch-target h-12 w-full"
			disabled={isSaving || previewLoading}
			onclick={() => {
				if (step === 'preview') {
					step = 'pick';
					return;
				}
				onOpenChange(false);
			}}
		>
			{step === 'preview' ? 'Back' : 'Cancel'}
		</Button>
		<Button
			type="button"
			class="touch-target h-12 w-full"
			disabled={isSaving || previewLoading || (step === 'pick' && selectedIds.length === 0)}
			onclick={() => {
				if (step === 'pick') {
					void handleContinue();
				} else {
					void confirmSave();
				}
			}}
		>
			{step === 'pick' ? 'Continue' : isSaving ? 'Saving…' : 'Save'}
		</Button>
	{/snippet}
</ResponsiveModal>
