<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import GroupPickerSheet from '$lib/components/groups/GroupPickerSheet.svelte';
	import AccessPreview from '$lib/components/groups/AccessPreview.svelte';
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import type { AccessPreviewData, GroupPickerItem } from '$lib/components/groups/types';
	import { formatCount } from '$lib/format';
	import { toast } from '$lib/toast';
	import { X } from 'lucide-svelte';

	interface Props {
		selectedCount: number;
		selectedLoanIds: number[];
		groups: GroupPickerItem[];
		currentGroupId?: number | null;
		showAddToGroup?: boolean;
		onClear: () => void;
		onAdded?: () => void | Promise<void>;
	}

	let {
		selectedCount,
		selectedLoanIds,
		groups,
		currentGroupId = null,
		showAddToGroup = true,
		onClear,
		onAdded
	}: Props = $props();

	let pickerOpen = $state(false);
	let selectedIds = $state<number[]>([]);
	let busy = $state(false);
	let removeOpen = $state(false);
	let removePreview = $state<AccessPreviewData | null>(null);
	let removePreviewLoading = $state(false);
	let removePreviewError = $state<string | null>(null);

	async function applySelection(ids: number[]) {
		const groupId = ids[0];
		if (!groupId || selectedLoanIds.length === 0) return;
		busy = true;
		try {
			const res = await fetch(`/api/groups/${groupId}/loans`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ loanIds: selectedLoanIds })
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error((body as { error?: string }).error ?? 'Failed to add to group');
			}
			toast.success('Added to group');
			await onAdded?.();
			onClear();
			pickerOpen = false;
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to add to group');
		} finally {
			busy = false;
		}
	}

	async function openRemovePreview() {
		if (!currentGroupId || selectedLoanIds.length === 0) return;
		removeOpen = true;
		removePreview = null;
		removePreviewError = null;
		removePreviewLoading = true;
		try {
			const res = await fetch(`/api/groups/${currentGroupId}/access-preview`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ removeLoanIds: selectedLoanIds })
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error((body as { error?: string }).error ?? 'Preview failed');
			}
			removePreview = (await res.json()) as AccessPreviewData;
		} catch (err) {
			removePreviewError = err instanceof Error ? err.message : 'Preview failed';
		} finally {
			removePreviewLoading = false;
		}
	}

	async function confirmRemove() {
		if (!currentGroupId || selectedLoanIds.length === 0) return;
		busy = true;
		try {
			const res = await fetch(`/api/groups/${currentGroupId}/loans`, {
				method: 'DELETE',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ loanIds: selectedLoanIds })
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error((body as { error?: string }).error ?? 'Failed to remove');
			}
			toast.success('Removed from group');
			removeOpen = false;
			await onAdded?.();
			onClear();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to remove');
		} finally {
			busy = false;
		}
	}
</script>

{#if selectedCount > 0}
	<div
		class="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 flex flex-wrap items-center gap-2 border-t px-3 py-2 backdrop-blur lg:bottom-0"
	>
		<span class="text-sm font-medium">{formatCount(selectedCount)} selected</span>
		{#if showAddToGroup}
			<Button
				size="sm"
				class="touch-target"
				disabled={busy}
				onclick={() => {
					selectedIds = [];
					pickerOpen = true;
				}}
			>
				Add to group
			</Button>
		{/if}
		{#if currentGroupId}
			<Button
				size="sm"
				variant="outline"
				class="touch-target"
				disabled={busy}
				onclick={() => void openRemovePreview()}
			>
				Remove from group
			</Button>
		{/if}
		<Button size="sm" variant="ghost" class="touch-target" aria-label="Clear selection" onclick={onClear}>
			<X class="h-4 w-4" />
		</Button>
	</div>
{/if}

<GroupPickerSheet
	open={pickerOpen}
	onOpenChange={(open) => (pickerOpen = open)}
	{groups}
	{selectedIds}
	onSelectedIdsChange={(ids) => (selectedIds = ids)}
	multiple={false}
	previewAddLoanIds={selectedLoanIds}
	previewGroupId={selectedIds[0]}
	usedColorKeys={groups.map((group) => group.color)}
	onSave={applySelection}
	onCreateInlineGroup={async (payload) => {
		const res = await fetch('/api/groups', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				name: payload.name,
				color: payload.color,
				loanIds: [],
				createCalendar: true
			})
		});
		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			throw new Error((body as { error?: string }).error ?? 'Failed to create group');
		}
		const created = (await res.json()) as { id: number; name: string; color: string };
		await invalidateAll();
		return { id: created.id, name: created.name, color: created.color };
	}}
/>

<ResponsiveModal
	open={removeOpen}
	onOpenChange={(open) => {
		removeOpen = open;
		if (!open) {
			removePreview = null;
			removePreviewError = null;
		}
	}}
	title="Remove from group?"
	contentClass="sm:max-w-lg"
>
	<div class="space-y-3">
		<p class="text-sm text-muted-foreground">
			{formatCount(selectedCount)} {selectedCount === 1 ? 'loan' : 'loans'} will leave this group.
		</p>
		<AccessPreview
			preview={removePreview}
			loading={removePreviewLoading}
			error={removePreviewError}
		/>
	</div>
	{#snippet footer()}
		<Button
			type="button"
			variant="outline"
			class="touch-target h-12 w-full"
			disabled={busy}
			onclick={() => (removeOpen = false)}
		>
			Cancel
		</Button>
		<Button
			type="button"
			variant="destructive"
			class="touch-target h-12 w-full"
			disabled={busy || removePreviewLoading}
			onclick={() => void confirmRemove()}
		>
			{busy ? 'Removing…' : 'Remove'}
		</Button>
	{/snippet}
</ResponsiveModal>
