/**
 * One-time setup for a brand-new instance.
 *
 * Sign-in is invite-only: auth.ts only emails an address that already has a
 * User row, and creating users requires being signed in as an Owner. On an
 * empty database that is a deadlock — nobody can sign in, so nobody can ever
 * be invited. This script breaks it by creating the company record and the
 * first Owner directly.
 *
 * Deliberately refuses to run when users already exist, so it can't be used to
 * mint an Owner account on a live system.
 *
 *   npx tsx scripts/bootstrap.ts "Acme Property Group" owner@acme.com "Jane Doe"
 */
import { PrismaClient, Role } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const [companyName, email, ownerName] = process.argv.slice(2);

  if (!companyName || !email || !ownerName) {
    console.error("Usage: npx tsx scripts/bootstrap.ts <company name> <owner email> <owner name>");
    console.error('Example: npx tsx scripts/bootstrap.ts "Acme Property Group" owner@acme.com "Jane Doe"');
    process.exit(1);
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error(`"${email}" does not look like an email address.`);
    process.exit(1);
  }

  const existingUsers = await db.user.count();
  if (existingUsers > 0) {
    console.error(
      `Refusing to run: this database already has ${existingUsers} user(s).\n` +
        "Bootstrap is only for an empty instance. Add further users from Settings > Users."
    );
    process.exit(1);
  }

  const company = await db.company.findFirst();
  if (company) {
    await db.company.update({ where: { id: company.id }, data: { name: companyName } });
  } else {
    await db.company.create({ data: { name: companyName } });
  }

  const owner = await db.user.create({
    data: { name: ownerName, email: email.toLowerCase().trim(), role: Role.OWNER },
  });

  console.log(`Company:     ${companyName}`);
  console.log(`First Owner: ${owner.name} <${owner.email}>`);
  console.log("\nDone. Go to the app, enter that email, and click the sign-in link.");
  console.log("Then add everyone else from Settings > Users.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
