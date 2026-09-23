import type { NextConfig } from "next";

function storageOrigin(): string | null {
  const endpoint = process.env.STORAGE_ENDPOINT;
  if (!endpoint) return null;
  try {
    return new URL(endpoint).origin;
  } catch {
    return null;
  }
}

// The document viewer and large uploads talk to object storage directly
// from the browser (see src/lib/storage.ts's presigned URLs) — connect-src
// needs that origin. Falls back to a generic R2 host pattern when
// STORAGE_ENDPOINT isn't set at build time (local dev, or the local-disk
// fallback, where nothing actually calls out to it). A deployment on a
// different S3-compatible provider should have its own STORAGE_ENDPOINT
// set, which this picks up automatically.
const STORAGE_ORIGIN = storageOrigin() ?? "https://*.r2.cloudflarestorage.com";

// What the app actually loads, resource type by resource type:
// - script-src/style-src: Next.js's own hydration bootstrap emits inline
//   scripts, and React's inline `style={{}}` props render as inline style
//   attributes — both need 'unsafe-inline' without a nonce-based setup
//   (a bigger change than headers alone; see the security-headers commit
//   message for the trade-off).
// - img-src: same-origin uploaded images, plus `data:` for the CSS
//   grain-texture overlay (an inline SVG data URI in globals.css).
// - font-src: next/font self-hosts every font at build time (no
//   fonts.gstatic.com or similar at runtime) — 'self' is enough.
// - connect-src: same-origin API calls, plus the storage origin above for
//   direct browser<->R2 uploads and the viewer's presigned-URL redirects.
// - worker-src: react-pdf/pdf.js's worker script, served from /public,
//   same-origin; pdf.js also uses blob: URLs internally for some worker
//   setups.
const CSP_DIRECTIVES = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data:`,
  `font-src 'self'`,
  `connect-src 'self' ${STORAGE_ORIGIN}`,
  `worker-src 'self' blob:`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
].join("; ");

const PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "interest-cohort=()",
].join(", ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            // Browsers only honor this over an actual HTTPS connection,
            // so it's harmless to send unconditionally in local dev too.
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            // Real, enforced clickjacking protection from day one. The
            // equivalent CSP directive (frame-ancestors, below) ships
            // Report-Only for now, so on its own it wouldn't actually
            // block anything yet — this does, immediately, and doesn't
            // carry the same risk of breaking something unexpected that
            // the fuller resource-loading policy does.
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Permissions-Policy",
            value: PERMISSIONS_POLICY,
          },
          {
            // Report-Only deliberately: this lets the policy be verified
            // against real traffic (nothing unexpectedly reported as
            // blocked) before switching this same value over to an
            // enforced `Content-Security-Policy` header.
            key: "Content-Security-Policy-Report-Only",
            value: CSP_DIRECTIVES,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
