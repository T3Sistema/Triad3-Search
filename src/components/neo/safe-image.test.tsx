// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SafeImage } from "./safe-image";

describe("SafeImage", () => {
  it("renders an <img> for a valid http(s) URL", () => {
    render(<SafeImage src="https://example.com/foto.png" alt="Foto de teste" />);
    const img = screen.getByRole("img", { name: "Foto de teste" });
    expect(img).toHaveAttribute("src", "https://example.com/foto.png");
    expect(img).toHaveAttribute("referrerPolicy", "no-referrer");
  });

  it("shows the neutral fallback instead of rendering an <img> for a javascript: URL", () => {
    render(<SafeImage src="javascript:alert(1)" alt="Foto" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Imagem indisponível")).toBeInTheDocument();
  });

  it("shows the fallback for a data: URL too", () => {
    render(<SafeImage src="data:text/html,<script>alert(1)</script>" alt="Foto" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("falls back to the neutral placeholder if the image fails to load at runtime", () => {
    render(<SafeImage src="https://example.com/quebrada.png" alt="Foto quebrada" />);
    const img = screen.getByRole("img");
    fireEvent.error(img);
    expect(screen.getByText("Imagem indisponível")).toBeInTheDocument();
  });
});
