<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';

	let { data } = $props();
</script>

<svelte:head><title>Sign In</title></svelte:head>

<div class="relative flex min-h-screen items-center justify-center p-4">
	<div class="absolute inset-0 -z-10 overflow-hidden">
		<div
			class="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary/6 blur-3xl"
		></div>
		<div
			class="absolute -bottom-40 -left-40 h-[400px] w-[400px] rounded-full bg-chart-5/6 blur-3xl"
		></div>
	</div>

	<Card.Root class="w-full max-w-md border-border/40 shadow-[var(--shadow-elevated-lg)]">
		<Card.Header class="space-y-12 pt-8 pb-2 text-center">
			<div class="flex justify-center">
				<Logo size="xl" showIcon={true} gradient={true} />
			</div>
			<div class="space-y-2">
				<h1 class="text-2xl font-bold tracking-tight">Welcome back</h1>
				<Card.Description class="text-base">
					Sign in to manage your loans and investors
				</Card.Description>
			</div>
		</Card.Header>
		<Card.Content class="mt-5 space-y-5 px-8 pb-8">
			<form method="POST" class="space-y-5">
				<input type="hidden" name="providerId" value="google" />
				<input type="hidden" name="callbackUrl" value={data.callbackUrl} />
				<Button
					type="submit"
					variant="outline"
					class="h-12 w-full rounded-2xl text-sm font-semibold [&_svg]:size-5"
				>
					<svg viewBox="0 0 24 24" aria-hidden="true" class="mr-2">
						<path
							d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
							fill="#4285F4"
						/>
						<path
							d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
							fill="#34A853"
						/>
						<path
							d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
							fill="#FBBC05"
						/>
						<path
							d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
							fill="#EA4335"
						/>
					</svg>
					Continue with Google
				</Button>
			</form>

			<p class="text-center text-xs text-muted-foreground">
				By continuing, you agree to our Terms of Service and Privacy Policy
			</p>
		</Card.Content>
	</Card.Root>
</div>
