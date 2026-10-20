import test from "node:test";
import assert from "node:assert/strict";
import { createGame, emptyPlan, getPerson } from "../src/game/initial";
import {
  activeExpedition,
  isAway,
  launchExpedition,
  resolveExpeditions,
} from "../src/game/expeditions";
import { settleDay, planErrors } from "../src/game/settlement";
import { transition } from "../src/game/reducer";
import { rationPreview, reservationErrors } from "../src/game/resources";
import { taskError } from "../src/game/tasks";
import { isGameState, loadGame, saveGame, SAVE_KEY } from "../src/game/storage";
import { evaluateEnding } from "../src/game/ending";
import { makePromise, settlePromises } from "../src/game/memories";
import { eventFor, chooseEvent } from "../src/game/events";

function depart(seed: number) {
  const s = createGame("mom", seed);
  s.resources.food = 16;
  s.resources.water = 20;
  s.phase = "confirm";
  s.choices["1"] = "inventory";
  s.plan = emptyPlan();
  s.plan.tasks.dad = { kind: "search", location: "food", protected: true };
  const result = settleDay(s);
  assert.equal(result.error, undefined);
  return result.state;
}
test("随机外出包含当天、隔日、第三天和百日未归，物资只在归来入库", () => {
  for (const [seed, day] of [
    [1, 1],
    [7168, 2],
    [12288, 3],
    [15872, null],
  ] as const) {
    const s = depart(seed),
      trip = s.expeditions[0];
    assert.equal(trip.returnDay, day);
    assert.equal(isAway(s, "dad"), day !== 1);
    assert.equal(
      s.resources.food,
      16 + (day === 1 ? trip.loot.food : 0) - (day === 1 ? 4 : 3),
    );
    assert.ok(isGameState(s));
    const again = settleDay(s);
    assert.deepEqual(again.state, s);
  }
});
test("延迟归来恢复可分工，随机库存与疲劳只结算一次", () => {
  const s = depart(12288);
  s.day = 2;
  const before = s.resources.food;
  resolveExpeditions(s, []);
  assert.equal(s.resources.food, before);
  assert.ok(isAway(s, "dad"));
  s.day = 3;
  resolveExpeditions(s, []);
  assert.ok(!isAway(s, "dad"));
  assert.equal(s.resources.food, before + s.expeditions[0].loot.food);
  const once = structuredClone(s);
  resolveExpeditions(s, []);
  assert.deepEqual(s, once);
  assert.equal(s.expeditions[0].returnedDay, 3);
});
test("在外者不能改派、照护、用药或许诺，防护包持续被占用", () => {
  let s = transition(depart(12288), { type: "next" }).state;
  s.phase = "planning";
  s.choices["2"] = "decline";
  const p = getPerson(s, "dad"),
    health = p.health;
  assert.ok(
    transition(s, { type: "task", id: "dad", task: { kind: "repair" } }).error,
  );
  assert.ok(taskError(s, "mom", { kind: "care", target: "dad" }));
  assert.ok(makePromise(s, "dad", "medicine").error);
  s.plan.medicineTarget = "dad";
  assert.ok(planErrors(s).some((e) => e.includes("用药对象")));
  s.plan.medicineTarget = null;
  s.plan.tasks.daughter = {
    kind: "search",
    location: "water",
    protected: true,
  };
  assert.ok(reservationErrors(s).some((e) => e.includes("防护包")));
  s.plan = emptyPlan();
  assert.equal(rationPreview(s).cost, 3);
  s.phase = "confirm";
  s = settleDay(s).state;
  assert.equal(getPerson(s, "dad").health, health - 2);
  assert.equal(activeExpedition(s, "dad")?.returnDay, 3);
});
test("刷新保留随机结果且不重抽，旧无探索字段存档自动补齐", () => {
  const s = depart(15872);
  const map = new Map<string, string>();
  const port = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
  saveGame(port, s);
  const loaded = loadGame(port);
  assert.equal(loaded.status, "valid");
  if (loaded.status === "valid") assert.deepEqual(loaded.state, s);
  const old = JSON.parse(JSON.stringify(createGame("mom")));
  old.version = 1;
  delete old.rngState;
  delete old.expeditions;
  map.set(SAVE_KEY, JSON.stringify(old));
  const migrated = loadGame(port);
  assert.equal(migrated.status, "valid");
  if (migrated.status === "valid")
    assert.deepEqual(migrated.state.expeditions, []);
  s.expeditions.push({ ...s.expeditions[0], id: "duplicate-active" });
  assert.equal(isGameState(s), false);
});
test("随机收获有空手与不同数量，姐姐保留技能，种子可复现", () => {
  const amounts = new Set<number>();
  for (let seed = 1; seed <= 100; seed++) {
    const a = createGame("mom", seed),
      b = createGame("mom", seed);
    launchExpedition(a, "dad", { kind: "search", location: "food" });
    launchExpedition(b, "dad", { kind: "search", location: "food" });
    assert.deepEqual(a, b);
    amounts.add(a.expeditions[0].loot.food);
    const sister = createGame("mom", seed);
    launchExpedition(sister, "daughter", { kind: "search", location: "food" });
    assert.equal(
      sister.expeditions[0].loot.food,
      a.expeditions[0].loot.food === 0 ? 0 : a.expeditions[0].loot.food + 2,
    );
  }
  assert.ok(amounts.has(0));
  assert.ok(amounts.size > 3);
});
test("第一百天未归有真实空位结局，在外等待不算兑现休息承诺", () => {
  const s = depart(15872);
  s.day = 100;
  s.settled = [1, 100];
  s.phase = "night";
  s.promises = [
    {
      id: "p",
      person: "dad",
      kind: "rest",
      day: 1,
      dueDay: 2,
      status: "pending",
    },
  ];
  s.plan = emptyPlan();
  settlePromises(s, null);
  assert.equal(s.promises[0].status, "broken");
  const ending = evaluateEnding(s);
  assert.equal(ending?.title, "百日之后，仍有人未归");
  assert.ok(ending?.text.includes("周衡"));
  assert.ok(isAway(s, "dad"));
});
test("三人在外时最后留守者不能出发，只能等待而不获得事件物资", () => {
  let s = createGame("mom");
  s.day = 5;
  s.phase = "event";
  s.plan = emptyPlan();
  for (const id of ["dad", "daughter", "brother"] as const) {
    launchExpedition(s, id, { kind: "search", location: "food" });
    s.expeditions.at(-1)!.returnDay = null;
  }
  launchExpedition(s, "mom", { kind: "search", location: "food" });
  assert.equal(s.expeditions.length, 3);
  assert.equal(isAway(s, "mom"), false);
  assert.equal(eventFor(s).choices[0].id, "wait");
  const inventory = { ...s.resources };
  s = chooseEvent(s, "wait").state;
  assert.deepEqual(s.resources, inventory);
  assert.equal(rationPreview(s).cost, 1);
});
