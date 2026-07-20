import { spawn } from "node:child_process";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

/** Load .env, .env.local, etc. (same order as Next.js). */
export function loadProjectEnv() {
  loadEnvConfig(process.cwd());
}

export function isCiEnvironment() {
  return process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
}

export function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

export function nodeCommand() {
  return process.execPath;
}

export async function waitForHealth(baseUrl, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return true;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

export async function requireReachableServer(baseUrl) {
  const ok = await waitForHealth(baseUrl, 3);
  if (ok) return;

  console.error(`\nServer not reachable at ${baseUrl}`);
  console.error("Start the app first, then rerun smoke tests:");
  console.error("  npm run dev");
  console.error("  npm run smoke:e2e\n");
  process.exit(1);
}

export function runProcess(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false, env });
    child.on("exit", (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}
