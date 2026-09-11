<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import ConfirmDeleteDialog from '$lib/components/common/ConfirmDeleteDialog.svelte';
	import ListEmptyState from '$lib/components/common/ListEmptyState.svelte';
	import GroupFormModal from '$lib/components/groups/GroupFormModal.svelte';
	import GroupLoanPicker from '$lib/components/groups/GroupLoanPicker.svelte';
	import GroupMembersList from '$lib/components/groups/GroupMembersList.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { formatDate } from '$lib/format';
	import { toast } from '$lib/toast';
	import { FileText, LogOut, Pencil, Trash2, X } from 'lucide-svelte';

	let { data } = $props();

	let showEditModal = $state(false);
	let showDeleteDialog = $state(false);
	let showLeaveDialog = $state(false);
	let loanPendingRemoval = $state<number | null>(null);

	async function refresh() {
		await invalidate('app:groups');
	}

	async function handleDelete() {
		const response = await fetch(`/api/groups/${data.group.id}`, { method: 'DELETE' });
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			toast.error(errorData.error || 'Failed to delete group');
			throw new Error(errorData.error || 'Failed to delete group');
		}
		toast.success('Group deleted');
		await goto('/groups');
	}

	async function handleLeave() {
		const response = await fetch(`/api/groups/${data.group.id}/leave`, { method: 'POST' });
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			toast.error(errorData.error || 'Failed to leave group');
			throw new Error(errorData.error || 'Failed to leave group');
		}
		toast.success('You left the group');
		await goto('/groups');
	}

	async function handleRemoveMember(userId: string) {
		const response = await fetch(`/api/groups/${data.group.id}/members/${userId}`, {
			method: 'DELETE'
		});
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			toast.error(errorData.error || 'Failed to remove member');
			return;
		}
		toast.success('Member removed');
		await refresh();
	}

	async function handleRemoveLoan() {
		if (loanPendingRemoval === null) return;
		const response = await fetch(`/api/groups/${data.group.id}/loans/${loanPendingRemoval}`, {
			method: 'DELETE'
		});
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			toast.error(errorData.error || 'Failed to remove loan');
			throw new Error(errorData.error || 'Failed to remove loan');
		}
		toast.success('Loan removed from group');
		loanPendingRemoval = null;
		await refresh();
	}
</script>

<svelte:head><title>{data.group.name}</title></svelte:head>

<DashboardPage>
	<PageHeader title={data.group.name} description={data.group.notes ?? undefined}>
		{#if data.canEdit}
			<Button size="sm" variant="outline" onclick={() => (showEditModal = true)}>
				<Pencil class="h-4 w-4 lg:mr-2" />
				<span class="hidden lg:inline">Edit</span>
			</Button>
			<Button size="sm" variant="destructive" onclick={() => (showDeleteDialog = true)}>
				<Trash2 class="h-4 w-4 lg:mr-2" />
				<span class="hidden lg:inline">Delete</span>
			</Button>
		{:else if data.canLeave}
			<Button size="sm" variant="outline" onclick={() => (showLeaveDialog = true)}>
				<LogOut class="h-4 w-4 lg:mr-2" />
				<span class="hidden lg:inline">Leave group</span>
			</Button>
		{/if}
	</PageHeader>

	<Card.Root>
		<Card.Header>
			<Card.Title>Loans</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-4">
			{#if data.canEdit}
				<GroupLoanPicker
					groupId={data.group.id}
					excludeLoanIds={data.loans.map((loan) => loan.id)}
					onAdded={refresh}
				/>
			{/if}

			{#if data.loans.length === 0}
				<ListEmptyState message="No loans in this group yet." icon={FileText} />
			{:else}
				<div class="flex flex-col gap-2">
					{#each data.loans as loan (loan.id)}
						<div
							class="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
						>
							<button
								type="button"
								class="min-w-0 flex-1 text-left"
								onclick={() => goto(`/loans/${loan.id}`)}
							>
								<p class="truncate text-sm font-medium">{loan.loanName}</p>
								<p class="text-xs text-muted-foreground">
									{loan.type} · {loan.status} · Due {formatDate(loan.dueDate)}
								</p>
							</button>
							{#if data.canEdit}
								<Button
									size="icon"
									variant="ghost"
									aria-label="Remove loan from group"
									onclick={() => (loanPendingRemoval = loan.id)}
								>
									<X class="h-4 w-4" />
								</Button>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Members</Card.Title>
		</Card.Header>
		<Card.Content>
			<GroupMembersList
				members={data.members}
				creatorUserId={data.group.creatorUserId}
				canRemove={data.canEdit}
				onRemove={handleRemoveMember}
			/>
		</Card.Content>
	</Card.Root>
</DashboardPage>

<GroupFormModal
	open={showEditModal}
	existingGroup={data.group}
	onOpenChange={(open) => (showEditModal = open)}
	onSuccess={refresh}
/>

<ConfirmDeleteDialog
	open={showDeleteDialog}
	onOpenChange={(open) => (showDeleteDialog = open)}
	title="Delete group?"
	description={`This will permanently delete "${data.group.name}" and remove all members.`}
	onConfirm={handleDelete}
/>

<ConfirmDeleteDialog
	open={showLeaveDialog}
	onOpenChange={(open) => (showLeaveDialog = open)}
	title="Leave group?"
	description={`You will lose access to "${data.group.name}" unless re-added.`}
	onConfirm={handleLeave}
/>

<ConfirmDeleteDialog
	open={loanPendingRemoval !== null}
	onOpenChange={(open) => {
		if (!open) loanPendingRemoval = null;
	}}
	title="Remove loan from group?"
	description="Members added because of this loan will stay in the group."
	onConfirm={handleRemoveLoan}
/>
