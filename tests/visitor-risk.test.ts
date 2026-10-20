import test from "node:test";
import assert from "node:assert/strict";
import { createFamilyGame, enterFamilyMode } from "../src/game/family-mode";
import { transition } from "../src/game/reducer";
import {
  chooseEncounter,
  closeEncounter,
  encounterFor,
  prepareEncounter,
} from "../src/game/encounters";
import {
  defenseChance,
  ensureEncounterSecret,
  scheduleVisit,
  visitorSecret,
} from "../src/game/encounter-effects";
import { isGameState, loadGame } from "../src/game/storage";
import { getPerson } from "../src/game/initial";
import { settleLife } from "../src/game/life";
import type { GameState } from "../src/game/types";
function fixture(
  id = "neighbor-food",
  identity: "honest" | "fraud" | "raiders" = "honest",
  roll = 0.9,
) {
  const s = transition(
    transition(createFamilyGame(12345), { type: "end-day" }).state,
    { type: "next" },
  ).state;
  s.encounters!.current!.id = id;
  s.encounters!.current!.secret = { identity, roll };
  return s;
}
function load(s: GameState) {
  return loadGame({
    getItem: () => JSON.stringify(s),
    setItem() {},
    removeItem() {},
  });
}
test("同一种求助的真诚/诈骗/埋伏均能自然抽到，询问与刷新不重抽身份和结果骰", () => {
  const identities = new Set<string>();
  for (let seed = 1; seed <= 100; seed++) {
    let s = transition(
      transition(createFamilyGame(Math.imul(seed, 2654435761) >>> 0), {
        type: "end-day",
      }).state,
      { type: "next" },
    ).state;
    const secret = structuredClone(s.encounters!.current!.secret!);
    identities.add(secret.identity);
    const rng = s.rngState;
    s = chooseEncounter(s, "ask").state;
    assert.deepEqual(s.encounters!.current!.secret, secret);
    assert.equal(s.rngState, rng);
    const loaded = load(s);
    assert.equal(loaded.status, "valid");
    if (loaded.status === "valid")
      assert.deepEqual(visitorSecret(loaded.state), secret);
    assert.deepEqual(prepareEncounter(s), s);
    assert.doesNotMatch(encounterFor(s)!.reply, /身份：|身份为|必定|百分之/);
  }
  assert.deepEqual(identities, new Set(["honest", "fraud", "raiders"]));
});
test("隔门帮助也会被骗，开门遇到骗子可失窃，假水不入库，真救援可加固", () => {
  for (const [id, resource] of [
    ["neighbor-food", "food"],
    ["child-water", "water"],
    ["messenger", "medicine"],
  ] as const) {
    const initial = fixture(id, "fraud");
    const s = chooseEncounter(initial, "give").state;
    assert.equal(s.resources[resource], initial.resources[resource] - 1);
    assert.match(s.encounters!.current!.outcome!, /骗/);
    assert.equal(s.encounters!.followUp, null);
    assert.ok(getPerson(s, "mom").mood < getPerson(initial, "mom").mood);
    const stolen = chooseEncounter(initial, "open").state;
    assert.equal(
      stolen.resources.water,
      initial.resources.water - (resource === "water" ? 2 : 1),
    );
  }
  const fake = chooseEncounter(fixture("barter-water", "fraud"), "trade").state;
  assert.equal(fake.resources.food, 2);
  assert.equal(fake.resources.water, 2);
  assert.match(fake.encounters!.current!.outcome!, /不能喝/);
  const rescue = fixture("rescue-check", "honest");
  const good = chooseEncounter(rescue, "give").state;
  assert.equal(good.resources.safety, rescue.resources.safety + 5);
  assert.equal(good.resources.food, 2);
});
test("开门遭抢实际扣物资并伤留守者，重复点击与刷新不重复，夜晚可因伤恶化死亡", () => {
  const initial = fixture("neighbor-food", "raiders", 0.99);
  getPerson(initial, "dad").health = 6;
  let s = chooseEncounter(initial, "open").state;
  assert.equal(s.resources.food, 0);
  assert.equal(s.resources.water, 1);
  assert.equal(s.resources.materials, 2);
  assert.equal(s.resources.safety, initial.resources.safety - 12);
  assert.equal(getPerson(s, "dad").health, 1);
  assert.match(s.encounters!.current!.outcome!, /抢/);
  assert.equal(isGameState(s), true);
  assert.equal(load(s).status, "valid");
  assert.deepEqual(chooseEncounter(s, "open").state, s);
  s = transition(s, { type: "end-day" }).state;
  assert.ok(s.diary.at(-1)!.notes.some((n) => n.includes("抢")));
  assert.equal(s.diary.at(-1)!.summary!.foodDelta, -3);
  const injured = chooseEncounter(initial, "open").state;
  injured.rngState = 1;
  settleLife(injured, []);
  assert.equal(getPerson(injured, "dad").alive, false);
});
test("留守人数/安全/斧头影响抵抗，在外斧头无效，死者与在外者不会受伤", () => {
  let s = fixture("stranger-family", "raiders");
  s.shelter!.inventory.axe = 1;
  s = transition(s, {
    type: "outing",
    id: "daughter",
    location: "water",
    gear: "axe",
  }).state;
  assert.equal(s.expeditions.length, 1);
  const withAxe = structuredClone(s);
  withAxe.expeditions[0].gear = "map";
  assert.ok(defenseChance(withAxe) > defenseChance(s));
  const roll = (defenseChance(withAxe) + defenseChance(s)) / 2;
  s.encounters!.current!.secret!.roll = roll;
  withAxe.encounters!.current!.secret!.roll = roll;
  const awayHealth = getPerson(s, "daughter").health;
  const failed = chooseEncounter(s, "open").state,
    held = chooseEncounter(withAxe, "open").state;
  assert.match(failed.encounters!.current!.outcome!, /抢走/);
  assert.match(held.encounters!.current!.outcome!, /物资守住/);
  assert.equal(held.resources.food, 3);
  assert.equal(getPerson(held, "dad").health, getPerson(s, "dad").health);
  assert.equal(getPerson(failed, "daughter").health, awayHealth);
  const high = fixture("stranger-family", "raiders");
  const weak = structuredClone(high);
  weak.resources.safety = 0;
  weak.people.forEach((p) => (p.fatigue = 90));
  assert.ok(defenseChance(high) > defenseChance(weak));
  const dead = getPerson(weak, "dad");
  Object.assign(dead, {
    alive: false,
    health: 0,
    deathDay: 2,
    deathReason: "旧伤",
  });
  const result = chooseEncounter(weak, "open").state;
  assert.equal(getPerson(result, "dad").health, 0);
  assert.equal(
    getPerson(result, "mom").health,
    getPerson(weak, "mom").health - 15,
  );
  assert.equal(isGameState(result), true);
});
test("善意后续可以回报、无回报或受损，危险后续不覆盖已有来访，队列遵循冷却", () => {
  for (const [roll, water, safety, mood] of [
    [0.2, 1, 0, 0],
    [0.6, 0, 3, 0],
    [0.9, 0, 0, -2],
  ]) {
    const initial = fixture("neighbor-return", "honest", roll),
      s = chooseEncounter(initial, "listen").state;
    assert.equal(s.resources.water, initial.resources.water + water);
    assert.equal(s.resources.safety, initial.resources.safety + safety);
    assert.equal(
      getPerson(s, "mom").mood,
      getPerson(initial, "mom").mood + mood,
    );
  }
  const hostile = chooseEncounter(
    fixture("neighbor-return", "fraud"),
    "listen",
  ).state;
  assert.equal(
    hostile.resources.safety,
    fixture("neighbor-return", "fraud").resources.safety - 3,
  );
  assert.equal(hostile.resources.water, 2);
  let s = fixture("child-water", "raiders");
  scheduleVisit(s, "neighbor-return");
  const original = structuredClone(s.encounters!.followUp!);
  s = closeEncounter(chooseEncounter(s, "give").state);
  const visits = [
    s.encounters!.followUp!,
    ...(s.encounters!.queuedFollowUps ?? []),
  ];
  assert.equal(visits.length, 2);
  assert.ok(visits.some((v) => v.id === original.id && v.day === original.day));
  assert.ok(visits.some((v) => v.id === "marked-door"));
  s.day = visits[0].day;
  s = prepareEncounter(s);
  assert.equal(s.encounters!.current!.id, visits[0].id);
  const retained = s.encounters!.followUp;
  assert.ok(retained);
  s = closeEncounter(s);
  s.day++;
  s = prepareEncounter(s);
  assert.equal(s.encounters!.current, null);
  s.day = Math.max(s.day + 1, retained!.day);
  s = prepareEncounter(s);
  assert.equal(s.encounters!.current!.id, retained!.id);
});
test("空库存遇袭不扣成负数，所有故事保留零物资拒绝/静默，诚实陌生一家可以互助", () => {
  const s = fixture("stranger-family", "raiders");
  s.resources.food = 0;
  s.resources.water = 0;
  s.resources.materials = 0;
  const attacked = chooseEncounter(s, "open").state;
  assert.equal(attacked.resources.food, 0);
  assert.equal(attacked.resources.water, 0);
  assert.equal(attacked.resources.materials, 0);
  assert.ok(isGameState(attacked));
  for (const id of [
    "neighbor-food",
    "child-water",
    "barter-water",
    "messenger",
    "stranger-family",
    "rescue-check",
    "neighbor-return",
    "marked-door",
  ]) {
    const initial = fixture(id, "raiders");
    initial.resources.food = 0;
    initial.resources.water = 0;
    initial.resources.medicine = 0;
    initial.resources.materials = 0;
    for (const result of [
      chooseEncounter(initial, "leave").state,
      closeEncounter(initial),
    ]) {
      assert.deepEqual(result.resources, initial.resources);
      assert.ok(isGameState(result));
    }
  }
  const good = chooseEncounter(
    fixture("stranger-family", "honest"),
    "open",
  ).state;
  assert.equal(good.resources.water, 3);
  assert.equal(good.resources.materials, 4);
});
test("旧已选结果原样保留，旧待选身份恢复即固定，非法身份/骰子/后续队列拒绝载入", () => {
  let s = fixture();
  s = chooseEncounter(s, "give").state;
  delete s.encounters!.current!.secret;
  const outcome = s.encounters!.current!.outcome;
  assert.equal(load(s).status, "valid");
  assert.equal(enterFamilyMode(s).encounters!.current!.outcome, outcome);
  const pending = fixture();
  delete pending.encounters!.current!.secret;
  const migrated = enterFamilyMode(pending);
  assert.ok(migrated.encounters!.current!.secret);
  const changed = structuredClone(migrated);
  changed.rngState = 123;
  assert.deepEqual(visitorSecret(changed), visitorSecret(migrated));
  assert.deepEqual(ensureEncounterSecret(changed), changed);
  for (const mutate of [
    (v: GameState) => {
      v.encounters!.current!.secret!.roll = 1;
    },
    (v: GameState) => {
      v.encounters!.current!.secret!.roll = -0.1;
    },
    (v: GameState) => {
      (
        v.encounters!.current!.secret as unknown as { identity: string }
      ).identity = "unknown";
    },
    (v: GameState) => {
      v.encounters!.queuedFollowUps = [{ id: "unknown", day: 5 }];
    },
  ]) {
    const bad = fixture();
    mutate(bad);
    assert.equal(load(bad).status, "invalid");
  }
});
