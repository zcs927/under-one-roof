import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../src/game/initial";
import {
  reservations,
  reservationErrors,
  rationPreview,
  consumeRations,
} from "../src/game/resources";
import { attitude } from "../src/game/attitude";
import { makePromise, settlePromises } from "../src/game/memories";
import { negotiate } from "../src/game/negotiation";
test("预留不借用未来收益，装备和外出名额唯一", () => {
  const s = createGame("mom");
  s.resources.food = 0;
  s.resources.water = 20;
  s.plan.tasks.dad.extraFood = true;
  assert.ok(reservationErrors(s).length);
  assert.equal(reservations(s).food, 1);
  assert.equal(rationPreview(s).shortage, 5);
  s.plan.tasks.daughter = { kind: "search", location: "food", protected: true };
  s.plan.tasks.dad.protected = true;
  assert.ok(reservationErrors(s).some((x) => x.includes("防护")));
  assert.ok(reservationErrors(s).some((x) => x.includes("外出")));
});
test("配给只对每类短缺罚一次，节省额外扣3，库存不负数", () => {
  const s = createGame("mom");
  s.resources.food = 0;
  s.resources.water = 1;
  s.plan.ration = "save";
  const next = consumeRations(s);
  assert.equal(next.people[0].health, 62);
  assert.equal(next.people[0].mood, 56);
  assert.equal(next.resources.water, 0);
  assert.equal(s.resources.water, 1);
});
test("首日分歧可通过实际保障解决，重复解释不刷分", () => {
  let s = createGame("mom");
  assert.equal(attitude(s, "dad").level, "refuse");
  s = negotiate(s, "dad", "explain").state;
  const score = attitude(s, "dad").score;
  s = negotiate(s, "dad", "explain").state;
  assert.equal(attitude(s, "dad").score, score);
  s = negotiate(s, "dad", "protection").state;
  s = negotiate(s, "dad", "food").state;
  assert.equal(attitude(s, "dad").level, "accept");
  assert.equal(s.people[1].trust, 60);
});
test("高信任也不能绕过身体限制，低信任仍可休息", () => {
  const s = createGame("mom");
  s.people[1].trust = 100;
  s.people[1].health = 30;
  assert.equal(attitude(s, "dad").hard, true);
  s.people[1].trust = 0;
  s.plan.tasks.dad = { kind: "rest" };
  assert.equal(attitude(s, "dad").level, "accept");
});
test("兑现或失信只结算一次，取消治疗不删除承诺", () => {
  let s = createGame("mom");
  s = makePromise(s, "dad", "medicine").state;
  assert.equal(s.plan.medicineTarget, "dad");
  assert.ok(makePromise(s, "dad", "rest").error);
  s.plan.medicineTarget = null;
  settlePromises(s, null);
  assert.equal(s.people[1].trust, 48);
  settlePromises(s, null);
  assert.equal(s.people[1].trust, 48);
  assert.equal(s.memories.length, 1);
});
test("明日休息的期限及第100天边界", () => {
  let s = createGame("daughter");
  s = makePromise(s, "dad", "rest").state;
  settlePromises(s, null);
  assert.equal(s.promises[0].status, "pending");
  s.day = 2;
  s.plan.tasks.dad = { kind: "rest" };
  settlePromises(s, null);
  assert.equal(s.people[1].trust, 68);
  s.day = 100;
  assert.ok(makePromise(s, "mom", "rest").error);
  assert.ok(makePromise(s, "daughter", "medicine").error);
});
