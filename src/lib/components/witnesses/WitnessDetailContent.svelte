<script lang="ts">
	import ContactInfoCard from '$lib/components/common/ContactInfoCard.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { formatDateVeryShort, formatText } from '$lib/format';
	import { getLoanStatusBadge, getLoanTypeBadge } from '$lib/badge-config';
	import { uniqueWitnessedLoans } from '$lib/witness-loans';
	import { cn } from '$lib/utils';
	import type { WitnessWithLoans } from '$lib/types';

	interface Props {
		witness: WitnessWithLoans;
		showHeader?: boolean;
	}

	let { witness, showHeader = true }: Props = $props();

	const witnessedLoans = $derived(uniqueWitnessedLoans(witness.signingInvitations));

	function formatPartyRole(role: string) {
		return role.replace(/_/g, ' ');
	}
</script>

<div class="dashboard-stack">
	{#if showHeader}
		<div class="space-y-1">
			<h2 class="text-base font-medium tracking-tight">{formatText(witness.name)}</h2>
		</div>
	{/if}

	<ContactInfoCard
		name={witness.name}
		email={witness.email}
		contactNumber={witness.contactNumber}
		address={witness.address}
	/>

	<div class="space-y-3">
		<h3 class="text-sm font-semibold">Witnessed Loans ({witnessedLoans.length})</h3>
		{#if witnessedLoans.length === 0}
			<Card.Root>
				<Card.Content class="py-8 text-center text-muted-foreground">No witnessed loans yet</Card.Content>
			</Card.Root>
		{:else}
			{#each witnessedLoans as invitation (invitation.id)}
				{@const loan = invitation.loan}
				<Card.Root>
					<Card.Content
						class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
					>
						<div class="min-w-0 space-y-1">
							<p class="truncate font-medium">{formatText(loan.loanName)}</p>
							<p class="text-sm text-muted-foreground">
								Due {formatDateVeryShort(loan.dueDate)}
							</p>
							<p class="text-xs text-muted-foreground">
								{formatPartyRole(invitation.partyRole)}
								{#if invitation.signedAt}
									· Signed {formatDateVeryShort(invitation.signedAt)}
								{/if}
							</p>
						</div>
						<div class="flex flex-wrap items-center gap-2">
							<Badge variant="secondary" class="text-[10px]">
								{formatPartyRole(invitation.partyRole)}
							</Badge>
							<Badge
								variant={getLoanTypeBadge(loan.type).variant}
								class={cn('text-[10px]', getLoanTypeBadge(loan.type).className)}
							>
								{loan.type}
							</Badge>
							<Badge
								variant={getLoanStatusBadge(loan.status).variant}
								class={cn('text-[10px]', getLoanStatusBadge(loan.status).className)}
							>
								{loan.status}
							</Badge>
							<Button href="/loans/{loan.id}" variant="outline" size="sm">Open</Button>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		{/if}
	</div>
</div>
