-- Bank transactions become bi-directional so cash on hand is derived from
-- them, and deposits can post as property income.
--
-- Hand-written rather than generated: Prisma's diff wants to DROP "account"
-- and ADD "accountId" NOT NULL in a single step, which fails on a non-empty
-- table and would throw away the existing account names. This does the
-- additive work first, backfills, and only then tightens constraints — the
-- same pattern used for the Worker migration. Postgres runs the whole file
-- in one transaction, so a failure anywhere rolls the lot back.

-- CreateEnum
CREATE TYPE "TxnDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "IncomeCategory" AS ENUM ('RENT', 'SALE_PROCEEDS', 'REFUND', 'OTHER');

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "openingBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BankAccount_name_key" ON "BankAccount"("name");

-- Step 1 (additive): every existing row is money out, so the OUT default is
-- correct for all of them. accountId starts nullable so the backfill can run.
ALTER TABLE "BankTxn" ADD COLUMN "direction" "TxnDirection" NOT NULL DEFAULT 'OUT';
ALTER TABLE "BankTxn" ADD COLUMN "accountId" TEXT;

-- Step 2 (backfill): promote each distinct free-text account name to a real
-- BankAccount, then link. openingBalance stays 0 — the chosen "start from
-- zero and import full history" behaviour.
INSERT INTO "BankAccount" ("id", "name", "openingBalance", "updatedAt")
SELECT gen_random_uuid()::text, "account", 0, NOW()
FROM "BankTxn"
GROUP BY "account";

UPDATE "BankTxn" t
SET "accountId" = a."id"
FROM "BankAccount" a
WHERE a."name" = t."account";

-- Rewrite importHash into the new accountId|date|amount|direction|description
-- format. MUST stay byte-identical to importHash() in lib/csvImport.ts or
-- re-importing a statement would silently duplicate every row.
UPDATE "BankTxn"
SET "importHash" =
  "accountId" || '|' ||
  to_char("date", 'YYYY-MM-DD') || '|' ||
  to_char("amount", 'FM9999999999990.00') || '|' ||
  "direction"::text || '|' ||
  regexp_replace(lower(btrim("description")), '\s+', ' ', 'g');

-- Step 3 (finalize): now that every row has an account, tighten and drop the
-- old free-text column so there's a single source of truth.
ALTER TABLE "BankTxn" ALTER COLUMN "accountId" SET NOT NULL;
ALTER TABLE "BankTxn" ADD CONSTRAINT "BankTxn_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankTxn" DROP COLUMN "account";

-- CreateTable
CREATE TABLE "Income" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "propertyId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "category" "IncomeCategory" NOT NULL DEFAULT 'RENT',
    "bankTxnId" TEXT,

    CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Income_bankTxnId_key" ON "Income"("bankTxnId");
ALTER TABLE "Income" ADD CONSTRAINT "Income_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Income" ADD CONSTRAINT "Income_bankTxnId_fkey" FOREIGN KEY ("bankTxnId") REFERENCES "BankTxn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CashAccount is superseded by BankAccount (verified 0 rows before this ran).
DROP TABLE "CashAccount";

-- Corrects a genuine drift left by the Worker migration: workerId became
-- required, but its FK still carried the optional-relation ON DELETE rule.
ALTER TABLE "PayrollEntry" DROP CONSTRAINT "PayrollEntry_workerId_fkey";
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
