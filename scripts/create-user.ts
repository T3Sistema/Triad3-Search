#!/usr/bin/env tsx
// Administrative CLI to create the first (and any subsequent) Triad3 Search
// user. There is no public signup — this is the only way to add an account.
//
// Deliberately self-contained: it does NOT import anything under
// src/server/ that has `import "server-only"` (those throw when loaded
// outside the Next.js bundler). It builds its own Supabase client and calls
// @node-rs/argon2 directly, sharing only the plain constants/validators
// that are safe to import anywhere (src/lib/auth/validation.ts,
// src/server/auth/argon2-params.ts).
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createClient } from "@supabase/supabase-js";
import { hash } from "@node-rs/argon2";
import { ARGON2_OPTIONS } from "../src/server/auth/argon2-params";
import { MIN_PASSWORD_LENGTH, isStrongPassword, isValidEmail, normalizeEmail } from "../src/lib/auth/validation";

// Control character codes used while reading masked input, spelled out as
// numbers rather than escape sequences so nothing unprintable ends up
// embedded in the source file itself.
const CODE_CTRL_C = 3;
const CODE_CTRL_D = 4;
const CODE_BACKSPACE = 127;

// node's readline/promises has a long-standing quirk: a second
// rl.question() never resolves once piped (non-TTY) stdin has already
// reached EOF. Interactive terminals never hit that (nothing is buffered
// ahead of the user typing), so only the non-TTY path needs a workaround —
// read all of stdin up front and hand out answers from a queue.
let pipedLines: string[] | null = null;

async function readAllPipedLines(): Promise<string[]> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8").split("\n");
}

async function ask(question: string): Promise<string> {
  stdout.write(question);

  if (!stdin.isTTY) {
    if (pipedLines === null) pipedLines = await readAllPipedLines();
    const next = pipedLines.shift() ?? "";
    stdout.write(next + "\n");
    return next.trim();
  }

  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  try {
    return (await rl.question("")).trim();
  } finally {
    rl.close();
  }
}

/** Masks input with "*" when the terminal supports raw mode; falls back to a plain prompt otherwise. */
function askHidden(question: string): Promise<string> {
  if (!stdin.isTTY) {
    return ask(question);
  }

  return new Promise((resolve, reject) => {
    stdout.write(question);
    let value = "";

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
    };

    function onData(char: string) {
      const code = char.charCodeAt(0);
      const isEnter = char === "\n" || char === "\r";
      const isBackspace = code === CODE_BACKSPACE || char === "\b";

      if (isEnter || code === CODE_CTRL_D) {
        cleanup();
        stdout.write("\n");
        resolve(value);
        return;
      }

      if (code === CODE_CTRL_C) {
        cleanup();
        stdout.write("\n");
        reject(new Error("Cancelado."));
        return;
      }

      if (isBackspace) {
        if (value.length > 0) {
          value = value.slice(0, -1);
          stdout.write("\b \b");
        }
        return;
      }

      value += char;
      stdout.write("*");
    }

    stdin.on("data", onData);
  });
}

function fail(message: string): never {
  console.error(message);
  process.exitCode = 1;
  throw new Error(message);
}

async function main() {
  console.log("Triad3 Search — criação de usuário administrativo\n");

  const nome = await ask("Nome: ");
  if (!nome) fail("Nome não pode ser vazio.");

  const emailInput = await ask("E-mail: ");
  const email = normalizeEmail(emailInput);
  if (!isValidEmail(email)) fail("E-mail inválido.");

  const senha = await askHidden(`Senha (mínimo ${MIN_PASSWORD_LENGTH} caracteres): `);
  if (!isStrongPassword(senha)) fail(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);

  const confirmacao = await askHidden("Confirme a senha: ");
  if (senha !== confirmacao) fail("As senhas não coincidem.");

  const url = process.env.SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secretKey) {
    fail("Defina SUPABASE_URL e SUPABASE_SECRET_KEY (por exemplo em .env.local) antes de rodar este script.");
  }

  const supabase = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const passwordHash = await hash(senha, ARGON2_OPTIONS);

  const { data, error } = await supabase
    .from("usuarios")
    .insert({ nome, email, password_hash: passwordHash })
    .select("id, nome, email")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      fail("Já existe um usuário com este e-mail.");
    }
    fail("Não foi possível criar o usuário. Confira a conexão com o banco e tente novamente.");
  }

  console.log("\nUsuário criado com sucesso:");
  console.log(`  Nome:   ${data.nome}`);
  console.log(`  E-mail: ${data.email}`);
  console.log(`  ID:     ${data.id}`);
}

main().catch((error) => {
  if (process.exitCode === undefined) process.exitCode = 1;
  if (error instanceof Error && error.message === "Cancelado.") {
    // User-initiated cancel — already reported inline, nothing more to log.
  }
});
