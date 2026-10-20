import { PEOPLE } from "./config";
import { getPerson, normalize } from "./initial";
import { isAlive, isAway } from "./presence";
import { reservations } from "./resources";
import type { GameState, PersonId } from "./types";
export type FeedingResource = "food" | "water";
export function feedPerson(
  state: GameState,
  id: PersonId,
  resource: FeedingResource,
  give: boolean,
): { state: GameState; error?: string } {
  if (!["morning", "event", "planning"].includes(state.phase))
    return { state, error: "请在白天决定喂食，夜间结果已经结算" };
  if (!isAlive(state, id) || isAway(state, id))
    return { state, error: "只能给在家且活着的人喂食或喂水" };
  const field = resource === "food" ? "fedDay" : "wateredDay",
    refused = resource === "food" ? "refusedFoodDay" : "refusedWaterDay";
  const person = getPerson(state, id),
    label = resource === "food" ? "食物" : "饮水";
  if (person[field] === state.day)
    return { state, error: `今天已经给过${label}，不重复消耗，也不能撤回` };
  const reserved = resource === "food" ? reservations(state).food : 0;
  if (give && state.resources[resource] - reserved < 1)
    return { state, error: `没有可用${label}，库存不足或已预留` };
  if (!give && person[refused] === state.day) return { state };
  const next = structuredClone(state),
    target = getPerson(next, id);
  if (give) {
    const before = next.resources[resource];
    next.resources[resource]--;
    target[field] = state.day;
    target[refused] = null;
    if (resource === "food") target.hungryDays = 0;
    else target.thirstyDays = 0;
    const health = target.health;
    target.health = Math.min(
      100,
      target.health + (resource === "food" ? 4 : 5),
    );
    target.mood += 2;
    next.eventChanges.push({
      label,
      before,
      delta: -1,
      after: before - 1,
      reason: `直接给${PEOPLE[id].name}${resource === "food" ? "喂食" : "喂水"}`,
    });
    next.eventChanges.push({
      label: `${PEOPLE[id].name} · 健康`,
      before: health,
      delta: target.health - health,
      after: target.health,
      reason: `缓解${resource === "food" ? "饥饿" : "口渴"}`,
    });
    next.dayNotes.push(
      `${PEOPLE[id].name}得到一份${label}（库存−1），缓解${resource === "food" ? "饥饿" : "口渴"}；今晚不会重复扣这一份。`,
    );
  } else {
    target[refused] = state.day;
    next.dayNotes.push(
      `今天暂不给${PEOPLE[id].name}${label}，保留库存；晚间也不会自动分给对方，饥渴仍会恶化。`,
    );
  }
  return { state: normalize(next) };
}
