import { RESOURCE_NAMES } from "./config";
import { residents } from "./presence";
import { draw } from "./random";
import type { GameState, Resource } from "./types";
import { stories } from "./encounter-stories";
import {
  change,
  ensureEncounterSecret,
  FOLLOW_UP_IDS,
  makeVisitorSecret,
} from "./encounter-effects";

export const ENCOUNTER_IDS = stories.map((s) => s.id);
export function encounterFor(s: GameState) {
  const event = stories.find((e) => e.id === s.encounters?.current?.id);
  return event ? { ...event, reply: event.reply(s) } : undefined;
}

// Called only when a new morning is prepared. Reloading never schedules or rerolls.
export function prepareEncounter(state: GameState): GameState {
  const s = structuredClone(state);
  s.encounters ??= {
    preparedDay: 0,
    current: null,
    recent: [],
    lastDay: 0,
    followUp: null,
  };
  const events = s.encounters;
  if (events.preparedDay === s.day || events.current?.day === s.day) return s;
  events.preparedDay = s.day;
  events.current = null;
  if (s.phase !== "morning" || !residents(s).length || s.day === 1) return s;
  let id: string | undefined;
  if (
    events.followUp &&
    events.followUp.day <= s.day &&
    s.day - events.lastDay >= 2
  ) {
    id = events.followUp.id;
    events.followUp = events.queuedFollowUps?.shift() ?? null;
  } else if (s.day === 2) id = "neighbor-food";
  else if (s.day - events.lastDay >= 2 && draw(s) < 0.45) {
    const pool = stories.filter(
      (e) =>
        !FOLLOW_UP_IDS.includes(e.id) &&
        !events.recent.includes(e.id) &&
        !(e.id === "neighbor-food" && events.followUp),
    );
    id = pool[Math.floor(draw(s) * pool.length)].id;
  }
  if (id) {
    events.current = {
      id,
      day: s.day,
      asked: false,
      choice: null,
      outcome: null,
      acknowledged: false,
      secret: makeVisitorSecret(s, id),
    };
    events.lastDay = s.day;
    events.recent = [...events.recent, id].slice(-2);
  }
  return s;
}
export function encounterChoiceError(s: GameState, id: string): string | null {
  if (s.phase !== "morning" || !s.encounters?.current)
    return "现在没有需要回应的门外故事";
  if (s.encounters.current.choice !== null) return "已经作出选择";
  const event = encounterFor(s);
  if (!event) return "没有这个故事";
  if (id === "ask" && event.reply)
    return s.encounters.current.asked ? "已经问过了，请决定是否帮助" : null;
  if (id === "ignore") return null;
  const c = event.choices.find((c) => c.id === id);
  if (!c) return "没有这个选择";
  for (const [resource, cost] of Object.entries(c.cost ?? {}))
    if (s.resources[resource as Resource] < cost!)
      return `${RESOURCE_NAMES[resource as Resource]}不足`;
  return null;
}
export function chooseEncounter(
  state: GameState,
  id: string,
): { state: GameState; error?: string } {
  if (state.encounters?.current?.choice != null) return { state };
  const error = encounterChoiceError(state, id);
  if (error) return { state, error };
  const s = structuredClone(ensureEncounterSecret(state)),
    current = s.encounters!.current!,
    event = encounterFor(s)!;
  if (id === "ask") {
    current.asked = true;
    return { state: s };
  }
  const c = event.choices.find((c) => c.id === id);
  for (const [resource, cost] of Object.entries(c?.cost ?? {}))
    change(s, resource as Resource, -cost!);
  current.choice = id;
  current.outcome = c ? c.apply(s) : event.leave;
  s.dayNotes.push(
    `门外的故事 · ${event.title}：${c?.title ?? "没有回应"}。${current.outcome}`,
  );
  return { state: s };
}
export function closeEncounter(state: GameState): GameState {
  if (
    state.phase !== "morning" ||
    !state.encounters?.current ||
    state.encounters.current.acknowledged
  )
    return state;
  const s =
    state.encounters.current.choice === null
      ? chooseEncounter(state, "ignore").state
      : structuredClone(state);
  s.encounters!.current!.acknowledged = true;
  return s;
}

export function validEncounters(value: unknown, day: number): boolean {
  if (value === undefined) return true; // Old saves acquire the optional field next morning.
  const obj = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);
  const date = (v: unknown, max = day) =>
    typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= max;
  if (
    !obj(value) ||
    !(
      value.preparedDay === undefined ||
      value.preparedDay === 0 ||
      date(value.preparedDay)
    ) ||
    !Array.isArray(value.recent) ||
    value.recent.length > 2 ||
    !value.recent.every(
      (v) => typeof v === "string" && ENCOUNTER_IDS.includes(v),
    ) ||
    !(value.lastDay === 0 || date(value.lastDay))
  )
    return false;
  if (
    value.followUp !== null &&
    !(
      obj(value.followUp) &&
      FOLLOW_UP_IDS.includes(String(value.followUp.id)) &&
      date(value.followUp.day, 105)
    )
  )
    return false;
  if (
    value.queuedFollowUps !== undefined &&
    (!Array.isArray(value.queuedFollowUps) ||
      value.queuedFollowUps.length > 4 ||
      !value.queuedFollowUps.every(
        (v) =>
          obj(v) && FOLLOW_UP_IDS.includes(String(v.id)) && date(v.day, 105),
      ))
  )
    return false;
  const c = value.current;
  if (c === null) return true;
  if (
    !obj(c) ||
    c.day !== day ||
    c.day !== value.lastDay ||
    typeof c.asked !== "boolean" ||
    typeof c.acknowledged !== "boolean"
  )
    return false;
  if (
    c.secret !== undefined &&
    !(
      obj(c.secret) &&
      ["honest", "fraud", "raiders"].includes(String(c.secret.identity)) &&
      typeof c.secret.roll === "number" &&
      Number.isFinite(c.secret.roll) &&
      c.secret.roll >= 0 &&
      c.secret.roll < 1
    )
  )
    return false;
  const event = stories.find((e) => e.id === c.id);
  if (!event || (c.asked && !event.reply)) return false;
  if (c.choice === null) return c.outcome === null && !c.acknowledged;
  return (
    (c.choice === "ignore" || event.choices.some((v) => v.id === c.choice)) &&
    typeof c.outcome === "string" &&
    c.outcome.length > 0
  );
}
