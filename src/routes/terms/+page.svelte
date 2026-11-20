<script lang="ts">
	import { APP_NAME } from '$lib/brand';
	import LegalPage from '$lib/components/legal/LegalPage.svelte';
</script>

<LegalPage
	title="Terms of Service"
	summary={`The terms for using ${APP_NAME} to record lending activity, payments, and contracts.`}
>
	<section>
		<h2>The service</h2>
		<p>
			{APP_NAME} is a record-keeping and workflow tool for lending operations. It helps you
			track loans, investors, borrowers, witnesses, payments, interest schedules, groups, and
			contracts. It is not a bank, lender, lawyer, accountant, or financial adviser, and it
			does not provide legal, tax, or investment advice.
		</p>
	</section>

	<section>
		<h2>Your account</h2>
		<p>
			You are responsible for the accuracy of the records you enter, for keeping your sign-in
			method secure, and for making sure you have the right to store the personal and financial
			information you upload. Do not add another person's identity documents or signatures
			without their permission.
		</p>
	</section>

	<section>
		<h2>Loan records and payments</h2>
		<p>
			The app calculates schedules and balances from the information you enter. You must
			review the figures and the contracts before relying on them. Recording a payment or
			changing a schedule does not move money and does not replace a receipt, bank record, or
			written agreement.
		</p>
	</section>

	<section>
		<h2>Electronic signatures</h2>
		<p>
			When a party signs electronically, they confirm that they have read the contract and
			consent to sign electronically. The signature, consent time, and related contract data
			are stored as part of the record. Electronic signatures are intended to work under
			applicable Philippine e-commerce law, but you remain responsible for the underlying
			agreement and its enforceability.
		</p>
	</section>

	<section>
		<h2>Acceptable use</h2>
		<ul>
			<li>Do not use the app to store unlawful, fraudulent, or harmful material.</li>
			<li>Do not attempt to access another workspace, loan, or file without permission.</li>
			<li>Do not interfere with the service, its security controls, or other users.</li>
			<li>Keep backups or exports of records you cannot afford to lose.</li>
		</ul>
	</section>

	<section>
		<h2>Availability and changes</h2>
		<p>
			The service may change, be unavailable for maintenance, or be discontinued. Features
			that depend on third parties, such as calendar, messaging, email, push notifications,
			and AI scanning, may be unavailable without notice. We may update these terms; the
			updated date at the top shows the current version.
		</p>
	</section>

	<section>
		<h2>Liability</h2>
		<p>
			To the extent permitted by law, {APP_NAME} and its operator are not liable for indirect
			or consequential loss, lost profits, or loss caused by records you entered incorrectly,
			third-party outages, or a party's failure to perform a loan. Nothing in these terms
			limits rights that cannot be limited by law.
		</p>
	</section>

	<section>
		<h2>Contact</h2>
		<p>
			Questions about these terms should go to the workspace owner or administrator who gave
			you access to {APP_NAME}.
		</p>
	</section>
</LegalPage>
