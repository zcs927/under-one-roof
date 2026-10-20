import test from "node:test";
import assert from "node:assert/strict";
import { createFamilyGame, enterFamilyMode } from "../src/game/family-mode";
import { createGame, getPerson } from "../src/game/initial";
import { transition } from "../src/game/reducer";
import { consumeRations } from "../src/game/resources";
import { deathRisk, settleLife } from "../src/game/life";
import { gearAvailable } from "../src/game/shelter";
import {
  chooseIncident,
  incidentFor,
  prepareShelterDay,
} from "../src/game/shelter-events";
import { isGameState, loadGame } from "../src/game/storage";
import { resolveExpeditions } from "../src/game/expeditions";
import { evaluateEnding } from "../src/game/ending";
function incident(s: ReturnType<typeof createFamilyGame>, id: string) {
  s.shelter!.incident = { id, day: s.day, choice: null, outcome: null };
  return s;
}
test("健康家人可暂缓给水吃饭，缓冲结束才受损；病危依旧可能立刻死亡", () => {
  let s = createFamilyGame();
  s.people.forEach((p) => (p.health = 100));
  for (let day = 1; day <= 2; day++) {
    s.day = day;
    s = consumeRations(s);
    assert.equal(getPerson(s, "mom").health, 100);
    assert.equal(deathRisk(getPerson(s, "mom"), true), 0);
  }
  s.day = 3;
  s = consumeRations(s);
  assert.equal(getPerson(s, "mom").health, 88);
  getPerson(s, "mom").health = 1;
  s.rngState = 1;
  settleLife(s, []);
  assert.equal(getPerson(s, "mom").alive, false);
  const food = createFamilyGame();
  food.people.forEach((p) => {
    p.health = 100;
    p.wateredDay = 1;
  });
  for (let day = 1; day <= 4; day++) {
    food.day = day;
    food.people.forEach((p) => (p.wateredDay = day));
    Object.assign(food, consumeRations(food));
    assert.equal(getPerson(food, "dad").health, 100);
  }
  food.day = 5;
  food.people.forEach((p) => (p.wateredDay = 5));
  assert.equal(getPerson(consumeRations(food), "dad").health, 92);
});
test("主动治疗真实消耗一份，每日同人一次；药不代替补给且不能治外出/死亡人物", () => {
  const s = createFamilyGame();
  getPerson(s, "dad").health = 40;
  getPerson(s, "dad").thirstyDays = 3;
  const treated = transition(s, { type: "treat", id: "dad" }).state;
  assert.equal(treated.resources.medicine, 2);
  assert.equal(getPerson(treated, "dad").health, 65);
  assert.equal(getPerson(treated, "dad").thirstyDays, 3);
  assert.ok(transition(treated, { type: "treat", id: "dad" }).error);
  const gone = transition(s, {
    type: "outing",
    id: "daughter",
    location: "water",
  }).state;
  assert.ok(transition(gone, { type: "treat", id: "daughter" }).error);
});
test("日记选择一次生效、代价预检、不重抽，设备被带出后不能在家使用", () => {
  let s = createFamilyGame(12288);
  s = transition(s, {
    type: "outing",
    id: "daughter",
    location: "water",
    gear: "radio",
  }).state;
  assert.equal(gearAvailable(s, "radio"), false);
  assert.ok(chooseIncident(s, "listen").error);
  assert.equal(s.shelter!.rescue, 0);
  const borrowed = chooseIncident(s, "borrow").state;
  assert.equal(borrowed.resources.food, 2);
  assert.equal(borrowed.shelter!.rescue, 1);
  assert.deepEqual(chooseIncident(borrowed, "borrow").state, borrowed);
  const poor = createFamilyGame();
  poor.resources.food = 0;
  assert.ok(chooseIncident(poor, "borrow").error);
  const port = {
    getItem: () => JSON.stringify(borrowed),
    setItem() {},
    removeItem() {},
  };
  const loaded = loadGame(port);
  assert.equal(loaded.status, "valid");
  if (loaded.status === "valid") assert.deepEqual(loaded.state, borrowed);
});
test("放任有代价的事件在结束今天时只结算一次，日记和库存快照一致", () => {
  const s = incident(createFamilyGame(), "pests");
  const night = transition(s, { type: "end-day" }).state;
  assert.equal(night.resources.food, 2);
  assert.equal(night.diary[0].event, "口粮箱里有第二种呼吸声");
  assert.equal(night.diary[0].summary!.foodDelta, -1);
  assert.equal(night.shelter!.incident.choice, "leave");
  assert.deepEqual(transition(night, { type: "end-day" }).state, night);
  assert.ok(isGameState(night));
});
test("高污染时面罩减少伤势，地图缩短返程；装备损坏、丢失和收获只入库一次", () => {
  const base = createFamilyGame(12288);
  const bare = transition(base, {
    type: "outing",
    id: "daughter",
    location: "food",
  }).state;
  const masked = transition(base, {
    type: "outing",
    id: "daughter",
    location: "food",
    gear: "mask",
  }).state;
  const mapped = transition(base, {
    type: "outing",
    id: "daughter",
    location: "food",
    gear: "map",
  }).state;
  assert.ok(
    bare.expeditions[0].returnHealthCost >
      masked.expeditions[0].returnHealthCost,
  );
  assert.equal(
    mapped.expeditions[0].returnDay!,
    bare.expeditions[0].returnDay! - 1,
  );
  const trip = masked.expeditions[0];
  trip.returnDay = 2;
  trip.gearBroken = true;
  trip.gearFound = "handbook";
  masked.day = 2;
  resolveExpeditions(masked, []);
  const resources = { ...masked.resources };
  assert.equal(masked.shelter!.inventory.mask, 0);
  assert.equal(masked.shelter!.inventory.handbook, 1);
  resolveExpeditions(masked, []);
  assert.deepEqual(masked.resources, resources);
  const lost = transition(base, {
    type: "outing",
    id: "daughter",
    location: "food",
    gear: "map",
  }).state;
  getPerson(lost, "daughter").health = 0;
  settleLife(lost, []);
  assert.equal(lost.shelter!.inventory.map, 0);
  assert.equal(lost.expeditions[0].lostDay, 1);
});
test("救援线索有后续，早期不通关，完成准备改变100天车队结局", () => {
  let s = createFamilyGame();
  s = chooseIncident(s, "listen").state;
  assert.equal(s.shelter!.rescue, 1);
  s.day = 5;
  s = prepareShelterDay(s);
  assert.equal(incidentFor(s).id, "mark");
  s = chooseIncident(s, "map").state;
  assert.equal(s.shelter!.rescue, 2);
  assert.equal(s.resources.materials, 2);
  s.day = 12;
  s = prepareShelterDay(s);
  assert.equal(incidentFor(s).id, "reserve");
  s = chooseIncident(s, "water").state;
  assert.equal(s.resources.water, 0);
  assert.equal(s.shelter!.rescue, 3);
  s.settled = [12];
  assert.equal(evaluateEnding(s), null);
  s.day = 100;
  s.settled = [12, 100];
  assert.ok(evaluateEnding(s)!.title.includes("敲对了门"));
});
test("借药的后续在下一天出现；日常事件不连续重复，旧存档增加玩法而不清空库存", () => {
  let s = incident(createFamilyGame(), "neighbour");
  s = chooseIncident(s, "help").state;
  assert.equal(s.resources.medicine, 2);
  s.day = 2;
  s = prepareShelterDay(s);
  assert.equal(incidentFor(s).id, "thanks");
  s = chooseIncident(s, "take").state;
  assert.equal(s.resources.water, 4);
  assert.equal(s.flags.neighborAid, false);
  for (let day = 16; day < 30; day++) {
    s.day = day;
    s = prepareShelterDay(s);
    const recent = s.shelter!.recent;
    assert.equal(new Set(recent).size, recent.length);
  }
  const legacy = createGame("dad");
  legacy.resources.food = 12;
  legacy.day = 8;
  legacy.phase = "planning";
  const updated = enterFamilyMode(legacy);
  assert.equal(updated.resources.food, 12);
  assert.ok(updated.shelter);
  assert.ok(isGameState(updated));
  const bad = structuredClone(updated);
  bad.shelter!.inventory.radio = -1;
  assert.equal(isGameState(bad), false);
});
