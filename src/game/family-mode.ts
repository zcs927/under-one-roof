import { attitude } from "./attitude";
import { PEOPLE, WEATHER } from "./config";
import { launchExpedition } from "./expeditions";
import { createGame, emptyPlan, getPerson, normalize } from "./initial";
import { remember } from "./memories";
import { departureError } from "./presence";
import { taskEffect, taskError } from "./tasks";
import type { GameState, GearId, Location, PersonId } from "./types";
import { ensureShelter } from "./shelter-events";
import { gearAvailable } from "./shelter";
import { ensureVisualInjuries } from "./appearance";

export function familyPlan() {
  return { ...emptyPlan(), ration: "manual" as const };
}
export function enterFamilyMode(state: GameState): GameState {
  if (state.flags.familyManagement)
    return ensureVisualInjuries(ensureShelter(state));
  const next = structuredClone(state);
  next.flags.familyManagement = true;
  next.autonomy = null;
  next.people.forEach((p) => (p.trust ??= PEOPLE[p.id].trust ?? 60));
  next.plan = familyPlan();
  if (!["night", "ending"].includes(next.phase)) next.phase = "morning";
  // Existing departures stay real; an old save may already have sent someone today.
  next.flags.outingSent = next.expeditions.some(
    (t) => t.departedDay === next.day,
  );
  return ensureVisualInjuries(ensureShelter(next));
}
export function createFamilyGame(seed?: number) {
  const state = enterFamilyMode(createGame("mom", seed));
  state.flags["firstConcern:dad"] = true;
  return state;
}
export function outingError(
  state: GameState,
  id: PersonId,
  location: Location,
) {
  if (state.phase !== "morning") return "今天已经结束，明早再决定谁外出";
  const unavailable = departureError(state, id);
  if (unavailable) return unavailable;
  if (state.flags.outingSent) return "今天已经有一位家人出发，明天再安排";
  return taskError(state, id, { kind: "search", location });
}
export function requestOuting(
  state: GameState,
  id: PersonId,
  location: Location,
  force = false,
  gear?: GearId,
): { state: GameState; error?: string } {
  const error = outingError(state, id, location);
  if (error) return { state, error };
  if (gear && !gearAvailable(state, gear))
    return { state, error: "这件道具不在家中，不能带走" };
  const task = { kind: "search" as const, location };
  const response = attitude(state, id, task);
  if (force && !state.flags[`outingRefused:${id}`])
    return { state, error: "先听听家人的答复，再决定是否强制" };
  const next = structuredClone(state);
  if (response.level === "refuse" && !force) {
    if (!next.flags[`outingRefused:${id}`])
      next.dayNotes.push(
        `${PEOPLE[id].name}拒绝外出：${response.reasons.join("；")}`,
      );
    next.flags[`outingRefused:${id}`] = true;
    return { state: next };
  }
  if (force)
    remember(next, {
      id: `forced:${state.day}:${id}`,
      source: `outing:${state.day}:${id}`,
      person: id,
      day: state.day,
      kind: "stopped",
      trustDelta: -8,
      moodDelta: -10,
      text: "我说了不想出去，你还是强制让我离开。我记住了这次决定。",
    });
  const before = structuredClone(getPerson(next, id));
  const effect = taskEffect(next, id, task).people[id];
  launchExpedition(next, id, task, gear);
  const p = getPerson(next, id);
  if (effect)
    for (const key of ["health", "fatigue", "mood"] as const)
      p[key] += effect[key] ?? 0;
  normalize(next);
  for (const key of ["health", "fatigue", "mood"] as const)
    if (p[key] !== before[key])
      next.eventChanges.push({
        label: `${PEOPLE[id].name} · ${{ health: "健康", fatigue: "疲劳", mood: "情绪" }[key]}`,
        before: before[key],
        delta: p[key] - before[key],
        after: p[key],
        reason: "离开住所，开始探索",
      });
  next.flags.outingSent = true;
  next.dayNotes.push(
    `${PEOPLE[id].name}${force ? "被强制派出" : "答应了外出"}。归期未知，今天不能再派其他人。`,
  );
  return { state: next };
}
export function familyDayTitle(state: GameState) {
  return `第${state.day}天 · ${WEATHER[(state.day - 1) % WEATHER.length]}`;
}
