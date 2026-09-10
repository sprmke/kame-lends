<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { formatText } from '$lib/format';
	import {
		formatPaymentAccountNumberDisplay,
		paymentProviderLabel,
		paymentQrAltText
	} from '$lib/payment-providers';
	import { toast } from '$lib/toast';
	import type { PaymentMethod } from '$lib/types';
	import { Check, Copy } from 'lucide-svelte';

	interface Props {
		paymentMethods: PaymentMethod[];
	}

	let { paymentMethods }: Props = $props();

	let copiedKey = $state<string | null>(null);

	async function copyText(key: string, value: string, label: string) {
		try {
			await navigator.clipboard.writeText(value);
			copiedKey = key;
			toast.success(`${label} copied`);
			setTimeout(() => {
				if (copiedKey === key) copiedKey = null;
			}, 2000);
		} catch {
			toast.error('Could not copy');
		}
	}
</script>

{#if paymentMethods.length > 0}
	<Card.Root>
		<Card.Header>
			<Card.Title>Payment details</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-4">
			{#each paymentMethods as method (method.id)}
				<div class="space-y-3 border-b border-border pb-4 last:border-0 last:pb-0">
					<div class="grid gap-3 sm:grid-cols-2">
						<div class="space-y-1">
							<p class="text-caption">Bank</p>
							<div class="flex items-center gap-1">
								<p class="min-w-0 flex-1 text-sm font-medium">
									{formatText(paymentProviderLabel(method.bankName))}
								</p>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									class="shrink-0"
									aria-label="Copy bank name"
									onclick={() => copyText(`bank-${method.id}`, method.bankName, 'Bank name')}
								>
									{#if copiedKey === `bank-${method.id}`}
										<Check class="h-3.5 w-3.5" />
									{:else}
										<Copy class="h-3.5 w-3.5" />
									{/if}
								</Button>
							</div>
						</div>
						<div class="space-y-1">
							<p class="text-caption">Account number</p>
							<div class="flex items-center gap-1">
								<p class="min-w-0 flex-1 text-sm font-medium break-all tabular-nums">
									{formatText(
										formatPaymentAccountNumberDisplay(method.bankName, method.accountNumber)
									)}
								</p>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									class="shrink-0"
									aria-label="Copy account number"
									onclick={() =>
										copyText(`acct-${method.id}`, method.accountNumber, 'Account number')}
								>
									{#if copiedKey === `acct-${method.id}`}
										<Check class="h-3.5 w-3.5" />
									{:else}
										<Copy class="h-3.5 w-3.5" />
									{/if}
								</Button>
							</div>
						</div>
					</div>
					{#if method.qrCodeUrl}
						<div class="space-y-1">
							<p class="text-caption">QR code</p>
							<div
								class="mx-auto max-w-xs overflow-hidden rounded-md border border-border bg-white p-3"
							>
								<img
									src={method.qrCodeUrl}
									alt={paymentQrAltText(method.bankName)}
									class="mx-auto h-auto w-full object-contain"
								/>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</Card.Content>
	</Card.Root>
{/if}
