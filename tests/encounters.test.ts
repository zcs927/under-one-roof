import test from "node:test";
import assert from "node:assert/strict";
import { createFamilyGame } from "../src/game/family-mode";
import { transition } from "../src/game/reducer";
import {
  chooseEncounter,
  closeEncounter,
  encounterFor,
  prepareEncounter,
} from "../src/game/encounters";
import { isGameState, loadGame } from "../src/game/storage";
import type { GameState } from "../src/game/types";

function secondMorning(seed = 12345) {
  return transition(
    transition(createFamilyGame(seed), { type: "end-day" }).state,
    { type: "next" },
  ).state;
}
function load(s: GameState) {
  return loadGame({
    getItem: () => JSON.stringify(s),
    setItem() {},
    removeItem() {},
  });
}
function fixture(id: string) {
  const s = secondMorning();
  s.encounters!.current!.id = id;
  s.encounters!.current!.secret = { identity: "honest", roll: 0.2 };
  return s;
}

test("额外故事第2天自动准备，日记事件独立保留；同日重新准备不重抽", () => {
  const first = createFamilyGame();
  assert.equal(first.encounters?.current, null);
  assert.deepEqual(prepareEncounter(first), first);
  const s = secondMorning();
  assert.equal(s.encounters?.current?.id, "neighbor-food");
  assert.equal(s.shelter?.incident.id, "knock");
  assert.deepEqual(prepareEncounter(s), s);
  assert.ok(isGameState(s));
});
test("隔门询问不消耗、仍可选择；帮助扣1且重复点击不多扣，后续日期随存档保存", () => {
  const initial = fixture("neighbor-food");
  let s = chooseEncounter(initial, "ask").state;
  assert.equal(s.encounters!.current!.asked, true);
  assert.equal(s.encounters!.current!.choice, null);
  assert.deepEqual(s.resources, initial.resources);
  assert.equal(s.rngState, initial.rngState);
  s = transition(s, { type: "encounter", id: "give" }).state;
  assert.equal(s.resources.food, initial.resources.food - 1);
  assert.equal(s.resources.water, initial.resources.water);
  assert.ok(
    s.encounters!.followUp!.day >= s.day + 3 &&
      s.encounters!.followUp!.day <= s.day + 5,
  );
  assert.deepEqual(chooseEncounter(s, "give").state, s);
  assert.deepEqual(chooseEncounter(s, "leave").state, s);
  const loaded = load(s);
  assert.equal(loaded.status, "valid");
  if (loaded.status === "valid") assert.deepEqual(loaded.state, s);
  s = transition(s, { type: "encounter-close" }).state;
  assert.equal(s.encounters!.current!.acknowledged, true);
  assert.deepEqual(closeEncounter(s), s);
  assert.equal(load(s).status, "valid");
  assert.equal(initial.encounters!.current!.asked, false);
});
test("食物和饮水/药品不足不能赠送，零库存依然能拒绝和继续", () => {
  for (const [id, resource] of [
    ["neighbor-food", "food"],
    ["child-water", "water"],
    ["messenger", "medicine"],
  ] as const) {
    let s = fixture(id);
    s.resources[resource] = 0;
    const failed = chooseEncounter(s, "give");
    assert.match(failed.error!, /不足/);
    assert.deepEqual(failed.state, s);
    s = chooseEncounter(s, "leave").state;
    assert.equal(s.resources[resource], 0);
    assert.equal(s.encounters!.followUp, null);
    assert.ok(s.encounters!.current!.outcome);
    s = transition(s, { type: "end-day" }).state;
    assert.equal(s.phase, "night");
    assert.ok(isGameState(s));
  }
});
test("食物换水与其他援助只影响对应库存，并进入每日小结净变化和日记", () => {
  let s = fixture("barter-water");
  const food = s.resources.food,
    water = s.resources.water;
  s = chooseEncounter(s, "trade").state;
  assert.equal(s.resources.food, food - 1);
  assert.equal(s.resources.water, water + 1);
  s = transition(s, { type: "end-day" }).state;
  const day = s.diary.at(-1)!;
  assert.equal(day.summary!.foodDelta, -1);
  assert.equal(day.summary!.waterDelta, 1);
  assert.ok(day.notes.some((n) => n.startsWith("门外的故事 · 一瓶水，一罐饭")));
  assert.ok(isGameState(s));
  const child = fixture("child-water");
  assert.equal(
    chooseEncounter(child, "give").state.resources.water,
    child.resources.water - 1,
  );
  const messenger = fixture("messenger");
  assert.equal(
    chooseEncounter(messenger, "give").state.resources.medicine,
    messenger.resources.medicine - 1,
  );
});
test("关闭或跳过一天等于不回应，零暗扣、无后续赠礼，结果只记一次", () => {
  const s = secondMorning();
  const closed = closeEncounter(s);
  assert.equal(closed.encounters!.current!.choice, "ignore");
  assert.equal(closed.encounters!.current!.acknowledged, true);
  assert.deepEqual(closed.resources, s.resources);
  assert.equal(closed.encounters!.followUp, null);
  assert.equal(
    closed.dayNotes.filter((n) => n.startsWith("门外的故事")).length,
    1,
  );
  const night = transition(s, { type: "end-day" }).state;
  assert.equal(night.encounters!.current!.choice, "ignore");
  assert.equal(
    night.diary.at(-1)!.notes.filter((n) => n.startsWith("门外的故事")).length,
    1,
  );
  assert.equal(chooseEncounter(night, "give").state, night);
});
test("额外事件有冷却与多个故事，援助后续到期优先出现，回报可能只有警告", () => {
  const heard = new Set<string>(),
    outcomes = new Set<string>();
  for (let seed = 10; seed <= 40; seed++) {
    const initial = secondMorning(seed);
    initial.encounters!.current!.secret = {
      identity: "honest",
      roll: seed / 50,
    };
    let s = closeEncounter(chooseEncounter(initial, "give").state);
    const due = s.encounters!.followUp!.day;
    s.day = 3;
    s = prepareEncounter(s);
    assert.equal(s.encounters!.current, null);
    assert.deepEqual(prepareEncounter(s), s);
    s.day = due;
    s = prepareEncounter(s);
    assert.equal(s.encounters!.current!.id, "neighbor-return");
    assert.equal(s.encounters!.followUp, null);
    const before = { ...s.resources };
    s.encounters!.current!.secret = {
      identity: "honest",
      roll: seed % 2 ? 0.2 : 0.6,
    };
    s = chooseEncounter(s, "listen").state;
    outcomes.add(s.resources.water > before.water ? "water" : "warning");
    assert.ok(
      s.resources.water === before.water + 1 ||
        s.resources.safety === before.safety + 3,
    );
    const rng = s.rngState;
    assert.equal(chooseEncounter(s, "listen").state.rngState, rng);
    for (let day = due + 1; day < 25; day++) {
      s.day = day;
      const lastDay = s.encounters!.lastDay;
      s = prepareEncounter(s);
      if (s.encounters!.current) {
        assert.ok(day - lastDay >= 2);
        heard.add(encounterFor(s)!.id);
        s = closeEncounter(s);
      }
    }
  }
  assert.deepEqual(outcomes, new Set(["water", "warning"]));
  for (const id of [
    "neighbor-food",
    "child-water",
    "barter-water",
    "messenger",
    "stranger-family",
    "rescue-check",
  ])
    assert.ok(heard.has(id));
});
test("旧存档兼容且不强行生成当日事件，畸形额外剧情字段拒绝载入", () => {
  const old = secondMorning();
  delete old.encounters;
  assert.equal(load(old).status, "valid");
  assert.equal(transition(old, { type: "end-day" }).state.phase, "night");
  for (const mutate of [
    (s: GameState) => {
      s.encounters!.current!.day = 99;
    },
    (s: GameState) => {
      s.encounters!.current!.acknowledged = true;
    },
    (s: GameState) => {
      s.encounters!.current!.id = "unknown";
    },
    (s: GameState) => {
      s.encounters!.followUp = { id: "unknown", day: 6 };
    },
    (s: GameState) => {
      s.encounters!.current!.choice = "unknown";
      s.encounters!.current!.outcome = "x";
    },
  ]) {
    const bad = secondMorning();
    mutate(bad);
    assert.equal(load(bad).status, "invalid");
  }
});
