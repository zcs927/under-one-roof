import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../src/game/initial";
import {
  clearGame,
  isGameState,
  loadGame,
  SAVE_KEY,
  saveGame,
  type StoragePort,
} from "../src/game/storage";
test("完整存档往返，损坏及版本不兼容可恢复", () => {
  const map = new Map<string, string>();
  const port: StoragePort = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
  const s = createGame("brother");
  s.phase = "planning";
  s.plan.tasks.mom = { kind: "care", target: "dad" };
  assert.equal(saveGame(port, s).ok, true);
  const loaded = loadGame(port);
  assert.equal(loaded.status, "valid");
  if (loaded.status === "valid") assert.deepEqual(loaded.state, s);
  map.set(SAVE_KEY, "{");
  assert.equal(loadGame(port).status, "invalid");
  map.set(SAVE_KEY, JSON.stringify({ ...s, version: 999 }));
  assert.equal(loadGame(port).status, "invalid");
  map.set("other-app", "keep");
  clearGame(port);
  assert.equal(map.get("other-app"), "keep");
});
test("不可用存储返回失败且不改变内存，非法数值被拒绝", () => {
  const port: StoragePort = {
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("full");
    },
    removeItem() {
      throw Error("blocked");
    },
  };
  const s = createGame("mom");
  assert.equal(loadGame(port).status, "unavailable");
  assert.equal(saveGame(port, s).ok, false);
  assert.equal(s.resources.food, 3);
  s.resources.food = -1;
  assert.equal(isGameState(s), false);
});
test("旧四人存档迁移弟弟身份及任务、承诺、记忆、自主行动引用", () => {
  const s = createGame("mom");
  s.day = 3;
  s.phase = "planning";
  s.plan.tasks.dad = { kind: "care", target: "brother" };
  s.plan.medicineTarget = "brother";
  s.promises = [
    {
      id: "medicine:3:brother",
      person: "brother",
      kind: "medicine",
      day: 3,
      dueDay: 3,
      status: "pending",
    },
  ];
  s.memories = [
    {
      id: "care:2:brother",
      person: "brother",
      day: 2,
      kind: "cared",
      text: "周小豆记得照护",
      source: "care:brother",
      trustDelta: 3,
      moodDelta: 0,
    },
  ];
  s.autonomy = { person: "brother", signaledDay: 2, resolved: false };
  const legacy = JSON.stringify({ ...s, version: 1 })
    .replaceAll("brother", "grandpa")
    .replaceAll("周小豆", "林远山");
  const loaded = loadGame({
    getItem: () => legacy,
    setItem() {},
    removeItem() {},
  });
  assert.equal(loaded.status, "valid");
  if (loaded.status === "valid") assert.deepEqual(loaded.state, s);
  const player = createGame("brother");
  const oldPlayer = JSON.stringify({ ...player, version: 1 }).replaceAll(
    "brother",
    "grandpa",
  );
  const resumed = loadGame({
    getItem: () => oldPlayer,
    setItem() {},
    removeItem() {},
  });
  assert.equal(resumed.status, "valid");
  if (resumed.status === "valid") assert.deepEqual(resumed.state, player);
});
