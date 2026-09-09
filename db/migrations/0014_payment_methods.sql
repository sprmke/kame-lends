-- Payment methods (bank / QR) owned by a user. Shown to borrowers on loan detail only.

CREATE TABLE IF NOT EXISTS "payment_methods" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"bank_name" text NOT NULL,
	"account_number" text NOT NULL,
	"qr_code_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "payment_methods_user_id_idx"
	ON "payment_methods" ("user_id");
