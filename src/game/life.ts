import { PEOPLE } from "./config";
import { draw } from "./random";
import { activeExpedition, isAway } from "./presence";
import type { GameState, Person } from "./types";
import { settleIllness } from "./illness";
import { settleInjury } from "./appearance";

export function deathRisk(person: Person, reserves = false) {
  if (!person.alive) return 0;
  if (person.health <= 0) return 1;
  let risk =
    person.health <= 10
      ? 0.55
      : person.health <= 20
        ? 0.28
        : person.health <= 30
          ? 0.12
          : person.health <= 45
            ? 0.025
            : 0;
  risk += Math.min(
    0.3,
    Math.max(0, person.hungryDays - (reserves ? 5 : 1)) * 0.06,
  );
  risk += Math.min(
    0.6,
    Math.max(0, person.thirstyDays - (reserves ? 2 : 0)) * 0.08,
  );
  risk += person.fatigue >= 90 ? 0.12 : person.fatigue >= 80 ? 0.04 : 0;
  if (risk > 0)
    risk += Math.min(0.15, Math.max(0, person.criticalDays - 1) * 0.025);
  return Math.min(0.95, risk);
}
export function settleLife(state: GameState, actions: string[]) {
  const deaths: Person[] = [];
  for (const person of state.people) {
    if (!person.alive) continue;
    const wasIll = !!person.illness;
    const trip = activeExpedition(state, person.id);
    if (trip && state.shelter) {
      person.fatigue = Math.min(100, person.fatigue + 5);
      person.hungryDays =
        person.fedDay === state.day ? 0 : person.hungryDays + 1;
      person.thirstyDays =
        person.wateredDay === state.day ? 0 : person.thirstyDays + 1;
      person.health -=
        (person.hungryDays >= 5 ? 8 : 0) + (person.thirstyDays >= 3 ? 12 : 0);
    } else if (trip && trip.departedDay < state.day) {
      person.health -= 2;
      person.fatigue = Math.min(100, person.fatigue + 8);
      person.hungryDays = Math.max(0, state.day - trip.departedDay - 2);
      person.thirstyDays = Math.max(0, state.day - trip.departedDay - 4);
    }
    settleIllness(state, person);
    settleInjury(state, person);
    person.criticalDays =
      person.health <= 30 ||
      person.fatigue >= 80 ||
      person.thirstyDays > (state.shelter ? 2 : 0) ||
      person.hungryDays > (state.shelter ? 4 : 1)
        ? person.criticalDays + 1
        : 0;
    const risk = deathRisk(person, !!state.shelter);
    if (risk === 0 || (risk < 1 && draw(state) >= risk)) continue;
    const outside = isAway(state, person.id);
    person.alive = false;
    delete person.illness;
    delete person.injury;
    person.health = 0;
    person.deathDay = state.day;
    person.deathReason =
      (outside ? "外出期间，" : "") +
      (person.thirstyDays >= (state.shelter ? 3 : 1)
        ? "缺水与身体衰竭"
        : person.hungryDays >= (state.shelter ? 5 : 2)
          ? "长期饥饿与身体衰竭"
          : wasIll
            ? "发烧与伤病恶化"
            : person.fatigue >= 80
              ? "过劳与伤势恶化"
              : state.expeditions.some(
                    (t) =>
                      t.person === person.id &&
                      t.returnedDay === state.day &&
                      t.returnHealthCost > 0,
                  )
                ? "外出伤势恶化"
                : "伤病恶化");
    if (trip) {
      trip.lostDay = state.day;
      if (trip.gear && state.shelter) state.shelter.inventory[trip.gear] = 0;
      if (trip.protected && !state.shelter) state.flags.protectionLost = true;
    }
    state.plan.tasks[person.id] = { kind: "rest" };
    if (state.plan.medicineTarget === person.id)
      state.plan.medicineTarget = null;
    for (const promise of state.promises)
      if (promise.person === person.id && promise.status === "pending")
        promise.status = "cancelled";
    actions.push(
      `${PEOPLE[person.id].name}于第${state.day}天死亡 · ${person.deathReason}`,
    );
    state.dayNotes.push(
      `${PEOPLE[person.id].name}没有撑过今天，已经从住所中离去。`,
    );
    deaths.push(person);
  }
  if (deaths.length)
    for (const survivor of state.people)
      if (survivor.alive) survivor.mood -= 10 * deaths.length;
}
