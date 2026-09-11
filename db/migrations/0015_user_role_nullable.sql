-- Sitewide admin is michaeldmanlulu@gmail.com only. Party users default to null
-- until they are linked on a loan. Safe for prod: only updates mistaken admin rows.

-- 1) Allow null roles before data fixes
ALTER TABLE "user" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "user" ALTER COLUMN "role" DROP NOT NULL;

-- 2) Non-owner admins with party links → matching party role; others → null
UPDATE "user" u
SET role = CASE
  WHEN EXISTS (
    SELECT 1 FROM investors i WHERE i.investor_user_id = u.id
  ) THEN 'investor'::user_role
  WHEN EXISTS (
    SELECT 1 FROM borrowers b WHERE b.borrower_user_id = u.id
  ) THEN 'borrower'::user_role
  WHEN EXISTS (
    SELECT 1 FROM witnesses w WHERE w.witness_user_id = u.id
  ) THEN 'witness'::user_role
  ELSE NULL
END
WHERE u.role = 'admin'
  AND lower(u.email) <> lower('michaeldmanlulu@gmail.com');

-- 3) Workspace owner stays admin
UPDATE "user"
SET role = 'admin'::user_role
WHERE lower(email) = lower('michaeldmanlulu@gmail.com');
