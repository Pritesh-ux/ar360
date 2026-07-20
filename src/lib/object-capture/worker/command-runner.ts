import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";

export class CommandCancelledError extends Error {
  constructor(message = "Command cancelled") {
    super(message);
    this.name = "CommandCancelledError";
  }
}

export class CommandTimeoutError extends Error {
  constructor(command: string, timeoutMs: number) {
    super(`${command} exceeded its ${timeoutMs}ms stage timeout`);
    this.name = "CommandTimeoutError";
  }
}

export type CommandSpec = {
  command: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
};

export type CommandResult = {
  exitCode: number;
  durationMs: number;
  output: string;
};

export type CommandRunnerOptions = {
  signal?: AbortSignal;
  onLine?: (line: string, stream: "stdout" | "stderr") => void | Promise<void>;
};

function executableName(command: string) {
  return command.replace(/^.*[\\/]/, "");
}

export function parsePercent(line: string): number | null {
  const patterns = [
    /(?:progress|processed|completed)[^\d]{0,8}(\d{1,3}(?:\.\d+)?)\s*%/i,
    /\b(\d{1,3}(?:\.\d+)?)\s*%/,
  ];
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) return Math.max(0, Math.min(100, Number(match[1])));
  }
  return null;
}

export async function terminateProcessTree(child: ChildProcess): Promise<void> {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    await new Promise<void>((resolve) => {
      const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
        shell: false,
        windowsHide: true,
        stdio: "ignore",
      });
      killer.once("exit", () => resolve());
      killer.once("error", () => resolve());
    });
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {}
  }
  await new Promise((resolve) => setTimeout(resolve, 3000));
  if (child.exitCode === null) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      try {
        child.kill("SIGKILL");
      } catch {}
    }
  }
}

export async function runCommand(
  spec: CommandSpec,
  options: CommandRunnerOptions = {},
): Promise<CommandResult> {
  if (options.signal?.aborted) throw new CommandCancelledError();
  const startedAt = Date.now();
  const output: string[] = [];
  let timedOut = false;
  let cancelled = false;

  const child = spawn(spec.command, spec.args, {
    cwd: spec.cwd,
    env: { ...process.env, ...spec.env },
    shell: false,
    windowsHide: true,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });

  const consume = (stream: NodeJS.ReadableStream, name: "stdout" | "stderr") => {
    const reader = createInterface({ input: stream });
    reader.on("line", (line) => {
      output.push(`[${name}] ${line}`);
      if (output.length > 2000) output.splice(0, output.length - 2000);
      void options.onLine?.(line, name);
    });
  };
  if (child.stdout) consume(child.stdout, "stdout");
  if (child.stderr) consume(child.stderr, "stderr");

  const timeout = setTimeout(() => {
    timedOut = true;
    void terminateProcessTree(child);
  }, spec.timeoutMs);
  timeout.unref();
  const abort = () => {
    cancelled = true;
    void terminateProcessTree(child);
  };
  options.signal?.addEventListener("abort", abort, { once: true });

  try {
    const exitCode = await new Promise<number>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => resolve(code ?? -1));
    });
    if (cancelled) throw new CommandCancelledError();
    if (timedOut) throw new CommandTimeoutError(executableName(spec.command), spec.timeoutMs);
    if (exitCode !== 0) {
      const detail = output.slice(-40).join("\n");
      throw new Error(`${executableName(spec.command)} exited with code ${exitCode}${detail ? `\n${detail}` : ""}`);
    }
    return { exitCode, durationMs: Date.now() - startedAt, output: output.join("\n") };
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}
