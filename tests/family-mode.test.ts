import test from "node:test";
import assert from "node:assert/strict";
import { createFamilyGame, enterFamilyMode } from "../src/game/family-mode";
import { createGame, getPerson } from "../src/game/initial";
import { transition } from "../src/game/reducer";
import { isAway, residents } from "../src/game/presence";
import { isGameState, loadGame } from "../src/game/storage";

test("直接管理家庭开局，四人都有信任，无默认外出或自动配给", () => {
  const s = createFamilyGame();
  assert.equal(s.flags.familyManagement, true);
  assert.equal(s.phase, "morning");
  assert.ok(s.people.every((p) => p.trust !== undefined));
  assert.ok(Object.values(s.plan.tasks).every((t) => t.kind === "rest"));
  assert.equal(s.plan.ration, "manual");
  assert.ok(isGameState(s));
  assert.deepEqual(
    transition(s, { type: "ration", ration: "normal" }).state,
    s,
  );
  assert.deepEqual(transition(s, { type: "event" }).state, s);
});
test("爸爸可拒绝、改派他人，强制立即离开且付出关系代价，不能重复出发", () => {
  const s = createFamilyGame(12288);
  const refused = transition(s, {
    type: "outing",
    id: "dad",
    location: "food",
  }).state;
  assert.equal(refused.flags["outingRefused:dad"], true);
  assert.equal(isAway(refused, "dad"), false);
  const other = transition(refused, {
    type: "outing",
    id: "daughter",
    location: "water",
  }).state;
  assert.equal(isAway(other, "daughter"), true);
  assert.equal(isAway(other, "dad"), false);
  assert.equal(other.expeditions.length, 1);
  const forced = transition(refused, {
    type: "outing",
    id: "dad",
    location: "food",
    force: true,
  }).state;
  assert.equal(isAway(forced, "dad"), true);
  assert.equal(getPerson(forced, "dad").mood, 50);
  assert.equal(getPerson(forced, "dad").trust, 52);
  assert.equal(residents(forced).length, 3);
  assert.equal(forced.memories.length, 1);
  assert.ok(
    transition(forced, { type: "outing", id: "mom", location: "food" }).error,
  );
  assert.equal(
    transition(forced, {
      type: "outing",
      id: "dad",
      location: "food",
      force: true,
    }).state.expeditions.length,
    1,
  );
  assert.ok(
    transition(s, { type: "outing", id: "dad", location: "food", force: true })
      .error,
  );
  assert.ok(isGameState(forced));
  const loaded = loadGame({
    getItem: () => JSON.stringify(forced),
    setItem() {},
    removeItem() {},
  });
  assert.equal(loaded.status, "valid");
  if (loaded.status === "valid") assert.deepEqual(loaded.state, forced);
});
test("外出立即生效，只有回家才入库，不会在夜间再次出发", () => {
  let s = createFamilyGame(12288);
  s = transition(s, { type: "outing", id: "daughter", location: "food" }).state;
  assert.equal(s.expeditions.length, 1);
  assert.equal(s.resources.food, 3);
  const returnDay = s.expeditions[0].returnDay!;
  assert.ok(returnDay >= 2 && returnDay <= 5);
  s = transition(s, { type: "end-day" }).state;
  assert.equal(s.phase, "night");
  assert.equal(s.expeditions.length, 1);
  assert.deepEqual(s.diary[0].summary?.departed, ["周小满"]);
  assert.equal(s.resources.food, 3);
  s = transition(s, { type: "next" }).state;
  assert.equal(s.day, 2);
  assert.equal(s.phase, "morning");
  assert.equal(s.flags.outingSent, false);
  assert.equal(s.autonomy, null);
  for (let day = 2; day <= returnDay; day++) {
    // Give the explorer a known return opportunity; check arrival, not unrelated deprivation.
    if (day === returnDay)
      s.people.forEach((p) => {
        p.health = 90;
        p.thirstyDays = 0;
      });
    s = transition(s, { type: "end-day" }).state;
    if (day < returnDay) s = transition(s, { type: "next" }).state;
  }
  assert.equal(s.expeditions[0].returnedDay, returnDay);
  assert.ok(s.diary.at(-1)?.summary?.returned.includes("周小满"));
});
test("结束今天不自动扣食水，不主动喂会饥渴；喂过只扣一次", () => {
  let s = createFamilyGame(0x5eed);
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
  s = transition(s, { type: "end-day" }).state;
  assert.equal(s.phase, "night");
  assert.equal(s.resources.food, 2);
  assert.equal(s.resources.water, 1);
  assert.equal(getPerson(s, "mom").hungryDays, 0);
  assert.equal(getPerson(s, "dad").hungryDays, 1);
  assert.equal(getPerson(s, "dad").thirstyDays, 1);
  assert.equal(s.diary[0].summary?.foodDelta, -1);
  assert.deepEqual(transition(s, { type: "end-day" }).state, s);
});
test("强制也不能派出最后一人、死者、已经在外或无法行动者", () => {
  const s = createFamilyGame();
  s.people
    .filter((p) => p.id !== "mom")
    .forEach((p) =>
      Object.assign(p, {
        alive: false,
        health: 0,
        deathDay: 1,
        deathReason: "测试",
      }),
    );
  s.flags["outingRefused:mom"] = true;
  assert.ok(
    transition(s, {
      type: "outing",
      id: "mom",
      location: "food",
      force: true,
    }).error?.includes("最后"),
  );
  assert.ok(
    transition(s, { type: "outing", id: "dad", location: "food", force: true })
      .error,
  );
  const sick = createFamilyGame();
  getPerson(sick, "dad").health = 20;
  sick.flags["outingRefused:dad"] = true;
  assert.ok(
    transition(sick, {
      type: "outing",
      id: "dad",
      location: "food",
      force: true,
    }).error?.includes("身体"),
  );
});
test("旧档切换保留当天给予、真实外出与历史，尚未执行的计划改为手动留守", () => {
  const s = createGame("dad");
  s.phase = "planning";
  s.resources.food = 12;
  s.resources.water = 8;
  getPerson(s, "mom").fedDay = 1;
  s.expeditions.push({
    id: "expedition:1:daughter",
    person: "daughter",
    location: "food",
    departedDay: 1,
    returnDay: 3,
    returnedDay: null,
    lostDay: null,
    protected: false,
    loot: { food: 3, water: 0, medicine: 0, materials: 0 },
    returnHealthCost: 0,
  });
  const upgraded = enterFamilyMode(s);
  assert.equal(upgraded.phase, "morning");
  assert.equal(upgraded.resources.food, 12);
  assert.equal(getPerson(upgraded, "mom").fedDay, 1);
  assert.equal(upgraded.flags.outingSent, true);
  assert.equal(isAway(upgraded, "daughter"), true);
  assert.equal(upgraded.plan.ration, "manual");
  assert.ok(isGameState(upgraded));
  assert.deepEqual(enterFamilyMode(upgraded), upgraded);
});
test("新简化流程充足库存夹具能走100天，每天只需主动喂食和结束，不会第7天结束", () => {
  let s = createFamilyGame();
  s.resources.food = 500;
  s.resources.water = 500;
  for (let day = 1; day <= 100; day++) {
    for (const p of s.people)
      for (const resource of ["food", "water"] as const)
        s = transition(s, {
          type: "feed",
          id: p.id,
          resource,
          give: true,
        }).state;
    s = transition(s, { type: "end-day" }).state;
    assert.equal(s.diary.length, day);
    assert.ok(s.diary.at(-1)?.summary);
    assert.equal(s.phase, day === 100 ? "ending" : "night");
    if (day < 100) s = transition(s, { type: "next" }).state;
  }
  assert.equal(s.people.filter((p) => p.alive).length, 4);
  assert.ok(isGameState(s));
});
