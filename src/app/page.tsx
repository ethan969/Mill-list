import Link from "next/link";

const siteName = process.env.SITE_NAME || "Mill List";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-sm tracking-[0.3em] text-muted uppercase">
        {siteName}
      </p>
      <h1 className="mt-4 font-display text-4xl sm:text-5xl">
        Private data rooms for film financing
      </h1>
      <p className="mt-4 max-w-md text-sm text-muted">
        Each project has its own private link and password. If you were sent
        one, use it directly — it isn&apos;t listed here.
      </p>
      <Link
        href="/admin/login"
        className="mt-10 text-xs uppercase tracking-widest text-muted hover:text-accent transition-colors"
      >
        Team sign in →
      </Link>
    </div>
  );
}
