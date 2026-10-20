import { LIMITS, LOCATION_NAMES, PEOPLE, TASK_NAMES } from "./config";
import { getPerson } from "./initial";
import { isAway } from "./expeditions";
import { departureError, isAlive } from "./presence";
import type { GameState, PersonId, Resource, Task } from "./types";
export const unable = (state: GameState, id: PersonId) => {
  const p = getPerson(state, id);
  return (
    !p.alive ||
    p.health <= LIMITS.unableHealth ||
    p.fatigue >= LIMITS.unableFatigue
  );
};
export function taskError(
  state: GameState,
  id: PersonId,
  task: Task,
): string | null {
  if (!isAlive(state, id))
    return task.kind === "rest" ? null : "家人已死亡，无法执行任务";
  if (isAway(state, id))
    return task.kind === "rest" ? null : "家人仍在外出，无法安排住所内任务";
  if (task.kind === "search" && getPerson(state, id).illness)
    return "还在发烧，需要先用药或在家休息恢复，不能外出";
  if (task.kind !== "rest" && unable(state, id))
    return "身体需要恢复，只能休息或接受照护";
  if (task.kind === "search" && departureError(state, id))
    return departureError(state, id);
  if (task.kind === "care" && (!task.target || task.target === id))
    return "请选择另一名家人作为照护对象";
  if (
    task.kind === "care" &&
    task.target &&
    (!isAlive(state, task.target) ||
      isAway(state, task.target) ||
      state.plan.tasks[task.target].kind === "search")
  )
    return "照护对象已死亡、不在住所或今天将外出";
  if (task.kind === "search" && !task.location) return "请选择搜集地点";
  return null;
}
export const taskLabel = (task: Task) =>
  task.kind === "search"
    ? `搜集 · ${LOCATION_NAMES[task.location ?? "food"]}`
    : task.kind === "care"
      ? `照护 · ${task.target ? PEOPLE[task.target].name : "待选择"}`
      : TASK_NAMES[task.kind];
export interface TaskEffect {
  resources: Partial<Record<Resource, number>>;
  people: Partial<
    Record<PersonId, { health?: number; mood?: number; fatigue?: number }>
  >;
  note: string;
}
export function taskEffect(
  state: GameState,
  id: PersonId,
  task: Task,
): TaskEffect {
  const effect: TaskEffect = {
    resources: {},
    people: {},
    note: `${PEOPLE[id].name}：${taskLabel(task)}`,
  };
  if (!isAlive(state, id) || isAway(state, id))
    return {
      ...effect,
      note: `${PEOPLE[id].name}仍在外出，无法执行住所内任务`,
    };
  if (taskError(state, id, task))
    return { ...effect, note: taskError(state, id, task)! };
  if (task.kind === "rest")
    effect.people[id] = { health: 5, mood: 3, fatigue: -25 };
  if (task.kind === "repair") {
    effect.resources = { materials: -1, safety: 12 + (id === "dad" ? 8 : 0) };
    effect.people[id] = { fatigue: 15 };
  }
  if (task.kind === "care" && task.target) {
    effect.people[id] = { fatigue: 10 };
    effect.people[task.target] = {
      health: 8 + (id === "brother" ? 5 : 0),
      mood: 5 + (id === "mom" ? 5 : 0),
    };
  }
  if (task.kind === "search") {
    effect.note += " · 出发探索，归期与收获未知";
    effect.people[id] = {
      fatigue: 20,
      health: task.locked ? -8 : task.protected ? 0 : -5,
    };
  }
  return effect;
}
