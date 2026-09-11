<script lang="ts">
	import LoanContractCustomizationForm from '$lib/components/loans/LoanContractCustomizationForm.svelte';
	import LoanContractDocumentBody from '$lib/components/loans/LoanContractDocumentBody.svelte';
	import FormPageSkeleton from '$lib/components/common/FormPageSkeleton.svelte';
	import { buildLoanContractData } from '$lib/loan-contract-data';
	import {
		applyContractCustomization,
		areContractCustomizationsEqual,
		buildDefaultContractCustomizationFromLoan,
		CONTRACT_CUSTOMIZATION_FIELDS,
		createEmptyDirtyFields,
		parseStoredContractCustomization,
		type ContractCustomization
	} from '$lib/loan-contract-customization';
	import {
		applySigningSignatures,
		buildInvestorEmailMap,
		buildSavedPartySignaturesFromLoan,
		type SigningInvitationRecord
	} from '$lib/loan-signing';
	import { toast } from '$lib/toast';
	import type { Borrower, Investor, LoanWithInvestors } from '$lib/types';

	interface Props {
		loan: LoanWithInvestors;
		canEdit?: boolean;
		borrowers?: Borrower[];
		investors?: Investor[];
		onDirtyChange?: (dirty: boolean) => void;
		onRegisterSave?: (save: () => Promise<void>) => void;
		onSaved?: (customization: ContractCustomization) => void;
	}

	let {
		loan,
		canEdit = false,
		borrowers: borrowersProp = [],
		investors: investorsProp = [],
		onDirtyChange,
		onRegisterSave,
		onSaved
	}: Props = $props();

	let borrowers = $state<Borrower[]>(borrowersProp);
	let investors = $state<Investor[]>(investorsProp);
	let isLoadingContacts = $state(false);
	let isSaving = $state(false);
	let signingInvitations = $state<SigningInvitationRecord[]>([]);

	const baseContractData = $derived(buildLoanContractData(loan));
	const defaults = $derived(buildDefaultContractCustomizationFromLoan(baseContractData));
	const storedCustomization = $derived(
		parseStoredContractCustomization(
			(loan.loanContract?.customization as ContractCustomization | undefined) ?? null,
			defaults
		)
	);

	let customization = $state<ContractCustomization>(storedCustomization);
	let savedSnapshot = $state<ContractCustomization>(storedCustomization);
	let dirtyFields = $state(createEmptyDirtyFields());

	const previewMerged = $derived(
		applySigningSignatures(
			applyContractCustomization(baseContractData, customization),
			customization,
			signingInvitations,
			buildInvestorEmailMap(loan),
			buildSavedPartySignaturesFromLoan(loan)
		)
	);
	const previewData = $derived(previewMerged.data);
	const previewCustomization = $derived(previewMerged.customization);
	const isDirty = $derived(!areContractCustomizationsEqual(customization, savedSnapshot));

	$effect(() => {
		onDirtyChange?.(isDirty);
	});

	$effect(() => {
		customization = storedCustomization;
		savedSnapshot = storedCustomization;
		dirtyFields = createEmptyDirtyFields();
	});

	$effect(() => {
		if (!canEdit) return;
		if (borrowersProp.length > 0) borrowers = borrowersProp;
		if (investorsProp.length > 0) investors = investorsProp;
	});

	$effect(() => {
		if (!canEdit) return;
		if (borrowers.length > 0 && investors.length > 0) return;
		void loadContacts();
	});

	$effect(() => {
		onRegisterSave?.(handleSave);
	});

	$effect(() => {
		void loadSigningInvitations(loan.id);
	});

	async function loadSigningInvitations(loanId: number) {
		try {
			const response = await fetch(`/api/loans/${loanId}/contract`);
			if (!response.ok) return;
			const payload = (await response.json()) as {
				signingInvitations?: SigningInvitationRecord[];
			};
			if (Array.isArray(payload.signingInvitations)) {
				signingInvitations = payload.signingInvitations;
			}
		} catch (error) {
			console.error('Failed to load contract signing invitations', error);
		}
	}

	async function loadContacts() {
		isLoadingContacts = true;
		try {
			const [investorRes, borrowerRes] = await Promise.all([
				fetch('/api/investors?simple=true'),
				fetch('/api/borrowers?simple=true')
			]);
			const investorData = await investorRes.json();
			const borrowerData = await borrowerRes.json();
			if (Array.isArray(investorData)) investors = investorData;
			if (Array.isArray(borrowerData)) borrowers = borrowerData;
		} catch (error) {
			console.error('Failed to load contract editor contacts', error);
			toast.error('Failed to load contacts');
		} finally {
			isLoadingContacts = false;
		}
	}

	function handleFieldChange(
		field: keyof ContractCustomization,
		nextValue: ContractCustomization[keyof ContractCustomization]
	) {
		dirtyFields = new Set([...dirtyFields, field]);
		customization = { ...customization, [field]: nextValue };
	}

	function handleFieldsChange(changes: Partial<ContractCustomization>) {
		for (const field of Object.keys(changes) as Array<keyof ContractCustomization>) {
			dirtyFields = new Set([...dirtyFields, field]);
		}
		customization = { ...customization, ...changes };
	}

	function handleReset() {
		dirtyFields = createEmptyDirtyFields();
		customization = defaults;
	}

	async function handleSave() {
		if (!canEdit || !isDirty || isSaving) return;
		isSaving = true;
		try {
			const response = await fetch(`/api/loans/${loan.id}/contract`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ customization })
			});
			if (!response.ok) {
				toast.error('Failed to save contract');
				return;
			}
			const payload = (await response.json()) as { customization: ContractCustomization };
			const next = parseStoredContractCustomization(payload.customization, defaults);
			customization = next;
			savedSnapshot = next;
			dirtyFields = createEmptyDirtyFields();
			toast.success('Contract saved');
			onSaved?.(next);
		} catch (error) {
			console.error('Error saving contract:', error);
			toast.error('Failed to save contract');
		} finally {
			isSaving = false;
		}
	}

</script>

{#if canEdit && isLoadingContacts && (borrowers.length === 0 || investors.length === 0)}
	<FormPageSkeleton />
{:else if canEdit}
	<LoanContractCustomizationForm
		value={customization}
		contractData={previewData}
		previewCustomization={previewCustomization}
		borrowerName={previewData.borrowerName}
		borrowerHasSignature={Boolean(loan.borrower?.eSignatureUrl)}
		lenders={previewData.lenders}
		{borrowers}
		{investors}
		onChange={handleFieldChange}
		onChanges={handleFieldsChange}
		onReset={handleReset}
	/>
{:else}
	<div class="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
		<div class="max-h-[min(720px,70vh)] overflow-y-auto">
			<LoanContractDocumentBody data={previewData} customization={previewCustomization} />
		</div>
	</div>
{/if}
