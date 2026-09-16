<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import CreateGroupReviewStep, {
		type WizardTelegramDraft
	} from '$lib/components/groups/CreateGroupReviewStep.svelte';
	import GroupBadgeList from '$lib/components/groups/GroupBadgeList.svelte';
	import GroupColorSwatches from '$lib/components/groups/GroupColorSwatches.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import MultiSelectFilter from '$lib/components/common/MultiSelectFilter.svelte';
	import { nextGroupColor, resolveGroupColor, type GroupColorKey } from '$lib/groups/group-colors';
	import { resolveWizardContactLoanIds } from '$lib/groups/group-list-map';
	import type {
		AccessPreviewData,
		WizardContactOption,
		WizardLoanRow
	} from '$lib/components/groups/types';
	import { formatCount, formatCurrency, formatDateShort, formatText } from '$lib/format';
	import { toast } from '$lib/toast';
	import { cn } from '$lib/utils';
	import Search from '@lucide/svelte/icons/search';

	const STORAGE_KEY = 'kame:create-group-wizard';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		ownedLoans: WizardLoanRow[];
		usedColorKeys?: string[];
		existingNames?: string[];
		initialLoanIds?: number[];
		initialContact?: WizardContactOption | null;
		contactOptions?: WizardContactOption[];
		contactsReady?: boolean;
		createCalendarAvailable?: boolean;
		telegramStartGroupAvailable?: boolean;
		telegramBotConfigured?: boolean;
		onCreated?: (groupId: number) => void | Promise<void>;
	}

	let {
		open,
		onOpenChange,
		ownedLoans,
		usedColorKeys = [],
		existingNames = [],
		initialLoanIds = [],
		initialContact = null,
		contactOptions = [],
		contactsReady = true,
		createCalendarAvailable = true,
		telegramStartGroupAvailable = false,
		telegramBotConfigured = false,
		onCreated
	}: Props = $props();

	const defaultTelegramDraft = (): WizardTelegramDraft => ({
		chatId: '',
		botToken: '',
		enabled: true,
		notifyUpcoming: true,
		reminderDays: [3, 1],
		notifyDueToday: true,
		notifyOverdue: true,
		notifyDailyDigest: false,
		notifyActivity: true,
		includeAmounts: true,
		connectViaLinkAfterCreate: false
	});

	type StartMode = 'blank' | 'investor' | 'borrower';

	const startFromOptions: { mode: StartMode; label: string }[] = [
		{ mode: 'blank', label: 'None' },
		{ mode: 'investor', label: 'Investor' },
		{ mode: 'borrower', label: 'Borrower' }
	];

	function contactKey(option: WizardContactOption): string {
		return `${option.partyType}:${option.contactId}`;
	}

	function contactsFromKeys(
		keys: string[],
		options: WizardContactOption[]
	): WizardContactOption[] {
		const set = new Set(keys);
		return options.filter((option) => set.has(contactKey(option)));
	}

	function suggestedNameFor(contacts: WizardContactOption[]): string {
		if (contacts.length === 1) return `${contacts[0].name} loans`;
		return '';
	}

	let step = $state<1 | 2 | 3>(1);
	let name = $state('');
	let color = $state<GroupColorKey>('orange');
	let description = $state('');
	let includeInvestors = $state(false);
	let includeBorrowers = $state(false);
	let selectedContactKeys = $state<string[]>([]);
	let addFutureRule = $state(false);
	let selectedLoanIds = $state<number[]>([]);
	let showAllLoans = $state(false);
	let showCompleted = $state(false);
	let loanQuery = $state('');
	let createCalendar = $state(true);
	let telegramDraft = $state<WizardTelegramDraft>(defaultTelegramDraft());
	let preview = $state<AccessPreviewData | null>(null);
	let previewLoading = $state(false);
	let previewError = $state<string | null>(null);
	let isSubmitting = $state(false);
	let submitError = $state<string | null>(null);

	let previewTimer: ReturnType<typeof setTimeout> | undefined;

	function loadDraft() {
		if (typeof sessionStorage === 'undefined') return;
		try {
			const raw = sessionStorage.getItem(STORAGE_KEY);
			if (!raw) return;
			const draft = JSON.parse(raw) as Record<string, unknown>;
			if (typeof draft.step === 'number') step = draft.step as 1 | 2 | 3;
			if (typeof draft.name === 'string') name = draft.name;
			if (typeof draft.color === 'string') color = draft.color as GroupColorKey;
			if (typeof draft.description === 'string') description = draft.description;
			if (Array.isArray(draft.selectedContactKeys)) {
				selectedContactKeys = draft.selectedContactKeys.filter(
					(key) => typeof key === 'string'
				);
			} else if (typeof draft.selectedContactId === 'string' && draft.selectedContactId) {
				selectedContactKeys = [draft.selectedContactId];
			}
			includeInvestors =
				draft.includeInvestors === true ||
				draft.startMode === 'investor' ||
				selectedContactKeys.some((key) => key.startsWith('investor:'));
			includeBorrowers =
				draft.includeBorrowers === true ||
				draft.startMode === 'borrower' ||
				selectedContactKeys.some((key) => key.startsWith('borrower:'));
			if (Array.isArray(draft.selectedLoanIds)) {
				const ids = draft.selectedLoanIds.filter((id) => typeof id === 'number');
				if (selectedContactKeys.length > 0 || step === 2 || step === 3) {
					selectedLoanIds = ids;
				}
			}
			if (typeof draft.addFutureRule === 'boolean') addFutureRule = draft.addFutureRule;
			if (typeof draft.createCalendar === 'boolean') createCalendar = draft.createCalendar;
			if (draft.telegram && typeof draft.telegram === 'object') {
				telegramDraft = { ...defaultTelegramDraft(), ...(draft.telegram as WizardTelegramDraft) };
			}
		} catch {
			// ignore corrupt draft
		}
	}

	function saveDraft() {
		if (typeof sessionStorage === 'undefined') return;
		try {
			sessionStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					step,
					name,
					color,
					description,
					includeInvestors,
					includeBorrowers,
					selectedContactKeys,
					selectedLoanIds,
					addFutureRule,
					createCalendar,
					telegram: telegramDraft
				})
			);
		} catch {
			// ignore quota errors
		}
	}

	function clearDraft() {
		try {
			sessionStorage.removeItem(STORAGE_KEY);
		} catch {
			// ignore
		}
	}

	function applyInitials() {
		if (initialLoanIds.length > 0) {
			selectedLoanIds = [...new Set(initialLoanIds)];
		}
		if (initialContact) {
			includeInvestors = initialContact.partyType === 'investor';
			includeBorrowers = initialContact.partyType === 'borrower';
			selectedContactKeys = [contactKey(initialContact)];
			name = suggestedNameFor([initialContact]);
			selectedLoanIds = [...new Set(initialContact.loanIds)];
			addFutureRule = true;
		}
		color = nextGroupColor(usedColorKeys);
	}

	$effect(() => {
		if (!open) return;
		untrack(() => {
			if (initialLoanIds.length > 0 || initialContact) {
				applyInitials();
				return;
			}
			loadDraft();
		});
	});
	$effect(() => {
		if (open) saveDraft();
	});

	const duplicateName = $derived(
		name.trim().length > 0 &&
			existingNames.some((existing) => existing.toLowerCase() === name.trim().toLowerCase())
	);

	const selectedContacts = $derived(
		contactsFromKeys(selectedContactKeys, contactOptions)
	);
	const investorOptions = $derived(
		contactOptions
			.filter((option) => option.partyType === 'investor')
			.map((option) => ({ value: contactKey(option), label: option.name }))
	);
	const borrowerOptions = $derived(
		contactOptions
			.filter((option) => option.partyType === 'borrower')
			.map((option) => ({ value: contactKey(option), label: option.name }))
	);
	const selectedInvestorKeys = $derived(
		selectedContactKeys.filter((key) => key.startsWith('investor:'))
	);
	const selectedBorrowerKeys = $derived(
		selectedContactKeys.filter((key) => key.startsWith('borrower:'))
	);
	const futureRules = $derived(
		addFutureRule
			? selectedContacts.map((contact) => ({
					partyType: contact.partyType,
					contactId: contact.contactId
				}))
			: []
	);

	const contactLoanIds = $derived(new Set(resolveWizardContactLoanIds(selectedContacts)));

	const filteredLoans = $derived.by(() => {
		if (step !== 2) return [];
		const q = loanQuery.trim().toLowerCase();
		return ownedLoans.filter((loan) => {
			if (!showCompleted && loan.status === 'completed') return false;
			if (selectedContacts.length > 0 && !showAllLoans && !contactLoanIds.has(loan.id)) {
				return false;
			}
			if (q) {
				const name = loan.loanName.toLowerCase();
				const borrower = (loan.borrowerName ?? '').toLowerCase();
				if (!name.includes(q) && !borrower.includes(q)) return false;
			}
			return true;
		});
	});

	const allVisibleSelected = $derived(
		filteredLoans.length > 0 &&
			filteredLoans.every((loan) => selectedLoanIds.includes(loan.id))
	);

	function applyContactKeys(keys: string[]) {
		const previousSuggested = suggestedNameFor(selectedContacts);
		selectedContactKeys = keys;
		const next = contactsFromKeys(keys, contactOptions);
		const nextSuggested = suggestedNameFor(next);
		if (!name.trim() || name.trim() === previousSuggested) {
			if (nextSuggested) name = nextSuggested;
		}
		selectedLoanIds = resolveWizardContactLoanIds(next);
		showAllLoans = false;
	}

	function setInvestorKeys(keys: string[]) {
		applyContactKeys([...selectedBorrowerKeys, ...keys]);
	}

	function setBorrowerKeys(keys: string[]) {
		applyContactKeys([...selectedInvestorKeys, ...keys]);
	}

	function isSourceActive(mode: StartMode): boolean {
		if (mode === 'blank') return !includeInvestors && !includeBorrowers;
		if (mode === 'investor') return includeInvestors;
		return includeBorrowers;
	}

	function toggleStartSource(mode: StartMode) {
		showAllLoans = false;
		if (mode === 'blank') {
			includeInvestors = false;
			includeBorrowers = false;
			addFutureRule = false;
			applyContactKeys([]);
			return;
		}
		if (mode === 'investor') {
			includeInvestors = !includeInvestors;
			if (!includeInvestors) {
				applyContactKeys(selectedBorrowerKeys);
			}
			return;
		}
		includeBorrowers = !includeBorrowers;
		if (!includeBorrowers) {
			applyContactKeys(selectedInvestorKeys);
		}
	}

	function toggleLoan(id: number) {
		if (selectedLoanIds.includes(id)) {
			selectedLoanIds = selectedLoanIds.filter((value) => value !== id);
		} else {
			selectedLoanIds = [...selectedLoanIds, id];
		}
	}

	function selectAllVisible() {
		const ids = filteredLoans.map((loan) => loan.id);
		const set = new Set([...selectedLoanIds, ...ids]);
		selectedLoanIds = [...set];
	}

	function unselectAll() {
		selectedLoanIds = [];
	}

	async function fetchPreview() {
		const rules = futureRules;
		const response = await fetch('/api/groups/access-preview', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				loanIds: selectedLoanIds,
				rules
			})
		});
		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			throw new Error(data.error || 'Access preview failed');
		}
		preview = (await response.json()) as AccessPreviewData;
	}

	$effect(() => {
		if (!open || step !== 3) return;
		const idsKey = selectedLoanIds.join(',');
		const ruleKey = addFutureRule ? selectedContactKeys.join(',') : '';
		void idsKey;
		void ruleKey;
		clearTimeout(previewTimer);
		previewLoading = true;
		previewError = null;
		previewTimer = setTimeout(() => {
			void fetchPreview()
				.catch((error) => {
					preview = null;
					previewError = error instanceof Error ? error.message : 'Access preview failed';
				})
				.finally(() => {
					previewLoading = false;
				});
		}, 300);
		return () => clearTimeout(previewTimer);
	});

	async function handleCreate() {
		isSubmitting = true;
		submitError = null;
		const rules = futureRules;
		try {
			const response = await fetch('/api/groups', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					color,
					description: description.trim() || undefined,
					loanIds: selectedLoanIds,
					rules,
					createCalendar: createCalendarAvailable ? createCalendar : false
				})
			});
			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.error || 'Create failed');
			}
			const data = (await response.json()) as { id: number };
			const telegramError = await applyTelegramAfterCreate(data.id);
			clearDraft();
			toast.success('Group created');
			if (telegramError) {
				toast.error(telegramError);
			}
			onOpenChange(false);
			if (onCreated) {
				await onCreated(data.id);
			} else {
				await goto(`/groups/${data.id}?tab=overview`);
			}
		} catch (error) {
			submitError = error instanceof Error ? error.message : 'Create failed';
		} finally {
			isSubmitting = false;
		}
	}

	const stepTitle = $derived(
		step === 1 ? 'New group' : step === 2 ? 'Choose loans' : 'Review access'
	);
	const stepLabel = $derived(`Step ${step} of 3`);
	const groupColorDot = $derived(resolveGroupColor(color).dot);
	const reviewLoans = $derived.by(() => {
		const idSet = new Set(selectedLoanIds);
		return ownedLoans
			.filter((loan) => idSet.has(loan.id))
			.sort((a, b) => a.loanName.localeCompare(b.loanName));
	});

	function patchTelegramDraft(patch: Partial<WizardTelegramDraft>) {
		telegramDraft = { ...telegramDraft, ...patch };
	}

	async function applyTelegramAfterCreate(groupId: number): Promise<string | null> {
		const draft = telegramDraft;
		const wantsConnect =
			draft.chatId.trim().length > 0 || draft.connectViaLinkAfterCreate;
		if (!wantsConnect) return null;

		if (draft.connectViaLinkAfterCreate) {
			const linkRes = await fetch(`/api/groups/${groupId}/telegram/link`, { method: 'POST' });
			if (!linkRes.ok) {
				const body = await linkRes.json().catch(() => ({}));
				return (body as { error?: string }).error ?? 'Telegram link failed';
			}
			const linkBody = (await linkRes.json()) as { url: string };
			window.open(linkBody.url, '_blank', 'noopener,noreferrer');
		} else {
			const payload: { chatId: string; botToken?: string } = {
				chatId: draft.chatId.trim()
			};
			const token = draft.botToken.trim();
			if (token) payload.botToken = token;
			const connectRes = await fetch(`/api/groups/${groupId}/telegram/connect`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!connectRes.ok) {
				const body = await connectRes.json().catch(() => ({}));
				return (body as { error?: string }).error ?? 'Telegram connect failed';
			}
		}

		const prefs = {
			enabled: draft.enabled,
			notifyUpcoming: draft.notifyUpcoming,
			reminderDays: draft.reminderDays,
			notifyDueToday: draft.notifyDueToday,
			notifyOverdue: draft.notifyOverdue,
			notifyDailyDigest: draft.notifyDailyDigest,
			notifyActivity: draft.notifyActivity,
			includeAmounts: draft.includeAmounts
		};
		const patchRes = await fetch(`/api/groups/${groupId}/telegram`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(prefs)
		});
		if (!patchRes.ok) {
			const body = await patchRes.json().catch(() => ({}));
			return (body as { error?: string }).error ?? 'Telegram settings save failed';
		}
		return null;
	}
</script>

<ResponsiveModal
	{open}
	{onOpenChange}
	title={stepTitle}
	description={stepLabel}
	contentClass={step === 3 ? 'sm:max-w-lg' : 'sm:max-w-xl'}
	bodyClass={cn('pb-2', step === 3 && 'max-h-[min(72dvh,640px)] overflow-y-auto')}
>
	<div class="mb-4 flex gap-1.5" aria-hidden="true">
		{#each [1, 2, 3] as n (n)}
			<span
				class={cn('h-1 flex-1 rounded-full', n <= step ? 'bg-primary' : 'bg-muted')}
			></span>
		{/each}
	</div>

	{#if step === 1}
		<div class="space-y-4">
			<div class="space-y-2">
				<Label for="wizard-name">Name</Label>
				<Input id="wizard-name" bind:value={name} />
				{#if duplicateName}
					<p class="text-xs text-amber-700 dark:text-amber-200">
						You already have a group with this name.
					</p>
				{/if}
			</div>
			<div class="space-y-2">
				<span class="text-sm font-medium">Color</span>
				<GroupColorSwatches value={color} onValueChange={(value) => (color = value)} />
			</div>
			<div class="space-y-2">
				<Label for="wizard-description">Description</Label>
				<Textarea id="wizard-description" bind:value={description} rows={2} />
			</div>
			<div class="space-y-2">
				<span class="text-sm font-medium">Add loans from</span>
				<div class="flex flex-wrap gap-2">
					{#each startFromOptions as option (option.mode)}
						<Button
							type="button"
							size="sm"
							variant={isSourceActive(option.mode) ? 'default' : 'outline'}
							class="touch-target"
							aria-pressed={isSourceActive(option.mode)}
							onclick={() => toggleStartSource(option.mode)}
						>
							{option.label}
						</Button>
					{/each}
				</div>
				{#if includeInvestors || includeBorrowers}
					{#if !contactsReady}
						<p class="text-sm text-muted-foreground">Loading…</p>
					{:else}
						<div class="space-y-2">
							{#if includeInvestors}
								{#if investorOptions.length === 0}
									<p class="text-sm text-muted-foreground">None on your loans.</p>
								{:else}
									<div class="w-full">
										<MultiSelectFilter
											options={investorOptions}
											selected={selectedInvestorKeys}
											onChange={setInvestorKeys}
											placeholder="Investors"
											allLabel="Select investors"
											searchPlaceholder="Search"
											triggerClassName="w-full"
											class="w-72"
										/>
									</div>
								{/if}
							{/if}
							{#if includeBorrowers}
								{#if borrowerOptions.length === 0}
									<p class="text-sm text-muted-foreground">None on your loans.</p>
								{:else}
									<div class="w-full">
										<MultiSelectFilter
											options={borrowerOptions}
											selected={selectedBorrowerKeys}
											onChange={setBorrowerKeys}
											placeholder="Borrowers"
											allLabel="Select borrowers"
											searchPlaceholder="Search"
											triggerClassName="w-full"
											class="w-72"
										/>
									</div>
								{/if}
							{/if}
							{#if selectedContacts.length > 0}
								<label class="flex min-h-11 items-center gap-2 text-sm">
									<Checkbox bind:checked={addFutureRule} />
									Also add their future loans
								</label>
							{/if}
						</div>
					{/if}
				{/if}
			</div>
		</div>
	{:else if step === 2}
		<div class="space-y-3">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<p class="text-sm font-medium tabular-nums">
					{formatCount(selectedLoanIds.length)} selected
				</p>
				<div class="flex flex-wrap gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						class="touch-target"
						disabled={filteredLoans.length === 0 || allVisibleSelected}
						onclick={selectAllVisible}
					>
						Select all
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						class="touch-target"
						disabled={selectedLoanIds.length === 0}
						onclick={unselectAll}
					>
						Unselect all
					</Button>
				</div>
			</div>
			<div class="relative">
				<Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					class="pl-9"
					placeholder="Search loans"
					bind:value={loanQuery}
					aria-label="Search loans"
				/>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<label class="flex min-h-11 items-center gap-2 text-sm">
					<Checkbox bind:checked={showCompleted} />
					Show completed
				</label>
				{#if selectedContacts.length > 0}
					<Button
						type="button"
						variant={showAllLoans ? 'default' : 'outline'}
						size="sm"
						class="touch-target"
						aria-pressed={showAllLoans}
						onclick={() => (showAllLoans = !showAllLoans)}
					>
						All loans
					</Button>
				{/if}
			</div>
			<ul class="max-h-[min(45dvh,320px)] space-y-1 overflow-y-auto">
				{#each filteredLoans as loan (loan.id)}
					<li>
						<label
							class={cn(
								'flex min-h-11 cursor-pointer flex-col gap-1 rounded-lg border border-transparent px-2 py-2 hover:bg-muted/40',
								selectedLoanIds.includes(loan.id) && 'border-primary/30 bg-primary/5'
							)}
						>
							<div class="flex items-start gap-2">
								<Checkbox
									checked={selectedLoanIds.includes(loan.id)}
									onCheckedChange={() => toggleLoan(loan.id)}
								/>
								<div class="min-w-0 flex-1">
									<p class="truncate font-medium">{formatText(loan.loanName)}</p>
									<p class="text-xs text-muted-foreground">
										{loan.borrowerName ? formatText(loan.borrowerName) : 'No borrower'}
										{#if loan.dueDate}
											· Due {formatDateShort(loan.dueDate)}
										{/if}
										{#if loan.principal != null}
											· {formatCurrency(loan.principal)}
										{/if}
									</p>
									{#if loan.groupBadges && loan.groupBadges.length > 0}
										<div class="pt-1">
											<GroupBadgeList groups={loan.groupBadges} size="sm" />
										</div>
									{/if}
								</div>
							</div>
						</label>
					</li>
				{:else}
					<li class="px-2 py-6 text-center text-sm text-muted-foreground">
						{ownedLoans.length === 0 ? 'No loans to add.' : 'No loans match.'}
					</li>
				{/each}
			</ul>
		</div>
	{:else}
		<div class="space-y-3">
			<CreateGroupReviewStep
				groupName={name.trim() || 'New group'}
				groupColorClass={groupColorDot}
				loans={reviewLoans}
				{preview}
				previewLoading={previewLoading}
				previewError={previewError}
				{createCalendarAvailable}
				{createCalendar}
				onCreateCalendarChange={(value) => (createCalendar = value)}
				{telegramStartGroupAvailable}
				{telegramBotConfigured}
				telegram={telegramDraft}
				onTelegramChange={patchTelegramDraft}
			/>
			{#if submitError}
				<p class="text-sm text-destructive">{submitError}</p>
			{/if}
		</div>
	{/if}

	{#snippet footer()}
		<div class="grid w-full grid-cols-2 gap-2">
			<Button
				type="button"
				variant="outline"
				class="touch-target h-12 w-full"
				disabled={isSubmitting}
				onclick={() => {
					if (step === 1) {
						onOpenChange(false);
						return;
					}
					step = (step - 1) as 1 | 2 | 3;
				}}
			>
				{step === 1 ? 'Cancel' : 'Back'}
			</Button>
			{#if step < 3}
				<Button
					type="button"
					class="touch-target h-12 w-full"
					disabled={step === 1 && !name.trim()}
					onclick={() => {
						step = (step + 1) as 1 | 2 | 3;
					}}
				>
					{step === 2 ? 'Review' : 'Next'}
				</Button>
			{:else}
				<Button
					type="button"
					class="touch-target h-12 w-full"
					disabled={isSubmitting || !name.trim()}
					onclick={() => void handleCreate()}
				>
					{isSubmitting ? 'Creating…' : 'Create group'}
				</Button>
			{/if}
		</div>
	{/snippet}
</ResponsiveModal>
