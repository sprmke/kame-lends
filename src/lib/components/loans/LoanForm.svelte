<script lang="ts">
	import { goto } from '$app/navigation';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Select from '$lib/components/ui/select';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import MultipleInterestManager from '$lib/components/loans/MultipleInterestManager.svelte';
	import BorrowerFormModal from '$lib/components/borrowers/BorrowerFormModal.svelte';
	import InvestorFormModal from '$lib/components/investors/InvestorFormModal.svelte';
	import FormHeader from '$lib/components/common/FormHeader.svelte';
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
	import LoanSigningSection from '$lib/components/loans/LoanSigningSection.svelte';
	import { downloadLoanContractPdf } from '$lib/pdf-download';
	import type { ContractCustomization } from '$lib/loan-contract-customization';
	import * as Collapsible from '$lib/components/ui/collapsible';
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
	import { ChevronDown, Copy, MoreVertical, Plus, Trash2, UserPlus } from 'lucide-svelte';

	interface Props {
		investors?: Investor[];
		borrowers?: Borrower[];
		preselectedInvestorId?: number;
		duplicateData?: DuplicateLoanData | null;
		existingLoan?: LoanWithInvestors;
		cancelHref?: string;
		onSuccess?: () => void | Promise<void>;
		onCancel?: () => void;
	}

	let {
		investors = [],
		borrowers: initialBorrowers = [],
		preselectedInvestorId,
		duplicateData = null,
		existingLoan,
		cancelHref = '/loans',
		onSuccess,
		onCancel
	}: Props = $props();

	const isEditMode = $derived(Boolean(existingLoan));

	let borrowerList = $state<Borrower[]>([...initialBorrowers]);
	let investorList = $state<Investor[]>([...investors]);
	let showBorrowerModal = $state(false);
	let showInvestorModal = $state(false);
	let copySourceInvestorId = $state<number | null>(null);
	let formRef = $state<HTMLFormElement | null>(null);
	let borrowerSelectValue = $state(
		duplicateData?.borrowerId ? String(duplicateData.borrowerId) : ''
	);

	const loanTypes: LoanType[] = ['Lot Title', 'OR/CR', 'Agent'];

	function createReceivedPayment(): LoanFormReceivedPayment {
		return {
			id: `rp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
			amount: '',
			receivedDate: toLocalDateString(new Date())
		};
	}

	function createTransaction(): LoanFormTransaction {
		return {
			id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
			amount: '',
			sentDate: toLocalDateString(new Date()),
			interestType: 'rate',
			interestRate: '10',
			interestAmount: '',
			isPaid: true
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
	let isSubmitting = $state(false);
	let errors = $state<Record<string, string>>({});
	let initializedFromDuplicate = $state(false);
	let contractCustomization = $state<ContractCustomization | null>(
		(existingLoan?.loanContract?.customization as ContractCustomization | undefined) ??
			duplicateData?.contractCustomization ??
			null
	);

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
		const balance = totalAmount - totalReceived;
		if (totalAmount > 0 && balance <= 0.01) return 'Completed';

		if (dueDate) {
			const today = getTodayAtMidnight();
			const due = normalizeToMidnight(dueDate);
			if (today >= due) return 'Overdue';
		}

		return 'Fully Funded';
	}

	function addInvestor(investorId: string) {
		if (!investorId || investorId === 'placeholder') return;
		const investor = investorList.find((inv) => String(inv.id) === investorId);
		if (!investor || selectedInvestors.some((si) => si.investor.id === investor.id)) return;

		selectedInvestors = [
			...selectedInvestors,
			{
				investor,
				transactions: [createTransaction()],
				receivedPayments: [],
				hasMultipleInterest: false,
				interestPeriods: []
			}
		];
		investorSelectValue = '';
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

	function addTransaction(investorId: number) {
		selectedInvestors = selectedInvestors.map((si) =>
			si.investor.id === investorId
				? { ...si, transactions: [...si.transactions, createTransaction()] }
				: si
		);
	}

	function removeTransaction(investorId: number, transactionId: string) {
		selectedInvestors = selectedInvestors.map((si) => {
			if (si.investor.id !== investorId || si.transactions.length <= 1) return si;
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
		field: keyof LoanFormReceivedPayment,
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

	function receivedTotalForInvestor(si: SelectedInvestorAllocation): number {
		return si.receivedPayments.reduce((sum, rp) => sum + (parseFloat(rp.amount) || 0), 0);
	}

	function receivedExceedsMax(si: SelectedInvestorAllocation): boolean {
		const totalDue = estimateInvestorTotal(si);
		if (totalDue <= 0) return false;
		return receivedTotalForInvestor(si) > totalDue + 0.01;
	}

	function validate() {
		const next: Record<string, string> = {};
		if (!loanName.trim()) next.loanName = 'Loan name is required';
		if (!dueDate) next.dueDate = 'Due date is required';
		if (!borrowerId) next.borrowerId = 'Borrower is required';
		if (selectedInvestors.length === 0) next.investors = 'At least one investor is required';

		for (const si of selectedInvestors) {
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

		errors = next;
		return Object.keys(next).length === 0;
	}

	function buildInvestorPayload() {
		const investorData: Array<{
			investorId: number;
			amount: string;
			interestRate: string;
			interestType: 'rate' | 'fixed';
			sentDate: string;
			isPaid: boolean;
			hasMultipleInterest: boolean;
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
					interestPeriods
				});
			}
		}

		return investorData;
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		if (!validate()) return;

		isSubmitting = true;
		try {
			const url = isEditMode ? `/api/loans/${existingLoan!.id}` : '/api/loans';
			const method = isEditMode ? 'PUT' : 'POST';

			const response = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
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
						receivedPayments: si.receivedPayments.map((rp) => ({
							amount: rp.amount,
							receivedDate: rp.receivedDate
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
				await onSuccess();
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
		borrowerSelectValue = value;
		borrowerId = value;
	}

	function handleBorrowerCreated(borrower: Borrower) {
		borrowerList = [...borrowerList.filter((item) => item.id !== borrower.id), borrower].sort(
			(a, b) => a.name.localeCompare(b.name)
		);
		borrowerId = String(borrower.id);
		borrowerSelectValue = String(borrower.id);
	}

	$effect(() => {
		if (initialBorrowers.length === 0 && !existingLoan?.borrower) return;
		const merged = new Map<number, Borrower>();
		for (const borrower of initialBorrowers) merged.set(borrower.id, borrower);
		if (existingLoan?.borrower) merged.set(existingLoan.borrower.id, existingLoan.borrower);
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

<form bind:this={formRef} class="dashboard-form max-w-4xl" onsubmit={handleSubmit}>
	<FormHeader
		title={formTitle}
		description={formDescription}
		onCancel={handleCancel}
		onSubmit={handleFormSubmit}
		{isSubmitting}
		{isEditMode}
		submitLabel={submitButtonLabel}
	/>

	<Card.Root>
		<Card.Header>
			<Card.Title class="text-lg sm:text-xl">Loan Details</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="grid gap-4 sm:grid-cols-2">
				<div class="space-y-2">
					<Label for="borrowerId">Borrower *</Label>
					<Select.Root
						type="single"
						value={borrowerSelectValue}
						onValueChange={handleBorrowerSelect}
						disabled={isSubmitting}
					>
						<Select.Trigger id="borrowerId" class="w-full">
							{borrowerList.find((b) => String(b.id) === borrowerId)?.name ??
								'Select a borrower...'}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="new" class="font-medium text-primary">
								<span class="flex items-center gap-2">
									<UserPlus class="h-4 w-4" />
									Add New Borrower
								</span>
							</Select.Item>
							{#if borrowerList.length > 0}
								<div class="my-1 h-px bg-border"></div>
							{/if}
							{#each borrowerList as borrower}
								<Select.Item value={String(borrower.id)}>{borrower.name}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					{#if errors.borrowerId}<p class="text-sm text-destructive">{errors.borrowerId}</p>{/if}
				</div>
				<div class="space-y-2">
					<Label for="loanName">Loan Name / Label *</Label>
					<Input
						id="loanName"
						bind:value={loanName}
						disabled={isSubmitting}
						placeholder="e.g., Mexico, Pampanga"
						required
					/>
					{#if errors.loanName}<p class="text-sm text-destructive">{errors.loanName}</p>{/if}
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
				<div class="space-y-2">
					<Label for="dueDate">Due Date *</Label>
					<Input id="dueDate" type="date" bind:value={dueDate} disabled={isSubmitting} />
					{#if errors.dueDate}<p class="text-sm text-destructive">{errors.dueDate}</p>{/if}
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
		</Card.Content>
	</Card.Root>

	<Card.Root id="investors-section">
		<Card.Header>
			<Card.Title class="text-lg sm:text-xl">Investors</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="space-y-3">
				<Label>Add Investor</Label>
				<Select.Root
					type="single"
					value={investorSelectValue}
					onValueChange={handleInvestorSelect}
					disabled={isSubmitting}
				>
					<Select.Trigger class="w-full">
						{investorSelectValue
							? (investorList.find((inv) => String(inv.id) === investorSelectValue)?.name ??
								'Select an investor...')
							: 'Select an investor...'}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="new" class="font-medium text-primary">
							<span class="flex items-center gap-2">
								<UserPlus class="h-4 w-4" />
								Add New Investor
							</span>
						</Select.Item>
						{#if availableInvestors.length > 0}
							<div class="my-1 h-px bg-border"></div>
						{/if}
						{#each availableInvestors as investor}
							<Select.Item value={String(investor.id)}>{investor.name}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>

			{#if errors.investors}<p class="text-sm text-destructive">{errors.investors}</p>{/if}

			{#if selectedInvestors.length === 0}
				<p class="py-4 text-center text-muted-foreground">No investors added yet</p>
			{/if}

			{#each selectedInvestors as si (si.investor.id)}
				{@const primaryTransaction = si.transactions[0]}
				{@const investorTotalDue = estimateInvestorTotal(si)}
				{@const investorReceivedTotal = receivedTotalForInvestor(si)}
				<div class="space-y-4 rounded-lg border p-4">
					<div class="flex items-center justify-between gap-3">
						<p class="font-medium">{si.investor.name}</p>
						<div class="flex items-center gap-1">
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									{#snippet child({ props })}
										<Button
											{...props}
											type="button"
											variant="ghost"
											size="sm"
											disabled={isSubmitting}
											title="Actions"
										>
											<MoreVertical class="h-4 w-4" />
										</Button>
									{/snippet}
								</DropdownMenu.Trigger>
								<DropdownMenu.Content align="end">
									<DropdownMenu.Item onclick={() => handleCopy(si.investor.id)}>
										<Copy class="mr-2 h-4 w-4" />
										Copy
									</DropdownMenu.Item>
								</DropdownMenu.Content>
							</DropdownMenu.Root>
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

					<Tabs.Root value="principal" class="w-full">
						<Tabs.List class="grid h-9 w-full grid-cols-2">
							<Tabs.Trigger value="principal" class="text-xs sm:text-sm">
								Principal Disbursement
							</Tabs.Trigger>
							<Tabs.Trigger value="received" class="text-xs sm:text-sm">
								Received Payments
							</Tabs.Trigger>
						</Tabs.List>

						<Tabs.Content value="principal" class="mt-3 space-y-4">
							{#each si.transactions as transaction, txIndex (transaction.id)}
								<div class="space-y-3 rounded-md bg-muted/30 p-3">
									<div class="flex items-center justify-between">
										<p class="text-sm text-muted-foreground">Transaction {txIndex + 1}</p>
										{#if si.transactions.length > 1}
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onclick={() => removeTransaction(si.investor.id, transaction.id)}
											>
												<Trash2 class="h-3 w-3" />
											</Button>
										{/if}
									</div>

									<div class="grid gap-3 sm:grid-cols-3">
										<div class="space-y-2">
											<Label>Principal</Label>
											<Input
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
										<div class="space-y-2">
											<Label>Sent Date</Label>
											<Input
												type="date"
												value={transaction.sentDate}
												disabled={isSubmitting}
												oninput={(e) =>
													updateTransaction(
														si.investor.id,
														transaction.id,
														'sentDate',
														e.currentTarget.value
													)}
											/>
										</div>
										<div class="flex items-end gap-2 pb-2">
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
											<Label for={`paid-${transaction.id}`} class="text-sm">Disbursed</Label>
										</div>
									</div>

									{#if !si.hasMultipleInterest}
										<Tabs.Root
											value={transaction.interestType}
											onValueChange={(value) =>
												updateTransaction(
													si.investor.id,
													transaction.id,
													'interestType',
													value as 'rate' | 'fixed'
												)}
										>
											<Tabs.List class="grid h-8 w-full max-w-xs grid-cols-2">
												<Tabs.Trigger value="rate" class="text-xs">Rate (%)</Tabs.Trigger>
												<Tabs.Trigger value="fixed" class="text-xs">Fixed (₱)</Tabs.Trigger>
											</Tabs.List>
											<Tabs.Content value="rate" class="mt-2 max-w-xs">
												<Input
													type="number"
													step="0.01"
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
											<Tabs.Content value="fixed" class="mt-2 max-w-xs">
												<Input
													type="number"
													step="0.01"
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
									{/if}
								</div>
							{/each}

							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={isSubmitting}
								onclick={() => addTransaction(si.investor.id)}
							>
								<Plus class="mr-2 h-4 w-4" />
								Add Transaction
							</Button>

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
									<div class="space-y-3 rounded-md border bg-muted/50 p-3">
										<div class="flex items-center justify-between">
											<p class="text-sm text-muted-foreground">Payment {rpIndex + 1}</p>
											{#if si.receivedPayments.length > 1}
												<Button
													type="button"
													variant="ghost"
													size="sm"
													disabled={isSubmitting}
													onclick={() => removeReceivedPayment(si.investor.id, rp.id)}
												>
													<Trash2 class="h-3 w-3" />
												</Button>
											{/if}
										</div>
										<div class="grid gap-3 sm:grid-cols-2">
											<div class="space-y-2">
												<Label>Amount</Label>
												<Input
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
												<Label>Received Date</Label>
												<Input
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
									Add received payment
								</Button>
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
				<Card.Content class="p-3">
					<Collapsible.Trigger class="group flex w-full items-center justify-between p-0">
						<h4 class="text-lg font-bold tracking-tight sm:text-xl">Loan Preview</h4>
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

		<LoanSummarySection
			totalPrincipal={loanSummary.totalCapital}
			averageRate={loanSummary.averageRate}
			totalInterest={loanSummary.totalInterest}
			totalAmount={loanSummary.totalAmount}
			totalReceived={loanSummary.totalReceived}
			totalBalance={loanSummary.totalBalance}
			uniqueInvestors={loanSummary.uniqueInvestors}
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
	{/if}

	{#if isEditMode && existingLoan}
		<LoanSigningSection loanId={existingLoan.id} />
	{/if}

	<div class="flex flex-col gap-3 sm:flex-row">
		<Button
			type="button"
			variant="outline"
			class="flex-1"
			disabled={isSubmitting}
			onclick={handleCancel}
		>
			Cancel
		</Button>
		<Button type="submit" class="flex-1" disabled={isSubmitting}>
			{isSubmitting
				? isEditMode
					? 'Updating...'
					: 'Creating...'
				: isEditMode
					? 'Update Loan'
					: duplicateData
						? 'Duplicate Loan'
						: 'Create Loan'}
		</Button>
	</div>
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
