-- Company balance sheet: property market value / rent, outside debt, cash accounts.
-- Entirely additive — new nullable columns and new tables only. No data loss.

-- CreateEnum
CREATE TYPE "LiabilityKind" AS ENUM ('MORTGAGE', 'HARD_MONEY', 'LINE_OF_CREDIT', 'CREDIT_CARD', 'OTHER');

-- AlterTable: both nullable, so existing rows are untouched.
ALTER TABLE "Property" ADD COLUMN     "marketValue" DECIMAL(12,2),
ADD COLUMN     "monthlyRent" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "Liability" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "LiabilityKind" NOT NULL DEFAULT 'OTHER',
    "balance" DECIMAL(12,2) NOT NULL,
    "interestRate" DECIMAL(5,3),
    "propertyId" TEXT,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Liability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashAccount_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: SET NULL mirrors BankTxn (spec §5) — deleting a property
-- must not silently erase a debt that still genuinely exists.
ALTER TABLE "Liability" ADD CONSTRAINT "Liability_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
