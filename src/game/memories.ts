import { PEOPLE, DAY_LIMIT } from "./config";
import { getPerson, normalize } from "./initial";
import type { GameState, Memory, PersonId, PromiseRecord } from "./types";
import { isAway } from "./expeditions";
import { isAlive } from "./presence";
export function remember(state: GameState, memory: Memory) {
  if (state.memories.some((m) => m.id === memory.id)) return;
  state.memories.push(memory);
  const p = getPerson(state, memory.person);
  if (p.trust !== undefined) p.trust += memory.trustDelta;
  p.mood += memory.moodDelta;
  state.dayNotes.push(`${PEOPLE[memory.person].name}记得：${memory.text}`);
  normalize(state);
}
export function makePromise(
  state: GameState,
  id: PersonId,
  kind: PromiseRecord["kind"],
): { state: GameState; error?: string } {
  if (!isAlive(state, id))
    return { state, error: "家人已死亡，无法再作出承诺" };
  if (isAway(state, id))
    return { state, error: "家人仍在外出，无法当面作出承诺" };
  if (id === state.player) return { state, error: "不能向自己作出协商承诺" };
  if (state.promises.some((p) => p.person === id && p.status === "pending"))
    return { state, error: "这个家人还有尚未到期的承诺" };
  if (kind === "rest" && state.day === DAY_LIMIT)
    return { state, error: "第100天不能承诺明日休息" };
  if (
    kind === "medicine" &&
    (state.resources.medicine < 1 ||
      (state.plan.medicineTarget && state.plan.medicineTarget !== id))
  )
    return { state, error: "药品不足或已预留给别人" };
  const next = structuredClone(state);
  next.promises.push({
    id: `promise:${state.day}:${id}:${kind}`,
    person: id,
    kind,
    day: state.day,
    dueDay: state.day + (kind === "rest" ? 1 : 0),
    status: "pending",
  });
  if (kind === "medicine") next.plan.medicineTarget = id;
  return { state: next };
}
export function settlePromises(state: GameState, medicated: PersonId | null) {
  for (const p of state.promises) {
    if (!isAlive(state, p.person)) {
      if (p.status === "pending") p.status = "cancelled";
      continue;
    }
    if (p.status !== "pending" || p.dueDay > state.day) continue;
    const kept =
      p.kind === "medicine"
        ? medicated === p.person
        : state.plan.tasks[p.person].kind === "rest" &&
          !isAway(state, p.person) &&
          !state.expeditions.some(
            (trip) =>
              trip.person === p.person &&
              trip.departedDay <= state.day &&
              (trip.returnedDay === null || trip.returnedDay >= state.day),
          );
    p.status = kept ? "kept" : "broken";
    remember(state, {
      id: `memory:${p.id}`,
      source: p.id,
      person: p.person,
      day: state.day,
      kind: kept ? "kept" : "broken",
      text: `你${kept ? "兑现了" : "没有兑现"}${p.kind === "medicine" ? "给我药" : "让我休息"}的承诺。`,
      trustDelta: kept ? 8 : -12,
      moodDelta: kept ? 0 : -5,
    });
  }
}
