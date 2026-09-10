<script lang="ts">
	import { onMount } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import PageBackHeader from '$lib/components/common/PageBackHeader.svelte';
	import { createCanNavigateBack } from '$lib/composables/use-browser-back.svelte';
	import SignaturePad from './SignaturePad.svelte';
	import LoanContractPreview from './LoanContractPreview.svelte';
	import { toast } from '$lib/toast';
	import {
		getElectronicSignatureConsentText,
		getSignedConfirmationMessage,
		getSigningPartyRoleLabel
	} from '$lib/loan-signing-consent';
	import type { SigningPartyRole } from '$lib/loan-signing';
	import { applyLiveSignaturePreview, resolveSigningPartyDisplayName } from '$lib/loan-signing';
	import { normalizeLoanContractData } from '$lib/loan-contract-data';
	import type { LoanContractData } from '$lib/loan-contract-data';
	import type { ContractCustomization } from '$lib/loan-contract-customization';
	import { CheckCircle2, Loader2 } from 'lucide-svelte';

	export interface ContractSigningPayload {
		partyRole: SigningPartyRole;
		partyName: string;
		partyEmail: string | null;
		signedAt: string | null;
		signatureDataUrl: string | null;
		contractData: LoanContractData;
		customization: ContractCustomization;
		expired: boolean;
	}

	interface Props {
		loanId: number;
		initialData: ContractSigningPayload;
		/** @deprecated Legacy token polling path */
		token?: string | null;
	}

	let { loanId, initialData, token = null }: Props = $props();

	const canNavigateBack = createCanNavigateBack(false);

	$effect(() => canNavigateBack.init());

	const signApiBase = $derived(token ? `/api/sign/${token}` : `/api/loans/${loanId}/sign`);

	let data = $state(normalizePayload(initialData));
	let signatureDataUrl = $state<string | null>(null);
	let isDrawingSignature = $state(false);
	let consentChecked = $state(false);
	let isSubmitting = $state(false);
	let consentDetailsOpen = $state(false);

	function normalizePayload(payload: ContractSigningPayload): ContractSigningPayload {
		return { ...payload, contractData: normalizeLoanContractData(payload.contractData) };
	}

	const displayName = $derived(
		resolveSigningPartyDisplayName(data.partyRole, data.partyName, data.customization)
	);
	const consent = $derived(getElectronicSignatureConsentText(data.partyRole, displayName));
	const roleLabel = $derived(getSigningPartyRoleLabel(data.partyRole));
	const hasSignature = $derived(Boolean(signatureDataUrl));
	const canSubmit = $derived(hasSignature && consentChecked && !isSubmitting);

	const previewContract = $derived(
		applyLiveSignaturePreview(
			data.contractData,
			data.customization,
			data.partyRole,
			signatureDataUrl,
			data.partyEmail
		)
	);

	onMount(() => {
		if (data.signedAt || data.expired) return;
		const intervalId = window.setInterval(async () => {
			if (isDrawingSignature) return;
			try {
				const response = await fetch(`${signApiBase}`, { cache: 'no-store' });
				if (!response.ok) return;
				const fresh = (await response.json()) as ContractSigningPayload;
				data = normalizePayload({ ...fresh, signedAt: data.signedAt ?? fresh.signedAt });
			} catch {
				// ignore polling errors
			}
		}, 10000);
		return () => window.clearInterval(intervalId);
	});

	async function handleSubmit() {
		if (!signatureDataUrl) {
			toast.error('Please draw your signature before submitting.');
			return;
		}
		if (!consentChecked) {
			toast.error('Please confirm your consent before signing.');
			return;
		}

		isSubmitting = true;
		try {
			const response = await fetch(`${signApiBase}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'sign',
					signatureDataUrl,
					consentAccepted: true
				})
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error ?? 'Failed to submit signature');
			data = normalizePayload(result);
			toast.success('Your electronic signature has been recorded.');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to submit signature');
		} finally {
			isSubmitting = false;
		}
	}

	function handleBack() {
		window.history.back();
	}
</script>

{#if data.expired}
	<div class="mx-auto w-full max-w-2xl space-y-4">
		<PageBackHeader
			title="Signing Link Expired"
			showBack={canNavigateBack.matches}
			onBack={handleBack}
		/>
		<Card.Root class="rounded-3xl border-chart-5/30 bg-chart-5/10 shadow-sm">
			<Card.Content class="text-base leading-relaxed text-chart-5/90">
				This signing link is no longer valid. Please contact the loan administrator to request a new
				link.
			</Card.Content>
		</Card.Root>
	</div>
{:else if data.signedAt}
	<div class="mx-auto w-full max-w-5xl space-y-4 sm:space-y-5 md:space-y-6">
		<PageBackHeader
			title="Sign Loan Agreement"
			showBack={canNavigateBack.matches}
			onBack={handleBack}
		>
			{#snippet titleAddon()}
				<Badge variant="secondary" class="px-2 py-0.5 text-[11px]">{roleLabel}</Badge>
			{/snippet}
		</PageBackHeader>
		<Card.Root class="rounded-2xl border-chart-2/25 bg-chart-2/10 sm:rounded-3xl">
			<Card.Content class="flex items-start gap-3 p-5 sm:gap-4 sm:p-6 md:p-7">
				<CheckCircle2 class="mt-0.5 h-5 w-5 shrink-0 text-chart-2 sm:h-6 sm:w-6" />
				<div class="space-y-1">
					<p class="text-lg font-semibold text-chart-2 sm:text-xl">Signature Recorded</p>
					<p class="text-sm leading-relaxed text-chart-2/90 sm:text-base">
						{getSignedConfirmationMessage(data.partyRole, displayName)}
					</p>
				</div>
			</Card.Content>
		</Card.Root>
		<Card.Root class="overflow-hidden rounded-3xl shadow-sm">
			<Card.Header class="space-y-1 p-5 pb-3 sm:p-6 sm:pb-4 md:p-7 md:pb-5">
				<Card.Title class="text-base sm:text-lg">Signed Contract Preview</Card.Title>
			</Card.Header>
			<Card.Content class="p-0">
				<LoanContractPreview data={data.contractData} customization={data.customization} />
			</Card.Content>
		</Card.Root>
	</div>
{:else}
	<div class="mx-auto w-full max-w-7xl space-y-4 sm:space-y-5 md:space-y-6">
		<PageBackHeader
			title="Sign Loan Agreement"
			showBack={canNavigateBack.matches}
			onBack={handleBack}
		>
			{#snippet titleAddon()}
				<Badge variant="secondary" class="px-2 py-0.5 text-[11px]">{roleLabel}</Badge>
			{/snippet}
			{#snippet descriptionContent()}
				You are signing as <strong class="font-medium text-foreground">{displayName}</strong>. Review
				the contract, complete your signature, accept electronic consent, and submit.
			{/snippet}
		</PageBackHeader>

		<div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] xl:items-start">
			<div class="order-2 min-w-0 space-y-5 xl:sticky xl:top-6 xl:order-2 xl:self-start">
				<Card.Root class="rounded-3xl shadow-sm">
					<Card.Header class="space-y-1 p-5 pb-3 sm:p-6 sm:pb-4 md:p-7 md:pb-5">
						<Card.Title class="text-base sm:text-lg">
							{displayName} ({roleLabel}) - Signature
						</Card.Title>
					</Card.Header>
					<Card.Content class="p-5 pt-0 sm:p-6 sm:pt-0 md:p-7 md:pt-0">
						<SignaturePad
							onChange={(url) => (signatureDataUrl = url)}
							onDrawingChange={(drawing) => (isDrawingSignature = drawing)}
						/>
					</Card.Content>
				</Card.Root>

				<Card.Root class="rounded-3xl shadow-sm">
					<Card.Header class="space-y-1 p-5 pb-3 sm:p-6 sm:pb-4 md:p-7 md:pb-5">
						<Card.Title class="text-base sm:text-lg">{consent.heading}</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-4 p-5 pt-0 sm:space-y-5 sm:p-6 sm:pt-0 md:p-7 md:pt-0">
						<div class="rounded-xl border border-border bg-muted/30 p-4">
							<div class="flex items-start gap-3">
								<Checkbox
									id="signing-consent"
									checked={consentChecked}
									onCheckedChange={(checked) => (consentChecked = checked === true)}
									class="mt-1 shrink-0"
								/>
								<div class="min-w-0 flex-1 space-y-2">
									<Label
										for="signing-consent"
										class="cursor-pointer text-sm leading-relaxed font-normal text-muted-foreground"
									>
										{consent.consentDescription}
									</Label>
									<button
										type="button"
										class="text-sm font-normal text-primary underline-offset-4 hover:underline"
										onclick={() => (consentDetailsOpen = true)}
									>
										{consent.detailsLinkLabel}
									</button>
								</div>
							</div>
						</div>

						<ResponsiveModal
							open={consentDetailsOpen}
							onOpenChange={(open) => (consentDetailsOpen = open)}
							title={consent.heading}
							contentClass="sm:max-w-xl"
						>
							<div class="space-y-4">
								{#each consent.body as paragraph}
									<p class="text-sm leading-relaxed text-muted-foreground sm:text-base">
										{paragraph}
									</p>
								{/each}
							</div>
						</ResponsiveModal>

						<div class="space-y-3 border-t border-border/60 pt-4">
							{#if !canSubmit && !isSubmitting}
								<p class="text-sm text-muted-foreground">
									{!hasSignature && !consentChecked
										? 'Draw your signature and accept consent to submit.'
										: !hasSignature
											? 'Draw your signature above.'
											: 'Accept electronic consent to submit.'}
								</p>
							{/if}
							<Button
								type="button"
								size="lg"
								class="touch-target h-12 w-full text-base"
								onclick={handleSubmit}
								disabled={!canSubmit}
							>
								{#if isSubmitting}
									<Loader2 class="mr-2 h-4 w-4 animate-spin" />
									Submitting...
								{:else}
									{consent.submitLabel}
								{/if}
							</Button>
						</div>
					</Card.Content>
				</Card.Root>
			</div>

			<Card.Root class="order-1 min-w-0 overflow-hidden rounded-3xl shadow-sm xl:order-1">
				<Card.Header class="space-y-1 p-5 pb-3 sm:p-6 sm:pb-4 md:p-7 md:pb-5">
					<Card.Title class="text-base sm:text-lg">Contract Preview</Card.Title>
				</Card.Header>
				<Card.Content class="p-0">
					<LoanContractPreview
						data={previewContract.data}
						customization={previewContract.customization}
					/>
				</Card.Content>
			</Card.Root>
		</div>
	</div>
{/if}
