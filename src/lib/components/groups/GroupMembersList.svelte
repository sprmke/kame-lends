<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { X } from 'lucide-svelte';
	import type { LoanGroupMember } from '$lib/types';

	interface Props {
		members: LoanGroupMember[];
		creatorUserId: string;
		canRemove: boolean;
		onRemove: (userId: string) => void | Promise<void>;
	}

	let { members, creatorUserId, canRemove, onRemove }: Props = $props();

	const activeMembers = $derived(members.filter((member) => member.status === 'active'));
</script>

<div class="flex flex-col gap-2">
	{#each activeMembers as member (member.userId)}
		<div class="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
			<div class="min-w-0">
				<p class="truncate text-sm font-medium">{member.name || member.email || member.userId}</p>
				{#if member.name && member.email}
					<p class="truncate text-xs text-muted-foreground">{member.email}</p>
				{/if}
			</div>
			<div class="flex shrink-0 items-center gap-2">
				{#if member.userId === creatorUserId}
					<Badge variant="secondary">Owner</Badge>
				{:else if canRemove}
					<Button
						size="icon"
						variant="ghost"
						aria-label="Remove member"
						onclick={() => onRemove(member.userId)}
					>
						<X class="h-4 w-4" />
					</Button>
				{/if}
			</div>
		</div>
	{/each}
</div>
