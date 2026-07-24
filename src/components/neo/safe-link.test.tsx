// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SafeLink } from "./safe-link";

describe("SafeLink", () => {
  it("renders a real anchor with target=_blank and rel=noopener noreferrer for an https URL", () => {
    render(<SafeLink href="https://example.com">Exemplo</SafeLink>);
    const link = screen.getByRole("link", { name: /Exemplo/ });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("never renders a clickable link for a javascript: URL", () => {
    render(<SafeLink href="javascript:alert(1)">Clique aqui</SafeLink>);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Clique aqui")).toBeInTheDocument();
  });

  it("never renders a clickable link for a file: URL", () => {
    render(<SafeLink href="file:///etc/passwd">Arquivo</SafeLink>);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
