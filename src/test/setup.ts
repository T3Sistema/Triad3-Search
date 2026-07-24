import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement scrollTo/scrollIntoView — no-op polyfill so
// components using them for UX (auto-scroll chat views, etc.) don't crash
// under test.
if (typeof Element !== "undefined") {
  if (!Element.prototype.scrollTo) {
    Element.prototype.scrollTo = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}
