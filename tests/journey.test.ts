import test from "node:test";
import assert from "node:assert/strict";
import { createGame, emptyPlan } from "../src/game/initial";
import { transition } from "../src/game/reducer";
import { IDS, DAY_LIMIT } from "../src/game/config";
import { eventFor, choiceError } from "../src/game/events";
import { evaluateEnding } from "../src/game/ending";
import { isGameState } from "../src/game/storage";
import type { GameState } from "../src/game/types";
function step(s: GameState) {
  s = transition(s, { type: "event" }).state;
  const selected = eventFor(s).choices.find(
    (c) => !Object.keys(c.requires ?? {}).length && !choiceError(s, c),
  )!;
  s = transition(s, { type: "choice", id: selected.id }).state;
  s.plan = emptyPlan();
  const confirmation = transition(s, { type: "confirm" });
  assert.equal(confirmation.error, undefined);
  const result = transition(confirmation.state, { type: "execute" });
  assert.equal(result.error, undefined);
  assert.deepEqual(
    transition(result.state, { type: "execute" }).state,
    result.state,
  );
  assert.ok(isGameState(result.state));
  return result.state.phase === "ending"
    ? result.state
    : transition(result.state, { type: "next" }).state;
}
test("充足初始物资场景可完整走100天，四种身份不在第7天提前结束", () => {
  for (const id of IDS) {
    let s = createGame(id);
    s.resources.food = 500;
    s.resources.water = 500;
    for (let day = 1; day <= DAY_LIMIT; day++) {
      s = step(s);
      if (day < DAY_LIMIT) assert.notEqual(s.phase, "ending");
      if (day === 7) assert.equal(s.day, 8);
    }
    assert.equal(s.day, 100);
    assert.equal(s.phase, "ending");
    assert.equal(s.diary.length, 100);
    assert.ok(s.people.every((p) => p.alive));
    assert.equal(s.player, id);
  }
});
test("零补给危重场景会提前死亡，死亡与结算不会重复", () => {
  let s = createGame("mom");
  s.plan = emptyPlan();
  s.resources.food = 0;
  s.resources.water = 0;
  s.people.forEach((p) => {
    p.health = 1;
    p.fatigue = 100;
  });
  s = step(s);
  assert.equal(s.phase, "ending");
  assert.equal(s.day, 1);
  assert.equal(s.ending?.kind, "extinct");
  assert.ok(
    s.people.every((p) => !p.alive && p.health === 0 && p.deathDay === 1),
  );
  assert.equal(s.diary.length, 1);
  assert.deepEqual(transition(s, { type: "execute" }).state, s);
});
test("未处理事件与明确拒绝不能执行，百日前不得产生普通通关结局", () => {
  const s = createGame("mom");
  assert.ok(transition(s, { type: "execute" }).error);
  s.phase = "planning";
  assert.ok(transition(s, { type: "confirm" }).error);
  s.day = 7;
  s.settled = [7];
  assert.equal(evaluateEnding(s), null);
  s.day = 99;
  s.settled = [99];
  assert.equal(evaluateEnding(s), null);
  s.day = 100;
  s.settled = [100];
  s.people.filter((p) => p.trust !== undefined).forEach((p) => (p.trust = 60));
  assert.equal(evaluateEnding(s)?.kind, "together");
  s.people.filter((p) => p.trust !== undefined).forEach((p) => (p.trust = 20));
  assert.equal(evaluateEnding(s)?.kind, "distance");
});
