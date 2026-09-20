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
	import { createIsMobileShell } from '$lib/composables/use-media-query.svelte';
	import { mobileDockSlot } from '$lib/stores/mobile-dock-slot.svelte';
	import { cn } from '$lib/utils';

	interface Props {
		selectedCount: number;
		selectedLoanIds: number[];
		groups: GroupPickerItem[];
		currentGroupId?: number | null;
		showAddToGroup?: boolean;
		onSummary?: () => void;
		onClear: () => void;
		onAdded?: () => void | Promise<void>;
	}

	let {
		selectedCount,
		selectedLoanIds,
		groups,
		currentGroupId = null,
		showAddToGroup = true,
		onSummary,
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

	const mobileShell = createIsMobileShell(false);
	$effect(() => mobileShell.init());

	$effect(() => {
		const shouldClaim = selectedCount > 0 && mobileShell.matches;
		if (!shouldClaim) return;
		mobileDockSlot.claim();
		return () => mobileDockSlot.release();
	});

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
		class={cn(
			'max-lg:pointer-events-none max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:px-4 max-lg:pb-[max(0.75rem,var(--safe-area-bottom))]',
			'lg:sticky lg:bottom-0 lg:z-30 lg:border-t lg:border-border/60 lg:bg-background lg:px-3 lg:py-2'
		)}
		style="padding-left: max(1rem, var(--safe-area-left)); padding-right: max(1rem, var(--safe-area-right));"
		role="toolbar"
		aria-label="Selection actions"
	>
		<div
			class={cn(
				'flex min-w-0 flex-nowrap items-center gap-2',
				'max-lg:pointer-events-auto max-lg:mx-auto max-lg:w-full max-lg:max-w-lg max-lg:rounded-[1.75rem] max-lg:border max-lg:border-border/40 max-lg:bg-background max-lg:px-3 max-lg:py-2 max-lg:ring-1 max-lg:ring-black/[0.04] max-lg:dark:ring-white/[0.08]'
			)}
		>
			<span class="shrink-0 text-sm font-medium whitespace-nowrap tabular-nums">
				{formatCount(selectedCount)} selected
			</span>
			<div class="ml-auto flex min-w-0 shrink-0 items-center gap-1.5">
				{#if onSummary}
					<Button size="sm" variant="outline" class="touch-target h-11 px-3" onclick={onSummary}>
						Summary
					</Button>
				{/if}
				{#if showAddToGroup}
					<Button
						size="sm"
						class="touch-target h-11 px-3"
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
						class="touch-target h-11 px-3"
						disabled={busy}
						aria-label="Remove from group"
						onclick={() => void openRemovePreview()}
					>
						Remove
					</Button>
				{/if}
				<Button
					size="sm"
					variant="ghost"
					class="touch-target h-11 w-11 shrink-0 px-0"
					aria-label="Clear selection"
					onclick={onClear}
				>
					<X class="h-4 w-4" />
				</Button>
			</div>
		</div>
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
