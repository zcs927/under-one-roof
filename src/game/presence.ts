import type { GameState, PersonId } from "./types";
export const isAlive = (state: GameState, id: PersonId) =>
  state.people.some((p) => p.id === id && p.alive);
export const activeExpedition = (state: GameState, id: PersonId) =>
  isAlive(state, id)
    ? state.expeditions.find(
        (t) => t.person === id && t.returnedDay === null && t.lostDay === null,
      )
    : undefined;
export const isAway = (state: GameState, id: PersonId) =>
  !!activeExpedition(state, id);
export const residents = (state: GameState) =>
  state.people.filter((p) => p.alive && !isAway(state, p.id));
export function departureError(state: GameState, id: PersonId): string | null {
  if (!isAlive(state, id)) return "家人已死亡，不能再外出";
  if (isAway(state, id)) return "家人已经在外出中";
  if (state.people.find((p) => p.id === id)?.illness)
    return "还在发烧，需要先用药或在家休息恢复，不能外出";
  if (
    !residents(state).some(
      (p) => p.id !== id && state.plan.tasks[p.id].kind !== "search",
    )
  )
    return "你是最后一名活着的留守者，不能外出；必须至少留一人在家";
  return null;
}
