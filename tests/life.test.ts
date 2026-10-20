import test from "node:test";
import assert from "node:assert/strict";
import { createGame, emptyPlan, getPerson } from "../src/game/initial";
import { deathRisk, settleLife } from "../src/game/life";
import {
  launchExpedition,
  isAway,
  resolveExpeditions,
} from "../src/game/expeditions";
import { departureError, residents } from "../src/game/presence";
import { taskError } from "../src/game/tasks";
import { transition } from "../src/game/reducer";
import { settleDay, planErrors } from "../src/game/settlement";
import { negotiate } from "../src/game/negotiation";
import { resolveAutonomy } from "../src/game/autonomy";
import { loadGame, isGameState } from "../src/game/storage";
import type { GameState, PersonId } from "../src/game/types";

function dead(s: GameState, id: PersonId) {
  Object.assign(getPerson(s, id), {
    alive: false,
    health: 0,
    deathDay: 1,
    deathReason: "伤病恶化",
  });
  s.plan.tasks[id] = { kind: "rest" };
}
test("病危可当晚死亡，也可撑4至5天，健康者没有无条件死亡掷骰", () => {
  const observed = new Set<number>();
  for (let n = 1; n <= 400; n++) {
    const s = createGame("mom", n * 1234567);
    getPerson(s, "mom").health = 25;
    for (let day = 1; day <= 8; day++) {
      s.day = day;
      settleLife(s, []);
      if (!getPerson(s, "mom").alive) {
        observed.add(day);
        break;
      }
    }
  }
  assert.ok(observed.has(1));
  assert.ok(observed.has(4));
  assert.ok(observed.has(5));
  const healthy = createGame("mom", 1),
    seed = healthy.rngState;
  settleLife(healthy, []);
  assert.equal(healthy.rngState, seed);
  assert.ok(healthy.people.every((p) => p.alive));
  const weak = createGame("mom", 1);
  getPerson(weak, "mom").health = 25;
  settleLife(weak, []);
  assert.equal(getPerson(weak, "mom").deathDay, 1);
  const p = getPerson(createGame("mom"), "mom");
  p.hungryDays = 4;
  p.thirstyDays = 3;
  p.fatigue = 95;
  assert.ok(deathRisk(p) > 0.5);
});
test("死亡不可复活，死亡角色不能任务照护用药协商，存档往返保留死亡", () => {
  const s = createGame("mom");
  s.plan = emptyPlan();
  dead(s, "dad");
  assert.ok(taskError(s, "dad", { kind: "repair" }));
  assert.ok(taskError(s, "mom", { kind: "care", target: "dad" }));
  s.phase = "planning";
  assert.ok(
    transition(s, { type: "task", id: "dad", task: { kind: "rest" } }).error,
  );
  assert.ok(negotiate(s, "dad", "medicine").error);
  s.plan.medicineTarget = "dad";
  s.choices["1"] = "inventory";
  assert.ok(planErrors(s).some((e) => e.includes("用药对象")));
  s.plan.medicineTarget = null;
  assert.ok(isGameState(s));
  const loaded = loadGame({
    getItem: () => JSON.stringify(s),
    setItem() {},
    removeItem() {},
  });
  assert.equal(loaded.status, "valid");
  if (loaded.status === "valid")
    assert.equal(getPerson(loaded.state, "dad").alive, false);
});
test("最后一名留守者不能外出，任务注入和自主行动不能绕过", () => {
  const s = createGame("dad");
  s.plan = emptyPlan();
  dead(s, "daughter");
  dead(s, "brother");
  launchExpedition(s, "dad", { kind: "search", location: "food" });
  s.expeditions[0].returnDay = null;
  assert.equal(residents(s).length, 1);
  assert.ok(departureError(s, "mom"));
  s.phase = "planning";
  assert.ok(
    transition(s, {
      type: "task",
      id: "mom",
      task: { kind: "search", location: "food" },
    }).error,
  );
  s.day = 3;
  s.autonomy = { person: "mom", signaledDay: 2, resolved: false };
  const ignored = resolveAutonomy(s, "ignore");
  assert.equal(ignored.plan.tasks.mom.kind, "rest");
  assert.equal(ignored.expeditions.length, 1);
  s.plan.tasks.mom = { kind: "search", location: "food", locked: true };
  s.choices["3"] = "wait";
  assert.ok(planErrors(s).some((e) => e.includes("留守")));
});
test("最后留守者在零物资下死亡会提前失守，即使还有人活着在外", () => {
  const s = createGame("mom", 1);
  s.plan = emptyPlan();
  dead(s, "daughter");
  dead(s, "brother");
  launchExpedition(s, "dad", { kind: "search", location: "food" });
  s.expeditions[0].returnDay = null;
  s.resources.food = 0;
  s.resources.water = 0;
  getPerson(s, "mom").health = 1;
  s.phase = "confirm";
  s.choices["1"] = "wait";
  const result = settleDay(s);
  assert.equal(result.error, undefined);
  assert.equal(result.state.phase, "ending");
  assert.equal(result.state.ending?.kind, "abandoned");
  assert.equal(getPerson(result.state, "dad").alive, true);
  assert.ok(isAway(result.state, "dad"));
  assert.ok(isGameState(result.state));
});
test("扮演者死亡后其余留守家人仍可继续，外出死者不入库且丢失防护包", () => {
  const s = createGame("mom", 1);
  s.plan = emptyPlan();
  dead(s, "mom");
  s.choices["1"] = "inventory";
  s.phase = "confirm";
  const next = settleDay(s).state;
  assert.equal(next.phase, "night");
  assert.equal(transition(next, { type: "next" }).state.day, 2);
  const away = createGame("mom", 1);
  away.plan = emptyPlan();
  launchExpedition(away, "dad", {
    kind: "search",
    location: "food",
    protected: true,
  });
  away.expeditions[0].returnDay = 3;
  getPerson(away, "dad").health = 0;
  settleLife(away, []);
  const before = away.resources.food;
  away.day = 3;
  resolveExpeditions(away, []);
  assert.equal(away.resources.food, before);
  assert.equal(away.expeditions[0].lostDay, 1);
  assert.equal(away.flags.protectionLost, true);
});
test("旧版第七天结局迁移为第八天，100天上限及坏死亡数据会被校验", () => {
  const original = createGame("mom");
  const old = JSON.parse(JSON.stringify(original));
  old.version = 1;
  old.day = 7;
  old.phase = "ending";
  old.settled = [7];
  old.ending = {
    kind: "together",
    title: "同一张饭桌",
    text: "旧结局",
    highlights: [],
  };
  old.people.forEach((p: Record<string, unknown>) => {
    delete p.alive;
    delete p.deathDay;
    delete p.deathReason;
    delete p.hungryDays;
    delete p.thirstyDays;
    delete p.criticalDays;
  });
  const loaded = loadGame({
    getItem: () => JSON.stringify(old),
    setItem() {},
    removeItem() {},
  });
  assert.equal(loaded.status, "valid");
  if (loaded.status === "valid") {
    assert.equal(loaded.state.day, 8);
    assert.equal(loaded.state.phase, "morning");
    assert.equal(loaded.state.version, 2);
    assert.equal(loaded.state.ending, null);
  }
  original.day = 101;
  assert.equal(isGameState(original), false);
  original.day = 1;
  dead(original, "dad");
  getPerson(original, "dad").health = 20;
  assert.equal(isGameState(original), false);
});
