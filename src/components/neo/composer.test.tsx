// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Composer } from "./composer";

function setup(overrides: Partial<ComponentProps<typeof Composer>> = {}) {
  const onChange = vi.fn();
  const onEnviar = vi.fn();
  const onParar = vi.fn();
  render(<Composer value="" onChange={onChange} onEnviar={onEnviar} onParar={onParar} emExecucao={false} {...overrides} />);
  return { onChange, onEnviar, onParar };
}

describe("Composer", () => {
  it("sends on Enter without Shift", () => {
    const { onEnviar } = setup({ value: "investigar algo" });
    const textarea = screen.getByRole("textbox", { name: "Mensagem para o Neo" });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(onEnviar).toHaveBeenCalledTimes(1);
  });

  it("does not send on Shift+Enter (keeps it as a newline)", () => {
    const { onEnviar } = setup({ value: "investigar algo" });
    const textarea = screen.getByRole("textbox", { name: "Mensagem para o Neo" });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(onEnviar).not.toHaveBeenCalled();
  });

  it("never sends an empty/whitespace-only message", () => {
    const { onEnviar } = setup({ value: "   " });
    const textarea = screen.getByRole("textbox", { name: "Mensagem para o Neo" });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onEnviar).not.toHaveBeenCalled();
  });

  it("replaces the send button with a stop button while an execution is running, and disables the textarea", () => {
    setup({ value: "", emExecucao: true });
    expect(screen.getByRole("button", { name: "Parar execução" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar mensagem" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Mensagem para o Neo" })).toBeDisabled();
  });

  it("calls onParar when the stop button is clicked", () => {
    const { onParar } = setup({ value: "", emExecucao: true });
    fireEvent.click(screen.getByRole("button", { name: "Parar execução" }));
    expect(onParar).toHaveBeenCalledTimes(1);
  });

  it("disables the send button while there is no text", () => {
    setup({ value: "" });
    expect(screen.getByRole("button", { name: "Enviar mensagem" })).toBeDisabled();
  });
});
