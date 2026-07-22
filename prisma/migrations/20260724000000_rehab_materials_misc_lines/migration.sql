-- Adds "Building Materials" and "Miscellaneous and Permits" to Rehab Costs.
--
-- Listing them in SUBS_BY_CAT is enough for *new* properties, which are
-- created with the full checklist. Existing properties need the rows created
-- here, because computeProperty() builds the rollup from the budget lines that
-- exist: an expense whose subcategory has no matching line is dropped from the
-- category total silently, with no error and no visible gap. That would
-- understate actual cost — and therefore overstate profit — for any property
-- where someone logged spending under one of these new names.
--
-- Data-only and idempotent. BudgetLine.id is a client-side cuid with no
-- database default, so an id is supplied here; uniqueness is all that matters.
-- The NOT EXISTS guard matches the @@unique([propertyId, subcategory]) index,
-- so re-running changes nothing.

INSERT INTO "BudgetLine" ("id", "propertyId", "category", "subcategory", "estimated", "actual", "updatedAt")
SELECT gen_random_uuid()::text, p."id", 'Rehab Costs', s."subcategory", 0, 0, NOW()
FROM "Property" p
CROSS JOIN (VALUES ('Building Materials'), ('Miscellaneous and Permits')) AS s("subcategory")
WHERE NOT EXISTS (
  SELECT 1 FROM "BudgetLine" b
  WHERE b."propertyId" = p."id" AND b."subcategory" = s."subcategory"
);
