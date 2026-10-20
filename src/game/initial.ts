import { IDS, PEOPLE, INITIAL_RESOURCES, LIFE_DEFAULTS } from "./config";
import type { GameState, Person, PersonId, Plan } from "./types";
export const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));
export function normalize(state: GameState): GameState {
  for (const person of state.people) {
    person.health = person.alive ? clamp(person.health) : 0;
    person.fatigue = clamp(person.fatigue);
    person.mood = clamp(person.mood);
    if (person.id === state.player && !state.flags.familyManagement)
      delete person.trust;
    else person.trust = clamp(person.trust ?? 60);
  }
  for (const key of ["food", "water", "medicine", "materials"] as const)
    state.resources[key] = Math.max(0, Math.floor(state.resources[key]));
  state.resources.safety = clamp(state.resources.safety);
  return state;
}
export function emptyPlan(): Plan {
  return {
    tasks: {
      mom: { kind: "rest" },
      dad: { kind: "rest" },
      daughter: { kind: "rest" },
      brother: { kind: "rest" },
    },
    ration: "normal",
    medicineTarget: null,
  };
}
export function createGame(player: PersonId, seed = 0x5eed): GameState {
  const people: Person[] = IDS.map((id) => ({
    ...LIFE_DEFAULTS,
    id,
    health: PEOPLE[id].health,
    fatigue: PEOPLE[id].fatigue,
    mood: PEOPLE[id].mood,
    ...(id !== player ? { trust: PEOPLE[id].trust } : {}),
  }));
  const state: GameState = {
    version: 2,
    player,
    day: 1,
    phase: "morning",
    people,
    resources: { ...INITIAL_RESOURCES },
    plan: emptyPlan(),
    memories: [],
    promises: [],
    diary: [],
    choices: {},
    flags: { scarceStartApplied: true },
    autonomy: null,
    settled: [],
    ending: null,
    dayNotes: [],
    eventChanges: [],
    tutorialDone: false,
    rngState: seed >>> 0 || 0x5eed,
    expeditions: [],
  };
  const first = (["dad", "daughter", "mom", "brother"] as PersonId[]).find(
    (id) => id !== player,
  );
  if (first) {
    state.plan.tasks[first] = { kind: "search", location: "food" };
    state.flags[`firstConcern:${first}`] = true;
  }
  return state;
}
export const getPerson = (state: GameState, id: PersonId) =>
  state.people.find((p) => p.id === id)!;
