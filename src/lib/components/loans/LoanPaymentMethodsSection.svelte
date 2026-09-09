<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { formatText } from '$lib/format';
	import type { PaymentMethod } from '$lib/types';

	interface Props {
		paymentMethods: PaymentMethod[];
	}

	let { paymentMethods }: Props = $props();
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
							<p class="text-sm font-medium">{formatText(method.bankName)}</p>
						</div>
						<div class="space-y-1">
							<p class="text-caption">Account number</p>
							<p class="text-sm font-medium break-all">{formatText(method.accountNumber)}</p>
						</div>
					</div>
					{#if method.qrCodeUrl}
						<div class="space-y-1">
							<p class="text-caption">QR code</p>
							<div class="overflow-hidden rounded-md border border-border bg-muted/20 p-2">
								<img
									src={method.qrCodeUrl}
									alt="Payment QR code"
									class="mx-auto max-h-48 w-full object-contain"
								/>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</Card.Content>
	</Card.Root>
{/if}
