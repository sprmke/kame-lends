<script lang="ts">
	import { onMount } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import * as Dialog from '$lib/components/ui/dialog';
	import SignaturePad from './SignaturePad.svelte';
	import LoanContractPreview from './LoanContractPreview.svelte';
	import { toast } from '$lib/toast';
	import { cn } from '$lib/utils';
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
	import { CheckCircle2, FileText, Loader2, PenLine, ShieldCheck } from 'lucide-svelte';

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
</script>

{#if data.expired}
	<Card.Root class="mx-auto max-w-2xl rounded-3xl border-amber-300 bg-amber-50/60 shadow-sm">
		<Card.Header class="pb-2">
			<Card.Title class="text-xl text-amber-900">Signing Link Expired</Card.Title>
		</Card.Header>
		<Card.Content class="text-base leading-relaxed text-amber-800">
			This signing link is no longer valid. Please contact the loan administrator to request a new
			link.
		</Card.Content>
	</Card.Root>
{:else if data.signedAt}
	<div class="mx-auto w-full max-w-5xl space-y-5 sm:space-y-6 md:space-y-8">
		<Card.Root class="rounded-2xl border-green-200 bg-green-50/50 sm:rounded-3xl">
			<Card.Content class="flex items-start gap-3 p-5 sm:gap-4 sm:p-6 md:p-7">
				<CheckCircle2 class="mt-0.5 h-5 w-5 shrink-0 text-green-600 sm:h-6 sm:w-6" />
				<div class="space-y-1">
					<p class="text-lg font-semibold text-green-900 sm:text-xl">Signature Recorded</p>
					<p class="text-sm leading-relaxed text-green-800 sm:text-base">
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
	<div class="mx-auto w-full max-w-7xl space-y-5 pb-28 sm:space-y-6 sm:pb-32 md:space-y-8 md:pb-12">
		<Card.Root
			class="overflow-hidden rounded-3xl border-primary/20 bg-gradient-to-br from-primary/8 via-background to-background shadow-sm"
		>
			<Card.Content class="space-y-4 p-5 sm:p-7 md:p-8">
				<div class="flex flex-wrap items-center gap-2 sm:gap-3">
					<h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">Sign Loan Agreement</h1>
					<Badge variant="secondary" class="px-2.5 py-1 text-xs">{roleLabel}</Badge>
				</div>
				<p class="max-w-4xl text-sm leading-relaxed text-muted-foreground sm:text-base">
					You are signing as <strong>{displayName}</strong>. Review the contract, complete your
					signature, accept electronic consent, and submit.
				</p>
			</Card.Content>
		</Card.Root>

		<div class="grid gap-5 xl:grid-cols-[1fr_360px] xl:items-start">
			<div class="order-1 space-y-5 xl:sticky xl:top-6 xl:order-2">
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
									class="mt-1"
								/>
								<Label
									for="signing-consent"
									class="cursor-pointer text-sm leading-relaxed font-normal text-muted-foreground sm:text-base"
								>
									{consent.consentDescription}
									<button
										type="button"
										class="font-medium text-primary underline-offset-4 hover:underline"
										onclick={() => (consentDetailsOpen = true)}
									>
										{consent.detailsLinkLabel}
									</button>
								</Label>
							</div>
						</div>

						<Dialog.Root bind:open={consentDetailsOpen}>
							<Dialog.Content
								class="max-h-[85vh] w-[calc(100vw-1.5rem)] max-w-xl overflow-y-auto p-5 sm:p-6"
							>
								<Dialog.Header>
									<Dialog.Title class="text-xl">{consent.heading}</Dialog.Title>
								</Dialog.Header>
								<div class="space-y-4 pt-2">
									{#each consent.body as paragraph}
										<p class="text-sm leading-relaxed text-muted-foreground sm:text-base">
											{paragraph}
										</p>
									{/each}
								</div>
							</Dialog.Content>
						</Dialog.Root>

						<Button
							type="button"
							size="lg"
							class="hidden h-12 w-full text-base xl:flex"
							onclick={handleSubmit}
							disabled={!canSubmit}
						>
							{#if isSubmitting}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
								Submitting Signature...
							{:else}
								{consent.submitLabel}
							{/if}
						</Button>
					</Card.Content>
				</Card.Root>
			</div>

			<Card.Root class="order-2 overflow-hidden rounded-3xl shadow-sm xl:order-1">
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

		<div
			class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 pb-safe backdrop-blur xl:hidden"
		>
			<div class="mx-auto flex w-full max-w-7xl items-center gap-3">
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-medium text-foreground">
						{hasSignature && consentChecked
							? 'Ready to submit signature'
							: 'Complete steps to submit'}
					</p>
				</div>
				<Button
					type="button"
					size="lg"
					class="h-11 shrink-0 px-5 text-sm"
					onclick={handleSubmit}
					disabled={!canSubmit}
				>
					{#if isSubmitting}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						Submitting...
					{:else}
						Submit Signature
					{/if}
				</Button>
			</div>
		</div>
	</div>
{/if}
