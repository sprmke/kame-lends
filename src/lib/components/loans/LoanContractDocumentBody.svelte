<script lang="ts">
	import { APP_NAME } from '$lib/brand';
	import {
		formatContractCurrency,
		formatContractDate,
		getContractDetailRows,
		type LoanContractData
	} from '$lib/loan-contract-data';
	import type { ContractCustomization } from '$lib/loan-contract-customization';
	import { applyContractCustomization } from '$lib/loan-contract-customization';
	import {
		getContractIntroText,
		getContractSignaturePartiesForDisplay,
		getContractTermClauses,
		getWitnessAttestationText,
		shouldShowValidId,
		type SignaturePartyDetails
	} from '$lib/loan-contract-content';
	import type { SigningPartyRole } from '$lib/loan-signing';
	import { signingPartyRoleMatchesBlock } from '$lib/loan-signing';
	import { cn } from '$lib/utils';

	interface SigningContext {
		activePartyRole: SigningPartyRole;
		activePartyEmail?: string | null;
		showStatusBadges?: boolean;
	}

	interface Props {
		data: LoanContractData;
		customization?: ContractCustomization;
		signingContext?: SigningContext;
		variant?: 'default' | 'compact';
	}

	let { data, customization, signingContext, variant = 'default' }: Props = $props();

	const compact = $derived(variant === 'compact');
	const displayData = $derived(
		customization ? applyContractCustomization(data, customization) : data
	);
	const lenderNames = $derived(
		displayData.lenders.length > 0
			? displayData.lenders.map((lender) => lender.name).join(', ')
			: '_________________________'
	);
	const termClauses = $derived(getContractTermClauses(displayData, customization));
	const detailRows = $derived(getContractDetailRows(displayData));
	const signatureParties = $derived(
		getContractSignaturePartiesForDisplay(
			displayData,
			customization,
			signingContext
				? {
						shouldRevealSignature: (party) =>
							signingPartyRoleMatchesBlock(
								signingContext.activePartyRole,
								party.role,
								signingContext.activePartyEmail,
								party.email
							)
					}
				: undefined
		)
	);

	function partyIsActive(party: SignaturePartyDetails): boolean {
		if (!signingContext) return false;
		return signingPartyRoleMatchesBlock(
			signingContext.activePartyRole,
			party.role,
			signingContext.activePartyEmail,
			party.email
		);
	}
</script>

<div
	class={cn(
		'mx-auto w-full max-w-3xl bg-background text-foreground',
		compact
			? 'space-y-3 p-3 text-sm leading-relaxed sm:space-y-4 sm:p-4 md:p-5'
			: 'space-y-4 p-4 text-sm leading-relaxed sm:p-5'
	)}
>
	<div class="border-b-2 border-primary pb-2 sm:pb-3">
		<p
			class={cn(
				'font-bold tracking-widest text-primary uppercase',
				compact ? 'text-xs sm:text-sm' : 'text-xs'
			)}
		>
			{APP_NAME}
		</p>
		<h3 class={cn('mt-1 font-bold', compact ? 'text-2xl sm:text-3xl' : 'text-xl')}>
			{displayData.contractTitle}
		</h3>
		<p class={cn('text-muted-foreground', compact ? 'text-sm sm:text-base' : 'text-xs')}>
			Contract No. {displayData.contractNumber}
		</p>
	</div>

	<p class={cn('text-justify text-muted-foreground', compact && 'text-sm sm:text-base')}>
		{getContractIntroText(displayData, customization)}
	</p>

	<div class="space-y-1.5 sm:space-y-2">
		<p
			class={cn(
				'font-bold tracking-wide text-foreground uppercase',
				compact ? 'text-xs sm:text-sm' : 'text-xs'
			)}
		>
			Parties
		</p>
		<p class={cn('text-muted-foreground', compact && 'text-sm sm:text-base')}>
			<span class="font-semibold text-foreground">BORROWER: </span>
			{displayData.borrowerName}
		</p>
		<p class={cn('text-muted-foreground', compact && 'text-sm sm:text-base')}>
			<span class="font-semibold text-foreground">LENDER(S): </span>
			{lenderNames}
		</p>
	</div>

	<div class="space-y-2 sm:space-y-3">
		<p
			class={cn(
				'font-bold tracking-wide text-foreground uppercase',
				compact ? 'text-xs sm:text-sm' : 'text-xs'
			)}
		>
			Loan Terms
		</p>
		<div class="overflow-hidden rounded-md border border-border">
			{#each detailRows as row, index}
				<div
					class={cn(
						compact
							? 'border-b border-border last:border-b-0'
							: `grid grid-cols-[38%_1fr] ${index !== detailRows.length - 1 ? 'border-b border-border' : ''}`
					)}
				>
					<div
						class={cn(
							compact ? 'px-3 py-2 text-sm sm:px-4 sm:py-2.5 sm:text-sm' : 'px-3 py-2 text-xs',
							'bg-muted/60 font-medium text-muted-foreground'
						)}
					>
						{row.label}
					</div>
					<div
						class={cn(
							compact ? 'px-3 py-2 text-sm sm:px-4 sm:py-2.5 sm:text-sm' : 'px-3 py-2 text-xs',
							'text-foreground'
						)}
					>
						{row.value}
					</div>
				</div>
			{/each}
		</div>
	</div>

	{#if displayData.lenders.length > 0}
		<div class="space-y-2 sm:space-y-3">
			<p
				class={cn(
					'font-bold tracking-wide text-foreground uppercase',
					compact ? 'text-xs sm:text-sm' : 'text-xs'
				)}
			>
				Lender Allocation
			</p>
			<div class="space-y-2">
				{#each displayData.lenders as lender (lender.email)}
					<div
						class={cn(
							'rounded-md border border-border bg-muted/40',
							compact ? 'p-3 sm:p-4' : 'p-3'
						)}
					>
						<p class={cn('font-semibold', compact ? 'text-base sm:text-lg' : 'text-sm')}>
							{lender.name}
						</p>
						{#if lender.contactNumber}
							<p
								class={compact ? 'text-sm text-muted-foreground' : 'text-xs text-muted-foreground'}
							>
								Contact: {lender.contactNumber}
							</p>
						{/if}
						<p class={compact ? 'text-sm text-muted-foreground' : 'text-xs text-muted-foreground'}>
							Email: {lender.email}
						</p>
						<p class={compact ? 'text-sm text-muted-foreground' : 'text-xs text-muted-foreground'}>
							Principal: {formatContractCurrency(lender.principalAmount)}
						</p>
						<p class={compact ? 'text-sm text-muted-foreground' : 'text-xs text-muted-foreground'}>
							Interest: {lender.interestDescription}
						</p>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<div class="space-y-1.5 sm:space-y-2">
		<p
			class={cn(
				'font-bold tracking-wide text-foreground uppercase',
				compact ? 'text-xs sm:text-sm' : 'text-xs'
			)}
		>
			Terms and Conditions
		</p>
		<ol
			class={cn(
				'list-decimal space-y-2 pl-4 text-muted-foreground sm:space-y-3 sm:pl-5',
				compact && 'text-sm sm:text-base'
			)}
		>
			{#each termClauses as clause, index}
				<li class="text-justify">{clause.text}</li>
			{/each}
		</ol>
	</div>

	<div class="space-y-3 border-t border-border pt-3 sm:space-y-4 sm:pt-5">
		<p class={cn('text-muted-foreground italic', compact ? 'text-sm sm:text-base' : 'text-xs')}>
			{getWitnessAttestationText(customization)}
		</p>
		<div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
			{#each signatureParties as party (party.role + party.printedName)}
				{@const isSigned = Boolean(party.eSignatureUrl)}
				{@const knownAddress = party.address?.trim()}
				<div
					class={cn(
						'w-full min-w-0 flex-1 space-y-1.5 rounded-md p-3 transition-colors sm:min-w-50 md:min-w-60',
						partyIsActive(party)
							? 'bg-primary/5 ring-2 ring-primary/60'
							: isSigned
								? 'bg-green-50/60'
								: ''
					)}
				>
					{#if signingContext?.showStatusBadges}
						<div class="mb-1 flex items-center justify-between gap-2">
							<p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
								{party.role}
							</p>
							<span
								class={cn(
									'rounded-full px-2 py-0.5 text-xs font-medium',
									isSigned ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'
								)}
							>
								{isSigned ? 'Signed' : 'Pending'}
							</span>
						</div>
					{/if}
					<div
						class="mb-2 flex h-12 items-end overflow-hidden rounded border border-border bg-white px-2 py-1 sm:h-16"
					>
						{#if party.eSignatureUrl}
							<img
								src={party.eSignatureUrl}
								alt="{party.role} e-signature"
								class="max-h-full w-full object-contain object-left"
							/>
						{:else}
							<div class="w-full border-b border-foreground"></div>
						{/if}
					</div>
					{#if !signingContext?.showStatusBadges}
						<p
							class={cn(
								compact ? 'text-sm text-muted-foreground' : 'text-xs text-muted-foreground',
								'font-semibold text-foreground'
							)}
						>
							{party.role} Signature
						</p>
					{/if}
					<p class={compact ? 'text-sm text-muted-foreground' : 'text-xs text-muted-foreground'}>
						Printed Name: {party.printedName}
					</p>
					<p class={compact ? 'text-sm text-muted-foreground' : 'text-xs text-muted-foreground'}>
						Address: {knownAddress || '_________________________'}
					</p>
					{#if shouldShowValidId(party)}
						<div class="space-y-1 pt-1">
							<p
								class={compact ? 'text-sm text-muted-foreground' : 'text-xs text-muted-foreground'}
							>
								Valid ID:
							</p>
							{#if party.validIdUrl}
								<div class="overflow-hidden rounded border border-border bg-muted/20">
									<img
										src={party.validIdUrl}
										alt="{party.role} valid ID"
										class="max-h-28 w-full object-contain sm:max-h-36"
									/>
								</div>
							{:else}
								<p
									class={cn(
										compact ? 'text-sm text-muted-foreground' : 'text-xs text-muted-foreground',
										'italic'
									)}
								>
									No valid ID uploaded
								</p>
							{/if}
						</div>
					{/if}
					<p class={compact ? 'text-sm text-muted-foreground' : 'text-xs text-muted-foreground'}>
						Date Signed: {party.dateSigned || '_________________'}
					</p>
				</div>
			{/each}
		</div>
	</div>

	<p class={cn('text-muted-foreground', compact ? 'text-xs sm:text-sm' : 'text-[10px]')}>
		Generated by {APP_NAME} · {formatContractDate(new Date())}
	</p>
</div>
