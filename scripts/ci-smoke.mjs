import { spawn } from "node:child_process";
import {
  isCiEnvironment,
  loadProjectEnv,
  npmCommand,
  nodeCommand,
  waitForHealth,
} from "./lib/env-utils.mjs";

loadProjectEnv();

const port = process.env.CI_PORT || "3099";
const baseUrl = `http://127.0.0.1:${port}`;
const ci = isCiEnvironment();

const env = {
  ...process.env,
  PORT: port,
  AUTH_SECRET: process.env.AUTH_SECRET || "ci-smoke-auth-secret-minimum-32-characters",
  WORKER_SECRET: process.env.WORKER_SECRET || "ci-smoke-worker-secret-minimum-32-chars",
  SMOKE_TEST_SECRET: process.env.SMOKE_TEST_SECRET || "ci-smoke-test-secret-minimum-32-chars",
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || "ci-razorpay-webhook-secret-for-smoke-tests",
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "ci-razorpay-webhook-secret-for-smoke-tests",
  SEED_CUSTOMER_EMAIL: process.env.SEED_CUSTOMER_EMAIL || "customer@ar360.com",
  SEED_CUSTOMER_PASSWORD: process.env.SEED_CUSTOMER_PASSWORD || "Customer@12345",
  MYSQL_HOST: process.env.MYSQL_HOST || "127.0.0.1",
  MYSQL_PORT: process.env.MYSQL_PORT || "3306",
  MYSQL_USER: process.env.MYSQL_USER || "root",
  MYSQL_PASSWORD: process.env.MYSQL_PASSWORD ?? (ci ? "root" : ""),
  MYSQL_DATABASE: process.env.MYSQL_DATABASE || "arstudio",
  SKIP_RUNTIME_DDL: "false",
  NEXT_PUBLIC_APP_URL: baseUrl,
  APP_URL: baseUrl,
};

function runProcess(command, args, childEnv = env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false, env: childEnv });
    child.on("exit", (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}

console.log("Running migrations...");
console.log(`  MYSQL_HOST=${env.MYSQL_HOST} MYSQL_USER=${env.MYSQL_USER} MYSQL_DATABASE=${env.MYSQL_DATABASE}`);

try {
  await runProcess(npmCommand(), ["run", "db:migrate"]);
} catch (error) {
  console.error("\nMigration failed. Check MySQL is running and credentials in .env match XAMPP/phpMyAdmin.");
  console.error("XAMPP default is usually MYSQL_PASSWORD= (empty).\n");
  throw error;
}

console.log("Seeding auth users...");
await runProcess(npmCommand(), ["run", "auth:seed"]);

console.log(`Starting server on ${baseUrl}...`);
const server = spawn(npmCommand(), ["run", "start"], { stdio: "inherit", shell: false, env });

let failed = false;
try {
  const healthy = await waitForHealth(baseUrl, 60);
  if (!healthy) throw new Error("Server health check timed out");

  const steps = [
    [nodeCommand(), ["scripts/e2e-customer-smoke.mjs", baseUrl]],
    [nodeCommand(), ["scripts/api-smoke-test.mjs"]],
    [nodeCommand(), ["scripts/oc-worker-smoke.mjs", baseUrl]],
    [nodeCommand(), ["scripts/e2e-auth-smoke.mjs", baseUrl]],
    [nodeCommand(), ["scripts/e2e-product-flow-smoke.mjs", baseUrl]],
    [nodeCommand(), ["scripts/billing-webhook-smoke.mjs", baseUrl]],
    [nodeCommand(), ["scripts/storage-smoke.mjs", baseUrl]],
  ];

  for (const [command, args] of steps) {
    console.log(`\n> ${command} ${args.join(" ")}`);
    await runProcess(command, args);
  }
} catch (error) {
  failed = true;
  console.error(error instanceof Error ? error.message : error);
} finally {
  server.kill("SIGTERM");
}

if (failed) process.exit(1);
console.log("\nCI smoke passed.\n");
