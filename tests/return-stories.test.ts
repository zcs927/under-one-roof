import test from "node:test";
import assert from "node:assert/strict";
import { createFamilyGame } from "../src/game/family-mode";
import { getPerson } from "../src/game/initial";
import {
  launchExpedition,
  resolveExpeditions,
  isAway,
} from "../src/game/expeditions";
import { transition } from "../src/game/reducer";
import {
  pendingReturns,
  acknowledgeReturn,
  RETURN_KINDS,
} from "../src/game/return-stories";
import { settleIllness } from "../src/game/illness";
import { taskError } from "../src/game/tasks";
import { settleLife } from "../src/game/life";
import { isGameState, loadGame } from "../src/game/storage";
import type { GameState, ReturnStory } from "../src/game/types";
const cases = new Map<ReturnStory["kind"], GameState>();
for (let n = 1; n <= 300 && cases.size < RETURN_KINDS.length; n++) {
  const s = createFamilyGame(Math.imul(n, 2654435761) >>> 0);
  launchExpedition(s, "daughter", { kind: "search", location: "food" });
  if (s.expeditions[0].returnDay !== null)
    cases.set(s.expeditions[0].story!.kind, s);
}
function sample(kind: ReturnStory["kind"]) {
  assert.ok(cases.has(kind), "必须能自然抽到 " + kind);
  return structuredClone(cases.get(kind)!);
}
function due(kind: ReturnStory["kind"]) {
  const s = sample(kind),
    trip = s.expeditions[0];
  // Named immediate-return fixture. The original seeded trip above is untouched.
  trip.returnDay = s.day;
  return s;
}
const load = (s: GameState) =>
  loadGame({ getItem: () => JSON.stringify(s), setItem() {}, removeItem() {} });

test("五类归来故事都能自然抽到，出发时固定且不提前给物资，面罩避免本次染病", () => {
  assert.equal(cases.size, 5);
  for (let n = 1; n <= 50; n++) {
    const seed = Math.imul(n, 2654435761) >>> 0;
    const a = createFamilyGame(seed),
      b = createFamilyGame(seed);
    launchExpedition(a, "daughter", { kind: "search", location: "water" });
    launchExpedition(b, "daughter", { kind: "search", location: "water" });
    assert.deepEqual(a, b);
    assert.equal(a.resources.water, 2);
    assert.equal(pendingReturns(a).length, 0);
    assert.equal(load(a).status, "valid");
    const mask = createFamilyGame(seed);
    launchExpedition(
      mask,
      "daughter",
      { kind: "search", location: "water" },
      "mask",
    );
    assert.notEqual(mask.expeditions[0].story!.kind, "ill");
  }
});
test("空手/丰收的故事与库存相符，返家才施加身体心情影响且仅一次", () => {
  for (const kind of ["empty", "haul", "injured", "found"] as const) {
    const s = due(kind),
      trip = s.expeditions[0],
      before = structuredClone(s),
      rng = s.rngState;
    const actions: string[] = [];
    resolveExpeditions(s, actions);
    assert.equal(isAway(s, "daughter"), false);
    for (const key of ["food", "water", "medicine", "materials"] as const)
      assert.equal(s.resources[key], before.resources[key] + trip.loot[key]);
    assert.equal(
      getPerson(s, "daughter").health,
      Math.max(0, getPerson(before, "daughter").health - trip.returnHealthCost),
    );
    assert.equal(s.rngState, rng);
    assert.equal(pendingReturns(s).length, 1);
    assert.ok(s.dayNotes.some((n) => n.includes("归来经历 · 周小满")));
    if (kind === "empty") {
      assert.equal(
        Object.values(trip.loot).reduce((n, v) => n + v, 0),
        0,
      );
      assert.ok(
        getPerson(s, "daughter").mood < getPerson(before, "daughter").mood,
      );
    }
    if (kind === "haul") assert.ok(trip.loot.food >= 6 && trip.loot.water >= 2);
    const once = structuredClone(s);
    resolveExpeditions(s, []);
    assert.deepEqual(s, once);
    assert.ok(isGameState(s));
  }
});
test("发烧归来首夜不重复扣病损；后续每日恶化、有限天数恢复且不能再次派出", () => {
  const s = due("ill");
  resolveExpeditions(s, []);
  const p = getPerson(s, "daughter"),
    days = p.illness!.daysLeft,
    health = p.health;
  settleIllness(s, p);
  assert.equal(p.health, health);
  assert.equal(p.illness!.daysLeft, days);
  assert.match(
    taskError(s, "daughter", { kind: "search", location: "food" })!,
    /发烧/,
  );
  const count = s.expeditions.length;
  launchExpedition(s, "daughter", { kind: "search", location: "water" });
  assert.equal(s.expeditions.length, count);
  for (let day = 1; day <= days; day++) {
    s.day++;
    settleIllness(s, p);
    assert.equal(p.health, health - 6 * day);
  }
  assert.equal(p.illness, undefined);
  assert.equal(
    taskError(s, "daughter", { kind: "search", location: "food" }),
    null,
  );
});
test("药品一份能治疗发烧并恢复健康，满健康也可治病；没药、在外与死者不乱扣", () => {
  const s = due("ill");
  resolveExpeditions(s, []);
  getPerson(s, "daughter").health = 100;
  const cured = transition(s, { type: "treat", id: "daughter" }).state;
  assert.equal(cured.resources.medicine, 2);
  assert.equal(getPerson(cured, "daughter").illness, undefined);
  assert.ok(transition(cured, { type: "treat", id: "daughter" }).error);
  const poor = structuredClone(s);
  poor.resources.medicine = 0;
  assert.ok(transition(poor, { type: "treat", id: "daughter" }).error);
  assert.ok(getPerson(poor, "daughter").illness);
  const away = sample("ill");
  assert.ok(transition(away, { type: "treat", id: "daughter" }).error);
  const dead = structuredClone(s);
  Object.assign(getPerson(dead, "daughter"), {
    alive: false,
    health: 0,
    deathDay: 1,
    deathReason: "伤病恶化",
  });
  delete getPerson(dead, "daughter").illness;
  assert.ok(transition(dead, { type: "treat", id: "daughter" }).error);
});
test("严重伤病可在归来当晚死亡，未归或在外死亡不生成虚假返回，也不领取物资", () => {
  let s = due("injured");
  getPerson(s, "daughter").health = 1;
  s = transition(s, { type: "end-day" }).state;
  assert.equal(getPerson(s, "daughter").alive, false);
  assert.equal(s.expeditions[0].returnedDay, 1);
  assert.equal(pendingReturns(s).length, 1);
  assert.ok(isGameState(s));
  const missing = sample("haul");
  missing.expeditions[0].returnDay = null;
  const resources = { ...missing.resources };
  resolveExpeditions(missing, []);
  assert.deepEqual(missing.resources, resources);
  assert.equal(pendingReturns(missing).length, 0);
  getPerson(missing, "daughter").health = 0;
  settleLife(missing, []);
  resolveExpeditions(missing, []);
  assert.equal(pendingReturns(missing).length, 0);
  assert.deepEqual(missing.resources, resources);
});
test("多人同夜归来按序确认，刷新保留未读和已读；日记永久保留而结算不重复", () => {
  let s = due("haul");
  launchExpedition(s, "dad", { kind: "search", location: "water" });
  s.expeditions[1].returnDay = 1;
  s = transition(s, { type: "end-day" }).state;
  assert.equal(pendingReturns(s).length, 2);
  assert.equal(load(s).status, "valid");
  const first = pendingReturns(s)[0].id;
  const resources = { ...s.resources };
  s = transition(s, { type: "ack-return", id: first }).state;
  assert.equal(pendingReturns(s).length, 1);
  assert.deepEqual(s.resources, resources);
  assert.deepEqual(acknowledgeReturn(s, first), s);
  assert.equal(load(s).status, "valid");
  assert.equal(
    s.diary[0].notes.filter((n) => n.startsWith("归来经历 ·")).length,
    2,
  );
  assert.deepEqual(transition(s, { type: "end-day" }).state, s);
  s = acknowledgeReturn(s, pendingReturns(s)[0].id);
  assert.equal(pendingReturns(s).length, 0);
});
test("旧在途说明不重抽原结果、不额外染病；旧已返回不补扣、不强弹", () => {
  const s = due("injured");
  delete s.expeditions[0].story;
  const before = structuredClone(s),
    rng = s.rngState;
  resolveExpeditions(s, []);
  assert.equal(s.rngState, rng);
  assert.deepEqual(s.expeditions[0].loot, before.expeditions[0].loot);
  assert.equal(
    getPerson(s, "daughter").health,
    getPerson(before, "daughter").health - s.expeditions[0].returnHealthCost,
  );
  assert.equal(
    getPerson(s, "daughter").mood,
    getPerson(before, "daughter").mood,
  );
  assert.equal(getPerson(s, "daughter").illness, undefined);
  assert.equal(load(s).status, "valid");
  delete s.expeditions[0].story;
  assert.equal(load(s).status, "valid");
  assert.equal(pendingReturns(s).length, 0);
});
test("非法故事与病症存档拒绝，出发未结算不可提前标记报告已读或领取效果", () => {
  for (const mutate of [
    (s: GameState) => {
      s.expeditions[0].story!.acknowledged = true;
    },
    (s: GameState) => {
      s.expeditions[0].story!.applied = { health: -1, mood: 0, fatigue: 0 };
    },
    (s: GameState) => {
      s.expeditions[0].story!.illnessDays = 5;
    },
    (s: GameState) => {
      (s.expeditions[0].story as unknown as { kind: string }).kind = "unknown";
    },
    (s: GameState) => {
      getPerson(s, "mom").illness = { sinceDay: 1, daysLeft: 0 };
    },
    (s: GameState) => {
      getPerson(s, "mom").illness = { sinceDay: 2, daysLeft: 2 };
    },
  ]) {
    const s = sample("ill");
    mutate(s);
    assert.equal(load(s).status, "invalid");
  }
  const s = sample("ill");
  assert.deepEqual(acknowledgeReturn(s, s.expeditions[0].id), s);
});
