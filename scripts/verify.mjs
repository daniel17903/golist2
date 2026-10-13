#!/usr/bin/env node
// One command to run the right checks, for agents and humans.
//
//   node scripts/verify.mjs            # lint + typecheck + unit/sim tests (web + backend)
//   node scripts/verify.mjs --changed  # only the checks the changed paths need (AGENTS.md matrix)
//   node scripts/verify.mjs --full     # everything, including Playwright E2E
//   node scripts/verify.mjs --changed --base origin/main
//   node scripts/verify.mjs --changed --list   # only print which checks would run
//
// Every check runs even if an earlier one fails; a summary is printed at the
// end and the exit code is non-zero if anything failed.
import { execFileSync, spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const mode = args.includes("--full") ? "full" : args.includes("--changed") ? "changed" : "default";
const baseIndex = args.indexOf("--base");
const baseRef = baseIndex >= 0 ? args[baseIndex + 1] : "origin/main";

const checks = {
  lintWeb: { label: "web lint", cmd: ["npm", "run", "lint", "-w", "apps/web"] },
  typecheckWeb: { label: "web typecheck", cmd: ["npm", "run", "typecheck", "-w", "apps/web"] },
  testWeb: { label: "web unit + sync sim tests", cmd: ["npm", "run", "test", "-w", "apps/web"] },
  buildWeb: { label: "web build", cmd: ["npm", "run", "build", "-w", "apps/web"] },
  e2eWeb: { label: "web E2E (Playwright)", cmd: ["npm", "run", "test:e2e", "-w", "apps/web"] },
  lintBackend: { label: "backend lint", cmd: ["npm", "run", "lint", "-w", "apps/backend"] },
  typecheckBackend: { label: "backend typecheck", cmd: ["npm", "run", "typecheck", "-w", "apps/backend"] },
  testBackend: { label: "backend tests", cmd: ["npm", "run", "test", "-w", "apps/backend"] },
  buildBackend: { label: "backend build", cmd: ["npm", "run", "build", "-w", "apps/backend"] },
};

const order = Object.keys(checks);
const defaultChecks = ["lintWeb", "typecheckWeb", "testWeb", "lintBackend", "typecheckBackend", "testBackend"];

const changedFiles = () => {
  const git = (...gitArgs) => execFileSync("git", gitArgs, { encoding: "utf8" }).trim();
  let base = "HEAD";
  try {
    base = git("merge-base", "HEAD", baseRef);
  } catch {
    console.warn(`[verify] could not resolve ${baseRef}; comparing against HEAD only`);
  }
  const committed = git("diff", "--name-only", base, "HEAD");
  const working = git("diff", "--name-only", "HEAD");
  const untracked = git("ls-files", "--others", "--exclude-standard");
  return [...new Set([committed, working, untracked].join("\n").split("\n").filter(Boolean))];
};

// Mirrors the "Testing expectations" matrix in AGENTS.md.
const checksForChanges = (files) => {
  const selected = new Set();
  const add = (...names) => names.forEach((name) => selected.add(name));
  for (const file of files) {
    if (file.startsWith("packages/shared/")) {
      // Shared code is consumed by both apps and by the sync protocol.
      add(...defaultChecks, "buildBackend", "e2eWeb");
    } else if (file.startsWith("apps/backend/")) {
      add("lintBackend", "typecheckBackend", "testBackend", "testWeb");
      // Runtime code and build/packaging config must still compile to dist.
      if (/apps\/backend\/(src\/|package\.json|tsconfig[^/]*\.json|Dockerfile)/.test(file) && !/\.test\.ts$/.test(file)) {
        add("buildBackend");
      }
      if (/src\/(routes|repositories|sync)\//.test(file)) {
        add("e2eWeb");
      }
    } else if (file.startsWith("apps/web/")) {
      add("lintWeb", "typecheckWeb");
      if (/apps\/web\/(src|sim)\//.test(file)) {
        add("testWeb");
      }
      if (/apps\/web\/src\/(components|hooks|state|sharing|storage|App\.tsx)/.test(file) || file.startsWith("apps/web/e2e/")) {
        add("e2eWeb");
      }
      if (/apps\/web\/(public\/|vite\.config\.ts|index\.html)/.test(file)) {
        add("buildWeb");
      }
    } else if (file === "package.json" || file === "package-lock.json") {
      add(...defaultChecks, "buildWeb", "buildBackend");
    }
  }
  return order.filter((name) => selected.has(name));
};

let selected;
if (mode === "full") {
  selected = [...defaultChecks, "buildWeb", "buildBackend", "e2eWeb"];
} else if (mode === "changed") {
  const files = changedFiles();
  console.log(`[verify] ${files.length} changed file(s) vs ${baseRef}`);
  selected = checksForChanges(files);
  if (selected.length === 0) {
    console.log("[verify] nothing to check for these changes");
    process.exit(0);
  }
} else {
  selected = defaultChecks;
}

if (args.includes("--list")) {
  selected.forEach((name) => console.log(`${checks[name].label}: ${checks[name].cmd.join(" ")}`));
  process.exit(0);
}

const results = [];
for (const name of selected) {
  const { label, cmd } = checks[name];
  console.log(`\n[verify] ▶ ${label}: ${cmd.join(" ")}`);
  const startedAt = Date.now();
  const outcome = spawnSync(cmd[0], cmd.slice(1), { stdio: "inherit" });
  results.push({ label, ok: outcome.status === 0, seconds: (Date.now() - startedAt) / 1000 });
}

console.log("\n[verify] summary");
for (const { label, ok, seconds } of results) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label} (${seconds.toFixed(1)}s)`);
}
const failures = results.filter((result) => !result.ok);
if (failures.some((result) => result.label.startsWith("web E2E"))) {
  console.log("\n[verify] E2E failure artifacts: apps/web/test-results/ (traces, *-websocket-frames.txt, *-console.txt, backend-log.jsonl)");
}
process.exit(failures.length > 0 ? 1 : 0);
