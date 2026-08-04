-- Allow decimal square footage, lot size, and stories (e.g. a 0.17-acre lot,
-- a story-and-a-half cape). beds and baths were already Float.
--
-- integer -> double precision is a widening cast Postgres applies in place with
-- an implicit conversion, so every existing whole-number value is preserved
-- exactly and no backfill is needed.
ALTER TABLE "Property"
  ALTER COLUMN "sqft" SET DATA TYPE DOUBLE PRECISION,
  ALTER COLUMN "lotSize" SET DATA TYPE DOUBLE PRECISION,
  ALTER COLUMN "stories" SET DATA TYPE DOUBLE PRECISION;
