"use client";

import * as React from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { sanitizeInternalPath } from "@/lib/auth/redirect-target";
import styles from "./login-page.module.css";

const GENERIC_LOGIN_ERROR = "E-mail ou senha inválidos.";
const RATE_LIMIT_ERROR = "Muitas tentativas. Tente novamente em alguns minutos.";
const TEMPORARY_ERROR = "Não foi possível entrar agora. Tente novamente em instantes.";

/** "Liquid glass" login screen, wired to POST /api/triad3/sessao/entrar. */
export function LoginPage() {
  const searchParams = useSearchParams();
  const sceneRef = React.useRef<HTMLDivElement>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const emailRef = React.useRef<HTMLInputElement>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);

  const [emailInvalid, setEmailInvalid] = React.useState(false);
  const [passwordInvalid, setPasswordInvalid] = React.useState(false);
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<{ message: string; isError: boolean }>({
    message: "",
    isError: false,
  });

  React.useEffect(() => {
    const scene = sceneRef.current;
    const card = cardRef.current;
    if (!scene || !card) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) return;

    const handlePointerMove = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth) * 100;
      const y = (event.clientY / window.innerHeight) * 100;
      scene.style.setProperty("--mx", `${x}%`);
      scene.style.setProperty("--my", `${y}%`);
    };

    const handleCardPointerMove = (event: PointerEvent) => {
      const bounds = card.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      card.style.setProperty("--ry", `${x * 2.8}deg`);
      card.style.setProperty("--rx", `${y * -2.2}deg`);
    };

    const handleCardPointerLeave = () => {
      card.style.setProperty("--ry", "0deg");
      card.style.setProperty("--rx", "0deg");
    };

    window.addEventListener("pointermove", handlePointerMove);
    card.addEventListener("pointermove", handleCardPointerMove);
    card.addEventListener("pointerleave", handleCardPointerLeave);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      card.removeEventListener("pointermove", handleCardPointerMove);
      card.removeEventListener("pointerleave", handleCardPointerLeave);
    };
  }, []);

  const clearFieldError = (field: "email" | "password") => {
    if (field === "email") setEmailInvalid(false);
    else setPasswordInvalid(false);
    setStatus((prev) => (prev.isError ? { message: "", isError: false } : prev));
  };

  const validate = (): boolean => {
    const email = emailRef.current;
    const password = passwordRef.current;
    if (!email || !password) return false;

    const isEmailInvalid = !email.validity.valid;
    const isPasswordInvalid = !password.validity.valid;
    setEmailInvalid(isEmailInvalid);
    setPasswordInvalid(isPasswordInvalid);

    if (isEmailInvalid) {
      setStatus({ message: "Informe um e-mail válido para continuar.", isError: true });
      email.focus();
      return false;
    }

    if (isPasswordInvalid) {
      setStatus({ message: "Informe sua senha.", isError: true });
      password.focus();
      return false;
    }

    setStatus({ message: "", isError: false });
    return true;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !validate()) return;

    const formData = new FormData(event.currentTarget);
    const manterConectado = formData.get("remember") === "on";

    setBusy(true);
    setStatus({ message: "Validando suas credenciais…", isError: false });

    let response: Response;
    try {
      response = await fetch("/api/triad3/sessao/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailRef.current?.value ?? "",
          senha: passwordRef.current?.value ?? "",
          manterConectado,
        }),
      });
    } catch {
      setBusy(false);
      setStatus({ message: TEMPORARY_ERROR, isError: true });
      return;
    }

    if (response.ok) {
      setStatus({ message: "Tudo certo — redirecionando…", isError: false });
      const destino = sanitizeInternalPath(searchParams.get("retorno"), "/");
      window.location.href = destino;
      return; // keep the busy/spinner state until the browser navigates away
    }

    setBusy(false);
    const body: unknown = await response.json().catch(() => null);
    const errorType =
      body && typeof body === "object" && "error" in body && body.error && typeof body.error === "object" && "type" in body.error
        ? (body.error as { type?: unknown }).type
        : undefined;

    if (response.status === 429 || errorType === "rate_limited") {
      setStatus({ message: RATE_LIMIT_ERROR, isError: true });
    } else if (response.status === 401) {
      setStatus({ message: GENERIC_LOGIN_ERROR, isError: true });
    } else {
      setStatus({ message: TEMPORARY_ERROR, isError: true });
    }
  };

  const togglePasswordVisibility = () => {
    setPasswordVisible((visible) => !visible);
    passwordRef.current?.focus({ preventScroll: true });
  };

  const handleForgotPassword = () => {
    setStatus({
      message: "Para recuperar o acesso, entre em contato com o administrador do Triad3 Search.",
      isError: false,
    });
  };

  return (
    <div ref={sceneRef} className={styles.scene} aria-labelledby="login-page-title">
      <svg
        className={styles.network}
        viewBox="0 0 1600 1000"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="loginLineGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity=".96" />
            <stop offset=".5" stopColor="#4f9fff" stopOpacity=".58" />
            <stop offset="1" stopColor="#ffffff" stopOpacity=".26" />
          </linearGradient>
          <radialGradient id="loginNodeGradient" cx=".32" cy=".25" r=".8">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset=".36" stopColor="#8cc7ff" />
            <stop offset="1" stopColor="#1266df" />
          </radialGradient>
        </defs>
        <g fill="none">
          <path className={styles.line} d="M-40 205 150 82 301 181 207 350 393 459 561 349 735 471 905 284 1084 391 1280 227 1660 362" />
          <path className={styles.line} d="M-40 636 177 501 393 459 431 679 648 801 735 471 938 632 1084 391 1238 592 1510 515 1660 655" />
          <path className={styles.line} d="M150 82 207 350 177 501 431 679 386 910" />
          <path className={styles.line} d="M301 181 561 349 648 801 874 913" />
          <path className={styles.line} d="M905 284 938 632 1140 826 1510 515" />
          <path className={styles.line} d="M1280 227 1238 592 1391 840" />
          <path className={styles.pulseLine} d="M-40 636 177 501 393 459 561 349 735 471 905 284 1084 391 1280 227 1660 362" />
          <path className={styles.pulseLine} d="M150 82 301 181 393 459 648 801 874 913" />
        </g>
        <g>
          <circle className={styles.node} cx="150" cy="82" r="10" />
          <circle className={styles.node} cx="301" cy="181" r="7" />
          <circle className={styles.node} cx="207" cy="350" r="10" />
          <circle className={styles.node} cx="177" cy="501" r="6" />
          <circle className={styles.node} cx="393" cy="459" r="9" />
          <circle className={styles.node} cx="431" cy="679" r="7" />
          <circle className={styles.node} cx="561" cy="349" r="6" />
          <circle className={styles.node} cx="648" cy="801" r="10" />
          <circle className={styles.node} cx="735" cy="471" r="7" />
          <circle className={styles.node} cx="905" cy="284" r="9" />
          <circle className={styles.node} cx="938" cy="632" r="6" />
          <circle className={styles.node} cx="1084" cy="391" r="10" />
          <circle className={styles.node} cx="1140" cy="826" r="7" />
          <circle className={styles.node} cx="1280" cy="227" r="7" />
          <circle className={styles.node} cx="1238" cy="592" r="10" />
          <circle className={styles.node} cx="1391" cy="840" r="6" />
          <circle className={styles.node} cx="1510" cy="515" r="9" />
        </g>
      </svg>

      <div className={styles.orb} aria-hidden="true" />
      <div className={styles.horizon} aria-hidden="true" />

      <div className={styles.layout}>
        <section className={styles.intro} aria-label="Apresentação">
          <p className={styles.eyebrow}>Inteligência em movimento</p>
          <h1 id="login-page-title" className={styles.introTitle}>
            Sua inteligência <span>começa aqui.</span>
          </h1>
          <p className={styles.introText}>Entre para pesquisar, conectar e acompanhar o que realmente importa.</p>
        </section>

        <section className={styles.loginShell} aria-label="Acesso à plataforma">
          <div ref={cardRef} className={styles.glassCard}>
            <div className={styles.brand}>
              <Image src="/branding/triad3-search-logo.png" alt="Triad3 Search" width={1983} height={793} priority />
            </div>

            <h2 className={styles.loginTitle}>Acesse sua conta</h2>

            <form noValidate onSubmit={handleSubmit}>
              <div className={cn(styles.field, emailInvalid && styles.fieldInvalid)}>
                <input
                  ref={emailRef}
                  id="login-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder=" "
                  aria-describedby="login-form-status"
                  required
                  onChange={() => clearFieldError("email")}
                />
                <label htmlFor="login-email">E-mail</label>
              </div>

              <div className={cn(styles.field, passwordInvalid && styles.fieldInvalid)}>
                <input
                  ref={passwordRef}
                  id="login-password"
                  name="password"
                  type={passwordVisible ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder=" "
                  aria-describedby="login-form-status"
                  required
                  onChange={() => clearFieldError("password")}
                />
                <label htmlFor="login-password">Senha</label>
                <button
                  className={styles.passwordToggle}
                  type="button"
                  aria-label={passwordVisible ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={passwordVisible}
                  onClick={togglePasswordVisibility}
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M2.7 12s3.4-5.2 9.3-5.2S21.3 12 21.3 12 17.9 17.2 12 17.2 2.7 12 2.7 12Z"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    />
                    <circle cx="12" cy="12" r="2.7" stroke="currentColor" strokeWidth="1.7" />
                  </svg>
                </button>
              </div>

              <div className={styles.formOptions}>
                <label className={styles.remember}>
                  <input type="checkbox" name="remember" />
                  <span className={styles.checkmark} aria-hidden="true" />
                  <span>Manter conectado</span>
                </label>

                <button className={styles.forgot} type="button" onClick={handleForgotPassword}>
                  Esqueceu sua senha?
                </button>
              </div>

              <button className={styles.submit} type="submit" aria-busy={busy}>
                <span className={styles.submitContent}>
                  <span>{busy ? "Entrando" : "Entrar"}</span>
                  <svg className={styles.arrow} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M5 12h14M13 6l6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className={styles.spinner} aria-hidden="true" />
                </span>
              </button>

              <p
                className={cn(styles.status, status.isError && styles.statusError)}
                id="login-form-status"
                role="status"
                aria-live="polite"
              >
                {status.message}
              </p>
            </form>

            <div className={styles.secure}>
              <span className={styles.secureDot} aria-hidden="true" />
              <span>Ambiente protegido</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
