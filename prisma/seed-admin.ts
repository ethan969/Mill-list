import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { TOKEN_PRODUCTIONS_COMPANY_ID } from "../src/lib/tenancy";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME;

  if (!email || !password) {
    throw new Error(
      "Set ADMIN_EMAIL and ADMIN_PASSWORD in your environment before seeding."
    );
  }
  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { passwordHash, name },
    create: { email: email.toLowerCase(), passwordHash, name },
  });

  // Every user needs a CompanyMembership to access any tenant data (see
  // src/lib/tenant-context.ts) — this script's seeded account is tied to
  // Token Productions as its Owner.
  const company = await prisma.company.upsert({
    where: { id: TOKEN_PRODUCTIONS_COMPANY_ID },
    update: {},
    create: { id: TOKEN_PRODUCTIONS_COMPANY_ID, name: "Token Productions" },
  });
  await prisma.companyMembership.upsert({
    where: { userId_companyId: { userId: user.id, companyId: company.id } },
    update: {},
    create: { userId: user.id, companyId: company.id, role: "OWNER" },
  });

  console.log(`Admin user ready: ${user.email} (Owner of ${company.name})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
