import { reservationErrors } from "./resources";
import { makePromise } from "./memories";
import { attitude } from "./attitude";
import type { GameState, PersonId } from "./types";
import { isAway } from "./expeditions";
import { isAlive } from "./presence";
export type Offer = "explain" | "protection" | "food" | "medicine" | "rest";
export function negotiate(
  state: GameState,
  id: PersonId,
  offer: Offer,
): { state: GameState; error?: string } {
  if (!isAlive(state, id)) return { state, error: "家人已死亡，无法再协商" };
  if (isAway(state, id)) return { state, error: "家人仍在外出，暂时无法交谈" };
  if (id === state.player)
    return { state, error: "这是你自己的安排，无需协商" };
  if (state.plan.tasks[id].locked)
    return { state, error: "家人已经自主出发，今天的行动无法更改" };
  if (offer === "medicine" || offer === "rest")
    return makePromise(state, id, offer);
  const next = structuredClone(state),
    task = next.plan.tasks[id];
  if (task.kind === "rest") return { state, error: "休息无需额外让步" };
  if (offer === "explain") task.explained = true;
  if (offer === "food") task.extraFood = !task.extraFood;
  if (offer === "protection") {
    if (task.kind !== "search") return { state, error: "防护包仅供外出使用" };
    task.protected = !task.protected;
  }
  const error = reservationErrors(next)[0];
  if (error) return { state, error };
  return { state: next };
}
export const cooperation = (state: GameState, id: PersonId) =>
  attitude(state, id);
