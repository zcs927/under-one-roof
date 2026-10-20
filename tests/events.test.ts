import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../src/game/initial";
import { signalAutonomy, resolveAutonomy } from "../src/game/autonomy";
import { eventFor, chooseEvent } from "../src/game/events";
import { IDS } from "../src/game/config";
test("自主角色在四种身份下均非玩家，有提示后可干预", () => {
  for (const player of IDS) {
    let s = createGame(player);
    s.day = 2;
    s = signalAutonomy(s);
    assert.ok(s.autonomy);
    assert.notEqual(s.autonomy!.person, player);
    s.day = 3;
    const out = resolveAutonomy(s, "ignore");
    const id = out.autonomy!.person;
    assert.equal(out.plan.tasks[id].locked, true);
    assert.equal(out.plan.tasks[id].protected, undefined);
    assert.deepEqual(resolveAutonomy(out, "stop"), out);
  }
});
test("自主人物身体恶化时取消出门，零条件仍可继续", () => {
  let s = createGame("mom");
  s.day = 2;
  s = signalAutonomy(s);
  s.day = 3;
  s.people.find((p) => p.id === s.autonomy?.person)!.health = 1;
  const out = resolveAutonomy(s, "formal");
  assert.equal(out.autonomy!.outcome, "unwell");
  assert.equal(out.plan.tasks[out.autonomy!.person].kind, "rest");
});
test("每日事件都有零资源路径，选择不可重复领收益", () => {
  const s = createGame("mom");
  s.phase = "event";
  const out = chooseEvent(s, "inventory").state;
  assert.equal(out.resources.food, 5);
  assert.deepEqual(chooseEvent(out, "inventory").state, out);
  for (let day = 1; day <= 100; day++) {
    s.day = day;
    const e = eventFor(s);
    assert.ok(e.choices.length >= 2);
    assert.ok(e.choices.some((c) => !c.requires));
  }
});
test("借药选择影响第5天回礼，玩家母亲只改变自身情绪", () => {
  const s = createGame("mom");
  s.day = 2;
  s.phase = "event";
  const out = chooseEvent(s, "help").state;
  assert.equal(out.resources.medicine, 2);
  assert.equal(out.people[0].trust, undefined);
  out.day = 5;
  assert.ok(eventFor(out).choices.some((c) => c.id === "gift"));
  out.flags.helped = false;
  assert.ok(eventFor(out).choices.some((c) => c.id === "trade"));
});
