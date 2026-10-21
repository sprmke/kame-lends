-- One borrower, investor, or witness per workspace and normalized name.
-- Keep the oldest row. Copy contact fields and the linked user from the newer
-- row when the keeper is missing them, then point loans and templates at the keeper.

DO $$
DECLARE
  group_row record;
  keeper_id integer;
  dup_id integer;
  dup_user text;
  dup_email text;
  dup_phone text;
  dup_address text;
  dup_notes text;
  dup_valid text;
  dup_sign text;
BEGIN
  FOR group_row IN
    SELECT array_agg(id ORDER BY id) AS ids
    FROM borrowers
    GROUP BY user_id, lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g'))
    HAVING count(*) > 1
  LOOP
    keeper_id := group_row.ids[1];
    FOREACH dup_id IN ARRAY group_row.ids[2:cardinality(group_row.ids)]
    LOOP
      SELECT borrower_user_id, email, contact_number, address, notes, valid_id_url, e_signature_url
      INTO dup_user, dup_email, dup_phone, dup_address, dup_notes, dup_valid, dup_sign
      FROM borrowers
      WHERE id = dup_id;

      UPDATE borrowers SET borrower_user_id = NULL WHERE id = dup_id;

      UPDATE borrowers
      SET
        borrower_user_id = COALESCE(borrower_user_id, dup_user),
        email = COALESCE(NULLIF(btrim(email), ''), dup_email),
        contact_number = COALESCE(NULLIF(btrim(contact_number), ''), dup_phone),
        address = COALESCE(NULLIF(btrim(address), ''), dup_address),
        notes = COALESCE(NULLIF(btrim(notes), ''), dup_notes),
        valid_id_url = COALESCE(NULLIF(btrim(valid_id_url), ''), dup_valid),
        e_signature_url = COALESCE(NULLIF(btrim(e_signature_url), ''), dup_sign),
        updated_at = now()
      WHERE id = keeper_id;

      UPDATE loans SET borrower_id = keeper_id WHERE borrower_id = dup_id;
      UPDATE loan_templates SET borrower_id = keeper_id WHERE borrower_id = dup_id;

      UPDATE loan_templates
      SET borrower_ids = (
        SELECT COALESCE(jsonb_agg(to_jsonb(mapped) ORDER BY mapped), '[]'::jsonb)
        FROM (
          SELECT DISTINCT CASE
            WHEN elem::int = dup_id THEN keeper_id
            ELSE elem::int
          END AS mapped
          FROM jsonb_array_elements_text(borrower_ids) AS elem
        ) mapped_ids
      )
      WHERE borrower_ids @> to_jsonb(dup_id);

      UPDATE loan_group_rules AS rules
      SET contact_id = keeper_id
      WHERE rules.party_type = 'borrower'
        AND rules.contact_id = dup_id
        AND NOT EXISTS (
          SELECT 1
          FROM loan_group_rules existing
          WHERE existing.group_id = rules.group_id
            AND existing.party_type = 'borrower'
            AND existing.contact_id = keeper_id
        );

      DELETE FROM loan_group_rules
      WHERE party_type = 'borrower' AND contact_id = dup_id;

      DELETE FROM borrowers WHERE id = dup_id;
    END LOOP;
  END LOOP;

  FOR group_row IN
    SELECT array_agg(id ORDER BY id) AS ids
    FROM investors
    GROUP BY user_id, lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g'))
    HAVING count(*) > 1
  LOOP
    keeper_id := group_row.ids[1];
    FOREACH dup_id IN ARRAY group_row.ids[2:cardinality(group_row.ids)]
    LOOP
      SELECT investor_user_id, email, contact_number, address, valid_id_url, e_signature_url
      INTO dup_user, dup_email, dup_phone, dup_address, dup_valid, dup_sign
      FROM investors
      WHERE id = dup_id;

      UPDATE investors SET investor_user_id = NULL WHERE id = dup_id;

      UPDATE investors
      SET
        investor_user_id = COALESCE(investor_user_id, dup_user),
        email = COALESCE(NULLIF(btrim(email), ''), dup_email),
        contact_number = COALESCE(NULLIF(btrim(contact_number), ''), dup_phone),
        address = COALESCE(NULLIF(btrim(address), ''), dup_address),
        valid_id_url = COALESCE(NULLIF(btrim(valid_id_url), ''), dup_valid),
        e_signature_url = COALESCE(NULLIF(btrim(e_signature_url), ''), dup_sign),
        updated_at = now()
      WHERE id = keeper_id;

      UPDATE loan_investors SET investor_id = keeper_id WHERE investor_id = dup_id;
      UPDATE loan_signing_invitations SET investor_id = keeper_id WHERE investor_id = dup_id;
      UPDATE debts SET investor_id = keeper_id WHERE investor_id = dup_id;
      UPDATE transactions SET investor_id = keeper_id WHERE investor_id = dup_id;

      UPDATE loan_templates
      SET investors = (
        SELECT COALESCE(jsonb_agg(deduped.elem ORDER BY deduped.ord), '[]'::jsonb)
        FROM (
          SELECT DISTINCT ON (investor_key) mapped.elem, mapped.ord
          FROM (
            SELECT
              CASE
                WHEN (elem->>'investorId')::int = dup_id
                  THEN jsonb_set(elem, '{investorId}', to_jsonb(keeper_id))
                ELSE elem
              END AS elem,
              CASE
                WHEN (elem->>'investorId')::int = dup_id THEN keeper_id
                ELSE (elem->>'investorId')::int
              END AS investor_key,
              ord
            FROM jsonb_array_elements(investors) WITH ORDINALITY AS listed(elem, ord)
          ) mapped
          ORDER BY investor_key, ord
        ) deduped
      )
      WHERE EXISTS (
        SELECT 1
        FROM jsonb_array_elements(investors) elem
        WHERE (elem->>'investorId')::int = dup_id
      );

      UPDATE loan_group_rules AS rules
      SET contact_id = keeper_id
      WHERE rules.party_type = 'investor'
        AND rules.contact_id = dup_id
        AND NOT EXISTS (
          SELECT 1
          FROM loan_group_rules existing
          WHERE existing.group_id = rules.group_id
            AND existing.party_type = 'investor'
            AND existing.contact_id = keeper_id
        );

      DELETE FROM loan_group_rules
      WHERE party_type = 'investor' AND contact_id = dup_id;

      DELETE FROM investors WHERE id = dup_id;
    END LOOP;
  END LOOP;

  FOR group_row IN
    SELECT array_agg(id ORDER BY id) AS ids
    FROM witnesses
    GROUP BY user_id, lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g'))
    HAVING count(*) > 1
  LOOP
    keeper_id := group_row.ids[1];
    FOREACH dup_id IN ARRAY group_row.ids[2:cardinality(group_row.ids)]
    LOOP
      SELECT witness_user_id, email, contact_number, address, valid_id_url, e_signature_url
      INTO dup_user, dup_email, dup_phone, dup_address, dup_valid, dup_sign
      FROM witnesses
      WHERE id = dup_id;

      UPDATE witnesses SET witness_user_id = NULL WHERE id = dup_id;

      UPDATE witnesses
      SET
        witness_user_id = COALESCE(witness_user_id, dup_user),
        email = COALESCE(NULLIF(btrim(email), ''), dup_email),
        contact_number = COALESCE(NULLIF(btrim(contact_number), ''), dup_phone),
        address = COALESCE(NULLIF(btrim(address), ''), dup_address),
        valid_id_url = COALESCE(NULLIF(btrim(valid_id_url), ''), dup_valid),
        e_signature_url = COALESCE(NULLIF(btrim(e_signature_url), ''), dup_sign),
        updated_at = now()
      WHERE id = keeper_id;

      UPDATE loan_witnesses AS links
      SET witness_id = keeper_id
      WHERE links.witness_id = dup_id
        AND NOT EXISTS (
          SELECT 1
          FROM loan_witnesses existing
          WHERE existing.loan_id = links.loan_id
            AND existing.witness_id = keeper_id
        );
      DELETE FROM loan_witnesses WHERE witness_id = dup_id;

      UPDATE loan_signing_invitations SET witness_id = keeper_id WHERE witness_id = dup_id;

      UPDATE loan_group_default_witnesses AS defaults
      SET witness_id = keeper_id
      WHERE defaults.witness_id = dup_id
        AND NOT EXISTS (
          SELECT 1
          FROM loan_group_default_witnesses existing
          WHERE existing.group_id = defaults.group_id
            AND existing.witness_id = keeper_id
        );
      DELETE FROM loan_group_default_witnesses WHERE witness_id = dup_id;

      DELETE FROM witnesses WHERE id = dup_id;
    END LOOP;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS borrowers_workspace_name_uidx
  ON borrowers (user_id, lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')));

CREATE UNIQUE INDEX IF NOT EXISTS investors_workspace_name_uidx
  ON investors (user_id, lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')));

CREATE UNIQUE INDEX IF NOT EXISTS witnesses_workspace_name_uidx
  ON witnesses (user_id, lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')));
