<script lang="ts">
	import { onMount } from 'svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Popover from '$lib/components/ui/popover';
	import ValidIdUpload from '$lib/components/common/ValidIdUpload.svelte';
	import ESignatureUpload from '$lib/components/common/ESignatureUpload.svelte';
	import type { ContractCustomization } from '$lib/loan-contract-customization';
	import type { ContractLender } from '$lib/loan-contract-data';
	import { toast } from '$lib/toast';
	import type { Borrower, Investor, Witness } from '$lib/types';
	import { Check, ChevronDown, PenLine, Save, Search, UserRound, UsersRound } from 'lucide-svelte';

	interface ExistingContact {
		id: number;
		key: string;
		kind: 'Borrower' | 'Investor' | 'Witness';
		name: string;
		email: string | null;
		contactNumber: string | null;
		address: string | null;
		validIdUrl: string | null;
		eSignatureUrl: string | null;
	}

	interface Props {
		value: ContractCustomization;
		borrowerName: string;
		borrowerHasSignature: boolean;
		lenders: ContractLender[];
		borrowers: Borrower[];
		investors: Investor[];
		onChange: (
			field: keyof ContractCustomization,
			nextValue: ContractCustomization[keyof ContractCustomization]
		) => void;
		onChanges: (changes: Partial<ContractCustomization>) => void;
	}

	let {
		value,
		borrowerName,
		borrowerHasSignature,
		lenders,
		borrowers,
		investors,
		onChange,
		onChanges
	}: Props = $props();

	let witnesses = $state<Witness[]>([]);
	let contactPickerOpen = $state(false);
	let contactPickerQuery = $state('');
	let witness1Saving = $state(false);
	let witness2Saving = $state(false);

	const contacts = $derived<ExistingContact[]>([
		...witnesses.map((witness) => ({
			id: witness.id,
			key: `witness-${witness.id}`,
			kind: 'Witness' as const,
			name: witness.name,
			email: witness.email,
			contactNumber: witness.contactNumber,
			address: witness.address,
			validIdUrl: witness.validIdUrl,
			eSignatureUrl: witness.eSignatureUrl
		})),
		...borrowers.map((borrower) => ({
			id: borrower.id,
			key: `borrower-${borrower.id}`,
			kind: 'Borrower' as const,
			name: borrower.name,
			email: borrower.email,
			contactNumber: borrower.contactNumber,
			address: borrower.address,
			validIdUrl: borrower.validIdUrl,
			eSignatureUrl: borrower.eSignatureUrl
		})),
		...investors.map((investor) => ({
			id: investor.id,
			key: `investor-${investor.id}`,
			kind: 'Investor' as const,
			name: investor.name,
			email: investor.email,
			contactNumber: investor.contactNumber,
			address: investor.address,
			validIdUrl: investor.validIdUrl,
			eSignatureUrl: investor.eSignatureUrl
		}))
	]);

	const filteredContacts = $derived(() => {
		const query = contactPickerQuery.trim().toLowerCase();
		if (!query) return contacts;
		return contacts.filter((contact) =>
			[contact.name, contact.email, contact.contactNumber]
				.filter(Boolean)
				.some((item) => item!.toLowerCase().includes(query))
		);
	});

	onMount(async () => {
		try {
			const response = await fetch('/api/witnesses');
			if (!response.ok) return;
			const data = await response.json();
			if (Array.isArray(data)) witnesses = data;
		} catch (error) {
			console.error('Error loading witnesses:', error);
		}
	});

	function handleWitnessCreated(witness: Witness) {
		witnesses = [...witnesses.filter((item) => item.id !== witness.id), witness].sort((a, b) =>
			a.name.localeCompare(b.name)
		);
	}

	function selectContactForWitness(number: 1 | 2, contact: ExistingContact) {
		const prefix = `witness${number}` as const;
		onChanges({
			[`${prefix}Id`]: contact.kind === 'Witness' ? contact.id : null,
			[`${prefix}Name`]: contact.name,
			[`${prefix}Email`]: contact.email ?? '',
			[`${prefix}Address`]: contact.address ?? '',
			[`${prefix}ValidIdUrl`]: contact.validIdUrl ?? '',
			[`${prefix}ESignatureUrl`]: contact.eSignatureUrl ?? '',
			[`${prefix}SignatureIncluded`]: Boolean(contact.eSignatureUrl)
		});
		contactPickerOpen = false;
		contactPickerQuery = '';
	}

	async function saveWitness(number: 1 | 2) {
		const prefix = `witness${number}` as const;
		const name = value[`${prefix}Name`];
		if (!name.trim()) {
			toast.error('Enter the witness name before saving.');
			return;
		}

		const setSaving =
			number === 1 ? (v: boolean) => (witness1Saving = v) : (v: boolean) => (witness2Saving = v);
		setSaving(true);
		try {
			const response = await fetch('/api/witnesses', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name,
					email: value[`${prefix}Email`],
					address: value[`${prefix}Address`],
					validIdUrl: value[`${prefix}ValidIdUrl`],
					eSignatureUrl: value[`${prefix}ESignatureUrl`]
				})
			});
			const result = await response.json().catch(() => null);
			if (!response.ok) throw new Error(result?.error || 'Failed to save witness.');
			const witness = result as Witness;
			handleWitnessCreated(witness);
			onChanges({ [`${prefix}Id`]: witness.id });
			toast.success(`${witness.name} saved to the witness directory.`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to save witness.');
		} finally {
			setSaving(false);
		}
	}
</script>

{#snippet signatureStatus(available: boolean)}
	<Badge variant={available ? 'secondary' : 'outline'}>
		<PenLine class="mr-1 h-3 w-3" />
		{available ? 'Signature ready' : 'No saved signature'}
	</Badge>
{/snippet}

{#snippet witnessEditor(number: 1 | 2)}
	{@const prefix = `witness${number}` as const}
	{@const witnessId = value[`${prefix}Id`]}
	{@const name = value[`${prefix}Name`]}
	{@const email = value[`${prefix}Email`]}
	{@const address = value[`${prefix}Address`]}
	{@const validIdUrl = value[`${prefix}ValidIdUrl`]}
	{@const eSignatureUrl = value[`${prefix}ESignatureUrl`]}
	{@const signatureIncluded = value[`${prefix}SignatureIncluded`] !== false}
	{@const isSaving = number === 1 ? witness1Saving : witness2Saving}

	<div class="space-y-4 rounded-xl border border-border bg-background p-4">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<div>
				<p class="text-sm font-medium">Witness {number}</p>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				{#if witnessId}<Badge variant="secondary">Saved witness</Badge>{/if}
				{@render signatureStatus(Boolean(eSignatureUrl))}
			</div>
		</div>

		<Popover.Root bind:open={contactPickerOpen}>
			<Popover.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						type="button"
						variant="outline"
						class="w-full justify-between font-normal"
					>
						<span class="flex items-center gap-2">
							<Search class="h-4 w-4 text-muted-foreground" />
							Find an existing contact
						</span>
						<ChevronDown class="h-4 w-4 text-muted-foreground" />
					</Button>
				{/snippet}
			</Popover.Trigger>
			<Popover.Content class="w-[var(--bits-popover-anchor-width)] p-0">
				<div class="border-b border-border p-2">
					<div class="relative">
						<Search
							class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
						/>
						<Input
							value={contactPickerQuery}
							oninput={(e) => (contactPickerQuery = e.currentTarget.value)}
							placeholder="Search name, email, or phone..."
							class="pl-9"
						/>
					</div>
				</div>
				<div class="max-h-64 overflow-y-auto p-1">
					{#if filteredContacts().length}
						{#each filteredContacts() as contact (contact.key)}
							<button
								type="button"
								class="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted"
								onclick={() => selectContactForWitness(number, contact)}
							>
								<div class="mt-0.5 rounded-full bg-primary/10 p-1.5 text-primary">
									<UserRound class="h-3.5 w-3.5" />
								</div>
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<span class="truncate text-sm font-medium">{contact.name}</span>
										<Badge variant="secondary" class="shrink-0">{contact.kind}</Badge>
									</div>
									<p class="truncate text-xs text-muted-foreground">
										{contact.email || contact.contactNumber || 'No contact info'}
									</p>
								</div>
								{#if contact.eSignatureUrl}
									<Check class="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
								{/if}
							</button>
						{/each}
					{:else}
						<div class="px-3 py-8 text-center text-sm text-muted-foreground">
							No matching contacts found.
						</div>
					{/if}
				</div>
			</Popover.Content>
		</Popover.Root>

		<div class="grid gap-4 sm:grid-cols-2">
			<div class="space-y-2">
				<Label for="{prefix}-name">Full name</Label>
				<Input
					id="{prefix}-name"
					value={name}
					oninput={(e) => onChanges({ [`${prefix}Name`]: e.currentTarget.value })}
				/>
			</div>
			<div class="space-y-2">
				<Label for="{prefix}-email">Email</Label>
				<Input
					id="{prefix}-email"
					type="email"
					value={email}
					oninput={(e) => onChanges({ [`${prefix}Email`]: e.currentTarget.value })}
				/>
			</div>
			<div class="space-y-2 sm:col-span-2">
				<Label for="{prefix}-address">Address</Label>
				<Input
					id="{prefix}-address"
					value={address}
					oninput={(e) => onChanges({ [`${prefix}Address`]: e.currentTarget.value })}
				/>
			</div>
		</div>

		{#if !witnessId}
			<Button
				type="button"
				variant="outline"
				size="sm"
				disabled={isSaving || !name.trim()}
				onclick={() => saveWitness(number)}
			>
				<Save class="mr-2 h-4 w-4" />
				{isSaving ? 'Saving...' : 'Save to witness directory'}
			</Button>
		{/if}

		<div class="space-y-2">
			<Label for="{prefix}-date-signed">Signing date</Label>
			<Input
				id="{prefix}-date-signed"
				type="date"
				value={value[`${prefix}DateSigned`]}
				oninput={(e) => onChanges({ [`${prefix}DateSigned`]: e.currentTarget.value })}
			/>
		</div>

		<div class="grid gap-4 lg:grid-cols-2">
			<ValidIdUpload
				idPrefix={prefix}
				value={validIdUrl || null}
				onChange={(next) => onChanges({ [`${prefix}ValidIdUrl`]: next ?? '' })}
			/>
			<ESignatureUpload
				idPrefix={prefix}
				value={eSignatureUrl || null}
				onChange={(next) => onChanges({ [`${prefix}ESignatureUrl`]: next ?? '' })}
			/>
		</div>

		<div class="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3">
			<Checkbox
				id="{prefix}-include-signature"
				checked={signatureIncluded}
				disabled={!eSignatureUrl}
				onCheckedChange={(checked) =>
					onChanges({ [`${prefix}SignatureIncluded`]: checked === true })}
			/>
			<div>
				<Label for="{prefix}-include-signature">Use saved signature image</Label>
			</div>
		</div>
	</div>
{/snippet}

<div class="space-y-5">
	<div class="rounded-xl border border-border bg-background p-4">
		<div class="mb-4 flex items-start gap-3">
			<div class="rounded-lg bg-primary/10 p-2 text-primary">
				<UsersRound class="h-4 w-4" />
			</div>
			<div>
				<p class="text-sm font-medium">Borrower and lenders</p>
			</div>
		</div>

		<div class="space-y-3">
			<div
				class="grid gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:grid-cols-[1fr_auto]"
			>
				<div class="min-w-0">
					<div class="flex flex-wrap items-center gap-2">
						<p class="truncate text-sm font-medium">{borrowerName}</p>
						<Badge variant="secondary">Borrower</Badge>
						{@render signatureStatus(borrowerHasSignature)}
					</div>
				</div>
				<div class="flex items-center gap-2">
					<Checkbox
						id="include-borrower-signature"
						checked={value.includeBorrowerSignature !== false}
						onCheckedChange={(checked) => onChange('includeBorrowerSignature', checked === true)}
					/>
					<Label for="include-borrower-signature" class="text-xs font-normal">
						Use saved signature
					</Label>
				</div>
				<div class="space-y-2 sm:col-span-2">
					<Label for="borrower-date-signed">Borrower signing date</Label>
					<Input
						id="borrower-date-signed"
						type="date"
						value={value.borrowerDateSigned}
						oninput={(e) => onChange('borrowerDateSigned', e.currentTarget.value)}
					/>
				</div>
			</div>

			{#each lenders as lender, index (lender.email)}
				{@const included = value.lenderSignaturesIncluded?.[lender.email] !== false}
				<div
					class="grid gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:grid-cols-[1fr_auto]"
				>
					<div class="min-w-0">
						<div class="flex flex-wrap items-center gap-2">
							<p class="truncate text-sm font-medium">{lender.name}</p>
							<Badge variant="secondary">
								{lenders.length > 1 ? `Lender ${index + 1}` : 'Lender'}
							</Badge>
							{@render signatureStatus(Boolean(lender.eSignatureUrl))}
						</div>
						<p class="mt-1 truncate text-xs text-muted-foreground">{lender.email}</p>
					</div>
					<div class="flex items-center gap-2">
						<Checkbox
							id="include-lender-signature-{lender.email}"
							checked={included}
							onCheckedChange={(checked) =>
								onChange('lenderSignaturesIncluded', {
									...value.lenderSignaturesIncluded,
									[lender.email]: checked === true
								})}
						/>
						<Label for="include-lender-signature-{lender.email}" class="text-xs font-normal">
							Use saved signature
						</Label>
					</div>
					<div class="space-y-2 sm:col-span-2">
						<Label for="lender-date-signed-{lender.email}">Lender signing date</Label>
						<Input
							id="lender-date-signed-{lender.email}"
							type="date"
							value={value.lenderDateSigned[lender.email] ?? ''}
							oninput={(e) =>
								onChange('lenderDateSigned', {
									...value.lenderDateSigned,
									[lender.email]: e.currentTarget.value
								})}
						/>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<div class="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<p class="text-sm font-medium">Witnesses</p>
			</div>
			<div class="flex items-center gap-2">
				<Checkbox
					id="include-witnesses"
					checked={value.includeWitnesses}
					onCheckedChange={(checked) => onChange('includeWitnesses', checked === true)}
				/>
				<Label for="include-witnesses" class="text-xs font-normal">Include witnesses</Label>
			</div>
		</div>

		{#if value.includeWitnesses}
			{@render witnessEditor(1)}
			<div class="flex items-center gap-2">
				<Checkbox
					id="include-second-witness"
					checked={value.includeSecondWitness}
					onCheckedChange={(checked) => onChange('includeSecondWitness', checked === true)}
				/>
				<Label for="include-second-witness" class="text-sm font-normal">Add a second witness</Label>
			</div>
			{#if value.includeSecondWitness}
				{@render witnessEditor(2)}
			{/if}
		{:else}
			<div
				class="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground"
			>
				Witness blocks will not be included in this contract.
			</div>
		{/if}
	</div>
</div>
