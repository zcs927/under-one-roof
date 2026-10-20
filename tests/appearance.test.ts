import test from "node:test";
import assert from "node:assert/strict";
import {
  appearanceFor,
  ensureVisualInjuries,
  markInjury,
  settleInjury,
} from "../src/game/appearance";
import { createFamilyGame, enterFamilyMode } from "../src/game/family-mode";
import { getPerson } from "../src/game/initial";
import { transition } from "../src/game/reducer";
import { launchExpedition, resolveExpeditions } from "../src/game/expeditions";
import { chooseEncounter } from "../src/game/encounters";
import { settleLife } from "../src/game/life";
import { isGameState, loadGame } from "../src/game/storage";
import type { GameState } from "../src/game/types";
function injuredReturn() {
  for (let n = 1; n < 200; n++) {
    const s = createFamilyGame(Math.imul(n, 2654435761) >>> 0);
    launchExpedition(s, "daughter", { kind: "search", location: "food" });
    if (s.expeditions[0].story!.kind !== "injured") continue;
    s.expeditions[0].returnDay = s.day;
    resolveExpeditions(s, []);
    return s;
  }
  throw Error("没有自然受伤归来夹具");
}
const load = (s: GameState) =>
  loadGame({ getItem: () => JSON.stringify(s), setItem() {}, removeItem() {} });
test("四人开局保持原样，单纯低健康/饥渴不凭空画绷带，状态边界一致", () => {
  const s = createFamilyGame();
  for (const p of s.people) assert.equal(appearanceFor(s, p).kind, "normal");
  const p = getPerson(s, "mom");
  p.hungryDays = 4;
  p.health = 30;
  assert.equal(appearanceFor(s, p).kind, "hungry");
  assert.ok(!appearanceFor(s, p).labels.includes("受伤"));
  p.hungryDays = 0;
  p.health = 90;
  p.thirstyDays = 2;
  assert.ok(appearanceFor(s, p).labels.includes("缺水"));
  p.thirstyDays = 0;
  p.fatigue = 70;
  assert.ok(appearanceFor(s, p).labels.includes("疲惫"));
});
test("复合状态发烧/外伤/饥渴按紧急程度展示，照顾只解除对应外观", () => {
  let s = createFamilyGame();
  const p = getPerson(s, "mom");
  p.illness = { sinceDay: 1, daysLeft: 3 };
  markInjury(s, p);
  p.hungryDays = 5;
  p.thirstyDays = 3;
  assert.equal(appearanceFor(s, p).kind, "sick");
  assert.deepEqual(appearanceFor(s, p).labels, [
    "发烧",
    "受伤",
    "饥饿",
    "缺水",
  ]);
  s = transition(s, {
    type: "feed",
    id: "mom",
    resource: "food",
    give: true,
  }).state;
  assert.equal(appearanceFor(s, getPerson(s, "mom")).kind, "sick");
  assert.ok(!appearanceFor(s, getPerson(s, "mom")).labels.includes("饥饿"));
  assert.ok(getPerson(s, "mom").injury);
  s = transition(s, { type: "treat", id: "mom" }).state;
  assert.equal(getPerson(s, "mom").injury, undefined);
  assert.equal(getPerson(s, "mom").illness, undefined);
  assert.equal(appearanceFor(s, getPerson(s, "mom")).kind, "hungry");
  s = transition(s, {
    type: "feed",
    id: "mom",
    resource: "water",
    give: true,
  }).state;
  assert.equal(appearanceFor(s, getPerson(s, "mom")).kind, "normal");
  assert.equal(s.resources.food, 2);
  assert.equal(s.resources.water, 1);
  assert.equal(s.resources.medicine, 2);
});
test("真实受伤归来与抢劫受伤建立外伤，返回/选择去重且刷新保持", () => {
  const s = injuredReturn(),
    p = getPerson(s, "daughter");
  assert.ok(p.injury);
  assert.equal(appearanceFor(s, p).kind, "injured");
  const once = structuredClone(s);
  resolveExpeditions(s, []);
  assert.deepEqual(s, once);
  assert.equal(load(s).status, "valid");
  let raid = createFamilyGame();
  raid = transition(transition(raid, { type: "end-day" }).state, {
    type: "next",
  }).state;
  raid.encounters!.current!.secret = { identity: "raiders", roll: 0.99 };
  const hurt = chooseEncounter(raid, "open").state;
  assert.ok(getPerson(hurt, "dad").injury);
  assert.equal(appearanceFor(hurt, getPerson(hurt, "dad")).kind, "injured");
  assert.ok(isGameState(hurt));
});
test("外伤在后续三个居家休息夜消退，不额外扣血，受伤当晚不提前消退", () => {
  const s = createFamilyGame(),
    p = getPerson(s, "mom");
  p.health = 100;
  markInjury(s, p);
  settleInjury(s, p);
  assert.equal(p.injury!.daysLeft, 3);
  for (let day = 2; day <= 4; day++) {
    s.day = day;
    settleInjury(s, p);
    assert.equal(p.health, 100);
  }
  assert.equal(p.injury, undefined);
  assert.equal(appearanceFor(s, p).kind, "normal");
  markInjury(s, p);
  s.day++;
  s.plan.tasks.mom = { kind: "repair" };
  settleInjury(s, p);
  assert.equal(p.injury!.daysLeft, 3);
  s.plan.tasks.mom = { kind: "rest" };
  settleInjury(s, p);
  assert.equal(p.injury!.daysLeft, 2);
});
test("满健康但仍有外伤也可治疗，药物不解除饥饿，零库存不给假恢复", () => {
  const s = createFamilyGame();
  const p = getPerson(s, "mom");
  p.health = 100;
  p.hungryDays = 4;
  markInjury(s, p);
  const poor = structuredClone(s);
  poor.resources.medicine = 0;
  assert.ok(transition(poor, { type: "treat", id: "mom" }).error);
  assert.ok(getPerson(poor, "mom").injury);
  const healed = transition(s, { type: "treat", id: "mom" }).state;
  assert.equal(getPerson(healed, "mom").injury, undefined);
  assert.equal(appearanceFor(healed, getPerson(healed, "mom")).kind, "hungry");
  assert.equal(healed.resources.medicine, 2);
  assert.ok(transition(healed, { type: "treat", id: "mom" }).error);
});
test("旧近期外伤只推断一次，已经用药的旧伤不复发，迁移不改变身体与库存", () => {
  const old = injuredReturn();
  delete old.flags.appearanceInjuriesV1;
  delete getPerson(old, "daughter").injury;
  const before = structuredClone(old);
  const migrated = enterFamilyMode(old);
  assert.ok(getPerson(migrated, "daughter").injury);
  assert.equal(
    getPerson(migrated, "daughter").health,
    getPerson(before, "daughter").health,
  );
  assert.deepEqual(migrated.resources, before.resources);
  const healed = transition(migrated, { type: "treat", id: "daughter" }).state;
  assert.equal(
    getPerson(enterFamilyMode(healed), "daughter").injury,
    undefined,
  );
  const treatedOld = structuredClone(old);
  treatedOld.day = 2;
  treatedOld.flags["treated:2:daughter"] = true;
  assert.equal(
    getPerson(ensureVisualInjuries(treatedOld), "daughter").injury,
    undefined,
  );
});
test("离家和死亡不渲染任何外观，死亡清理外伤记录，在外休息不愈合", () => {
  const s = createFamilyGame();
  const p = getPerson(s, "daughter");
  markInjury(s, p);
  launchExpedition(s, "daughter", { kind: "search", location: "food" });
  s.day++;
  settleInjury(s, p);
  assert.equal(p.injury!.daysLeft, 3);
  assert.equal(appearanceFor(s, p).hidden, true);
  assert.deepEqual(appearanceFor(s, p).labels, []);
  p.health = 0;
  settleLife(s, []);
  assert.equal(p.alive, false);
  assert.equal(p.injury, undefined);
  assert.equal(appearanceFor(s, p).hidden, true);
});
test("外伤存档校验拒绝非法日期/时长/死者记录，旧无字段兼容", () => {
  for (const mutate of [
    (s: GameState) => {
      getPerson(s, "mom").injury = { sinceDay: 2, daysLeft: 3 };
    },
    (s: GameState) => {
      getPerson(s, "mom").injury = { sinceDay: 1, daysLeft: 0 };
    },
    (s: GameState) => {
      getPerson(s, "mom").injury = { sinceDay: 1, daysLeft: 4 };
    },
    (s: GameState) => {
      Object.assign(getPerson(s, "mom"), {
        alive: false,
        health: 0,
        deathDay: 1,
        deathReason: "旧伤",
        injury: { sinceDay: 1, daysLeft: 3 },
      });
    },
  ]) {
    const s = createFamilyGame();
    mutate(s);
    assert.equal(load(s).status, "invalid");
  }
  const s = createFamilyGame();
  delete s.flags.appearanceInjuriesV1;
  assert.equal(load(s).status, "valid");
});
