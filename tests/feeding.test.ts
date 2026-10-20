import test from "node:test";
import assert from "node:assert/strict";
import { createGame, emptyPlan, getPerson } from "../src/game/initial";
import { feedPerson } from "../src/game/feeding";
import { consumeRations, rationPreview } from "../src/game/resources";
import { loadGame, isGameState } from "../src/game/storage";
import { launchExpedition } from "../src/game/expeditions";
// 扣费/拒绝回归使用充足库存，默认开局的稀缺数值另有测试。
function stocked() {
  const s = createGame("mom");
  s.resources.food = 16;
  s.resources.water = 20;
  return s;
}
test("直接喂食喂水各扣1并缓解对应状态，同日不重复扣也不能撤回", () => {
  let s = stocked();
  s.plan = emptyPlan();
  const p = getPerson(s, "mom");
  p.hungryDays = 2;
  p.thirstyDays = 2;
  p.health = 40;
  s = feedPerson(s, "mom", "food", true).state;
  assert.equal(s.resources.food, 15);
  assert.equal(getPerson(s, "mom").hungryDays, 0);
  assert.equal(getPerson(s, "mom").thirstyDays, 2);
  assert.equal(getPerson(s, "mom").health, 44);
  assert.ok(feedPerson(s, "mom", "food", true).error);
  assert.ok(feedPerson(s, "mom", "food", false).error);
  s = feedPerson(s, "mom", "water", true).state;
  assert.equal(s.resources.water, 19);
  assert.equal(getPerson(s, "mom").thirstyDays, 0);
  assert.equal(getPerson(s, "mom").health, 49);
  assert.equal(rationPreview(s).foodCost, 3);
  assert.equal(rationPreview(s).waterCost, 3);
  s = consumeRations(s);
  assert.equal(s.resources.food, 12);
  assert.equal(s.resources.water, 16);
  assert.equal(getPerson(s, "mom").fedDay, 1);
  assert.ok(isGameState(s));
});
test("暂不给不会扣库存，正常晚餐也不会偷偷喂，可反悔后消耗一份", () => {
  let s = stocked();
  s.plan = emptyPlan();
  s = feedPerson(s, "mom", "food", false).state;
  s = feedPerson(s, "mom", "water", false).state;
  assert.equal(s.resources.food, 16);
  assert.equal(s.resources.water, 20);
  assert.equal(rationPreview(s).withheld, 1);
  const next = consumeRations(s);
  assert.equal(next.resources.food, 13);
  assert.equal(next.resources.water, 17);
  assert.equal(getPerson(next, "mom").hungryDays, 1);
  assert.equal(getPerson(next, "mom").thirstyDays, 1);
  const reconsider = feedPerson(s, "mom", "food", true);
  assert.equal(reconsider.error, undefined);
  assert.equal(reconsider.state.resources.food, 15);
  assert.equal(getPerson(reconsider.state, "mom").refusedFoodDay, null);
});
test("库存不足、死亡、外出和已结算阶段不能喂，手动模式无额外扣费", () => {
  let s = stocked();
  s.plan = emptyPlan();
  s.resources.food = 0;
  assert.ok(feedPerson(s, "mom", "food", true).error);
  launchExpedition(s, "dad", { kind: "search", location: "water" });
  assert.ok(feedPerson(s, "dad", "water", true).error);
  Object.assign(getPerson(s, "brother"), {
    alive: false,
    health: 0,
    deathDay: 1,
    deathReason: "伤病",
  });
  assert.ok(feedPerson(s, "brother", "water", true).error);
  s.phase = "night";
  assert.ok(feedPerson(s, "mom", "water", true).error);
  s = stocked();
  s.plan = emptyPlan();
  s.plan.ration = "manual";
  const next = consumeRations(s);
  assert.equal(next.resources.food, 16);
  assert.equal(next.resources.water, 20);
  assert.ok(
    next.people.every((p) => p.hungryDays === 1 && p.thirstyDays === 1),
  );
});
test("喂食选择刷新保留，旧v2记录补新字段而不复活或丢失死亡", () => {
  const s = feedPerson(stocked(), "mom", "food", true).state;
  const port = {
    getItem: () => JSON.stringify(s),
    setItem() {},
    removeItem() {},
  };
  const loaded = loadGame(port);
  assert.equal(loaded.status, "valid");
  if (loaded.status === "valid") {
    assert.equal(getPerson(loaded.state, "mom").fedDay, 1);
    assert.ok(feedPerson(loaded.state, "mom", "food", true).error);
  }
  const old = JSON.parse(JSON.stringify(s));
  old.people.forEach((p: Record<string, unknown>) => {
    delete p.fedDay;
    delete p.wateredDay;
    delete p.refusedFoodDay;
    delete p.refusedWaterDay;
  });
  const migrated = loadGame({ ...port, getItem: () => JSON.stringify(old) });
  assert.equal(migrated.status, "valid");
});
