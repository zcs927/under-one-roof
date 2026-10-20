import { IDS, DAY_LIMIT, LIFE_DEFAULTS, INITIAL_RESOURCES } from "./config";
import type { GameState } from "./types";
import { GEAR_IDS } from "./shelter";
import { INCIDENT_IDS } from "./shelter-events";
import { validEncounters } from "./encounters";
import { validReturnStory } from "./return-stories";
export const SAVE_KEY = "family-survival:save:v1";
export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export type LoadResult =
  | { status: "valid"; state: GameState }
  | { status: "empty" | "unavailable" | "invalid"; message: string };
const obj = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const number = (x: unknown, min = 0, max = 100): x is number =>
  typeof x === "number" && Number.isFinite(x) && x >= min && x <= max;
const id = (x: unknown) => IDS.includes(x as (typeof IDS)[number]);
const strings = (x: unknown) =>
  Array.isArray(x) && x.every((i) => typeof i === "string");
const change = (x: unknown) =>
  obj(x) &&
  typeof x.label === "string" &&
  number(x.before, -Infinity, Infinity) &&
  number(x.delta, -Infinity, Infinity) &&
  number(x.after, -Infinity, Infinity) &&
  typeof x.reason === "string";
export function isGameState(x: unknown): x is GameState {
  if (obj(x) && !validEncounters(x.encounters, Number(x.day))) return false;
  if (obj(x) && x.shelter !== undefined) {
    const sh = x.shelter;
    if (
      !obj(sh) ||
      !obj(sh.inventory) ||
      !GEAR_IDS.every(
        (g) =>
          sh.inventory &&
          obj(sh.inventory) &&
          [0, 1].includes(sh.inventory[g] as number),
      ) ||
      !["high", "medium", "low"].includes(String(sh.outside)) ||
      !number(sh.rescue, 0, 3) ||
      !Number.isInteger(sh.rescue) ||
      !strings(sh.recent) ||
      sh.recent.length > 3 ||
      !sh.recent.every((v) => INCIDENT_IDS.includes(v)) ||
      !obj(sh.incident) ||
      !INCIDENT_IDS.includes(String(sh.incident.id)) ||
      sh.incident.day !== x.day ||
      !(
        sh.incident.choice === null || typeof sh.incident.choice === "string"
      ) ||
      !(
        sh.incident.outcome === null || typeof sh.incident.outcome === "string"
      ) ||
      (sh.incident.choice === null) !== (sh.incident.outcome === null)
    )
      return false;
  }
  if (
    !obj(x) ||
    x.version !== 2 ||
    !id(x.player) ||
    !number(x.day, 1, DAY_LIMIT) ||
    !Number.isInteger(x.day) ||
    !["morning", "event", "planning", "confirm", "night", "ending"].includes(
      String(x.phase),
    )
  )
    return false;
  if (
    !number(x.rngState, 1, 4294967295) ||
    !Number.isInteger(x.rngState) ||
    !Array.isArray(x.expeditions)
  )
    return false;
  const trips = x.expeditions;
  if (
    !trips.every(
      (t) =>
        obj(t) &&
        validReturnStory(t.story, t.returnedDay !== null) &&
        typeof t.id === "string" &&
        id(t.person) &&
        ["food", "water", "materials"].includes(String(t.location)) &&
        number(t.departedDay, 1, Number(x.day)) &&
        Number.isInteger(t.departedDay) &&
        (t.returnDay === null ||
          (number(
            t.returnDay,
            Number(t.departedDay),
            Number(t.departedDay) + 4,
          ) &&
            Number.isInteger(t.returnDay))) &&
        (t.returnedDay === null ||
          (number(t.returnedDay, Number(t.departedDay), Number(x.day)) &&
            Number.isInteger(t.returnedDay) &&
            t.returnDay !== null &&
            t.returnedDay === t.returnDay)) &&
        (t.lostDay === null ||
          (number(t.lostDay, Number(t.departedDay), Number(x.day)) &&
            Number.isInteger(t.lostDay) &&
            t.returnedDay === null)) &&
        typeof t.protected === "boolean" &&
        number(t.returnHealthCost, 0, x.shelter ? 20 : 5) &&
        Number.isInteger(t.returnHealthCost) &&
        (t.gear === undefined ||
          GEAR_IDS.includes(t.gear as (typeof GEAR_IDS)[number])) &&
        (t.gearFound === undefined ||
          GEAR_IDS.includes(t.gearFound as (typeof GEAR_IDS)[number])) &&
        (t.gearBroken === undefined || typeof t.gearBroken === "boolean") &&
        obj(t.loot) &&
        ["food", "water", "medicine", "materials"].every(
          (key) =>
            obj(t.loot) &&
            number(t.loot[key], 0, 20) &&
            Number.isInteger(t.loot[key]),
        ),
    )
  )
    return false;
  if (
    new Set(trips.map((t) => (t as Record<string, unknown>).id)).size !==
    trips.length
  )
    return false;
  const active = trips.filter(
    (t) =>
      (t as Record<string, unknown>).returnedDay === null &&
      (t as Record<string, unknown>).lostDay === null,
  );
  const carried = active
    .map((t) => (t as Record<string, unknown>).gear)
    .filter(Boolean);
  if (new Set(carried).size !== carried.length) return false;
  if (
    new Set(active.map((t) => (t as Record<string, unknown>).person)).size !==
    active.length
  )
    return false;
  if (
    !Array.isArray(x.people) ||
    x.people.length !== 4 ||
    new Set(x.people.map((p) => (obj(p) ? p.id : null))).size !== 4
  )
    return false;
  if (
    !x.people.every(
      (p) =>
        obj(p) &&
        id(p.id) &&
        number(p.health) &&
        typeof p.alive === "boolean" &&
        (p.injury === undefined ||
          (p.alive &&
            obj(p.injury) &&
            number(p.injury.sinceDay, 1, Number(x.day)) &&
            Number.isInteger(p.injury.sinceDay) &&
            number(p.injury.daysLeft, 1, 3) &&
            Number.isInteger(p.injury.daysLeft))) &&
        (p.illness === undefined ||
          (p.alive &&
            obj(p.illness) &&
            number(p.illness.sinceDay, 1, Number(x.day)) &&
            Number.isInteger(p.illness.sinceDay) &&
            number(p.illness.daysLeft, 1, 4) &&
            Number.isInteger(p.illness.daysLeft))) &&
        (p.alive
          ? p.health > 0 && p.deathDay === null && p.deathReason === null
          : p.health === 0 &&
            number(p.deathDay, 1, Number(x.day)) &&
            Number.isInteger(p.deathDay) &&
            typeof p.deathReason === "string" &&
            p.deathReason.length > 0) &&
        [p.hungryDays, p.thirstyDays, p.criticalDays].every(
          (v) => number(v) && Number.isInteger(v),
        ) &&
        [p.fedDay, p.wateredDay, p.refusedFoodDay, p.refusedWaterDay].every(
          (v) =>
            v === null || (number(v, 1, Number(x.day)) && Number.isInteger(v)),
        ) &&
        number(p.fatigue) &&
        number(p.mood) &&
        (p.id === x.player && !(obj(x.flags) && x.flags.familyManagement)
          ? p.trust === undefined
          : number(p.trust)),
    )
  )
    return false;
  if (
    !obj(x.resources) ||
    !["food", "water", "medicine", "materials", "safety"].every(
      (k) =>
        number(
          (x.resources as Record<string, unknown>)[k],
          0,
          k === "safety" ? 100 : Infinity,
        ) && Number.isInteger((x.resources as Record<string, unknown>)[k]),
    )
  )
    return false;
  if (
    !obj(x.plan) ||
    !["normal", "save", "manual"].includes(String(x.plan.ration)) ||
    !(x.plan.medicineTarget === null || id(x.plan.medicineTarget)) ||
    !obj(x.plan.tasks)
  )
    return false;
  const tasks = x.plan.tasks;
  if (
    !IDS.every((person) => {
      const t = tasks[person];
      return (
        obj(t) &&
        ["rest", "search", "repair", "care"].includes(String(t.kind)) &&
        (t.target === undefined || id(t.target)) &&
        (t.location === undefined ||
          ["food", "water", "materials"].includes(String(t.location))) &&
        ["explained", "extraFood", "protected", "locked"].every(
          (k) => t[k] === undefined || typeof t[k] === "boolean",
        )
      );
    })
  )
    return false;
  if (
    !obj(x.choices) ||
    !Object.values(x.choices).every((v) => typeof v === "string") ||
    !obj(x.flags) ||
    !Object.values(x.flags).every((v) => typeof v === "boolean")
  )
    return false;
  if (
    !Array.isArray(x.settled) ||
    !x.settled.every(
      (d) =>
        number(d, 1, DAY_LIMIT) && Number.isInteger(d) && d <= Number(x.day),
    ) ||
    new Set(x.settled).size !== x.settled.length
  )
    return false;
  if (
    !strings(x.dayNotes) ||
    typeof x.tutorialDone !== "boolean" ||
    !Array.isArray(x.eventChanges) ||
    !x.eventChanges.every(change)
  )
    return false;
  if (
    !Array.isArray(x.memories) ||
    !x.memories.every(
      (m) =>
        obj(m) &&
        typeof m.id === "string" &&
        number(m.day, 1, DAY_LIMIT) &&
        id(m.person) &&
        ["kept", "broken", "cared", "respected", "stopped"].includes(
          String(m.kind),
        ) &&
        typeof m.text === "string" &&
        typeof m.source === "string" &&
        number(m.trustDelta, -100, 100) &&
        number(m.moodDelta, -100, 100),
    )
  )
    return false;
  if (
    !Array.isArray(x.promises) ||
    !x.promises.every(
      (p) =>
        obj(p) &&
        typeof p.id === "string" &&
        id(p.person) &&
        p.person !== x.player &&
        ["medicine", "rest"].includes(String(p.kind)) &&
        ["pending", "kept", "broken", "cancelled"].includes(String(p.status)) &&
        number(p.day, 1, DAY_LIMIT) &&
        number(p.dueDay, 1, DAY_LIMIT),
    )
  )
    return false;
  if (
    !Array.isArray(x.diary) ||
    !x.diary.every(
      (d) =>
        obj(d) &&
        number(d.day, 1, DAY_LIMIT) &&
        typeof d.event === "string" &&
        typeof d.choice === "string" &&
        strings(d.actions) &&
        strings(d.notes) &&
        Array.isArray(d.changes) &&
        d.changes.every(change) &&
        (d.summary === undefined ||
          (obj(d.summary) &&
            number(d.summary.foodDelta, -Infinity, Infinity) &&
            number(d.summary.waterDelta, -Infinity, Infinity) &&
            number(d.summary.foodLeft, 0, Infinity) &&
            number(d.summary.waterLeft, 0, Infinity) &&
            number(d.summary.alive, 0, 4) &&
            number(d.summary.atHome, 0, 4) &&
            [
              d.summary.departed,
              d.summary.returned,
              d.summary.died,
              d.summary.hungry,
              d.summary.thirsty,
            ].every(strings))),
    )
  )
    return false;
  if (!(
    x.autonomy === null ||
    (obj(x.autonomy) &&
      id(x.autonomy.person) &&
      x.autonomy.person !== x.player &&
      number(x.autonomy.signaledDay, 2, 3) &&
      typeof x.autonomy.resolved === "boolean" &&
      (x.autonomy.outcome === undefined ||
        ["formal", "stay", "stop", "ignore", "unwell"].includes(
          String(x.autonomy.outcome),
        )))
  ))
    return false;
  if (!(
    x.ending === null ||
    (obj(x.ending) &&
      ["help", "together", "distance", "extinct", "abandoned"].includes(
        String(x.ending.kind),
      ) &&
      typeof x.ending.title === "string" &&
      typeof x.ending.text === "string" &&
      strings(x.ending.highlights))
  ))
    return false;
  if (
    ["night", "ending"].includes(String(x.phase)) &&
    !(x.settled as number[]).includes(Number(x.day))
  )
    return false;
  if (x.phase === "ending" && x.ending === null) return false;
  const people = x.people as GameState["people"],
    expeditions = trips as GameState["expeditions"];
  for (const trip of expeditions) {
    const person = people.find((p) => p.id === trip.person)!;
    if (trip.returnedDay === null && trip.lostDay === null && !person.alive)
      return false;
    if (
      trip.lostDay !== null &&
      (person.alive || person.deathDay !== trip.lostDay)
    )
      return false;
  }
  const home = people.filter(
    (p) =>
      p.alive &&
      !expeditions.some(
        (t) =>
          t.person === p.id && t.returnedDay === null && t.lostDay === null,
      ),
  );
  if (x.phase === "ending" && Number(x.day) < DAY_LIMIT && home.length > 0)
    return false;
  return true;
}
export function loadGame(storage: StoragePort): LoadResult {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return { status: "empty", message: "还没有保存的故事" };
    const migrated = migrateSave(JSON.parse(raw));
    let state: unknown = migrated;
    if (
      obj(migrated) &&
      migrated.day === 1 &&
      migrated.phase === "morning" &&
      obj(migrated.flags) &&
      migrated.flags.scarceStartApplied !== true &&
      obj(migrated.resources) &&
      number(migrated.resources.food, 0, Infinity) &&
      number(migrated.resources.water, 0, Infinity) &&
      Array.isArray(migrated.settled) &&
      migrated.settled.length === 0
    ) {
      state = {
        ...migrated,
        flags: { ...migrated.flags, scarceStartApplied: true },
        resources: {
          ...migrated.resources,
          food: Math.min(migrated.resources.food, INITIAL_RESOURCES.food),
          water: Math.min(migrated.resources.water, INITIAL_RESOURCES.water),
        },
      };
    }
    return isGameState(state)
      ? { status: "valid", state }
      : { status: "invalid", message: "存档版本或数据不兼容，可以重新开始。" };
  } catch (error) {
    return error instanceof SyntaxError
      ? { status: "invalid", message: "存档内容损坏，可以重新开始。" }
      : {
          status: "unavailable",
          message: "无法访问本地存储，本次只能保留会话内进度。",
        };
  }
}
export function migrateSave(value: unknown): unknown {
  const old = migrateLegacyFamily(value);
  if (obj(old) && old.version === 2 && Array.isArray(old.people))
    return {
      ...old,
      people: old.people.map((p) =>
        obj(p)
          ? {
              fedDay: null,
              wateredDay: null,
              refusedFoodDay: null,
              refusedWaterDay: null,
              ...p,
            }
          : p,
      ),
    };
  if (!obj(old) || old.version !== 1) return old;
  const next = {
    ...old,
    version: 2,
    rngState: old.rngState === undefined ? 0x5eed : old.rngState,
    people: Array.isArray(old.people)
      ? old.people.map((p) => (obj(p) ? { ...p, ...LIFE_DEFAULTS } : p))
      : old.people,
    expeditions: Array.isArray(old.expeditions)
      ? old.expeditions.map((t) => (obj(t) ? { ...t, lostDay: null } : t))
      : old.expeditions === undefined
        ? []
        : old.expeditions,
  };
  if (old.phase === "ending" && old.day === 7 && obj(old.ending)) {
    Object.assign(next, {
      day: 8,
      phase: "morning",
      ending: null,
      dayNotes: ["旧版七日故事已继续到百日生存，第8天开始。"],
      eventChanges: [],
      plan: {
        tasks: Object.fromEntries(IDS.map((id) => [id, { kind: "rest" }])),
        ration: "normal",
        medicineTarget: null,
      },
    });
  }
  return next;
}
// 旧版第四位家人改为弟弟，保留其进度、数值、任务和承诺。
export function migrateLegacyFamily(value: unknown): unknown {
  if (
    !obj(value) ||
    value.version !== 1 ||
    !Array.isArray(value.people) ||
    !value.people.some((p) => obj(p) && p.id === "grandpa")
  )
    return value;
  const visit = (x: unknown): unknown => {
    if (typeof x === "string")
      return x
        .replaceAll("grandpa", "brother")
        .replaceAll("林远山", "周小豆")
        .replaceAll("爷爷", "弟弟");
    if (Array.isArray(x)) return x.map(visit);
    if (obj(x))
      return Object.fromEntries(
        Object.entries(x).map(([k, v]) => [
          k.replaceAll("grandpa", "brother"),
          visit(v),
        ]),
      );
    return x;
  };
  return visit(value);
}
export function saveGame(
  storage: StoragePort,
  state: GameState,
): { ok: boolean; message: string } {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(state));
    return { ok: true, message: "进度已保存" };
  } catch {
    return { ok: false, message: "无法自动保存，本次进度仅保留在当前会话。" };
  }
}
export function clearGame(storage: StoragePort): boolean {
  try {
    storage.removeItem(SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}
