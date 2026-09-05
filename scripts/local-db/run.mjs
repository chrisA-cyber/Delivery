import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pgtap } from "@electric-sql/pglite-pgtap";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  activeCounts,
  verifyUpgrade,
  verifyMatureUpgrade,
} from "./upgrade.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (name) => readFile(path.join(root, name), "utf8");
const startedAt = new Date().toISOString();
const report = {
  startedAt,
  engine: "PGlite PostgreSQL WASM",
  boundary:
    "SQL only; test auth/storage schemas; no external services or credentials",
  migrations: [],
  sha256: {},
  tests: [],
};
const makeDb = () => new PGlite({ extensions: { pgcrypto, citext, pgtap } });
const db = makeDb();
const migrations = (await readdir(path.join(root, "supabase/migrations")))
  .filter((file) => file.endsWith(".sql"))
  .sort();
let failed = false;
try {
  await db.exec(await read("scripts/local-db/bootstrap.sql"));
  report.version = (
    await db.query("select version() as version")
  ).rows[0].version;
  for (const name of migrations) {
    const sql = await read(`supabase/migrations/${name}`);
    report.sha256[name] = createHash("sha256").update(sql).digest("hex");
    await db.exec(sql);
    report.migrations.push(name);
    console.log(`migration passed: ${name}`);
  }
  const seed = await read("supabase/seed.sql");
  report.sha256["seed.sql"] = createHash("sha256").update(seed).digest("hex");
  await db.exec(seed);
  console.log("seed passed");
  report.activeCounts = await activeCounts(db);
  for (const name of (await readdir(path.join(root, "supabase/tests/database")))
    .filter((file) => file.endsWith(".test.sql"))
    .sort()) {
    try {
      const results = await db.exec(
        await read(`supabase/tests/database/${name}`),
      );
      const tap = results.flatMap((result) =>
        result.rows.flatMap((row) =>
          Object.values(row).filter(
            (value) =>
              typeof value === "string" &&
              /^(?:ok |not ok |1\.\.|#)/m.test(value),
          ),
        ),
      );
      const failures = tap.filter(
        (line) => /^not ok /m.test(line) || /^# Looks like /m.test(line),
      );
      const assertions = tap.filter((line) =>
        /^(?:ok |not ok )/m.test(line),
      ).length;
      if (failures.length || !assertions) failed = true;
      report.tests.push({
        name,
        assertions,
        passed: failures.length === 0 && assertions > 0,
        failures,
        tap,
      });
      console.log(
        `${failures.length ? "FAIL" : "PASS"} ${name}: ${assertions} assertions`,
      );
      for (const failure of failures) console.log(failure);
    } catch (error) {
      failed = true;
      await db.exec("rollback;");
      report.tests.push({
        name,
        passed: false,
        error: error.message,
        code: error.code,
        detail: error.detail,
      });
      console.log(
        `ERROR ${name}: ${error.message} (${error.code}) ${error.detail || ""}`,
      );
    }
  }
  const upgradeDb = makeDb();
  try {
    await upgradeDb.exec(await read("scripts/local-db/bootstrap.sql"));
    report.upgrade = await verifyUpgrade({
      db: upgradeDb,
      read,
      migrations,
      freshCounts: report.activeCounts,
    });
    console.log(
      `PASS additive upgrade: ${report.upgrade.checks.length} checks`,
    );
  } finally {
    await upgradeDb.close();
  }
  const matureDb = makeDb();
  try {
    await matureDb.exec(await read("scripts/local-db/bootstrap.sql"));
    report.matureUpgrade = await verifyMatureUpgrade({
      db: matureDb,
      read,
      migrations,
    });
    console.log(
      `PASS mature upgrade preflight: ${report.matureUpgrade.checks.length} checks`,
    );
  } finally {
    await matureDb.close();
  }
} catch (error) {
  failed = true;
  report.error = {
    message: error.message,
    code: error.code,
    detail: error.detail,
  };
  console.log(`STOP: ${error.message} (${error.code}) ${error.detail || ""}`);
} finally {
  await db.close();
  report.finishedAt = new Date().toISOString();
  report.passed = !failed;
  report.assertions = report.tests.reduce(
    (sum, test) => sum + (test.assertions || 0),
    0,
  );
  const output = path.join(root, "docs/evidence/classic-step-1b");
  await mkdir(output, { recursive: true });
  await writeFile(
    path.join(output, "database.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
}
if (failed) process.exitCode = 1;
