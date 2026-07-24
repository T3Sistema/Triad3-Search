// Central, extensible list of identifiers that must never appear in the
// public frontend (source under the scanned dirs below, or the built
// static bundle). Add every new integration's identifiers here the moment
// it's wired up — see CLAUDE.md "Regras permanentes de produto" and
// .claude/rules/frontend-product-rules.md.
export const forbiddenFrontendTerms = [
  "ScrapeGraphAI",
  "scrapegraphai",
  "Scrape Graph AI",
  "SGAI",
  "v2-api.scrapegraphai.com",
  "supabase.co",
  "supabase",
];

// Directories scanned for source-level violations (pre-build). Glob-style,
// relative to the repo root.
export const scannedSourceGlobs = [
  "src/app/**/*.{ts,tsx}",
  "src/components/**/*.{ts,tsx}",
  "src/features/**/*.{ts,tsx}",
  "src/lib/ui/**/*.{ts,tsx}",
  "public/**/*",
];

// File extensions considered when walking scannedSourceGlobs directories.
export const scannedSourceExtensions = [".ts", ".tsx", ".js", ".jsx", ".css", ".json", ".md", ".svg", ".html"];

// Anything matching these path fragments is never scanned, even if it lives
// under one of the globs above (belt-and-suspenders with the glob list).
// NOTE: these are only applied while scanning source roots (SOURCE_ROOTS /
// the "use client" sweep in check-ui-policy.mjs) — never while scanning the
// static bundle, since that scan's root already lives at `.next/static`
// and must not be excluded by a stray ".next" fragment.
export const excludedPathFragments = [
  "/api/", // server routes (route.ts) are never bundled to the client
  "/server/", // backend-only integration code
  "ui-policy.config.mjs", // the forbidden-term list itself
  "check-ui-policy.mjs", // the policy checker
  ".test.ts",
  ".test.tsx",
  "CLAUDE.md",
  ".claude/rules",
];

// Server routes are always server-only in Next.js (never bundled to the
// client) regardless of imports, so route.ts/route.js files are excluded
// from the source scan even when they sit under src/app.
export const excludedFileNames = ["route.ts", "route.js"];

// The static bundle directory produced by `next build`, scanned in full
// (no glob filtering — everything there is genuinely public).
export const staticBundleDir = ".next/static";
