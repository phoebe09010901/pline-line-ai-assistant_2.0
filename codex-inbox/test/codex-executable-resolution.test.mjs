import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { chmodSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { codexSearchPath, resolveCodexExecutable } from "../monitor.js";

async function withTempExecutable(name = "codex") {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pline-codex-bin-"));
  const file = path.join(dir, name);
  await writeFile(file, "#!/bin/sh\nexit 0\n");
  chmodSync(file, 0o755);
  return { dir, file, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

const explicit = await withTempExecutable("codex-custom");
try {
  assert.equal(resolveCodexExecutable({ CODEX_BIN: explicit.file, PATH: "" }), explicit.file);
} finally {
  await explicit.cleanup();
}

const pathOnly = await withTempExecutable("codex");
try {
  assert.equal(resolveCodexExecutable({ PATH: pathOnly.dir }), pathOnly.file);
  assert.ok(codexSearchPath({ PATH: pathOnly.dir }).includes(pathOnly.dir));
} finally {
  await pathOnly.cleanup();
}

assert.throws(
  () => resolveCodexExecutable({ CODEX_BIN: "/tmp/pline-missing-codex-bin", PATH: "" }),
  /codex_executable_not_executable/,
);

const actual = resolveCodexExecutable(process.env);
assert.match(actual, /\/codex$/);
console.log(JSON.stringify({ ok: true, actual }));
