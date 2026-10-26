<script lang="ts">
	import { goto } from '$app/navigation';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import PaymentNotesField from '$lib/components/payments/PaymentNotesField.svelte';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Select from '$lib/components/ui/select';
	import * as Tabs from '$lib/components/ui/tabs';
	import ResponsiveOverflowMenu from '$lib/components/common/ResponsiveOverflowMenu.svelte';
	import type { RowActionItem } from '$lib/components/common/action-buttons';
	import MultipleInterestManager from '$lib/components/loans/MultipleInterestManager.svelte';
	import BorrowerFormModal from '$lib/components/borrowers/BorrowerFormModal.svelte';
	import InvestorFormModal from '$lib/components/investors/InvestorFormModal.svelte';
	import FormHeader from '$lib/components/common/FormHeader.svelte';
	import FormActions from '$lib/components/common/FormActions.svelte';
	import SearchableSelect from '$lib/components/common/SearchableSelect.svelte';
	import CopyInvestorModal from '$lib/components/loans/CopyInvestorModal.svelte';
	import { toInvestorConfiguration } from '$lib/components/loans/copy-investor-utils';
	import LoanContractDraftPreview from '$lib/components/loans/LoanContractDraftPreview.svelte';
	import LoanInvestorsSection from '$lib/components/loans/LoanInvestorsSection.svelte';
	import LoanSummarySection from '$lib/components/loans/LoanSummarySection.svelte';
	import {
		buildContractDraft,
		buildInvestorsWithTransactionsForPreview,
		calculateLoanFormSummary,
		calculateLoanPreview
	} from '$lib/components/loans/loan-form-preview';
	import {
		buildAllocationsFromDuplicateData,
		buildAllocationsFromExistingLoan
	} from '$lib/components/loans/loan-form-allocations';
	import { downloadLoanContractPdf } from '$lib/pdf-download';
	import { tick, untrack } from 'svelte';
	import {
		areContractCustomizationsEqual,
		buildDefaultContractCustomization,
		type ContractCustomization
	} from '$lib/loan-contract-customization';
	import {
		applyDefaultWitnesses,
		type DefaultWitnessProfile
	} from '$lib/groups/default-witnesses';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import { cn } from '$lib/utils';
	import { toast } from '$lib/toast';
	import { formatCurrency } from '$lib/format';
	import { getTodayAtMidnight, normalizeToMidnight, toLocalDateString } from '$lib/date-utils';
	import { hasDuplicateInterestDueDates } from '$lib/components/loans/multiple-interest-types';
	import type {
		LoanFormReceivedPayment,
		LoanFormTransaction,
		SelectedInvestorAllocation
	} from '$lib/components/loans/loan-form-types';
	import type { DuplicateLoanData } from '$lib/loan-duplicate';
	import type { Borrower, Investor, LoanStatus, LoanType, LoanWithInvestors } from '$lib/types';
	import { isLoanFullyReceived } from '$lib/calculations';
	import { ChevronDown, MoreVertical, Plus, Trash2, UserPlus } from 'lucide-svelte';
	import ReceiptUploadField from '$lib/components/common/ReceiptUploadField.svelte';
	import ReceiptIntake from '$lib/components/receipt-scan/ReceiptIntake.svelte';
	import ScanRowActions from '$lib/components/receipt-scan/ScanRowActions.svelte';
	import ScanRowNotes from '$lib/components/receipt-scan/ScanRowNotes.svelte';
	import type { ReceiptExtractedData } from '$lib/receipt-extraction-types';
	import {
		hasPaymentReceipt,
		RECEIPT_REQUIRED_ERROR,
		type PaymentReceipt
	} from '$lib/payment-receipts';
	import {
		firstLoanFormFocusTarget,
		loanFormValidationSummary
	} from '$lib/loan-form-focus';
	import { scrollFieldIntoView } from '$lib/scroll-field';
	import type { ReceiptScanContext } from '$lib/receipt-extraction-client';
	import {
		groupScannedReceipts,
		type ProposedTransaction,
		type ScannedReceipt
	} from '$lib/receipt-scan/group-transactions';
	import {
		addProposalsToRows,
		mergeRowWithPrevious,
		splitRowAt,
		type RowAdapter
	} from '$lib/receipt-scan/rows';
	import { findMatchingParty } from '$lib/receipt-scan/match-party';
	import { useAiStatus } from '$lib/ai-status.svelte';
	import { SHOW_GROUPS_UI } from '$lib/feature-flags';
	import LoanFormGroupsField from '$lib/components/loans/LoanFormGroupsField.svelte';
	import { page } from '$app/state';
	import { loanGroupIds, type GroupsIndexItem } from '$lib/groups/loan-group-filter';
	import {
		addIsoDays,
		formatInterestInput,
		loanNameFromTemplate,
		templateLoanNameIsDynamic,
		type LoanTemplate
	} from '$lib/loan-templates';

	interface Props {
		investors?: Investor[];
		borrowers?: Borrower[];
		preselectedInvestorId?: number;
		duplicateData?: DuplicateLoanData | null;
		initialTemplate?: LoanTemplate | null;
		existingLoan?: LoanWithInvestors;
		cancelHref?: string;
		onSuccess?: () => void | Promise<void>;
		onCancel?: () => void;
		/** When false, parent renders FormHeader in a fixed modal shell. */
		showFormHeader?: boolean;
		formId?: string;
		isSubmitting?: boolean;
		/** True after a failed save, until every required field is filled. */
		submitBlocked?: boolean;
		/** Why save is blocked. Empty once the form is valid again. */
		submitError?: string | null;
	}

	let {
		investors = [],
		borrowers: initialBorrowers = [],
		preselectedInvestorId,
		duplicateData = null,
		initialTemplate = null,
		existingLoan,
		cancelHref = '/loans',
		onSuccess,
		onCancel,
		showFormHeader = true,
		formId,
		isSubmitting = $bindable(false),
		submitBlocked = $bindable(false),
		submitError = $bindable<string | null>(null)
	}: Props = $props();

	const isEditMode = $derived(Boolean(existingLoan));
	const isModalMode = $derived(Boolean(onSuccess));
	const groupsIndex = $derived(
		((page.data as { groupsIndex?: GroupsIndexItem[] }).groupsIndex ?? []) as GroupsIndexItem[]
	);
	const showGroupsField = $derived(SHOW_GROUPS_UI);
	let selectedGroupIds = $state<number[]>(
		existingLoan ? loanGroupIds(existingLoan) : []
	);

	let borrowerList = $state<Borrower[]>([...initialBorrowers]);
	let investorList = $state<Investor[]>([...investors]);
	let showBorrowerModal = $state(false);
	let showInvestorModal = $state(false);
	let copySourceInvestorId = $state<number | null>(null);
	let formRef = $state<HTMLFormElement | null>(null);
	const loanTypes: LoanType[] = ['Lot Title', 'OR/CR', 'Agent'];
	let defaultInterestType = $state<'rate' | 'fixed'>('rate');
	let defaultInterestValue = $state('10');

	function createReceivedPayment(): LoanFormReceivedPayment {
		return {
			id: `rp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
			amount: '',
			receivedDate: toLocalDateString(new Date()),
			receipts: [],
			notes: ''
		};
	}

	function createTransaction(interestValue?: string): LoanFormTransaction {
		const value = interestValue ?? defaultInterestValue;
		return {
			id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
			amount: '',
			sentDate: toLocalDateString(new Date()),
			interestType: defaultInterestType,
			interestRate: defaultInterestType === 'rate' ? value : '',
			interestAmount: defaultInterestType === 'fixed' ? value : '',
			isPaid: true,
			dateTouched: false,
			receipts: [],
			notes: ''
		};
	}

	function buildInitialAllocations(): SelectedInvestorAllocation[] {
		if (existingLoan) {
			return buildAllocationsFromExistingLoan(existingLoan);
		}

		if (duplicateData) {
			const fromDuplicate = buildAllocationsFromDuplicateData(duplicateData, investorList);
			if (fromDuplicate.length > 0) return fromDuplicate;
		}

		const preselected = preselectedInvestorId
			? investorList.find((inv) => inv.id === preselectedInvestorId)
			: undefined;
		if (preselected) {
			return [
				{
					investor: preselected,
					transactions: [createTransaction()],
					receivedPayments: [],
					hasMultipleInterest: false,
					interestPeriods: []
				}
			];
		}

		return [];
	}

	let loanName = $state(existingLoan?.loanName ?? duplicateData?.name ?? '');
	let type = $state<LoanType>(existingLoan?.type ?? duplicateData?.type ?? 'Lot Title');
	let dueDate = $state(
		existingLoan?.dueDate
			? toLocalDateString(existingLoan.dueDate)
			: duplicateData?.dueDate
				? toLocalDateString(duplicateData.dueDate)
				: toLocalDateString(new Date())
	);
	let freeLotSqm = $state(
		existingLoan?.freeLotSqm
			? String(existingLoan.freeLotSqm)
			: duplicateData?.freeLotSqm
				? String(duplicateData.freeLotSqm)
				: ''
	);
	let notes = $state(existingLoan?.notes ?? duplicateData?.notes ?? '');
	let borrowerId = $state(
		existingLoan?.borrowerId
			? String(existingLoan.borrowerId)
			: duplicateData?.borrowerId
				? String(duplicateData.borrowerId)
				: ''
	);
	let selectedInvestors = $state<SelectedInvestorAllocation[]>(buildInitialAllocations());
	let investorSelectValue = $state('');
	let investorTab = $state<Record<number, string>>({});
	/** Errors stay hidden until the first failed save, then track the form as it is fixed. */
	let validationRevealed = $state(false);
	let lastScrolledFieldId = $state<string | null>(null);
	let initializedFromDuplicate = $state(false);
	let contractCustomization = $state<ContractCustomization | null>(
		(existingLoan?.loanContract?.customization as ContractCustomization | undefined) ??
			duplicateData?.contractCustomization ??
			null
	);
	let loanTemplates = $state<LoanTemplate[]>([]);
	let selectedTemplateId = $state('none');
	let appliedTemplate = $state<LoanTemplate | null>(null);
	let loanNameTouched = $state(false);
	let useTemplateBorrowers = $state(false);

	const templateBorrowerChoices = $derived(
		(appliedTemplate?.borrowers ?? []).filter((borrower) =>
			borrowerList.some((item) => item.id === borrower.id)
		)
	);
	const templateInvestorChoices = $derived(
		(appliedTemplate?.investors ?? []).filter(
			(investor) =>
				investor.name && investorList.some((item) => item.id === investor.investorId)
		)
	);
	const templateOptions = $derived([
		{ value: 'none', label: 'None' },
		...loanTemplates.map((template) => ({ value: String(template.id), label: template.name }))
	]);
	const templateSentDate = $derived(
		selectedInvestors[0]?.transactions[0]?.sentDate || toLocalDateString(new Date())
	);

	$effect(() => {
		if (existingLoan || duplicateData) return;
		let cancelled = false;
		void fetch('/api/loan-templates')
			.then(async (response) => {
				if (!response.ok || cancelled) return;
				const body = (await response.json()) as unknown;
				if (!cancelled && Array.isArray(body)) loanTemplates = body as LoanTemplate[];
			})
			.catch((error) => {
				console.error('Failed to load loan templates', error);
			});
		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		const template = appliedTemplate;
		const sent = templateSentDate;
		const due = dueDate;
		const touched = loanNameTouched;
		if (!template || touched || !templateLoanNameIsDynamic(template.loanName, template.nameMode)) {
			return;
		}
		const next = loanNameFromTemplate(template.loanName, template.nameMode, sent, due);
		if (!next) return;
		untrack(() => {
			if (loanName !== next) loanName = next;
		});
	});

	function handleLoanNameInput(value: string) {
		loanName = value;
		if (
			!appliedTemplate ||
			!templateLoanNameIsDynamic(appliedTemplate.loanName, appliedTemplate.nameMode)
		) {
			loanNameTouched = true;
			return;
		}
		const expected = loanNameFromTemplate(
			appliedTemplate.loanName,
			appliedTemplate.nameMode,
			templateSentDate,
			dueDate
		);
		loanNameTouched = value !== expected;
	}

	function applyLoanTemplate(value: string) {
		selectedTemplateId = value || 'none';
		const template = loanTemplates.find((item) => String(item.id) === value);
		if (!template) {
			appliedTemplate = null;
			useTemplateBorrowers = false;
			return;
		}

		const today = toLocalDateString(new Date());
		const due = template.termDays ? addIsoDays(today, template.termDays) : dueDate;
		const interestValue = formatInterestInput(template.interestValue);
		defaultInterestType = template.interestType;
		defaultInterestValue = interestValue;
		type = template.type;
		const borrowerPool = (
			template.borrowerIds?.length
				? template.borrowerIds
				: template.borrowerId != null
					? [template.borrowerId]
					: []
		).filter((id) => borrowerList.some((borrower) => borrower.id === id));
		borrowerId = borrowerPool[0] != null ? String(borrowerPool[0]) : '';
		useTemplateBorrowers = borrowerPool.length > 0;
		notes = template.notes ?? '';
		freeLotSqm = template.freeLotSqm != null ? String(template.freeLotSqm) : '';
		if (template.termDays) dueDate = due;
		if (SHOW_GROUPS_UI) {
			const allowed = new Set(groupsIndex.map((group) => group.id));
			selectedGroupIds = template.groupIds.filter((id) => allowed.has(id));
		}
		const investorPresets = (template.investors ?? []).filter((preset) =>
			investorList.some((investor) => investor.id === preset.investorId)
		);
		if (investorPresets.length > 0) {
			selectedInvestors = investorPresets.flatMap((preset) => {
				const investor = investorList.find((item) => item.id === preset.investorId);
				if (!investor) return [];
				return [
					{
						investor,
						transactions: [createTransaction(formatInterestInput(preset.interestValue))],
						receivedPayments: [],
						hasMultipleInterest: false,
						interestPeriods: []
					}
				];
			});
		} else {
			selectedInvestors = selectedInvestors.map((allocation) => ({
				...allocation,
				transactions: allocation.transactions.map((transaction) =>
					template.interestType === 'fixed'
						? { ...transaction, interestType: 'fixed', interestAmount: interestValue }
						: { ...transaction, interestType: 'rate', interestRate: interestValue }
				)
			}));
		}
		loanNameTouched = false;
		appliedTemplate = template;
		loanName = loanNameFromTemplate(template.loanName, template.nameMode, templateSentDate, due);
	}

	let didApplyInitialTemplate = false;
	$effect(() => {
		const template = initialTemplate;
		if (!template || didApplyInitialTemplate || existingLoan || duplicateData) return;
		didApplyInitialTemplate = true;
		untrack(() => {
			if (!loanTemplates.some((item) => item.id === template.id)) {
				loanTemplates = [template, ...loanTemplates];
			}
			applyLoanTemplate(String(template.id));
		});
	});

	const selectedBorrower = $derived(
		borrowerList.find((borrower) => String(borrower.id) === borrowerId) ?? null
	);
	const loanPreview = $derived(calculateLoanPreview(selectedInvestors));
	const loanSummary = $derived(calculateLoanFormSummary(selectedInvestors, calculateLoanStatus));
	const investorsWithTransactions = $derived(
		buildInvestorsWithTransactionsForPreview(loanPreview, selectedInvestors)
	);
	const contractDraft = $derived(
		buildContractDraft({
			borrowerName: selectedBorrower?.name ?? '',
			borrowerAddress: selectedBorrower?.address,
			borrowerContact: selectedBorrower?.contactNumber,
			borrowerEmail: selectedBorrower?.email,
			borrowerValidIdUrl: selectedBorrower?.validIdUrl,
			borrowerESignatureUrl: selectedBorrower?.eSignatureUrl,
			loanName,
			type,
			dueDate,
			freeLotSqm,
			notes,
			selectedInvestors,
			summary: loanSummary,
			loanId: existingLoan?.id
		})
	);

	let defaultWitnessRequest = 0;

	$effect(() => {
		if (!SHOW_GROUPS_UI) return;
		const ids = [...selectedGroupIds].sort((a, b) => a - b);
		const key = ids.join(',');
		if (!key) return;
		const ticket = ++defaultWitnessRequest;
		const draft = untrack(() => contractDraft);
		const current = untrack(() => contractCustomization);
		void (async () => {
			try {
				const response = await fetch(`/api/groups/default-witnesses?ids=${key}`);
				if (!response.ok || ticket !== defaultWitnessRequest) return;
				const body = (await response.json()) as { witnesses?: DefaultWitnessProfile[] };
				const witnesses = body.witnesses ?? [];
				if (witnesses.length === 0 || ticket !== defaultWitnessRequest) return;
				const base = current ?? buildDefaultContractCustomization(draft);
				const next = applyDefaultWitnesses(base, witnesses);
				if (ticket !== defaultWitnessRequest) return;
				if (!areContractCustomizationsEqual(base, next)) {
					contractCustomization = next;
				}
			} catch {
				// The server still applies group witnesses when the loan is saved.
			}
		})();
	});

	$effect(() => {
		if (!duplicateData || investorList.length === 0 || initializedFromDuplicate || existingLoan)
			return;
		const fromDuplicate = buildAllocationsFromDuplicateData(duplicateData, investorList);
		if (fromDuplicate.length > 0) {
			selectedInvestors = fromDuplicate;
			initializedFromDuplicate = true;
		}
	});

	const availableInvestors = $derived(
		investorList.filter((inv) => !selectedInvestors.some((si) => si.investor.id === inv.id))
	);

	const borrowerOptions = $derived(
		borrowerList.map((borrower) => ({ value: String(borrower.id), label: borrower.name }))
	);

	const availableInvestorOptions = $derived(
		availableInvestors.map((investor) => ({ value: String(investor.id), label: investor.name }))
	);

	const totalPrincipal = $derived(
		selectedInvestors.reduce(
			(sum, si) =>
				sum + si.transactions.reduce((inner, t) => inner + (parseFloat(t.amount) || 0), 0),
			0
		)
	);

	const totalReceived = $derived(
		selectedInvestors.reduce(
			(sum, si) =>
				sum + si.receivedPayments.reduce((inner, rp) => inner + (parseFloat(rp.amount) || 0), 0),
			0
		)
	);

	function estimateInvestorTotal(si: SelectedInvestorAllocation): number {
		const principal = si.transactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
		if (si.hasMultipleInterest && si.interestPeriods.length > 0) {
			let interest = 0;
			for (const period of si.interestPeriods) {
				if (period.interestType === 'fixed') {
					interest += parseFloat(period.interestAmount) || 0;
				} else {
					interest += principal * ((parseFloat(period.interestRate) || 0) / 100);
				}
			}
			return principal + interest;
		}
		const transaction = si.transactions[0];
		if (!transaction) return principal;
		if (transaction.interestType === 'fixed') {
			return principal + (parseFloat(transaction.interestAmount) || 0);
		}
		return principal + principal * ((parseFloat(transaction.interestRate) || 0) / 100);
	}

	function calculateLoanStatus(): LoanStatus {
		const hasUnpaidTransactions = selectedInvestors.some((si) =>
			si.transactions.some((t) => !t.isPaid)
		);
		if (hasUnpaidTransactions) return 'Partially Funded';

		const totalAmount = selectedInvestors.reduce((sum, si) => sum + estimateInvestorTotal(si), 0);
		if (isLoanFullyReceived(totalAmount, totalReceived)) return 'Completed';

		if (dueDate) {
			const today = getTodayAtMidnight();
			const due = normalizeToMidnight(dueDate);
			if (today >= due) return 'Overdue';
		}

		return 'Fully Funded';
	}

	function addInvestor(investorId: string, interestValue?: string) {
		if (!investorId || investorId === 'placeholder') return;
		const investor = investorList.find((inv) => String(inv.id) === investorId);
		if (!investor || selectedInvestors.some((si) => si.investor.id === investor.id)) return;

		selectedInvestors = [
			...selectedInvestors,
			{
				investor,
				transactions: [createTransaction(interestValue)],
				receivedPayments: [],
				hasMultipleInterest: false,
				interestPeriods: []
			}
		];
		investorSelectValue = '';
	}

	function setTemplateBorrower(id: number, checked: boolean | 'indeterminate') {
		if (checked === true) {
			borrowerId = String(id);
			return;
		}
		if (borrowerId !== String(id)) return;
		borrowerId = '';
		useTemplateBorrowers = false;
	}

	function setTemplateInvestor(
		investorId: number,
		interestValue: string,
		checked: boolean | 'indeterminate'
	) {
		if (checked === true) addInvestor(String(investorId), formatInterestInput(interestValue));
		else removeInvestor(investorId);
	}

	function handleInvestorSelect(value: string) {
		if (value === 'new') {
			showInvestorModal = true;
			investorSelectValue = '';
			return;
		}
		addInvestor(value);
	}

	function handleInvestorCreated(investor: Investor) {
		investorList = [...investorList.filter((item) => item.id !== investor.id), investor].sort(
			(a, b) => a.name.localeCompare(b.name)
		);
		addInvestor(String(investor.id));
	}

	function handleFormSubmit() {
		formRef?.requestSubmit();
	}

	function cloneAllocationFromSource(
		sourceInvestor: SelectedInvestorAllocation
	): Pick<
		SelectedInvestorAllocation,
		'transactions' | 'receivedPayments' | 'hasMultipleInterest' | 'interestPeriods'
	> {
		const clonedTransactions = sourceInvestor.transactions.map((transaction) => ({
			...transaction,
			id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
		}));
		const clonedReceivedPayments = sourceInvestor.receivedPayments.map((payment) => ({
			...payment,
			id: `temp-rp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
		}));
		const clonedInterestPeriods = sourceInvestor.interestPeriods.map((period) => ({
			...period,
			id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
		}));
		return {
			transactions: clonedTransactions,
			receivedPayments: clonedReceivedPayments,
			hasMultipleInterest: sourceInvestor.hasMultipleInterest,
			interestPeriods: clonedInterestPeriods
		};
	}

	function handleCopy(sourceInvestorId: number) {
		copySourceInvestorId = sourceInvestorId;
	}

	function handleCopyConfirm(targetInvestorIds: number[]) {
		const sourceInvestor = selectedInvestors.find((si) => si.investor.id === copySourceInvestorId);
		if (!sourceInvestor) return;

		const clonedConfig = cloneAllocationFromSource(sourceInvestor);
		const newInvestorsToAdd: SelectedInvestorAllocation[] = [];

		for (const targetId of targetInvestorIds) {
			const isAlreadySelected = selectedInvestors.some((si) => si.investor.id === targetId);
			if (isAlreadySelected) continue;
			const investor = investorList.find((inv) => inv.id === targetId);
			if (!investor) continue;
			newInvestorsToAdd.push({
				investor,
				transactions: [],
				receivedPayments: [],
				hasMultipleInterest: false,
				interestPeriods: []
			});
		}

		selectedInvestors = [
			...selectedInvestors.map((allocation) =>
				targetInvestorIds.includes(allocation.investor.id)
					? { ...allocation, ...cloneAllocationFromSource(sourceInvestor) }
					: allocation
			),
			...newInvestorsToAdd.map((allocation) => ({
				...allocation,
				...clonedConfig
			}))
		];

		copySourceInvestorId = null;
		toast.success(
			`Configuration copied to ${targetInvestorIds.length} investor${
				targetInvestorIds.length !== 1 ? 's' : ''
			}`
		);
	}

	function removeInvestor(investorId: number) {
		selectedInvestors = selectedInvestors.filter((si) => si.investor.id !== investorId);
	}

	function removeTransaction(investorId: number, transactionId: string) {
		selectedInvestors = selectedInvestors.map((si) => {
			if (si.investor.id !== investorId) return si;
			return { ...si, transactions: si.transactions.filter((t) => t.id !== transactionId) };
		});
	}

	function updateTransaction(
		investorId: number,
		transactionId: string,
		field: keyof LoanFormTransaction,
		value: string | boolean
	) {
		selectedInvestors = selectedInvestors.map((si) => {
			if (si.investor.id !== investorId) return si;
			return {
				...si,
				transactions: si.transactions.map((t) =>
					t.id === transactionId ? { ...t, [field]: value } : t
				)
			};
		});
	}

	function updateTransactionFields(
		investorId: number,
		transactionId: string,
		changes: Partial<LoanFormTransaction>
	) {
		selectedInvestors = selectedInvestors.map((si) => {
			if (si.investor.id !== investorId) return si;
			return {
				...si,
				transactions: si.transactions.map((t) =>
					t.id === transactionId ? { ...t, ...changes } : t
				)
			};
		});
	}

	function handleTransactionReceiptExtracted(
		investorId: number,
		transactionId: string,
		extracted: ReceiptExtractedData | null
	) {
		const si = selectedInvestors.find((row) => row.investor.id === investorId);
		const transaction = si?.transactions.find((t) => t.id === transactionId);
		if (!transaction || !extracted) return;

		const changes: Partial<LoanFormTransaction> = {};
		if (!transaction.amount && extracted.amount) {
			changes.amount = String(extracted.amount);
		}
		if (!transaction.dateTouched && extracted.transactionDate) {
			changes.sentDate = extracted.transactionDate;
		}

		if (Object.keys(changes).length > 0) {
			updateTransactionFields(investorId, transactionId, changes);
		}
	}

	function handleReceivedReceiptExtracted(
		investorId: number,
		paymentId: string,
		extracted: ReceiptExtractedData | null
	) {
		const si = selectedInvestors.find((row) => row.investor.id === investorId);
		const payment = si?.receivedPayments.find((rp) => rp.id === paymentId);
		if (!payment || !extracted || payment.amount) return;

		const changes: Partial<LoanFormReceivedPayment> = {};
		if (extracted.amount) changes.amount = String(extracted.amount);
		if (extracted.transactionDate) changes.receivedDate = extracted.transactionDate;
		if (Object.keys(changes).length > 0) {
			updateReceivedPaymentFields(investorId, paymentId, changes);
		}
	}

	// --- Receipts first: uploads create the transaction / payment rows ----------

	const ai = useAiStatus();

	function scanContextFor(purpose: ReceiptScanContext['purpose']): ReceiptScanContext {
		return {
			purpose,
			loanId: existingLoan?.id,
			investorIds: selectedInvestors.map((si) => si.investor.id),
			borrowerId: borrowerId ? Number(borrowerId) : undefined
		};
	}

	function lenderOf(si: SelectedInvestorAllocation) {
		return [{ id: si.investor.id, name: si.investor.name }];
	}

	/** New principal rows copy the investor's existing interest settings. */
	function transactionAdapter(si: SelectedInvestorAllocation): RowAdapter<LoanFormTransaction> {
		return {
			getId: (t) => t.id,
			read: (t) => ({
				investorId: si.investor.id,
				amount: t.amount,
				date: t.sentDate,
				receipts: t.receipts,
				scan: t.scan ?? null
			}),
			write: (base, fields) => {
				const template = si.transactions[0];
				const fresh = template
					? {
							...createTransaction(),
							interestType: template.interestType,
							interestRate: template.interestRate,
							interestAmount: template.interestAmount,
							isPaid: template.isPaid
						}
					: createTransaction();
				return {
					...(base ?? fresh),
					amount: fields.amount,
					sentDate: fields.date || base?.sentDate || toLocalDateString(new Date()),
					dateTouched: true,
					receipts: fields.receipts,
					scan: fields.scan
				};
			}
		};
	}

	function receivedAdapter(si: SelectedInvestorAllocation): RowAdapter<LoanFormReceivedPayment> {
		return {
			getId: (rp) => rp.id,
			read: (rp) => ({
				investorId: si.investor.id,
				amount: rp.amount,
				date: rp.receivedDate,
				receipts: rp.receipts,
				scan: rp.scan ?? null
			}),
			write: (base, fields) => ({
				...(base ?? createReceivedPayment()),
				amount: fields.amount,
				receivedDate: fields.date || base?.receivedDate || toLocalDateString(new Date()),
				receipts: fields.receipts,
				scan: fields.scan
			})
		};
	}

	function updateInvestor(
		investorId: number,
		change: (si: SelectedInvestorAllocation) => SelectedInvestorAllocation
	) {
		selectedInvestors = selectedInvestors.map((si) =>
			si.investor.id === investorId ? change(si) : si
		);
	}

	function addTransactionsFromReceipts(investorId: number, proposals: ProposedTransaction[]) {
		updateInvestor(investorId, (si) => ({
			...si,
			transactions: addProposalsToRows(si.transactions, proposals, transactionAdapter(si))
		}));
	}

	function addReceivedFromReceipts(investorId: number, proposals: ProposedTransaction[]) {
		updateInvestor(investorId, (si) => ({
			...si,
			receivedPayments: addProposalsToRows(si.receivedPayments, proposals, receivedAdapter(si))
		}));
	}

	function scannedUrls(scanned: ScannedReceipt[]) {
		return scanned
			.map((item) => item.receipt?.imageUrl)
			.filter((url): url is string => Boolean(url));
	}

	/** A row's own upload holds several transfers: split that row in place. */
	function splitTransactionFromScan(
		si: SelectedInvestorAllocation,
		transactionId: string,
		scanned: ScannedReceipt[]
	) {
		const { proposals } = groupScannedReceipts(scanned, {
			purpose: 'loan_funding',
			lenders: lenderOf(si),
			defaultInvestorId: si.investor.id,
			currentLoanId: existingLoan?.id ?? null
		});
		updateInvestor(si.investor.id, (row) => ({
			...row,
			transactions: addProposalsToRows(row.transactions, proposals, transactionAdapter(row), {
				sourceId: transactionId,
				scannedImageUrls: scannedUrls(scanned)
			})
		}));
	}

	function splitReceivedFromScan(
		si: SelectedInvestorAllocation,
		paymentId: string,
		scanned: ScannedReceipt[]
	) {
		const { proposals } = groupScannedReceipts(scanned, {
			purpose: 'received_payment',
			lenders: lenderOf(si),
			defaultInvestorId: si.investor.id,
			currentLoanId: existingLoan?.id ?? null
		});
		updateInvestor(si.investor.id, (row) => ({
			...row,
			receivedPayments: addProposalsToRows(row.receivedPayments, proposals, receivedAdapter(row), {
				sourceId: paymentId,
				scannedImageUrls: scannedUrls(scanned)
			})
		}));
	}

	/** New loan with no investors yet: lenders come from the whole CRM. */
	const crmLenders = $derived(
		investorList.map((investor) => ({ id: investor.id, name: investor.name }))
	);

	function addInvestorsFromReceipts(proposals: ProposedTransaction[]) {
		const unmatched = proposals.filter((proposal) => proposal.investorId === null);
		const byInvestor = new Map<number, ProposedTransaction[]>();
		for (const proposal of proposals) {
			if (proposal.investorId === null) continue;
			byInvestor.set(proposal.investorId, [...(byInvestor.get(proposal.investorId) ?? []), proposal]);
		}
		for (const [investorId, list] of byInvestor) {
			addInvestor(String(investorId));
			addTransactionsFromReceipts(investorId, list);
		}
		if (unmatched.length > 0) {
			toast.info(
				`${unmatched.length} ${unmatched.length === 1 ? 'receipt' : 'receipts'} didn't match an investor. Add the investor, then upload in their card.`
			);
		}

		if (!borrowerId) {
			for (const proposal of proposals) {
				const borrower = findMatchingParty(proposal.counterpartyName, borrowerList);
				if (borrower) {
					borrowerId = String(borrower.id);
					toast.info(`Borrower set to ${borrower.name} from the receipt.`);
					break;
				}
			}
		}
	}

	function addTransaction(investorId: number) {
		selectedInvestors = selectedInvestors.map((si) =>
			si.investor.id === investorId
				? { ...si, transactions: [...si.transactions, createTransaction()] }
				: si
		);
	}

	function addReceivedPayment(investorId: number) {
		selectedInvestors = selectedInvestors.map((si) =>
			si.investor.id === investorId
				? { ...si, receivedPayments: [...si.receivedPayments, createReceivedPayment()] }
				: si
		);
	}

	function removeReceivedPayment(investorId: number, paymentId: string) {
		selectedInvestors = selectedInvestors.map((si) => {
			if (si.investor.id !== investorId) return si;
			return {
				...si,
				receivedPayments: si.receivedPayments.filter((rp) => rp.id !== paymentId)
			};
		});
	}

	function updateReceivedPayment(
		investorId: number,
		paymentId: string,
		field: 'amount' | 'receivedDate',
		value: string
	) {
		selectedInvestors = selectedInvestors.map((si) => {
			if (si.investor.id !== investorId) return si;
			return {
				...si,
				receivedPayments: si.receivedPayments.map((rp) =>
					rp.id === paymentId ? { ...rp, [field]: value } : rp
				)
			};
		});
	}

	function updateReceivedPaymentFields(
		investorId: number,
		paymentId: string,
		changes: Partial<LoanFormReceivedPayment>
	) {
		selectedInvestors = selectedInvestors.map((si) => {
			if (si.investor.id !== investorId) return si;
			return {
				...si,
				receivedPayments: si.receivedPayments.map((rp) =>
					rp.id === paymentId ? { ...rp, ...changes } : rp
				)
			};
		});
	}

	function receivedTotalForInvestor(si: SelectedInvestorAllocation): number {
		return si.receivedPayments.reduce((sum, rp) => sum + (parseFloat(rp.amount) || 0), 0);
	}

	function receivedExceedsMax(si: SelectedInvestorAllocation): boolean {
		const totalDue = estimateInvestorTotal(si);
		if (totalDue <= 0) return false;
		return receivedTotalForInvestor(si) > totalDue + 0.01;
	}

	function collectFieldErrors() {
		const next: Record<string, string> = {};
		if (!loanName.trim()) next.loanName = 'Loan name is required';
		if (!dueDate) next.dueDate = 'Due date is required';
		if (!borrowerId) next.borrowerId = 'Borrower is required';
		if (selectedInvestors.length === 0) next.investors = 'At least one investor is required';

		let missingDisbursementReceipt = false;
		let missingReceivedReceipt = false;

		for (const si of selectedInvestors) {
			if (si.transactions.length === 0) {
				next.investors = `Add a principal disbursement for ${si.investor.name}.`;
				missingDisbursementReceipt = true;
			}
			for (const transaction of si.transactions) {
				const amountText = String(transaction.amount).trim();
				const interestRateText = String(transaction.interestRate).trim();
				const interestAmountText = String(transaction.interestAmount).trim();
				if (!amountText || Number(amountText) < 0) {
					next.investors = 'Each transaction needs a valid principal amount';
					break;
				}
				if (transaction.interestType === 'rate' && !interestRateText) {
					next.investors = 'Each transaction needs an interest rate or fixed amount';
					break;
				}
				if (transaction.interestType === 'fixed' && !interestAmountText) {
					next.investors = 'Each transaction needs an interest rate or fixed amount';
					break;
				}
				if (!hasPaymentReceipt(transaction)) {
					next[`receipt-tx-${transaction.id}`] = RECEIPT_REQUIRED_ERROR;
					missingDisbursementReceipt = true;
				}
			}
			for (const rp of si.receivedPayments) {
				const amount = Number.parseFloat(rp.amount);
				if (!Number.isFinite(amount) || amount <= 0) continue;
				if (!hasPaymentReceipt(rp)) {
					next[`receipt-rp-${rp.id}`] = RECEIPT_REQUIRED_ERROR;
					missingReceivedReceipt = true;
				}
			}
			if (si.hasMultipleInterest) {
				if (si.interestPeriods.length === 0) {
					next.investors = 'Multiple interest periods are required';
					break;
				}
				if (hasDuplicateInterestDueDates(si.interestPeriods)) {
					next.investors = 'Interest periods cannot share the same due date';
					break;
				}
			}
		}

		if (selectedInvestors.some((si) => receivedExceedsMax(si))) {
			next.investors = 'Total received payments cannot exceed total amount due per investor';
		}

		if (!next.investors && missingDisbursementReceipt && missingReceivedReceipt) {
			next.investors = 'Upload a receipt for each disbursement and received payment.';
		} else if (!next.investors && missingDisbursementReceipt) {
			next.investors = 'Upload a receipt for each principal disbursement.';
		} else if (!next.investors && missingReceivedReceipt) {
			next.investors = 'Upload a receipt for each received payment.';
		}

		return next;
	}

	const fieldErrors = $derived.by(() => collectFieldErrors());
	const errors = $derived(validationRevealed ? fieldErrors : {});

	function focusInvestors() {
		return selectedInvestors.map((si) => ({
			investorId: si.investor.id,
			transactionIds: si.transactions.map((transaction) => transaction.id),
			receivedPaymentIds: si.receivedPayments.map((payment) => payment.id)
		}));
	}

	async function revealInvalidField(next: Record<string, string>) {
		const target = firstLoanFormFocusTarget(next, focusInvestors());
		if (!target) return false;
		if (target.investorId != null && target.tab) {
			investorTab[target.investorId] = target.tab;
		}
		await tick();
		await new Promise<void>((resolve) => {
			requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
		});
		return scrollFieldIntoView(target.domId, {
			focus: target.domId !== 'investors-section'
		});
	}

	$effect(() => {
		const blocked = validationRevealed && Object.keys(fieldErrors).length > 0;
		const message = blocked ? loanFormValidationSummary(fieldErrors) : null;
		if (submitBlocked !== blocked) submitBlocked = blocked;
		if (submitError !== message) submitError = message;

		if (!blocked) {
			if (lastScrolledFieldId !== null) lastScrolledFieldId = null;
			return;
		}

		const target = firstLoanFormFocusTarget(fieldErrors, focusInvestors());
		const domId = target?.domId ?? null;
		if (!domId || domId === lastScrolledFieldId) return;
		lastScrolledFieldId = domId;
		void revealInvalidField(fieldErrors);
	});

	function buildInvestorPayload() {
		const investorData: Array<{
			investorId: number;
			amount: string;
			interestRate: string;
			interestType: 'rate' | 'fixed';
			sentDate: string;
			isPaid: boolean;
			hasMultipleInterest: boolean;
			receipts: PaymentReceipt[];
			notes: string;
			interestPeriods?: Array<{
				dueDate: string;
				interestRate: string;
				interestType: 'rate' | 'fixed';
			}>;
		}> = [];

		for (const si of selectedInvestors) {
			const investorTotalCapital = si.transactions.reduce(
				(sum, t) => sum + (parseFloat(t.amount) || 0),
				0
			);

			const interestPeriods = si.hasMultipleInterest
				? si.interestPeriods.map((period) => {
						const isZeroPeriodCapitalWithRate =
							investorTotalCapital === 0 && period.interestType === 'rate';
						if (isZeroPeriodCapitalWithRate) {
							const rate = parseFloat(period.interestRate) || 0;
							const calculatedInterest = totalPrincipal * (rate / 100);
							return {
								dueDate: period.dueDate,
								interestRate: calculatedInterest.toFixed(2),
								interestType: 'fixed' as const
							};
						}
						return {
							dueDate: period.dueDate,
							interestRate:
								period.interestType === 'fixed' ? period.interestAmount : period.interestRate,
							interestType: period.interestType
						};
					})
				: undefined;

			for (const transaction of si.transactions) {
				const amount = parseFloat(transaction.amount) || 0;
				let interestRate = transaction.interestRate;
				let interestType: 'rate' | 'fixed' = 'rate';

				if (transaction.interestType === 'fixed') {
					interestRate = transaction.interestAmount;
					interestType = 'fixed';
				} else if (amount === 0 && transaction.interestType === 'rate') {
					const rate = parseFloat(transaction.interestRate) || 0;
					interestRate = (totalPrincipal * (rate / 100)).toFixed(2);
					interestType = 'fixed';
				}

				investorData.push({
					investorId: si.investor.id,
					amount: transaction.amount,
					interestRate,
					interestType,
					sentDate: transaction.sentDate,
					isPaid: transaction.isPaid,
					hasMultipleInterest: si.hasMultipleInterest,
					receipts: transaction.receipts,
					notes: transaction.notes,
					interestPeriods
				});
			}
		}

		return investorData;
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		if (Object.keys(fieldErrors).length > 0) {
			validationRevealed = true;
			const message = loanFormValidationSummary(fieldErrors);
			if (message) toast.error(message);
			return;
		}
		validationRevealed = false;

		isSubmitting = true;
		try {
			const url = isEditMode ? `/api/loans/${existingLoan!.id}` : '/api/loans';
			const method = isEditMode ? 'PUT' : 'POST';

			const response = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					groupIds: SHOW_GROUPS_UI && !isEditMode ? selectedGroupIds : undefined,
					loanData: {
						borrowerId: Number(borrowerId),
						loanName: loanName.trim(),
						type,
						status: calculateLoanStatus(),
						dueDate,
						freeLotSqm: freeLotSqm ? Number(freeLotSqm) : null,
						notes: notes.trim() || null
					},
					investorData: buildInvestorPayload(),
					receivedPaymentsByInvestor: selectedInvestors.map((si) => ({
						investorId: si.investor.id,
						receivedPayments: si.receivedPayments
							.filter((rp) => Number.parseFloat(rp.amount) > 0)
							.map((rp) => ({
								amount: rp.amount,
								receivedDate: rp.receivedDate,
								receipts: rp.receipts,
								notes: rp.notes
							}))
					})),
					contractCustomization: contractCustomization ?? null
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || `Failed to ${isEditMode ? 'update' : 'create'} loan`);
			}

			const savedLoan = await response.json();

			if (SHOW_GROUPS_UI && selectedGroupIds.length > 0) {
				const loanId = (savedLoan as { id: number }).id;
				const groupsRes = await fetch(`/api/loans/${loanId}/groups`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ groupIds: selectedGroupIds })
				});
				if (!groupsRes.ok) {
					const errorData = await groupsRes.json().catch(() => ({}));
					toast.error(
						(errorData as { error?: string }).error ||
							'Loan saved, but groups could not be updated'
					);
				}
			} else if (SHOW_GROUPS_UI && isEditMode) {
				const loanId = (savedLoan as { id: number }).id;
				await fetch(`/api/loans/${loanId}/groups`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ groupIds: selectedGroupIds })
				});
			}

			if (!isEditMode) {
				try {
					await downloadLoanContractPdf(savedLoan.id);
					toast.success('Loan created and contract PDF downloaded.');
				} catch (contractError) {
					console.error('Error generating loan contract PDF:', contractError);
					toast.success('Loan created.');
					toast.error('Contract PDF could not be generated. Download it from the loan details.');
				}
			} else {
				toast.success('Loan updated');
			}

			if (onSuccess) {
				try {
					await onSuccess();
				} catch (error) {
					console.error(error);
				}
			} else if (!isEditMode) {
				await goto(`/loans/${savedLoan.id}?signing=1`);
			}
		} catch (error) {
			console.error(error);
			toast.error(error instanceof Error ? error.message : 'Save failed');
		} finally {
			isSubmitting = false;
		}
	}

	function handleCancel() {
		if (onCancel) {
			onCancel();
			return;
		}
		goto(cancelHref);
	}

	function handleBorrowerSelect(value: string) {
		if (value === 'new') {
			showBorrowerModal = true;
			return;
		}
		borrowerId = value;
	}

	function handleBorrowerCreated(borrower: Borrower) {
		borrowerList = [...borrowerList.filter((item) => item.id !== borrower.id), borrower].sort(
			(a, b) => a.name.localeCompare(b.name)
		);
		borrowerId = String(borrower.id);
	}

	function resolveExistingLoanBorrower(): Borrower | undefined {
		if (existingLoan?.borrower) return existingLoan.borrower;
		if (!existingLoan?.borrowerId) return undefined;
		return initialBorrowers.find((borrower) => borrower.id === existingLoan.borrowerId);
	}

	$effect(() => {
		const loanBorrower = resolveExistingLoanBorrower();
		if (initialBorrowers.length === 0 && !loanBorrower && !existingLoan?.borrowerId) return;
		const merged = new Map<number, Borrower>();
		for (const borrower of initialBorrowers) merged.set(borrower.id, borrower);
		if (loanBorrower) merged.set(loanBorrower.id, loanBorrower);
		for (const borrower of borrowerList) merged.set(borrower.id, borrower);
		const next = Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
		const nextIds = next.map((borrower) => borrower.id).join(',');
		const currentIds = borrowerList.map((borrower) => borrower.id).join(',');
		if (nextIds !== currentIds) borrowerList = next;
	});

	$effect(() => {
		if (investors.length === 0) return;
		const merged = new Map<number, Investor>();
		for (const investor of investors) merged.set(investor.id, investor);
		for (const investor of investorList) merged.set(investor.id, investor);
		for (const allocation of selectedInvestors)
			merged.set(allocation.investor.id, allocation.investor);
		const next = Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
		const nextIds = next.map((investor) => investor.id).join(',');
		const currentIds = investorList.map((investor) => investor.id).join(',');
		if (nextIds !== currentIds) investorList = next;
	});

	const formTitle = $derived(
		isEditMode
			? (existingLoan?.loanName ?? 'Loan')
			: duplicateData
				? 'Duplicate Loan'
				: 'Create Loan'
	);
	const formDescription = $derived(
		isEditMode
			? 'Update loan details and investor allocations'
			: 'Add a new loan with investor allocations'
	);
	const copySourceInvestor = $derived(
		copySourceInvestorId
			? (selectedInvestors.find((si) => si.investor.id === copySourceInvestorId)?.investor ?? null)
			: null
	);
	const copySourceInvestorConfig = $derived(
		copySourceInvestorId
			? toInvestorConfiguration(
					selectedInvestors.find((si) => si.investor.id === copySourceInvestorId)!
				)
			: null
	);
	const selectedInvestorsConfigs = $derived(
		new Map(
			selectedInvestors.map((allocation) => [
				allocation.investor.id,
				toInvestorConfiguration(allocation)
			])
		)
	);
	const availableInvestorsForCopy = $derived(
		investorList.filter((investor) => investor.id !== copySourceInvestorId)
	);

	const submitButtonLabel = $derived(
		isSubmitting
			? isEditMode
				? 'Updating...'
				: 'Creating...'
			: isEditMode
				? 'Update Loan'
				: duplicateData
					? 'Duplicate Loan'
					: 'Create Loan'
	);
</script>

	<form
		bind:this={formRef}
		id={formId}
		class={cn('dashboard-form w-full min-w-0', isModalMode ? 'max-w-none' : 'max-w-4xl')}
		onsubmit={handleSubmit}
	>
	{#if showFormHeader}
		<FormHeader
			title={formTitle}
			description={formDescription}
			onCancel={handleCancel}
			onSubmit={handleFormSubmit}
			{formId}
			{isSubmitting}
			submitDisabled={submitBlocked}
			error={submitError}
			{isEditMode}
			submitLabel={submitButtonLabel}
			variant={isModalMode ? 'embedded' : 'page'}
		/>
	{/if}

	<Card.Root>
		<Card.Header>
			<Card.Title>Loan Details</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="grid gap-4 sm:grid-cols-2">
				{#if !isEditMode && !duplicateData && loanTemplates.length > 0}
					<div class="space-y-2 sm:col-span-2">
						<Label for="loanTemplate">Template</Label>
						<SearchableSelect
							id="loanTemplate"
							options={templateOptions}
							value={selectedTemplateId}
							onValueChange={applyLoanTemplate}
							placeholder="None"
							searchPlaceholder="Search templates..."
							searchable={loanTemplates.length > 8}
							disabled={isSubmitting}
							triggerClassName="w-full"
						/>
					</div>
				{/if}
				<div id="field-borrower" class="scroll-mt-24 space-y-2">
					<Label for={useTemplateBorrowers ? undefined : 'borrowerId'}>Borrower *</Label>
					{#if useTemplateBorrowers && templateBorrowerChoices.length > 0}
						<ul class="space-y-2">
							{#each templateBorrowerChoices as borrower (borrower.id)}
								{@const selected = borrowerId === String(borrower.id)}
								<li>
									<label
										class={cn(
											'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border bg-card px-3',
											selected
												? 'border-primary/45 bg-primary/[0.06]'
												: 'border-border/60'
										)}
									>
										<span class="min-w-0 flex-1 truncate text-sm font-medium">{borrower.name}</span>
										<Checkbox
											checked={selected}
											disabled={isSubmitting}
											aria-label={borrower.name}
											onCheckedChange={(checked) => setTemplateBorrower(borrower.id, checked)}
										/>
									</label>
								</li>
							{/each}
						</ul>
					{:else}
						<SearchableSelect
							id="borrowerId"
							options={borrowerOptions}
							value={borrowerId}
							onValueChange={handleBorrowerSelect}
							placeholder="Select a borrower..."
							searchPlaceholder="Search borrowers..."
							searchable={true}
							disabled={isSubmitting}
							triggerClassName="w-full"
						>
							{#snippet header({ select })}
								<button
									type="button"
									class="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2.5 text-left text-sm font-medium text-primary hover:bg-accent"
									onclick={() => select('new')}
								>
									<UserPlus class="h-4 w-4" />
									Add New Borrower
								</button>
								{#if borrowerList.length > 0}
									<div class="my-1 h-px bg-border"></div>
								{/if}
							{/snippet}
						</SearchableSelect>
					{/if}
					{#if errors.borrowerId}<p id="borrower-error" class="text-sm font-medium text-destructive" role="alert">{errors.borrowerId}</p>{/if}
				</div>
				<div id="field-loan-name" class="scroll-mt-24 space-y-2">
					<Label for="loanName">Loan Name / Label *</Label>
					<Input
						id="loanName"
						value={loanName}
						oninput={(event) => handleLoanNameInput(event.currentTarget.value)}
						disabled={isSubmitting}
						placeholder="e.g., Mexico, Pampanga"
						required
						aria-invalid={errors.loanName ? 'true' : undefined}
						aria-describedby={errors.loanName ? 'loan-name-error' : undefined}
					/>
					{#if errors.loanName}<p id="loan-name-error" class="text-sm font-medium text-destructive" role="alert">{errors.loanName}</p>{/if}
				</div>
				<div class="space-y-2">
					<Label for="type">Type *</Label>
					<Select.Root type="single" bind:value={type} disabled={isSubmitting}>
						<Select.Trigger id="type" class="w-full">{type}</Select.Trigger>
						<Select.Content>
							{#each loanTypes as loanType}
								<Select.Item value={loanType}>{loanType}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div id="field-due-date" class="scroll-mt-24 space-y-2">
					<Label for="dueDate">Due Date *</Label>
					<Input
						id="dueDate"
						type="date"
						bind:value={dueDate}
						disabled={isSubmitting}
						aria-invalid={errors.dueDate ? 'true' : undefined}
						aria-describedby={errors.dueDate ? 'due-date-error' : undefined}
					/>
					{#if errors.dueDate}<p id="due-date-error" class="text-sm font-medium text-destructive" role="alert">{errors.dueDate}</p>{/if}
				</div>
				{#if type === 'Lot Title'}
					<div class="space-y-2">
						<Label for="freeLotSqm">Free Lot (sqm)</Label>
						<Input
							id="freeLotSqm"
							type="number"
							min="0"
							bind:value={freeLotSqm}
							disabled={isSubmitting}
							placeholder="Optional"
						/>
					</div>
				{/if}
			</div>

			<div class="space-y-2">
				<Label for="notes">Notes</Label>
				<Textarea
					id="notes"
					bind:value={notes}
					disabled={isSubmitting}
					placeholder="Additional notes..."
					rows={3}
				/>
			</div>

			{#if showGroupsField}
				<LoanFormGroupsField
					groups={groupsIndex}
					bind:selectedGroupIds
					disabled={isSubmitting}
				/>
			{/if}
		</Card.Content>
	</Card.Root>

	<Card.Root id="investors-section" class="scroll-mt-24">
		<Card.Header>
			<Card.Title>Investors</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-4">
			{#if templateInvestorChoices.length > 0}
				<ul class="space-y-2">
					{#each templateInvestorChoices as preset (preset.investorId)}
						{@const selected = selectedInvestors.some((si) => si.investor.id === preset.investorId)}
						<li
							class={cn(
								'flex min-h-11 items-center gap-3 rounded-xl border bg-card px-3',
								selected ? 'border-primary/45 bg-primary/[0.06]' : 'border-border/60'
							)}
						>
							<span class="min-w-0 flex-1 truncate text-sm font-medium">{preset.name}</span>
							<span class="shrink-0 text-sm tabular-nums text-muted-foreground">
								{appliedTemplate?.interestType === 'fixed'
									? formatCurrency(preset.interestValue)
									: `${formatInterestInput(preset.interestValue)}%`}
							</span>
							<Checkbox
								checked={selected}
								disabled={isSubmitting}
								aria-label={preset.name ?? 'Investor'}
								onCheckedChange={(checked) =>
									setTemplateInvestor(preset.investorId, preset.interestValue, checked)}
							/>
						</li>
					{/each}
				</ul>
			{/if}
			<div class="space-y-3">
				<Label>Add Investor</Label>
				<SearchableSelect
					options={availableInvestorOptions}
					value={investorSelectValue}
					onValueChange={handleInvestorSelect}
					placeholder="Select an investor..."
					searchPlaceholder="Search investors..."
					searchable={true}
					disabled={isSubmitting}
					triggerClassName="w-full"
				>
					{#snippet header({ select })}
						<button
							type="button"
							class="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2.5 text-left text-sm font-medium text-primary hover:bg-accent"
							onclick={() => select('new')}
						>
							<UserPlus class="h-4 w-4" />
							Add New Investor
						</button>
						{#if availableInvestors.length > 0}
							<div class="my-1 h-px bg-border"></div>
						{/if}
					{/snippet}
				</SearchableSelect>
			</div>

			{#if errors.investors}<p class="text-sm font-medium text-destructive" role="alert">{errors.investors}</p>{/if}

			{#if selectedInvestors.length === 0}
				{#if ai.receiptExtraction}
					<ReceiptIntake
						context={scanContextFor('loan_funding')}
						lenders={crmLenders}
						currentLoanId={existingLoan?.id ?? null}
						onCreate={addInvestorsFromReceipts}
						disabled={isSubmitting}
					/>
				{:else}
					<p class="py-4 text-center text-muted-foreground">No investors added yet</p>
				{/if}
			{/if}

			{#each selectedInvestors as si (si.investor.id)}
				{@const primaryTransaction = si.transactions[0]}
				{@const investorTotalDue = estimateInvestorTotal(si)}
				{@const investorReceivedTotal = receivedTotalForInvestor(si)}
				<div class="space-y-4 rounded-lg border p-4">
					<div class="flex items-center justify-between gap-3">
						<p class="font-medium">{si.investor.name}</p>
						<div class="flex items-center gap-1">
							<ResponsiveOverflowMenu
								items={[
									{
										label: 'Copy',
										icon: 'duplicate',
										onClick: () => handleCopy(si.investor.id)
									} satisfies RowActionItem
								]}
								ariaLabel="Investor actions"
								sheetTitle="Actions"
							>
								{#snippet trigger({ props })}
									<Button
										{...props}
										type="button"
										variant="ghost"
										size="sm"
										disabled={isSubmitting}
										title="Actions"
										aria-label="Investor actions"
									>
										<MoreVertical class="h-4 w-4" />
									</Button>
								{/snippet}
							</ResponsiveOverflowMenu>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								disabled={isSubmitting}
								onclick={() => removeInvestor(si.investor.id)}
							>
								<Trash2 class="h-4 w-4" />
							</Button>
						</div>
					</div>

					<Tabs.Root
						value={investorTab[si.investor.id] ?? 'principal'}
						onValueChange={(value) => {
							if (value !== 'principal' && value !== 'received') return;
							investorTab[si.investor.id] = value;
						}}
						class="w-full"
					>
						<Tabs.List class="grid h-11 w-full grid-cols-2">
							<Tabs.Trigger value="principal" class="text-xs sm:text-sm">
								Principal Disbursement
							</Tabs.Trigger>
							<Tabs.Trigger value="received" class="text-xs sm:text-sm">
								Received Payments
							</Tabs.Trigger>
						</Tabs.List>

						<Tabs.Content value="principal" class="mt-3 space-y-4">
							{#each si.transactions as transaction, txIndex (transaction.id)}
								<div
									class={cn(
										'space-y-3 rounded-md bg-muted/30 p-3',
										errors[`receipt-tx-${transaction.id}`] && 'ring-1 ring-destructive/40'
									)}
									data-testid="principal-transaction"
								>
									<div class="flex items-center justify-between">
										<p class="text-sm text-muted-foreground">Transaction {txIndex + 1}</p>
										<ScanRowActions
											rowLabel="Transaction {txIndex + 1}"
											canMerge={txIndex > 0}
											canSplit={transaction.receipts.length > 1}
											canRemove={true}
											onMerge={() =>
												updateInvestor(si.investor.id, (row) => ({
													...row,
													transactions: mergeRowWithPrevious(
														row.transactions,
														txIndex,
														transactionAdapter(row)
													)
												}))}
											onSplit={() =>
												updateInvestor(si.investor.id, (row) => ({
													...row,
													transactions: splitRowAt(row.transactions, txIndex, transactionAdapter(row))
												}))}
											onRemove={() => removeTransaction(si.investor.id, transaction.id)}
											disabled={isSubmitting}
										/>
									</div>

									<div class="grid w-full gap-3 sm:grid-cols-2">
										<div class="min-w-0 space-y-2">
											<Label for={`principal-${transaction.id}`}>Principal</Label>
											<Input
												id={`principal-${transaction.id}`}
												class="w-full"
												type="number"
												min="0"
												step="0.01"
												value={transaction.amount}
												disabled={isSubmitting}
												oninput={(e) =>
													updateTransaction(
														si.investor.id,
														transaction.id,
														'amount',
														e.currentTarget.value
													)}
											/>
										</div>
										<div class="min-w-0 space-y-2">
											<Label for={`sent-date-${transaction.id}`}>Sent Date</Label>
											<Input
												id={`sent-date-${transaction.id}`}
												class="w-full"
												type="date"
												value={transaction.sentDate}
												disabled={isSubmitting}
												oninput={(e) =>
													updateTransactionFields(si.investor.id, transaction.id, {
														sentDate: e.currentTarget.value,
														dateTouched: true
													})}
											/>
										</div>
									</div>
									<label
										for={`paid-${transaction.id}`}
										class="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg border border-border/50 bg-card px-3"
									>
										<Checkbox
											id={`paid-${transaction.id}`}
											checked={transaction.isPaid}
											disabled={isSubmitting}
											onCheckedChange={(checked) =>
												updateTransaction(
													si.investor.id,
													transaction.id,
													'isPaid',
													checked === true
												)}
										/>
										<span class="text-sm font-medium leading-none">Disbursed</span>
									</label>

									{#if !si.hasMultipleInterest}
										<div class="w-full space-y-2">
											<Tabs.Root
												class="w-full"
												value={transaction.interestType}
												onValueChange={(value) =>
													updateTransaction(
														si.investor.id,
														transaction.id,
														'interestType',
														value as 'rate' | 'fixed'
													)}
											>
												<Tabs.List class="grid h-11 w-full grid-cols-2">
													<Tabs.Trigger value="rate" class="text-xs sm:text-sm">
														Rate (%)
													</Tabs.Trigger>
													<Tabs.Trigger value="fixed" class="text-xs sm:text-sm">
														Fixed (₱)
													</Tabs.Trigger>
												</Tabs.List>
												<Tabs.Content value="rate" class="mt-2 w-full">
													<Input
														class="w-full"
														type="number"
														step="0.01"
														aria-label="Interest rate percent"
														value={transaction.interestRate}
														disabled={isSubmitting}
														oninput={(e) =>
															updateTransaction(
																si.investor.id,
																transaction.id,
																'interestRate',
																e.currentTarget.value
															)}
													/>
												</Tabs.Content>
												<Tabs.Content value="fixed" class="mt-2 w-full">
													<Input
														class="w-full"
														type="number"
														step="0.01"
														aria-label="Fixed interest amount"
														value={transaction.interestAmount}
														disabled={isSubmitting}
														oninput={(e) =>
															updateTransaction(
																si.investor.id,
																transaction.id,
																'interestAmount',
																e.currentTarget.value
															)}
													/>
												</Tabs.Content>
											</Tabs.Root>
										</div>
									{/if}

									<PaymentNotesField
										id="tx-notes-{transaction.id}"
										value={transaction.notes}
										disabled={isSubmitting}
										onChange={(notes) =>
											updateTransactionFields(si.investor.id, transaction.id, { notes })}
									/>

									<ReceiptUploadField
										fieldId="receipt-tx-{transaction.id}"
										idPrefix="tx-{transaction.id}"
										receipts={transaction.receipts}
										showReading={!transaction.scan}
										required
										error={errors[`receipt-tx-${transaction.id}`]}
										disabled={isSubmitting}
										onChange={(receipts) =>
											updateTransactionFields(si.investor.id, transaction.id, { receipts })}
										onExtracted={(extracted) =>
											handleTransactionReceiptExtracted(
												si.investor.id,
												transaction.id,
												extracted
											)}
										scanContext={scanContextFor('loan_funding')}
										onSplitRequest={(scanned) =>
											splitTransactionFromScan(si, transaction.id, scanned)}
									/>

									<ScanRowNotes scan={transaction.scan} />
								</div>
							{/each}

							<Button
								type="button"
								variant="outline"
								size="sm"
								class="w-full"
								disabled={isSubmitting}
								onclick={() => addTransaction(si.investor.id)}
							>
								<Plus class="mr-2 h-4 w-4" />
								Add transaction
							</Button>

							<ReceiptIntake
								variant="compact"
								context={scanContextFor('loan_funding')}
								lenders={lenderOf(si)}
								defaultInvestorId={si.investor.id}
								currentLoanId={existingLoan?.id ?? null}
								onCreate={(proposals) => addTransactionsFromReceipts(si.investor.id, proposals)}
								disabled={isSubmitting}
							/>

							{#if primaryTransaction}
								<MultipleInterestManager
									sentDate={primaryTransaction.sentDate}
									loanDueDate={dueDate}
									amount={String(
										si.transactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0)
									)}
									defaultInterestRate={primaryTransaction.interestRate || '10'}
									defaultInterestType={primaryTransaction.interestType}
									initialMode={si.hasMultipleInterest ? 'multiple' : 'single'}
									initialPeriods={si.interestPeriods}
									onModeChange={(mode) => {
										selectedInvestors = selectedInvestors.map((row) =>
											row.investor.id === si.investor.id
												? { ...row, hasMultipleInterest: mode === 'multiple' }
												: row
										);
									}}
									onPeriodsChange={(periods) => {
										selectedInvestors = selectedInvestors.map((row) =>
											row.investor.id === si.investor.id
												? { ...row, interestPeriods: periods }
												: row
										);
									}}
								/>
							{/if}
						</Tabs.Content>

						<Tabs.Content value="received" class="mt-3 space-y-3">
							<div
								class="space-y-3 rounded-lg border bg-muted/30 p-4 {receivedExceedsMax(si)
									? 'border-destructive'
									: ''}"
							>
								<p class="text-sm font-semibold">Received Payments</p>
								{#if receivedExceedsMax(si)}
									<p class="text-xs text-destructive">
										Total received ({formatCurrency(investorReceivedTotal)}) cannot exceed amount
										due ({formatCurrency(investorTotalDue)}).
									</p>
								{/if}

								{#each si.receivedPayments as rp, rpIndex (rp.id)}
									<div
										class={cn(
											'space-y-3 rounded-md border bg-muted/50 p-3',
											errors[`receipt-rp-${rp.id}`] && 'border-destructive ring-1 ring-destructive/40'
										)}
										data-testid="received-payment"
									>
										<div class="flex items-center justify-between">
											<p class="text-sm text-muted-foreground">Payment {rpIndex + 1}</p>
											<ScanRowActions
												rowLabel="Payment {rpIndex + 1}"
												canMerge={rpIndex > 0}
												canSplit={rp.receipts.length > 1}
												canRemove={true}
												onMerge={() =>
													updateInvestor(si.investor.id, (row) => ({
														...row,
														receivedPayments: mergeRowWithPrevious(
															row.receivedPayments,
															rpIndex,
															receivedAdapter(row)
														)
													}))}
												onSplit={() =>
													updateInvestor(si.investor.id, (row) => ({
														...row,
														receivedPayments: splitRowAt(
															row.receivedPayments,
															rpIndex,
															receivedAdapter(row)
														)
													}))}
												onRemove={() => removeReceivedPayment(si.investor.id, rp.id)}
												disabled={isSubmitting}
											/>
										</div>
										<div class="grid gap-3 sm:grid-cols-2">
											<div class="space-y-2">
												<Label for="rp-amount-{rp.id}">Amount</Label>
												<Input
													id="rp-amount-{rp.id}"
													type="number"
													min="0"
													step="0.01"
													value={rp.amount}
													disabled={isSubmitting}
													oninput={(e) =>
														updateReceivedPayment(
															si.investor.id,
															rp.id,
															'amount',
															e.currentTarget.value
														)}
												/>
											</div>
											<div class="space-y-2">
												<Label for="rp-date-{rp.id}">Received Date</Label>
												<Input
													id="rp-date-{rp.id}"
													type="date"
													value={rp.receivedDate}
													disabled={isSubmitting}
													oninput={(e) =>
														updateReceivedPayment(
															si.investor.id,
															rp.id,
															'receivedDate',
															e.currentTarget.value
														)}
												/>
											</div>
										</div>

										<PaymentNotesField
											id="rp-notes-{rp.id}"
											value={rp.notes}
											disabled={isSubmitting}
											onChange={(notes) =>
												updateReceivedPaymentFields(si.investor.id, rp.id, { notes })}
										/>

										<ReceiptUploadField
											fieldId="receipt-rp-{rp.id}"
											idPrefix="rp-{rp.id}"
											receipts={rp.receipts}
											showReading={!rp.scan}
											required={Number.parseFloat(rp.amount) > 0}
											error={errors[`receipt-rp-${rp.id}`]}
											disabled={isSubmitting}
											onChange={(receipts) =>
												updateReceivedPaymentFields(si.investor.id, rp.id, { receipts })}
											onExtracted={(extracted) =>
												handleReceivedReceiptExtracted(si.investor.id, rp.id, extracted)}
											scanContext={scanContextFor('received_payment')}
											onSplitRequest={(scanned) => splitReceivedFromScan(si, rp.id, scanned)}
										/>

										<ScanRowNotes scan={rp.scan} />
									</div>
								{/each}

								<Button
									type="button"
									variant="outline"
									size="sm"
									class="w-full"
									disabled={isSubmitting}
									onclick={() => addReceivedPayment(si.investor.id)}
								>
									<Plus class="mr-2 h-4 w-4" />
									Add payment
								</Button>

								<ReceiptIntake
									variant="compact"
									context={scanContextFor('received_payment')}
									lenders={lenderOf(si)}
									defaultInvestorId={si.investor.id}
									currentLoanId={existingLoan?.id ?? null}
									onCreate={(proposals) => addReceivedFromReceipts(si.investor.id, proposals)}
									disabled={isSubmitting}
								/>
							</div>
						</Tabs.Content>
					</Tabs.Root>
				</div>
			{/each}
		</Card.Content>
	</Card.Root>

	{#if selectedInvestors.length > 0}
		<Collapsible.Root open>
			<Card.Root>
				<Card.Content class="p-6">
					<Collapsible.Trigger class="group flex w-full items-center justify-between p-0">
						<h4 class="text-base font-medium tracking-tight">Loan Preview</h4>
						<ChevronDown
							class="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180"
						/>
					</Collapsible.Trigger>
					<Collapsible.Content class="mt-2">
						<LoanInvestorsSection
							{investorsWithTransactions}
							title=""
							showEmail={false}
							showPeriodStatus={false}
						/>
					</Collapsible.Content>
				</Card.Content>
			</Card.Root>
		</Collapsible.Root>
	{/if}

	<LoanSummarySection
		totalPrincipal={loanSummary.totalCapital}
		averageRate={loanSummary.averageRate}
		totalInterest={loanSummary.totalInterest}
		totalAmount={loanSummary.totalAmount}
		totalReceived={loanSummary.totalReceived}
		totalBalance={loanSummary.totalBalance}
		uniqueInvestors={loanSummary.uniqueInvestors}
		borrowerCount={borrowerId ? 1 : 0}
		balance={loanSummary.balance}
	/>

	<LoanContractDraftPreview
		draft={contractDraft}
		customization={contractCustomization}
		preserveCustomization={Boolean(
			duplicateData?.contractCustomization || existingLoan?.loanContract?.customization
		)}
		borrowers={borrowerList}
		investors={investorList}
		onCustomizationChange={(next) => (contractCustomization = next)}
	/>

	<FormActions
		onCancel={handleCancel}
		{formId}
		{isSubmitting}
		submitDisabled={submitBlocked}
		error={submitError}
		submitLabel={submitButtonLabel}
		layout={isModalMode ? 'stacked' : 'responsive'}
		class={isModalMode ? 'md:hidden' : 'lg:hidden'}
	/>
</form>

<BorrowerFormModal
	open={showBorrowerModal}
	onOpenChange={(open) => (showBorrowerModal = open)}
	onSuccess={handleBorrowerCreated}
/>

<InvestorFormModal
	open={showInvestorModal}
	onOpenChange={(open) => (showInvestorModal = open)}
	onSuccess={handleInvestorCreated}
/>

{#if copySourceInvestor && copySourceInvestorConfig}
	<CopyInvestorModal
		open={copySourceInvestorId !== null}
		onOpenChange={(open) => {
			if (!open) copySourceInvestorId = null;
		}}
		sourceInvestor={copySourceInvestor}
		sourceInvestorConfig={copySourceInvestorConfig}
		availableInvestors={availableInvestorsForCopy}
		selectedInvestorIds={selectedInvestors.map((allocation) => allocation.investor.id)}
		{selectedInvestorsConfigs}
		onCopy={handleCopyConfirm}
	/>
{/if}
