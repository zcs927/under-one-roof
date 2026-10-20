import test from "node:test";
import assert from "node:assert/strict";
import { createGame, emptyPlan } from "../src/game/initial";
import { taskEffect, taskError } from "../src/game/tasks";
test("身体限制与照护目标边界", () => {
  const s = createGame("mom");
  s.people[1].fatigue = 80;
  assert.ok(
    taskError(s, "dad", { kind: "search", location: "food", protected: true }),
  );
  assert.equal(taskError(s, "dad", { kind: "rest" }), null);
  assert.ok(taskError(s, "mom", { kind: "care", target: "mom" }));
});
test("四人技能收益和防护代价", () => {
  const s = createGame("mom");
  s.plan = emptyPlan();
  assert.equal(
    taskEffect(s, "daughter", { kind: "search", location: "food" }).resources
      .food,
    undefined,
  );
  assert.equal(
    taskEffect(s, "daughter", { kind: "search", location: "materials" })
      .resources.materials,
    undefined,
  );
  assert.equal(taskEffect(s, "dad", { kind: "repair" }).resources.safety, 20);
  assert.equal(
    taskEffect(s, "brother", { kind: "care", target: "dad" }).people.dad
      ?.health,
    13,
  );
  assert.equal(
    taskEffect(s, "mom", { kind: "care", target: "dad" }).people.dad?.mood,
    10,
  );
  assert.equal(
    taskEffect(s, "dad", { kind: "search", location: "water", protected: true })
      .people.dad?.health,
    0,
  );
});
