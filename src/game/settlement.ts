import { IDS, PEOPLE, RESOURCE_NAMES } from "./config";
import { attitude } from "./attitude";
import { consumeRations, reservationErrors } from "./resources";
import { getPerson, normalize } from "./initial";
import { taskEffect, taskError } from "./tasks";
import { remember, settlePromises } from "./memories";
import { eventFor } from "./events";
import type { Change, GameState } from "./types";
import { isAway, launchExpedition, resolveExpeditions } from "./expeditions";
import { isAlive, residents } from "./presence";
import { settleLife } from "./life";
import { evaluateEnding } from "./ending";
import { familyDayTitle } from "./family-mode";
import { incidentFor } from "./shelter-events";
import { supplyNeed } from "./supplies";
export function planErrors(state: GameState): string[] {
  const errors = reservationErrors(state);
  if (!state.choices[String(state.day)]) errors.push("请先处理今天的事件");
  if (
    state.plan.medicineTarget &&
    (!isAlive(state, state.plan.medicineTarget) ||
      isAway(state, state.plan.medicineTarget) ||
      state.plan.tasks[state.plan.medicineTarget].kind === "search")
  )
    errors.push("用药对象不在住所或今天将外出，请调整治疗安排");
  for (const id of IDS) {
    const task = state.plan.tasks[id];
    if (!isAlive(state, id) || isAway(state, id)) {
      if (task.kind !== "rest")
        errors.push(`${PEOPLE[id].name}仍在外出，不能重新分工`);
      continue;
    }
    const error = taskError(state, id, task);
    if (error) errors.push(`${PEOPLE[id].name}：${error}`);
    else if (!task.locked && attitude(state, id).level === "refuse")
      errors.push(`${PEOPLE[id].name}还没有同意这个安排`);
  }
  return [...new Set(errors)];
}
export function settleDay(state: GameState): {
  state: GameState;
  error?: string;
} {
  if (state.settled.includes(state.day)) return { state };
  if (state.phase !== "confirm") return { state, error: "请先确认今日计划" };
  const error = planErrors(state)[0];
  if (error) return { state, error };
  let next = structuredClone(state);
  const actions: string[] = [],
    deltas: Record<string, number> = {};
  for (const id of IDS) {
    if (!isAlive(state, id) || isAway(state, id)) continue;
    const task = state.plan.tasks[id],
      effect = taskEffect(state, id, task);
    actions.push(`${task.locked ? "自主行动 · " : ""}${effect.note}`);
    if (task.kind === "search") launchExpedition(next, id, task);
    for (const [key, value] of Object.entries(effect.resources))
      next.resources[key as keyof typeof next.resources] += value ?? 0;
    for (const [target, changes] of Object.entries(effect.people))
      for (const [key, value] of Object.entries(changes))
        deltas[`${target}:${key}`] =
          (deltas[`${target}:${key}`] ?? 0) + (value ?? 0);
    if (task.extraFood && task.kind !== "rest") {
      next.resources.food -= 1;
      deltas[`${id}:mood`] = (deltas[`${id}:mood`] ?? 0) + 5;
    }
  }
  for (const p of next.people)
    for (const key of ["health", "fatigue", "mood"] as const)
      p[key] += deltas[`${p.id}:${key}`] ?? 0;
  resolveExpeditions(next, actions);
  const medicated = next.plan.medicineTarget;
  if (medicated) {
    next.resources.medicine--;
    getPerson(next, medicated).health += 15;
    remember(next, {
      id: `care:${state.day}:${medicated}`,
      source: `medicine:${state.day}`,
      person: medicated,
      day: state.day,
      kind: "cared",
      text: "你在物资紧张时仍然给我留了药。",
      trustDelta: 0,
      moodDelta: 0,
    });
  }
  for (const id of IDS) {
    if (!isAlive(state, id) || isAway(state, id)) continue;
    const t = state.plan.tasks[id];
    if (t.kind === "care" && t.target)
      remember(next, {
        id: `care:${state.day}:${id}:${t.target}`,
        source: `task:${state.day}:${id}`,
        person: t.target,
        day: state.day,
        kind: "cared",
        text: `${PEOPLE[id].name}今天留下来照顾了我。`,
        trustDelta: 0,
        moodDelta: 0,
      });
  }
  next = consumeRations(next);
  next.resources.safety -= 4;
  settlePromises(next, medicated);
  settleLife(next, actions);
  normalize(next);
  const changes: Change[] = [...next.eventChanges];
  for (const key of Object.keys(
    state.resources,
  ) as (keyof typeof state.resources)[])
    if (next.resources[key] !== state.resources[key])
      changes.push({
        label: RESOURCE_NAMES[key],
        before: state.resources[key],
        delta: next.resources[key] - state.resources[key],
        after: next.resources[key],
        reason:
          key === "safety" ? "行动效果与住所每日损耗 −4" : "任务与晚间补给",
      });
  for (const p of next.people) {
    const before = getPerson(state, p.id);
    for (const key of ["health", "fatigue", "mood", "trust"] as const) {
      if (p[key] !== undefined && p[key] !== before[key])
        changes.push({
          label: `${PEOPLE[p.id].name} · ${{ health: "健康", fatigue: "疲劳", mood: "情绪", trust: "信任" }[key]}`,
          before: before[key] ?? 0,
          delta: (p[key] ?? 0) - (before[key] ?? 0),
          after: p[key] ?? 0,
          reason: key === "trust" ? "到期承诺与重要经历" : "行动、补给与照护",
        });
    }
  }
  const event = eventFor(state);
  const incident = state.shelter ? incidentFor(state) : null;
  next.diary.push({
    day: state.day,
    event:
      incident?.title ??
      (state.flags.familyManagement ? familyDayTitle(state) : event.title),
    choice: incident
      ? (incident.choices.find((c) => c.id === state.shelter?.incident.choice)
          ?.title ?? "暂不处理")
      : state.flags.familyManagement
        ? next.expeditions.some((t) => t.departedDay === next.day)
          ? "有人出发，其他人留守"
          : "今天全员留守"
        : (event.choices.find((c) => c.id === state.choices[String(state.day)])
            ?.title ?? "家人共同商议"),
    actions,
    notes: [...next.dayNotes],
    changes,
    summary: {
      foodDelta: changes
        .filter((c) => c.label === RESOURCE_NAMES.food)
        .reduce((n, c) => n + c.delta, 0),
      waterDelta: changes
        .filter((c) => c.label === RESOURCE_NAMES.water)
        .reduce((n, c) => n + c.delta, 0),
      foodLeft: next.resources.food,
      waterLeft: next.resources.water,
      alive: next.people.filter((p) => p.alive).length,
      atHome: residents(next).length,
      departed: next.expeditions
        .filter((t) => t.departedDay === next.day)
        .map((t) => PEOPLE[t.person].name),
      returned: next.expeditions
        .filter((t) => t.returnedDay === next.day)
        .map((t) => PEOPLE[t.person].name),
      died: next.people
        .filter((p) => p.deathDay === next.day)
        .map((p) => PEOPLE[p.id].name),
      hungry: residents(next)
        .filter((p) => supplyNeed(next, p, "food") === "urgent")
        .map((p) => PEOPLE[p.id].name),
      thirsty: residents(next)
        .filter((p) => supplyNeed(next, p, "water") === "urgent")
        .map((p) => PEOPLE[p.id].name),
    },
  });
  next.settled.push(state.day);
  next.phase = "night";
  const ending = evaluateEnding(next);
  if (ending) {
    next.phase = "ending";
    next.ending = ending;
  }
  return { state: next };
}
