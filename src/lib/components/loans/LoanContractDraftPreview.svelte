<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import LoanContractCustomizationForm from '$lib/components/loans/LoanContractCustomizationForm.svelte';
	import {
		buildLoanContractDataFromDraft,
		type LoanContractDraftInput
	} from '$lib/loan-contract-data';
	import {
		applySigningSignatures,
		buildSavedPartySignaturesFromDraft
	} from '$lib/loan-signing';
	import {
		applyContractCustomization,
		areContractCustomizationsEqual,
		buildDefaultContractCustomization,
		CONTRACT_CUSTOMIZATION_FIELDS,
		createEmptyDirtyFields,
		mergeCustomizationWithDefaults,
		parseStoredContractCustomization,
		type ContractCustomization
	} from '$lib/loan-contract-customization';
	import type { Borrower, Investor } from '$lib/types';
	import { ChevronDown, FileText } from 'lucide-svelte';

	interface Props {
		draft: LoanContractDraftInput;
		customization?: ContractCustomization | null;
		onCustomizationChange?: (customization: ContractCustomization) => void;
		borrowers?: Borrower[];
		investors?: Investor[];
		onOpen?: () => void;
		preserveCustomization?: boolean;
	}

	let {
		draft,
		customization: externalCustomization = null,
		onCustomizationChange,
		borrowers = [],
		investors = [],
		onOpen,
		preserveCustomization = false
	}: Props = $props();

	const defaults = $derived(buildDefaultContractCustomization(draft));
	let internalCustomization = $state<ContractCustomization>(defaults);
	let dirtyFields = $state(
		preserveCustomization
			? new Set<keyof ContractCustomization>(CONTRACT_CUSTOMIZATION_FIELDS)
			: createEmptyDirtyFields()
	);

	const customization = $derived(
		externalCustomization
			? parseStoredContractCustomization(externalCustomization, defaults)
			: internalCustomization
	);

	const previewMerged = $derived(
		applySigningSignatures(
			applyContractCustomization(
				buildLoanContractDataFromDraft(draft),
				customization
			),
			customization,
			[],
			new Map(),
			buildSavedPartySignaturesFromDraft(draft)
		)
	);
	const contractData = $derived(previewMerged.data);
	const previewCustomization = $derived(previewMerged.customization);

	$effect(() => {
		const merged = mergeCustomizationWithDefaults(customization, defaults, dirtyFields);
		const parentSnapshot = externalCustomization ?? internalCustomization;

		if (!externalCustomization && !areContractCustomizationsEqual(internalCustomization, merged)) {
			internalCustomization = merged;
		}

		if (!areContractCustomizationsEqual(parentSnapshot, merged)) {
			onCustomizationChange?.(merged);
		}
	});

	function setCustomization(next: ContractCustomization) {
		if (externalCustomization) {
			onCustomizationChange?.(next);
		} else {
			internalCustomization = next;
			onCustomizationChange?.(next);
		}
	}

	function handleFieldChange(
		field: keyof ContractCustomization,
		nextValue: ContractCustomization[keyof ContractCustomization]
	) {
		dirtyFields = new Set([...dirtyFields, field]);
		setCustomization({ ...customization, [field]: nextValue });
	}

	function handleFieldsChange(changes: Partial<ContractCustomization>) {
		for (const field of Object.keys(changes) as Array<keyof ContractCustomization>) {
			dirtyFields = new Set([...dirtyFields, field]);
		}
		setCustomization({ ...customization, ...changes });
	}

	function handleReset() {
		dirtyFields = createEmptyDirtyFields();
		setCustomization(defaults);
	}
</script>

<Card.Root>
	<Collapsible.Root onOpenChange={(open) => open && onOpen?.()}>
		<Card.Header>
			<Collapsible.Trigger class="flex w-full items-start gap-3 text-left">
				<div class="rounded-lg bg-primary/10 p-2 text-primary">
					<FileText class="h-4 w-4" />
				</div>
				<div class="space-y-1">
					<Card.Title>Contract Preview</Card.Title>
					{#if !draft.loanId}
						<p class="text-xs text-chart-5">
							The final contract number will be assigned after the loan is saved.
						</p>
					{/if}
				</div>
				<ChevronDown
					class="mt-2 ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180"
				/>
			</Collapsible.Trigger>
		</Card.Header>
		<Collapsible.Content>
			<Card.Content class="space-y-4">
				<LoanContractCustomizationForm
					value={customization}
					contractData={contractData}
					previewCustomization={previewCustomization}
					borrowerName={contractData.borrowerName}
					borrowerHasSignature={Boolean(draft.borrowerESignatureUrl)}
					lenders={contractData.lenders}
					{borrowers}
					{investors}
					onChange={handleFieldChange}
					onChanges={handleFieldsChange}
					onReset={handleReset}
				/>
			</Card.Content>
		</Collapsible.Content>
	</Collapsible.Root>
</Card.Root>
