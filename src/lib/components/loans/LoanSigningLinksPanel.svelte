<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Copy, Check, CheckCircle2, Clock, Link2 } from 'lucide-svelte';
	import { getSigningPartyRoleLabel } from '$lib/loan-signing-consent';
	import type { SigningInvitationSummary } from '$lib/loan-signing';
	import { formatDate } from '$lib/format';
	import { toast } from '$lib/toast';

	interface Props {
		invitations: SigningInvitationSummary[];
		loanId: number;
	}

	let { invitations, loanId }: Props = $props();

	let copiedId = $state<number | null>(null);

	async function copyLink(invitation: SigningInvitationSummary) {
		const path = invitation.signingUrl || `/loans/${loanId}/sign`;
		const url = path.startsWith('http') ? path : `${window.location.origin}${path}`;

		try {
			await navigator.clipboard.writeText(url);
			copiedId = invitation.id;
			toast.success(`Signing link copied for ${invitation.partyName}.`);
			setTimeout(() => {
				copiedId = null;
			}, 2000);
		} catch {
			toast.error('Could not copy link. Please try again.');
		}
	}

	const signedCount = $derived(invitations.filter((item) => item.signedAt).length);
</script>

{#if invitations.length > 0}
	<Card.Root>
		<Card.Header class="pb-3">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<Card.Title class="flex items-center gap-2 text-base">
					<Link2 class="h-4 w-4 text-primary" />
					Contract signing
				</Card.Title>
				<Badge variant="secondary">{signedCount} of {invitations.length} signed</Badge>
			</div>
		</Card.Header>
		<Card.Content class="pt-0">
			<ul class="divide-y divide-border rounded-lg border border-border">
				{#each invitations as invitation (invitation.id)}
					{@const isSigned = Boolean(invitation.signedAt)}
					{@const isCopied = copiedId === invitation.id}
					{@const roleLabel = getSigningPartyRoleLabel(invitation.partyRole)}
					{@const showRoleSubtitle = roleLabel !== invitation.partyName}
					<li
						class="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4"
					>
						<div class="min-w-0 flex-1">
							<p class="truncate font-medium">{invitation.partyName}</p>
							{#if showRoleSubtitle}
								<p class="truncate text-xs text-muted-foreground">
									{roleLabel}{invitation.partyEmail ? ` · ${invitation.partyEmail}` : ''}
								</p>
							{:else if invitation.partyEmail}
								<p class="truncate text-xs text-muted-foreground">{invitation.partyEmail}</p>
							{/if}
						</div>

						<div class="flex shrink-0 items-center gap-2 self-end sm:self-auto">
							{#if isSigned}
								<Badge class="bg-green-100 text-green-800 hover:bg-green-100">
									<CheckCircle2 class="mr-1 h-3 w-3" />
									Signed {formatDate(invitation.signedAt!)}
								</Badge>
							{:else}
								<Badge variant="outline" class="hidden sm:inline-flex">
									<Clock class="mr-1 h-3 w-3" />
									Pending
								</Badge>
								<Button
									type="button"
									variant={isCopied ? 'secondary' : 'outline'}
									size="sm"
									onclick={() => copyLink(invitation)}
								>
									{#if isCopied}
										<Check class="mr-1.5 h-3.5 w-3.5" />
										Copied
									{:else}
										<Copy class="mr-1.5 h-3.5 w-3.5" />
										Copy link
									{/if}
								</Button>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		</Card.Content>
	</Card.Root>
{/if}
