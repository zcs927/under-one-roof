import { PEOPLE } from "./config";
import { normalize, getPerson } from "./initial";
import { residents, isAway, isAlive } from "./presence";
import type { GameState, Person, PersonId } from "./types";
export function supplyNeed(
  state: GameState,
  person: Person,
  resource: "food" | "water",
) {
  const days = resource === "food" ? person.hungryDays : person.thirstyDays;
  const threshold = resource === "food" ? 5 : 3;
  if (!state.shelter) return days > 0 ? "urgent" : "fine";
  return days >= threshold ? "urgent" : days >= threshold - 1 ? "soon" : "fine";
}
export function settleSurvivalSupplies(state: GameState): GameState {
  const next = structuredClone(state);
  for (const p of residents(next)) {
    p.hungryDays = p.fedDay === next.day ? 0 : p.hungryDays + 1;
    p.thirstyDays = p.wateredDay === next.day ? 0 : p.thirstyDays + 1;
    const hunger =
      p.hungryDays >= 5 ? 8 + Math.min(8, (p.hungryDays - 5) * 2) : 0;
    const thirst =
      p.thirstyDays >= 3 ? 12 + Math.min(12, (p.thirstyDays - 3) * 3) : 0;
    p.health -= hunger + thirst;
    p.mood -= (hunger ? 3 : 0) + (thirst ? 4 : 0);
    if (hunger || thirst)
      next.dayNotes.push(
        `${PEOPLE[p.id].name}${hunger ? "已经饿得虚弱" : ""}${hunger && thirst ? "，" : ""}${thirst ? "急需饮水" : ""}。继续拖延可能死亡。`,
      );
  }
  return normalize(next);
}
export function treatPerson(
  state: GameState,
  id: PersonId,
): { state: GameState; error?: string } {
  if (state.phase !== "morning" || !isAlive(state, id) || isAway(state, id))
    return { state, error: "只能在白天治疗活着的留守家人" };
  const p = getPerson(state, id);
  if (state.flags[`treated:${state.day}:${id}`])
    return { state, error: "今天已经用过药，不能反复治疗" };
  if (p.health >= 100 && !p.illness && !p.injury)
    return { state, error: "身体尚好，先把药留给更需要的人" };
  if (state.resources.medicine < 1) return { state, error: "没有药品了" };
  const next = structuredClone(state),
    target = getPerson(next, id);
  next.resources.medicine--;
  target.health = Math.min(100, target.health + 25);
  delete target.illness;
  delete target.injury;
  target.mood += 3;
  next.flags[`treated:${state.day}:${id}`] = true;
  next.eventChanges.push(
    {
      label: "药品",
      before: state.resources.medicine,
      delta: -1,
      after: next.resources.medicine,
      reason: `给${PEOPLE[id].name}治疗`,
    },
    {
      label: `${PEOPLE[id].name} · 健康`,
      before: p.health,
      delta: target.health - p.health,
      after: target.health,
      reason: "主动用药",
    },
  );
  next.dayNotes.push(
    `${PEOPLE[id].name}用了1份药，${p.illness ? "发烧得到治疗，可以开始恢复身体" : "伤势缓和了"}。药不能代替食物和水。`,
  );
  return { state: normalize(next) };
}
