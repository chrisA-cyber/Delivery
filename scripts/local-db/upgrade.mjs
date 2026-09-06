import assert from "node:assert/strict";

// Runs in the caller's fresh, in-memory PostgreSQL instance only.
export async function verifyUpgrade({ db, read, migrations, freshCounts }) {
  const checks = [];
  const apply = async (name) =>
    db.exec(await read(`supabase/migrations/${name}`));
  for (const name of migrations.filter((name) => name < "202609050014"))
    await apply(name);
  await db.exec(await read("scripts/local-db/legacy-seed.sql"));
  await db.exec(await read("scripts/local-db/upgrade-fixture.sql"));
  const original = await snapshots(db);
  for (const name of migrations.filter(
    (name) => name >= "202609050014" && name < "202609050017",
  ))
    await apply(name);
  const v2 = await catalogSnapshot(db);
  for (const name of migrations.filter((name) => name >= "202609050017"))
    await apply(name);
  await assertHistory(
    db,
    original,
    checks,
    "additive migrations without current seed",
  );
  await assertCatalog(
    db,
    v2,
    checks,
    "v2 bodies/directions and UUIDs survive Step1B",
  );
  assert.deepEqual(await activeCounts(db), freshCounts);
  checks.push(
    "additive upgrade active catalog counts match fresh install without running the new seed",
  );
  await db.exec(await read("supabase/seed.sql"));
  await db.exec(await read("supabase/seed.sql"));
  await assertHistory(db, original, checks, "two current seed reruns");
  await assertCatalog(
    db,
    v2,
    checks,
    "v2 immutable copy survives two seed reruns",
  );
  assert.deepEqual(await activeCounts(db), freshCounts);
  checks.push("two seed reruns preserve final active catalog counts");
  const archived = (
    await db.query(
      "select id from public.prompts where draw_enabled and state='published' order by slug limit 1",
    )
  ).rows[0].id;
  await db.query(
    "update public.prompts set draw_enabled=false,state='archived' where id=$1",
    [archived],
  );
  await db.exec(await read("supabase/seed.sql"));
  assert.deepEqual(
    (
      await db.query(
        "select draw_enabled,state::text from public.prompts where id=$1",
        [archived],
      )
    ).rows[0],
    { draw_enabled: false, state: "archived" },
  );
  checks.push(
    "seed rerun does not resurrect an archived active-catalog prompt",
  );
  return { passed: true, checks };
}
export async function activeCounts(db) {
  return (
    await db.query(`select
    (select count(*)::integer from public.prompts where draw_enabled and state='published') as prompts,
    (select count(*)::integer from public.energy_modifiers where draw_enabled and state='published') as directions,
    (select count(*)::integer from public.content_packs where draw_enabled and state='published') as packs
  `)
  ).rows[0];
}
async function catalogSnapshot(db) {
  return {
    prompts: (
      await db.query(
        "select id,slug::text,body from public.prompts order by id",
      )
    ).rows,
    directions: (
      await db.query(
        "select id,slug::text,instruction from public.energy_modifiers order by id",
      )
    ).rows,
  };
}
async function snapshots(db) {
  return {
    ...(await catalogSnapshot(db)),
    deliveries: (await db.query("select * from public.deliveries order by id"))
      .rows,
    scores: (
      await db.query(
        "select * from public.delivery_scores order by delivery_id",
      )
    ).rows,
    // Compare every original field, while permitting additive group columns.
    challenges: (await db.query(`select id,code,token_digest,created_by,
      recipient_user_id,prompt_id,energy_modifier_id,state,visibility,message,
      max_entries,expires_at,completed_at,created_at,updated_at
      from public.challenges order by id`)).rows,
    entries: (
      await db.query(
        "select * from public.challenge_entries order by challenge_id,entrant_id",
      )
    ).rows,
    daily: (
      await db.query(
        "select * from public.daily_challenges order by challenge_date,market",
      )
    ).rows,
  };
}
async function assertCatalog(db, saved, checks, description) {
  const after = await catalogSnapshot(db);
  for (const table of ["prompts", "directions"]) {
    const beforeIds = new Set(saved[table].map((row) => row.id));
    assert.deepEqual(
      after[table].filter((row) => beforeIds.has(row.id)),
      saved[table],
    );
  }
  checks.push(description);
}
async function assertHistory(db, saved, checks, description) {
  const after = await snapshots(db);
  for (const table of ["deliveries", "scores", "challenges", "entries"])
    assert.deepEqual(after[table], saved[table]);
  const oldDays = new Set(
    saved.daily.map((row) => `${row.challenge_date}/${row.market}`),
  );
  assert.deepEqual(
    after.daily.filter((row) =>
      oldDays.has(`${row.challenge_date}/${row.market}`),
    ),
    saved.daily,
  );
  await assertCatalog(
    db,
    saved,
    checks,
    `legacy catalog IDs and text preserved after ${description}`,
  );
  checks.push(
    `exact deliveries/scores/challenge entries/Daily fixtures preserved after ${description}`,
  );
}

export async function verifyMatureUpgrade({ db, read, migrations }) {
  for (const name of migrations.filter((name) => name < "202609050014"))
    await db.exec(await read(`supabase/migrations/${name}`));
  await db.exec(await read("scripts/local-db/legacy-seed.sql"));
  await db.exec(await read("scripts/local-db/upgrade-fixture.sql"));
  for (const name of migrations.filter(
    (name) => name >= "202609050014" && name < "202609050016",
  ))
    await db.exec(await read(`supabase/migrations/${name}`));
  await db.exec(`
    update public.prompts set rating='mature' where slug='timeline-needs-me';
    update public.deliveries set moderation_labels=array['publish-approved'], visibility='public',
      share_asset_path='57575757-5757-4757-8757-575757575701/fixture-share.png'
    where id='59595959-5959-4959-8959-595959595901';
  `);
  const matureMigration = migrations.find((name) =>
    name.startsWith("202609050016"),
  );
  const sql = await read(`supabase/migrations/${matureMigration}`);
  await assert.rejects(
    db.exec(sql),
    (error) =>
      error.code === "55000" &&
      error.message.includes("Remove existing mature delivery-share objects"),
  );
  const before = (
    await db.query(
      "select visibility::text,share_asset_path from public.deliveries where id='59595959-5959-4959-8959-595959595901'",
    )
  ).rows[0];
  assert.equal(before.visibility, "public");
  assert.equal(
    before.share_asset_path,
    "57575757-5757-4757-8757-575757575701/fixture-share.png",
  );
  // Fixture contains no actual object. A real environment must remove the object
  // through Storage before clearing this pointer; this runner does neither.
  await db.exec(
    "update public.deliveries set share_asset_path=null where id='59595959-5959-4959-8959-595959595901'",
  );
  await db.exec(sql);
  const after = (
    await db.query(
      "select visibility::text,moderation_labels,share_asset_path from public.deliveries where id='59595959-5959-4959-8959-595959595901'",
    )
  ).rows[0];
  assert.equal(after.visibility, "private");
  assert.ok(after.moderation_labels.includes("mature-content"));
  assert.equal(after.share_asset_path, null);
  return {
    passed: true,
    checks: [
      "016 refuses an existing Mature share pointer with 55000 before altering the receipt",
      "the failed migration preserves the share pointer and visibility for explicit operator cleanup",
      "after removing the nonexistent fixture pointer, 016 contains the receipt as private with a sticky Mature marker",
    ],
  };
}
