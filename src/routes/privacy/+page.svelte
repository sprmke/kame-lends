<script lang="ts">
	import { APP_NAME } from '$lib/brand';
	import LegalPage from '$lib/components/legal/LegalPage.svelte';
</script>

<LegalPage
	title="Privacy Policy"
	summary={`How ${APP_NAME} stores and uses the information you and your lending parties provide.`}
>
	<section>
		<h2>What we store</h2>
		<p>
			{APP_NAME} stores the account details you sign in with, the borrowers, investors, and
			witnesses you add, loan and bank loan records, payment schedules, payments, receipts,
			valid IDs, e-signatures, group settings, calendar and notification settings, and the
			activity needed to keep the record accurate.
		</p>
		<p>
			Receipt scanning is optional. When it is enabled and you upload a receipt, the image and
			the extracted transfer details are processed by the configured AI provider. The app
			stores the receipt and the result you choose to save.
		</p>
	</section>

	<section>
		<h2>How we use it</h2>
		<p>
			We use the data to show loan balances, interest, schedules, payments, reports, and
			reminders; to share a loan with its parties and group members; to send optional email,
			Telegram, calendar, and push notifications; and to create backups and exports.
		</p>
		<p>We do not sell personal data or use loan records for advertising.</p>
	</section>

	<section>
		<h2>Who can see a loan</h2>
		<p>
			You can see the records in your workspace. A borrower, investor, or witness can see the
			loan they are a party to. Group members can see the loans in their group as described in
			the group settings. Access is checked on the server for every record and image request.
		</p>
	</section>

	<section>
		<h2>Service providers</h2>
		<p>
			The app uses infrastructure providers for hosting, database, file storage, email,
			calendar, messaging, and optional AI processing. Those providers receive only the data
			needed to perform their part of the service. Production receipt images should use a
			provider plan that does not train on customer data.
		</p>
	</section>

	<section>
		<h2>Retention and your choices</h2>
		<p>
			Records stay in the workspace for as long as the workspace owner needs them. Settings
			includes a personal data export. Deleted loans can be restored for a limited period.
			Ask the workspace owner to correct or remove contact data that belongs to you.
		</p>
	</section>

	<section>
		<h2>Security</h2>
		<p>
			Access is role-based, traffic is encrypted in transit, and private files are served
			through short-lived links. No system is perfect; report a suspected exposure to the
			workspace owner promptly.
		</p>
	</section>

	<section>
		<h2>Contact</h2>
		<p>
			Questions about this policy should go to the workspace owner or administrator who gave
			you access to {APP_NAME}.
		</p>
	</section>
</LegalPage>
