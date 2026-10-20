import test from "node:test";
import assert from "node:assert/strict";
import { createGame, emptyPlan } from "../src/game/initial";
import { INITIAL_RESOURCES } from "../src/game/config";
import { transition } from "../src/game/reducer";
import { loadGame, isGameState } from "../src/game/storage";
test("默认食水不足四人一天，每日小结净变化包含白天喂食与夜间配给", () => {
  assert.equal(INITIAL_RESOURCES.food, 3);
  assert.equal(INITIAL_RESOURCES.water, 2);
  let s = createGame("mom");
  s.plan = emptyPlan();
  s = transition(s, {
    type: "feed",
    id: "mom",
    resource: "food",
    give: true,
  }).state;
  s = transition(s, {
    type: "feed",
    id: "mom",
    resource: "water",
    give: true,
  }).state;
  s = transition(s, { type: "event" }).state;
  s = transition(s, { type: "choice", id: "inventory" }).state;
  s.plan = emptyPlan();
  s = transition(s, { type: "confirm" }).state;
  s = transition(s, { type: "execute" }).state;
  const summary = s.diary[0].summary!;
  assert.ok(summary);
  assert.equal(summary.foodDelta, s.resources.food - 3);
  assert.equal(summary.waterDelta, s.resources.water - 2);
  assert.equal(summary.foodLeft, s.resources.food);
  assert.equal(summary.waterLeft, s.resources.water);
  assert.ok(!summary.hungry.includes("林岚"));
  assert.ok(!summary.thirsty.includes("林岚"));
  assert.ok(isGameState(s));
  const loaded = loadGame({
    getItem: () => JSON.stringify(s),
    setItem() {},
    removeItem() {},
  });
  assert.equal(loaded.status, "valid");
  if (loaded.status === "valid")
    assert.deepEqual(loaded.state.diary[0].summary, summary);
});
test("提前全灭也保留当天小结，列出死亡与剩余活人数", () => {
  let s = createGame("mom");
  s.plan = emptyPlan();
  s.phase = "confirm";
  s.choices["1"] = "inventory";
  s.resources.food = 0;
  s.resources.water = 0;
  s.people.forEach((p) => (p.health = 1));
  s = transition(s, { type: "execute" }).state;
  assert.equal(s.phase, "ending");
  assert.equal(s.diary[0].summary?.alive, 0);
  assert.equal(s.diary[0].summary?.atHome, 0);
  assert.equal(s.diary[0].summary?.died.length, 4);
});
test("只收紧尚未开始的旧版开局库存，不削减已开始或新版存档的物资", () => {
  const load = (state: unknown) =>
    loadGame({
      getItem: () => JSON.stringify(state),
      setItem() {},
      removeItem() {},
    });
  const old = createGame("mom");
  delete old.flags.scarceStartApplied;
  old.resources.food = 16;
  old.resources.water = 20;
  const migrated = load(old);
  assert.equal(migrated.status, "valid");
  if (migrated.status === "valid") {
    assert.equal(migrated.state.resources.food, 3);
    assert.equal(migrated.state.resources.water, 2);
    assert.equal(migrated.state.flags.scarceStartApplied, true);
  }
  old.phase = "planning";
  const started = load(old);
  assert.equal(started.status, "valid");
  if (started.status === "valid")
    assert.equal(started.state.resources.food, 16);
  const current = createGame("mom");
  current.resources.food = 18;
  current.resources.water = 22;
  const preserved = load(current);
  assert.equal(preserved.status, "valid");
  if (preserved.status === "valid")
    assert.deepEqual(preserved.state.resources, current.resources);
});
