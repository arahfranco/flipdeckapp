-- Public, no-login expense-entry link for the field team. entryToken is the
-- unguessable secret embedded in the URL; entryEnabled is the kill switch.
ALTER TABLE "Company" ADD COLUMN "entryToken" TEXT;
ALTER TABLE "Company" ADD COLUMN "entryEnabled" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "Company_entryToken_key" ON "Company"("entryToken");
