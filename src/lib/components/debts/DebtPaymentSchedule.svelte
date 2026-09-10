<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import { toast } from '$lib/toast';
	import { formatCurrency, formatDateShort } from '$lib/format';
	import { getInterestPeriodStatusBadge } from '$lib/badge-config';
	import { toLocalDateString } from '$lib/date-utils';
	import type { InterestPeriodStatus } from '$lib/types';
	import type { DebtInterestPeriodWithPayments } from '$lib/types';
	import type { InterestScheduleEntry } from '$lib/debt-calculations';
	import { cn } from '$lib/utils';
	import { Calendar, Check, Loader2, Pencil, Trash2 } from 'lucide-svelte';

	interface CompleteModalState {
		periodId: number;
		amount: string;
		receivedDate: string;
		expectedAmount: number;
	}

	interface EditPaymentModalState {
		periodId: number;
		mode: 'single' | 'consolidate';
		paymentId: number | null;
		amount: string;
		receivedDate: string;
		expectedAmount: number;
	}

	interface Props {
		schedule: InterestScheduleEntry[];
		interestPeriods: DebtInterestPeriodWithPayments[];
		onPaymentsChange?: () => void | Promise<void>;
	}

	let { schedule, interestPeriods, onPaymentsChange }: Props = $props();

	let completeModal = $state<CompleteModalState | null>(null);
	let editPaymentModal = $state<EditPaymentModalState | null>(null);
	let completingPeriods = $state(new Set<number>());
	let editingPaymentPeriodIds = $state(new Set<number>());
	let deletingPaymentIds = $state(new Set<number>());

	const periodByNumber = $derived(
		new Map(interestPeriods.map((period) => [period.periodNumber, period]))
	);

	function dateForPickerInput(receivedDate: string): string {
		if (/^\d{4}-\d{2}-\d{2}$/.test(receivedDate)) return receivedDate;
		return toLocalDateString(new Date(receivedDate));
	}

	function sumLinkedPayments(period: DebtInterestPeriodWithPayments | undefined): number {
		if (!period?.receivedPayments?.length) return 0;
		return period.receivedPayments.reduce(
			(sum, payment) => sum + (parseFloat(payment.amount) || 0),
			0
		);
	}

	function openCompleteModal(
		periodId: number,
		periodDueAmount: number,
		suggestedPaymentAmount: number
	) {
		completeModal = {
			periodId,
			amount: Math.max(0, suggestedPaymentAmount).toFixed(2),
			receivedDate: toLocalDateString(new Date()),
			expectedAmount: periodDueAmount
		};
	}

	async function handleCompletePeriod() {
		if (!completeModal) return;
		const { periodId, amount, receivedDate } = completeModal;
		const trimmedDate = receivedDate?.trim() ?? '';
		const parsed = parseFloat(amount);
		if (!Number.isFinite(parsed) || parsed <= 0) {
			toast.error('Enter a valid received amount.');
			return;
		}
		if (!trimmedDate) {
			toast.error('Choose a received date.');
			return;
		}

		completingPeriods = new Set([...completingPeriods, periodId]);
		try {
			const response = await fetch(`/api/debt-interest-periods/${periodId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					status: 'Completed',
					receivedAmount: parsed,
					receivedDate: trimmedDate
				})
			});
			const data = await response.json().catch(() => ({}));
			if (!response.ok) {
				toast.error(
					typeof data.error === 'string'
						? data.error
						: 'Could not record this payment. Please try again.'
				);
				return;
			}
			if (data.status === 'Incomplete') {
				toast.success('Partial payment recorded.');
			} else {
				toast.success('Payment recorded.');
			}
			completeModal = null;
			await onPaymentsChange?.();
		} catch (error) {
			console.error('Error completing debt period:', error);
			toast.error('Could not record this payment. Please try again.');
		} finally {
			const next = new Set(completingPeriods);
			next.delete(periodId);
			completingPeriods = next;
		}
	}

	function openEditPaymentModal(
		periodId: number,
		periodDueAmount: number,
		linkedRows: DebtInterestPeriodWithPayments['receivedPayments']
	) {
		const today = toLocalDateString(new Date());
		if (linkedRows.length === 0) {
			editPaymentModal = {
				periodId,
				mode: 'consolidate',
				paymentId: null,
				amount: periodDueAmount.toFixed(2),
				receivedDate: today,
				expectedAmount: periodDueAmount
			};
			return;
		}
		const sum = linkedRows.reduce((total, row) => total + (parseFloat(row.amount) || 0), 0);
		const last = linkedRows[linkedRows.length - 1];
		const single = linkedRows.length === 1;
		editPaymentModal = {
			periodId,
			mode: single ? 'single' : 'consolidate',
			paymentId: single ? linkedRows[0].id : null,
			amount: sum.toFixed(2),
			receivedDate: dateForPickerInput(String(last.receivedDate)),
			expectedAmount: periodDueAmount
		};
	}

	async function handleEditPaymentSave() {
		if (!editPaymentModal) return;
		const { periodId, mode, paymentId, amount, receivedDate } = editPaymentModal;
		const trimmedDate = receivedDate?.trim() ?? '';
		const parsed = parseFloat(amount);
		if (!Number.isFinite(parsed) || parsed <= 0) {
			toast.error('Enter a valid received amount.');
			return;
		}
		if (!trimmedDate) {
			toast.error('Choose a received date.');
			return;
		}

		editingPaymentPeriodIds = new Set([...editingPaymentPeriodIds, periodId]);
		try {
			const response =
				mode === 'single' && paymentId != null
					? await fetch(`/api/debt-received-payments/${paymentId}`, {
							method: 'PATCH',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ amount: parsed, receivedDate: trimmedDate })
						})
					: await fetch(`/api/debt-interest-periods/${periodId}/consolidate-payment`, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ amount: parsed, receivedDate: trimmedDate })
						});
			const data = await response.json().catch(() => ({}));
			if (!response.ok) {
				toast.error(typeof data.error === 'string' ? data.error : 'Could not update payment.');
				return;
			}
			toast.success('Payment updated.');
			editPaymentModal = null;
			await onPaymentsChange?.();
		} catch (error) {
			console.error('Error updating debt payment:', error);
			toast.error('Could not update payment.');
		} finally {
			const next = new Set(editingPaymentPeriodIds);
			next.delete(periodId);
			editingPaymentPeriodIds = next;
		}
	}

	async function handleDeleteReceivedPayment(paymentId: number) {
		if (!window.confirm('Remove this payment record?')) return;

		deletingPaymentIds = new Set([...deletingPaymentIds, paymentId]);
		try {
			const response = await fetch(`/api/debt-received-payments/${paymentId}`, {
				method: 'DELETE'
			});
			if (!response.ok) {
				toast.error('Could not remove payment.');
				return;
			}
			toast.success('Payment removed.');
			await onPaymentsChange?.();
		} catch (error) {
			console.error('Error deleting debt payment:', error);
			toast.error('Could not remove payment.');
		} finally {
			const next = new Set(deletingPaymentIds);
			next.delete(paymentId);
			deletingPaymentIds = next;
		}
	}
</script>

<div class="space-y-2">
	<div class="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
		<Calendar class="h-4 w-4" />
		Payment schedule
	</div>
	<div class="max-h-96 space-y-2 overflow-y-auto pr-1">
		{#each schedule as entry (entry.period)}
			{@const period = periodByNumber.get(entry.period)}
			{@const periodStatus = (period?.status ?? 'Pending') as InterestPeriodStatus}
			{@const statusBadge = getInterestPeriodStatusBadge(periodStatus)}
			{@const periodDueAmount = parseFloat(period?.expectedInterest ?? '') || entry.periodDue}
			{@const paidLinked = sumLinkedPayments(period)}
			{@const remainingDue = Math.max(0, periodDueAmount - paidLinked)}
			{@const linkedRows = period?.receivedPayments ?? []}
			{@const canComplete =
				!!onPaymentsChange &&
				!!period &&
				(periodStatus === 'Pending' || periodStatus === 'Overdue' || periodStatus === 'Incomplete')}
			{@const canEditPayment =
				!!onPaymentsChange && !!period && periodStatus === 'Completed'}
			<div class="space-y-2 rounded-lg border bg-background p-3 text-sm">
				<div class="flex items-start justify-between gap-3">
					<div class="flex min-w-0 items-center gap-2">
						<span class="w-7 shrink-0 text-muted-foreground">#{entry.period}</span>
						<span class="shrink-0">
							{entry.date.toLocaleDateString('en-US', {
								month: 'short',
								day: 'numeric',
								year: 'numeric'
							})}
						</span>
						{#if period}
							<Badge
								variant={statusBadge.variant}
								class={cn('h-4 text-[10px]', statusBadge.className)}
							>
								{periodStatus}
							</Badge>
						{/if}
					</div>
					<div class="min-w-0 text-right text-sm leading-snug tabular-nums">
						<span class="text-base font-semibold">{formatCurrency(entry.periodDue)}</span>
						<span class="text-muted-foreground">
							·
							{formatCurrency(entry.principalPortion)} principal ·
						</span>
						<span class="text-chart-2">{formatCurrency(entry.interest)} interest</span>
						{#if entry.feesPortion > 0}
							<span class="text-muted-foreground">
								·
								{formatCurrency(entry.feesPortion)} fees
							</span>
						{/if}
					</div>
				</div>

				{#if period}
					<div class="grid grid-cols-2 gap-x-3 gap-y-2 text-sm sm:grid-cols-3">
						<div>
							<p class="text-[11px] text-muted-foreground">Amount due</p>
							<p class="font-semibold tabular-nums">{formatCurrency(periodDueAmount)}</p>
						</div>
						<div>
							<p class="text-[11px] text-muted-foreground">Amount paid</p>
							<p class="font-semibold text-chart-2 tabular-nums">
								{formatCurrency(paidLinked)}
							</p>
						</div>
						<div>
							<p class="text-[11px] text-muted-foreground">Received date</p>
							<p class="font-medium tabular-nums">
								{linkedRows.length > 0
									? linkedRows.map((row) => formatDateShort(String(row.receivedDate))).join(', ')
									: '—'}
							</p>
						</div>
					</div>
				{/if}

				{#if period && paidLinked > 0 && periodStatus !== 'Completed'}
					<p class="text-[11px] text-muted-foreground">
						<span class="font-medium text-foreground tabular-nums"
							>{formatCurrency(remainingDue)}</span
						>
						remaining (of {formatCurrency(periodDueAmount)})
					</p>
				{/if}

				{#if linkedRows.length > 0}
					<div class="space-y-1.5">
						{#each linkedRows as payment (payment.id)}
							<div
								class="flex items-center gap-2 rounded-md border border-chart-2/25 bg-muted/20 px-2 py-1.5 text-xs dark:border-chart-2/30"
							>
								<div class="flex min-w-0 flex-1 justify-between gap-2">
									<span class="truncate text-muted-foreground">
										{formatDateShort(String(payment.receivedDate))}
									</span>
									<span
										class="shrink-0 font-semibold text-chart-2 tabular-nums"
									>
										{formatCurrency(parseFloat(payment.amount) || 0)}
									</span>
								</div>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									class="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
									aria-label="Remove payment"
									disabled={deletingPaymentIds.has(payment.id)}
									onclick={() => handleDeleteReceivedPayment(payment.id)}
								>
									{#if deletingPaymentIds.has(payment.id)}
										<Loader2 class="h-3.5 w-3.5 animate-spin" />
									{:else}
										<Trash2 class="h-3.5 w-3.5" />
									{/if}
								</Button>
							</div>
						{/each}
					</div>
				{/if}

				{#if canComplete}
					<Button
						type="button"
						size="sm"
						variant="outline"
						class="h-8 w-full bg-background text-xs"
						disabled={completingPeriods.has(period.id)}
						onclick={() =>
							openCompleteModal(
								period.id,
								periodDueAmount,
								remainingDue > 0 ? remainingDue : periodDueAmount
							)}
					>
						{#if periodStatus === 'Incomplete'}
							<Pencil class="mr-1.5 h-3 w-3" />
						{:else}
							<Check class="mr-1.5 h-3 w-3" />
						{/if}
						{completingPeriods.has(period.id)
							? 'Recording…'
							: periodStatus === 'Incomplete'
								? 'More payment'
								: 'Record payment'}
					</Button>
				{/if}

				{#if canEditPayment}
					<Button
						type="button"
						size="sm"
						variant="outline"
						class="h-8 w-full bg-background text-xs"
						disabled={editingPaymentPeriodIds.has(period.id)}
						onclick={() => openEditPaymentModal(period.id, periodDueAmount, linkedRows)}
					>
						<Pencil class="mr-1.5 h-3 w-3" />
						{editingPaymentPeriodIds.has(period.id) ? 'Saving…' : 'Edit payment'}
					</Button>
				{/if}
			</div>
		{/each}
	</div>
</div>

<ResponsiveModal
	open={completeModal !== null}
	onOpenChange={(open) => !open && (completeModal = null)}
	title="Record payment"
	contentClass="sm:max-w-md"
>
	{#snippet footer()}
		<Button
			type="button"
			variant="outline"
			disabled={!!completeModal && completingPeriods.has(completeModal.periodId)}
			onclick={() => (completeModal = null)}
		>
			Cancel
		</Button>
		<Button
			type="button"
			disabled={!completeModal ||
				!completeModal.amount?.trim() ||
				!completeModal.receivedDate?.trim() ||
				completingPeriods.has(completeModal.periodId)}
			onclick={handleCompletePeriod}
		>
			{#if completeModal && completingPeriods.has(completeModal.periodId)}
				<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				Saving…
			{:else}
				Confirm
			{/if}
		</Button>
	{/snippet}
	{#if completeModal}
		<div class="space-y-4 py-2">
			<div class="space-y-2">
				<Label for="debt-received-amount">Received amount</Label>
				<Input
					id="debt-received-amount"
					type="number"
					step="0.01"
					value={completeModal.amount}
					oninput={(e) => {
						if (completeModal) {
							completeModal = { ...completeModal, amount: e.currentTarget.value };
						}
					}}
				/>
				<p class="text-[11px] text-muted-foreground">
					Due for this period: {formatCurrency(completeModal.expectedAmount)}
				</p>
			</div>
			<div class="space-y-2">
				<Label for="debt-received-date">Received date</Label>
				<Input
					id="debt-received-date"
					type="date"
					value={completeModal.receivedDate}
					oninput={(e) => {
						if (completeModal) {
							completeModal = { ...completeModal, receivedDate: e.currentTarget.value };
						}
					}}
				/>
			</div>
		</div>
	{/if}
</ResponsiveModal>

<ResponsiveModal
	open={editPaymentModal !== null}
	onOpenChange={(open) => !open && (editPaymentModal = null)}
	title="Edit payment"
	description={editPaymentModal?.mode === 'consolidate'
		? 'Replaces all payment lines for this period with one entry.'
		: undefined}
	contentClass="sm:max-w-md"
>
	{#snippet footer()}
		<Button
			type="button"
			variant="outline"
			disabled={!!editPaymentModal && editingPaymentPeriodIds.has(editPaymentModal.periodId)}
			onclick={() => (editPaymentModal = null)}
		>
			Cancel
		</Button>
		<Button
			type="button"
			disabled={!editPaymentModal ||
				!editPaymentModal.amount?.trim() ||
				!editPaymentModal.receivedDate?.trim() ||
				editingPaymentPeriodIds.has(editPaymentModal.periodId)}
			onclick={handleEditPaymentSave}
		>
			{#if editPaymentModal && editingPaymentPeriodIds.has(editPaymentModal.periodId)}
				<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				Saving…
			{:else}
				Save
			{/if}
		</Button>
	{/snippet}
	{#if editPaymentModal}
		<div class="space-y-4 py-2">
			<div class="space-y-2">
				<Label for="debt-edit-received-amount">Received amount</Label>
				<Input
					id="debt-edit-received-amount"
					type="number"
					step="0.01"
					value={editPaymentModal.amount}
					oninput={(e) => {
						if (editPaymentModal) {
							editPaymentModal = { ...editPaymentModal, amount: e.currentTarget.value };
						}
					}}
				/>
				<p class="text-[11px] text-muted-foreground">
					Due for this period: {formatCurrency(editPaymentModal.expectedAmount)}
				</p>
			</div>
			<div class="space-y-2">
				<Label for="debt-edit-received-date">Received date</Label>
				<Input
					id="debt-edit-received-date"
					type="date"
					value={editPaymentModal.receivedDate}
					oninput={(e) => {
						if (editPaymentModal) {
							editPaymentModal = { ...editPaymentModal, receivedDate: e.currentTarget.value };
						}
					}}
				/>
			</div>
		</div>
	{/if}
</ResponsiveModal>
