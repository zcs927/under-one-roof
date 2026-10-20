import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../src/game/initial";
import { sessionReducer } from "../src/game/use-game";
test("会话恢复保留阶段和预留，写入失败不丢失计划", () => {
  const game = createGame("dad");
  game.phase = "planning";
  game.plan.tasks.daughter = {
    kind: "search",
    location: "water",
    protected: true,
  };
  const initial = {
    game: null,
    ready: false,
    error: "",
    saveMessage: "",
    saved: false,
    invalidSave: false,
    playing: false,
  };
  const hydrated = sessionReducer(initial, {
    type: "hydrate",
    result: { status: "valid", state: game },
  });
  assert.equal(hydrated.game?.phase, "planning");
  assert.equal(hydrated.game?.plan.tasks.daughter.protected, true);
  const failed = sessionReducer(hydrated, {
    type: "save-result",
    message: "full",
    saved: false,
  });
  assert.deepEqual(failed.game, game);
  assert.equal(failed.saved, false);
  assert.equal(failed.playing, false);
});
