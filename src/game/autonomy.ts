import { getPerson, normalize } from "./initial";
import { PEOPLE } from "./config";
import { remember } from "./memories";
import { unable } from "./tasks";
import type { Autonomy, GameState, PersonId } from "./types";
import { isAway } from "./expeditions";
import { departureError, isAlive } from "./presence";
export function signalAutonomy(state: GameState): GameState {
  if (state.autonomy || state.day < 2 || state.day > 3) return state;
  const id = (["daughter", "dad", "mom", "brother"] as PersonId[]).find(
    (id) =>
      id !== state.player &&
      !unable(state, id) &&
      !isAway(state, id) &&
      !departureError(state, id),
  );
  if (!id) return state;
  const next = structuredClone(state);
  next.autonomy = { person: id, signaledDay: state.day, resolved: false };
  next.dayNotes.push("有人把街区地图翻了又翻，背包也被悄悄放到了门边。");
  return next;
}
export function resolveAutonomy(
  state: GameState,
  outcome: NonNullable<Autonomy["outcome"]>,
): GameState {
  const signaled = signalAutonomy(state);
  if (!signaled.autonomy || signaled.autonomy.resolved) return signaled;
  const next = structuredClone(signaled),
    a = next.autonomy!,
    id = a.person;
  if (!isAlive(next, id)) {
    a.resolved = true;
    a.outcome = "unwell";
    next.dayNotes.push("原本准备出门的家人已离世，计划取消。");
    return next;
  }
  if (isAway(next, id)) {
    a.resolved = true;
    a.outcome = "unwell";
    next.dayNotes.push(`${PEOPLE[id].name}已在外探索，今天只能等待消息。`);
    return next;
  }
  if (unable(next, id) || departureError(next, id)) outcome = "unwell";
  a.resolved = true;
  a.outcome = outcome;
  if (outcome === "formal")
    next.plan.tasks[id] = { kind: "search", location: "food" };
  if (outcome === "stay") next.flags[`support:${id}`] = true;
  if (outcome === "ignore")
    next.plan.tasks[id] = { kind: "search", location: "food", locked: true };
  if (outcome === "unwell") {
    next.plan.tasks[id] = { kind: "rest" };
    next.dayNotes.push(
      "身体或留守人数不允许外出，家人今天留下休息，无法绕过留守限制。",
    );
  }
  const delta =
    outcome === "formal"
      ? 6
      : outcome === "stay"
        ? 3
        : outcome === "stop"
          ? -8
          : 0;
  remember(next, {
    id: `autonomy:${id}`,
    source: "autonomy-day3",
    day: state.day,
    person: id,
    kind: outcome === "stop" ? "stopped" : "respected",
    trustDelta: delta,
    moodDelta: outcome === "stop" ? -5 : 0,
    text:
      outcome === "formal"
        ? "你终于认真把一项任务交给了我。"
        : outcome === "stay"
          ? "你听了我的想法，我们商量着留下。"
          : outcome === "stop"
            ? "你直接阻止了我，我觉得自己没有被听见。"
            : outcome === "ignore"
              ? "我没有等到答复，还是自己出了门。"
              : "你注意到我身体不适，让我先休息。",
  });
  if (getPerson(next, id).trust === undefined)
    throw new Error("自主角色不能是玩家");
  return normalize(next);
}
