-- One person, one Auth.js user.
-- Contacts that share an email become investor, borrower, and witness rows
-- in the same workspace, linked to that user. Google sign-in then attaches
-- to the existing user instead of creating a second one.

UPDATE investors
SET email = lower(btrim(email))
WHERE email IS NOT NULL
  AND email IS DISTINCT FROM lower(btrim(email));

UPDATE borrowers
SET email = lower(btrim(email))
WHERE email IS NOT NULL
  AND email IS DISTINCT FROM lower(btrim(email));

UPDATE witnesses
SET email = lower(btrim(email))
WHERE email IS NOT NULL
  AND email IS DISTINCT FROM lower(btrim(email));

INSERT INTO "user" (id, name, email, role)
SELECT gen_random_uuid()::text, src.name, src.email, src.role::user_role
FROM (
  SELECT DISTINCT ON (email_norm)
    email_norm AS email,
    NULLIF(btrim(name), '') AS name,
    role
  FROM (
    SELECT lower(btrim(email)) AS email_norm, name, 'investor'::text AS role, 3 AS rank, created_at
    FROM investors
    WHERE email IS NOT NULL AND btrim(email) <> '' AND lower(btrim(email)) LIKE '%@%'
    UNION ALL
    SELECT lower(btrim(email)), name, 'borrower', 2, created_at
    FROM borrowers
    WHERE email IS NOT NULL AND btrim(email) <> '' AND lower(btrim(email)) LIKE '%@%'
    UNION ALL
    SELECT lower(btrim(email)), name, 'witness', 1, created_at
    FROM witnesses
    WHERE email IS NOT NULL AND btrim(email) <> '' AND lower(btrim(email)) LIKE '%@%'
  ) raw
  ORDER BY email_norm, rank DESC, created_at ASC
) src
WHERE NOT EXISTS (
  SELECT 1 FROM "user" u WHERE lower(btrim(u.email)) = src.email
);

UPDATE investors i
SET investor_user_id = picked.id
FROM (
  SELECT DISTINCT ON (lower(btrim(email)))
    id,
    lower(btrim(email)) AS email_norm
  FROM "user"
  WHERE email IS NOT NULL AND btrim(email) <> ''
  ORDER BY lower(btrim(email)),
    (EXISTS (SELECT 1 FROM account a WHERE a."userId" = "user".id)) DESC,
    id
) picked
WHERE i.email IS NOT NULL
  AND btrim(i.email) <> ''
  AND lower(btrim(i.email)) = picked.email_norm
  AND i.investor_user_id IS DISTINCT FROM picked.id
  AND (
    i.investor_user_id IS NULL
    OR EXISTS (
      SELECT 1 FROM "user" cur
      WHERE cur.id = i.investor_user_id
        AND lower(btrim(cur.email)) = picked.email_norm
    )
  );

UPDATE borrowers b
SET borrower_user_id = picked.id
FROM (
  SELECT DISTINCT ON (lower(btrim(email)))
    id,
    lower(btrim(email)) AS email_norm
  FROM "user"
  WHERE email IS NOT NULL AND btrim(email) <> ''
  ORDER BY lower(btrim(email)),
    (EXISTS (SELECT 1 FROM account a WHERE a."userId" = "user".id)) DESC,
    id
) picked
WHERE b.email IS NOT NULL
  AND btrim(b.email) <> ''
  AND lower(btrim(b.email)) = picked.email_norm
  AND b.borrower_user_id IS DISTINCT FROM picked.id
  AND (
    b.borrower_user_id IS NULL
    OR EXISTS (
      SELECT 1 FROM "user" cur
      WHERE cur.id = b.borrower_user_id
        AND lower(btrim(cur.email)) = picked.email_norm
    )
  );

UPDATE witnesses w
SET witness_user_id = picked.id
FROM (
  SELECT DISTINCT ON (lower(btrim(email)))
    id,
    lower(btrim(email)) AS email_norm
  FROM "user"
  WHERE email IS NOT NULL AND btrim(email) <> ''
  ORDER BY lower(btrim(email)),
    (EXISTS (SELECT 1 FROM account a WHERE a."userId" = "user".id)) DESC,
    id
) picked
WHERE w.email IS NOT NULL
  AND btrim(w.email) <> ''
  AND lower(btrim(w.email)) = picked.email_norm
  AND w.witness_user_id IS DISTINCT FROM picked.id
  AND (
    w.witness_user_id IS NULL
    OR EXISTS (
      SELECT 1 FROM "user" cur
      WHERE cur.id = w.witness_user_id
        AND lower(btrim(cur.email)) = picked.email_norm
    )
  );

DROP TABLE IF EXISTS _party_investor_dups;
CREATE TEMP TABLE _party_investor_dups AS
SELECT id, keep_id
FROM (
  SELECT id, MIN(id) OVER (PARTITION BY user_id, investor_user_id) AS keep_id
  FROM investors
  WHERE investor_user_id IS NOT NULL
) ranked
WHERE id <> keep_id;

DROP TABLE IF EXISTS _party_borrower_dups;
CREATE TEMP TABLE _party_borrower_dups AS
SELECT id, keep_id
FROM (
  SELECT id, MIN(id) OVER (PARTITION BY user_id, borrower_user_id) AS keep_id
  FROM borrowers
  WHERE borrower_user_id IS NOT NULL
) ranked
WHERE id <> keep_id;

DROP TABLE IF EXISTS _party_witness_dups;
CREATE TEMP TABLE _party_witness_dups AS
SELECT id, keep_id
FROM (
  SELECT id, MIN(id) OVER (PARTITION BY user_id, witness_user_id) AS keep_id
  FROM witnesses
  WHERE witness_user_id IS NOT NULL
) ranked
WHERE id <> keep_id;

UPDATE loans l
SET borrower_id = d.keep_id
FROM _party_borrower_dups d
WHERE l.borrower_id = d.id;

UPDATE loan_investors li
SET investor_id = d.keep_id
FROM _party_investor_dups d
WHERE li.investor_id = d.id;

UPDATE transactions t
SET investor_id = d.keep_id
FROM _party_investor_dups d
WHERE t.investor_id = d.id;

UPDATE debts debt
SET investor_id = d.keep_id
FROM _party_investor_dups d
WHERE debt.investor_id = d.id;

UPDATE loan_signing_invitations inv
SET investor_id = d.keep_id
FROM _party_investor_dups d
WHERE inv.investor_id = d.id;

UPDATE loan_signing_invitations inv
SET witness_id = d.keep_id
FROM _party_witness_dups d
WHERE inv.witness_id = d.id;

DELETE FROM loan_witnesses lw
USING _party_witness_dups d
WHERE lw.witness_id = d.id
  AND EXISTS (
    SELECT 1 FROM loan_witnesses kept
    WHERE kept.loan_id = lw.loan_id
      AND kept.witness_id = d.keep_id
  );

UPDATE loan_witnesses lw
SET witness_id = d.keep_id
FROM _party_witness_dups d
WHERE lw.witness_id = d.id;

DELETE FROM loan_group_default_witnesses def
USING _party_witness_dups d
WHERE def.witness_id = d.id
  AND EXISTS (
    SELECT 1 FROM loan_group_default_witnesses kept
    WHERE kept.group_id = def.group_id
      AND kept.witness_id = d.keep_id
  );

UPDATE loan_group_default_witnesses def
SET witness_id = d.keep_id
FROM _party_witness_dups d
WHERE def.witness_id = d.id;

DELETE FROM loan_group_rules grp
USING _party_investor_dups d
WHERE grp.party_type = 'investor'
  AND grp.contact_id = d.id
  AND EXISTS (
    SELECT 1 FROM loan_group_rules kept
    WHERE kept.group_id = grp.group_id
      AND kept.party_type = 'investor'
      AND kept.contact_id = d.keep_id
  );

UPDATE loan_group_rules grp
SET contact_id = d.keep_id
FROM _party_investor_dups d
WHERE grp.party_type = 'investor'
  AND grp.contact_id = d.id;

DELETE FROM loan_group_rules grp
USING _party_borrower_dups d
WHERE grp.party_type = 'borrower'
  AND grp.contact_id = d.id
  AND EXISTS (
    SELECT 1 FROM loan_group_rules kept
    WHERE kept.group_id = grp.group_id
      AND kept.party_type = 'borrower'
      AND kept.contact_id = d.keep_id
  );

UPDATE loan_group_rules grp
SET contact_id = d.keep_id
FROM _party_borrower_dups d
WHERE grp.party_type = 'borrower'
  AND grp.contact_id = d.id;

UPDATE loan_contracts c
SET customization = jsonb_set(
  c.customization,
  '{witness1Id}',
  to_jsonb(d.keep_id),
  false
)
FROM _party_witness_dups d
WHERE c.customization ? 'witness1Id'
  AND c.customization->>'witness1Id' ~ '^[0-9]+$'
  AND (c.customization->>'witness1Id')::int = d.id;

UPDATE loan_contracts c
SET customization = jsonb_set(
  c.customization,
  '{witness2Id}',
  to_jsonb(d.keep_id),
  false
)
FROM _party_witness_dups d
WHERE c.customization ? 'witness2Id'
  AND c.customization->>'witness2Id' ~ '^[0-9]+$'
  AND (c.customization->>'witness2Id')::int = d.id;

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN SELECT id, keep_id FROM _party_investor_dups LOOP
    UPDATE loan_contracts
    SET customization = jsonb_set(
      customization,
      '{lenderSignaturesIncluded}',
      (customization->'lenderSignaturesIncluded') - rec.id::text
        || jsonb_build_object(
          rec.keep_id::text,
          COALESCE(
            customization->'lenderSignaturesIncluded'->rec.keep_id::text,
            customization->'lenderSignaturesIncluded'->rec.id::text
          )
        )
    )
    WHERE customization ? 'lenderSignaturesIncluded'
      AND jsonb_typeof(customization->'lenderSignaturesIncluded') = 'object'
      AND customization->'lenderSignaturesIncluded' ? rec.id::text;

    UPDATE loan_contracts
    SET customization = jsonb_set(
      customization,
      '{lenderDateSigned}',
      (customization->'lenderDateSigned') - rec.id::text
        || jsonb_build_object(
          rec.keep_id::text,
          COALESCE(
            customization->'lenderDateSigned'->rec.keep_id::text,
            customization->'lenderDateSigned'->rec.id::text
          )
        )
    )
    WHERE customization ? 'lenderDateSigned'
      AND jsonb_typeof(customization->'lenderDateSigned') = 'object'
      AND customization->'lenderDateSigned' ? rec.id::text;
  END LOOP;
END $$;

DELETE FROM investors i
USING _party_investor_dups d
WHERE i.id = d.id;

DELETE FROM borrowers b
USING _party_borrower_dups d
WHERE b.id = d.id;

DELETE FROM witnesses w
USING _party_witness_dups d
WHERE w.id = d.id;

WITH profiles AS (
  SELECT DISTINCT ON (workspace_id, party_user_id)
    workspace_id,
    party_user_id,
    name,
    contact_number,
    address,
    valid_id_url,
    e_signature_url,
    notes
  FROM (
    SELECT
      user_id AS workspace_id,
      investor_user_id AS party_user_id,
      name,
      contact_number,
      address,
      valid_id_url,
      e_signature_url,
      NULL::text AS notes,
      (contact_number IS NOT NULL)::int
        + (address IS NOT NULL)::int
        + (valid_id_url IS NOT NULL)::int
        + (e_signature_url IS NOT NULL)::int AS score,
      created_at
    FROM investors
    WHERE investor_user_id IS NOT NULL
    UNION ALL
    SELECT
      user_id,
      borrower_user_id,
      name,
      contact_number,
      address,
      valid_id_url,
      e_signature_url,
      notes,
      (contact_number IS NOT NULL)::int
        + (address IS NOT NULL)::int
        + (valid_id_url IS NOT NULL)::int
        + (e_signature_url IS NOT NULL)::int
        + (notes IS NOT NULL)::int,
      created_at
    FROM borrowers
    WHERE borrower_user_id IS NOT NULL
    UNION ALL
    SELECT
      user_id,
      witness_user_id,
      name,
      contact_number,
      address,
      valid_id_url,
      e_signature_url,
      NULL::text,
      (contact_number IS NOT NULL)::int
        + (address IS NOT NULL)::int
        + (valid_id_url IS NOT NULL)::int
        + (e_signature_url IS NOT NULL)::int,
      created_at
    FROM witnesses
    WHERE witness_user_id IS NOT NULL
  ) raw
  ORDER BY workspace_id, party_user_id, score DESC, created_at ASC
)
INSERT INTO investors (
  user_id,
  investor_user_id,
  name,
  email,
  contact_number,
  address,
  valid_id_url,
  e_signature_url
)
SELECT
  p.workspace_id,
  p.party_user_id,
  COALESCE(NULLIF(btrim(p.name), ''), NULLIF(btrim(u.name), ''), 'Contact'),
  lower(btrim(u.email)),
  p.contact_number,
  p.address,
  p.valid_id_url,
  p.e_signature_url
FROM profiles p
JOIN "user" u ON u.id = p.party_user_id
WHERE NOT EXISTS (
  SELECT 1 FROM investors i
  WHERE i.user_id = p.workspace_id
    AND (
      i.investor_user_id = p.party_user_id
      OR lower(btrim(i.email)) = lower(btrim(u.email))
    )
);

WITH profiles AS (
  SELECT DISTINCT ON (workspace_id, party_user_id)
    workspace_id,
    party_user_id,
    name,
    contact_number,
    address,
    valid_id_url,
    e_signature_url,
    notes
  FROM (
    SELECT
      user_id AS workspace_id,
      investor_user_id AS party_user_id,
      name,
      contact_number,
      address,
      valid_id_url,
      e_signature_url,
      NULL::text AS notes,
      (contact_number IS NOT NULL)::int
        + (address IS NOT NULL)::int
        + (valid_id_url IS NOT NULL)::int
        + (e_signature_url IS NOT NULL)::int AS score,
      created_at
    FROM investors
    WHERE investor_user_id IS NOT NULL
    UNION ALL
    SELECT
      user_id,
      borrower_user_id,
      name,
      contact_number,
      address,
      valid_id_url,
      e_signature_url,
      notes,
      (contact_number IS NOT NULL)::int
        + (address IS NOT NULL)::int
        + (valid_id_url IS NOT NULL)::int
        + (e_signature_url IS NOT NULL)::int
        + (notes IS NOT NULL)::int,
      created_at
    FROM borrowers
    WHERE borrower_user_id IS NOT NULL
    UNION ALL
    SELECT
      user_id,
      witness_user_id,
      name,
      contact_number,
      address,
      valid_id_url,
      e_signature_url,
      NULL::text,
      (contact_number IS NOT NULL)::int
        + (address IS NOT NULL)::int
        + (valid_id_url IS NOT NULL)::int
        + (e_signature_url IS NOT NULL)::int,
      created_at
    FROM witnesses
    WHERE witness_user_id IS NOT NULL
  ) raw
  ORDER BY workspace_id, party_user_id, score DESC, created_at ASC
)
INSERT INTO borrowers (
  user_id,
  borrower_user_id,
  name,
  email,
  contact_number,
  address,
  notes,
  valid_id_url,
  e_signature_url
)
SELECT
  p.workspace_id,
  p.party_user_id,
  COALESCE(NULLIF(btrim(p.name), ''), NULLIF(btrim(u.name), ''), 'Contact'),
  lower(btrim(u.email)),
  p.contact_number,
  p.address,
  p.notes,
  p.valid_id_url,
  p.e_signature_url
FROM profiles p
JOIN "user" u ON u.id = p.party_user_id
WHERE NOT EXISTS (
  SELECT 1 FROM borrowers b
  WHERE b.user_id = p.workspace_id
    AND (
      b.borrower_user_id = p.party_user_id
      OR lower(btrim(b.email)) = lower(btrim(u.email))
    )
);

WITH profiles AS (
  SELECT DISTINCT ON (workspace_id, party_user_id)
    workspace_id,
    party_user_id,
    name,
    contact_number,
    address,
    valid_id_url,
    e_signature_url
  FROM (
    SELECT
      user_id AS workspace_id,
      investor_user_id AS party_user_id,
      name,
      contact_number,
      address,
      valid_id_url,
      e_signature_url,
      (contact_number IS NOT NULL)::int
        + (address IS NOT NULL)::int
        + (valid_id_url IS NOT NULL)::int
        + (e_signature_url IS NOT NULL)::int AS score,
      created_at
    FROM investors
    WHERE investor_user_id IS NOT NULL
    UNION ALL
    SELECT
      user_id,
      borrower_user_id,
      name,
      contact_number,
      address,
      valid_id_url,
      e_signature_url,
      (contact_number IS NOT NULL)::int
        + (address IS NOT NULL)::int
        + (valid_id_url IS NOT NULL)::int
        + (e_signature_url IS NOT NULL)::int,
      created_at
    FROM borrowers
    WHERE borrower_user_id IS NOT NULL
    UNION ALL
    SELECT
      user_id,
      witness_user_id,
      name,
      contact_number,
      address,
      valid_id_url,
      e_signature_url,
      (contact_number IS NOT NULL)::int
        + (address IS NOT NULL)::int
        + (valid_id_url IS NOT NULL)::int
        + (e_signature_url IS NOT NULL)::int,
      created_at
    FROM witnesses
    WHERE witness_user_id IS NOT NULL
  ) raw
  ORDER BY workspace_id, party_user_id, score DESC, created_at ASC
)
INSERT INTO witnesses (
  user_id,
  witness_user_id,
  name,
  email,
  contact_number,
  address,
  valid_id_url,
  e_signature_url
)
SELECT
  p.workspace_id,
  p.party_user_id,
  COALESCE(NULLIF(btrim(p.name), ''), NULLIF(btrim(u.name), ''), 'Contact'),
  lower(btrim(u.email)),
  p.contact_number,
  p.address,
  p.valid_id_url,
  p.e_signature_url
FROM profiles p
JOIN "user" u ON u.id = p.party_user_id
WHERE NOT EXISTS (
  SELECT 1 FROM witnesses w
  WHERE w.user_id = p.workspace_id
    AND (
      w.witness_user_id = p.party_user_id
      OR lower(btrim(w.email)) = lower(btrim(u.email))
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS investors_workspace_party_user_uidx
  ON investors (user_id, investor_user_id)
  WHERE investor_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS borrowers_workspace_party_user_uidx
  ON borrowers (user_id, borrower_user_id)
  WHERE borrower_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS witnesses_workspace_party_user_uidx
  ON witnesses (user_id, witness_user_id)
  WHERE witness_user_id IS NOT NULL;

DROP TABLE IF EXISTS _party_investor_dups;
DROP TABLE IF EXISTS _party_borrower_dups;
DROP TABLE IF EXISTS _party_witness_dups;
