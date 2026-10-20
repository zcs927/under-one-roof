import test from "node:test";
import assert from "node:assert/strict";
import { createGame, normalize } from "../src/game/initial";
import { IDS } from "../src/game/config";
test("四种身份均可初始化，只有其余三人拥有信任", () => {
  for (const id of IDS) {
    const s = createGame(id);
    assert.equal(s.people.length, 4);
    assert.equal(s.people.filter((p) => p.trust !== undefined).length, 3);
    assert.equal(s.people.find((p) => p.id === id)?.trust, undefined);
    assert.equal(JSON.parse(JSON.stringify(s)).player, id);
  }
});
test("实例互不污染且状态边界合法", () => {
  const a = createGame("mom"),
    b = createGame("mom");
  a.resources.food = -2;
  a.people[0].health = -50;
  a.people[1].trust = 200;
  normalize(a);
  assert.equal(a.resources.food, 0);
  assert.equal(a.people[0].health, 0);
  assert.equal(a.people[1].trust, 100);
  assert.equal(b.resources.food, 3);
});
