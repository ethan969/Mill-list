import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Clears an admin's TOTP enrollment (secret, enabled flag, replay-protection
// step) and deletes all of their recovery codes — the only way back in for
// an account that's enrolled in 2FA but has no working authenticator and no
// recovery code (e.g. a seeded/test admin on a preview database).
//
// Deliberately defensive about which database it's about to write to: it
// always prints the DB host it resolved (never the full connection string,
// which may carry credentials) and, unless --yes is passed, only reports
// what it *would* do without changing anything. Run it twice — once bare to
// confirm the host and the account's current state, once with --yes.
//
//   DATABASE_URL=<preview-url> npx tsx prisma/reset-admin-2fa.ts --email you@example.com
//   DATABASE_URL=<preview-url> npx tsx prisma/reset-admin-2fa.ts --email you@example.com --yes

function parseArgs(argv: string[]) {
  const emailIndex = argv.indexOf("--email");
  const email = emailIndex !== -1 ? argv[emailIndex + 1] : undefined;
  const confirmed = argv.includes("--yes");
  return { email, confirmed };
}

function dbHost(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    return `${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`;
  } catch {
    return "<unparseable DATABASE_URL>";
  }
}

async function main() {
  const { email, confirmed } = parseArgs(process.argv.slice(2));
  if (!email) {
    throw new Error(
      "Usage: tsx prisma/reset-admin-2fa.ts --email <address> [--yes]"
    );
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set in this shell.");
  }
  console.log(`Target database: ${dbHost(databaseUrl)}`);
  console.log(
    "Double-check that's the PREVIEW database before passing --yes — this script has no way to tell preview and production apart on its own."
  );

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { recoveryCodes: true },
  });

  if (!user) {
    throw new Error(`No admin user found for ${email} on this database.`);
  }

  console.log(`\nAccount: ${user.email} (id ${user.id})`);
  console.log(`  2FA enrolled: ${user.totpEnabledAt ? `yes, since ${user.totpEnabledAt.toISOString()}` : "no"}`);
  console.log(`  TOTP secret stored: ${user.totpSecretEncrypted ? "yes" : "no"}`);
  console.log(`  Recovery codes: ${user.recoveryCodes.length} (${user.recoveryCodes.filter((c) => !c.usedAt).length} unused)`);

  if (!confirmed) {
    console.log("\nDry run only — no changes made. Re-run with --yes to apply the reset above.");
    return;
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        totpSecretEncrypted: null,
        totpEnabledAt: null,
        totpLastUsedStep: null,
      },
    }),
    prisma.adminRecoveryCode.deleteMany({ where: { userId: user.id } }),
  ]);

  console.log(`\n2FA reset for ${user.email}. They'll be asked to enroll again on next login.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
