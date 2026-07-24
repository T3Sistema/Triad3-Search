// Vitest stub: the real `server-only` package throws unconditionally when
// imported outside of the Next.js bundler (it relies on webpack/turbopack
// aliasing, not a runtime check). Tests run under plain Node, so this
// no-op replaces it via the `server-only` alias in vitest.config.ts.
export {};
