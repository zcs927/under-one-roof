import { LOCATION_NAMES, PEOPLE, RESOURCE_NAMES } from "./config";
import { getPerson } from "./initial";
import type { Expedition, GameState, GearId, PersonId, Task } from "./types";
import { GEAR, GEAR_IDS, gearAvailable } from "./shelter";
import { draw } from "./random";
import { isAlive, departureError } from "./presence";
import { markInjury } from "./appearance";
import {
  legacyReturnStory,
  makeReturnStory,
  returnAccount,
} from "./return-stories";
export { activeExpedition, isAway } from "./presence";
export function launchExpedition(
  state: GameState,
  id: PersonId,
  task: Task,
  gear?: GearId,
) {
  if (departureError(state, id)) return;
  if (state.shelter) {
    launchSurvivalTrip(state, id, task, gear);
    return;
  }
  const roll = draw(state);
  const duration =
    roll < 0.45
      ? 1
      : roll < 0.75
        ? 2
        : roll < 0.9
          ? 3
          : roll < 0.98
            ? 4 + Math.floor(draw(state) * 2)
            : null;
  const found = draw(state) >= 0.25;
  const location = task.location ?? "food";
  const amount =
    1 +
    Math.floor(
      draw(state) *
        (location === "materials" ? 3 : location === "water" ? 4 : 5),
    );
  const loot = { food: 0, water: 0, medicine: 0, materials: 0 };
  if (found)
    loot[location] =
      amount +
      (id === "daughter" ? (location === "materials" ? 1 : 2) : 0) +
      (task.extraFood ? 1 : 0);
  if (found && draw(state) < 0.2) loot.medicine = 1;
  const returnHealthCost = task.protected ? 0 : Math.floor(draw(state) * 6);
  state.expeditions.push({
    id: `expedition:${state.day}:${id}`,
    person: id,
    location,
    departedDay: state.day,
    returnDay: duration === null ? null : state.day + duration - 1,
    returnedDay: null,
    lostDay: null,
    protected: !!task.protected,
    loot,
    returnHealthCost,
  });
  state.dayNotes.push(
    `${PEOPLE[id].name}前往${LOCATION_NAMES[location]}，离开了住所。归期未知；收获尚未入库，也可能在第100天结束时仍未归来。`,
  );
}
export function resolveExpeditions(state: GameState, actions: string[]) {
  for (const trip of state.expeditions) {
    if (
      trip.returnedDay !== null ||
      trip.lostDay !== null ||
      !isAlive(state, trip.person)
    )
      continue;
    if (trip.returnDay !== null && trip.returnDay <= state.day) {
      trip.returnedDay = state.day;
      for (const key of ["food", "water", "medicine", "materials"] as const)
        state.resources[key] += trip.loot[key];
      const person = getPerson(state, trip.person);
      const before = {
        health: person.health,
        fatigue: person.fatigue,
        mood: person.mood,
      };
      person.health = Math.max(0, person.health - trip.returnHealthCost);
      if (state.shelter) {
        trip.story ??= legacyReturnStory(trip);
        if (trip.story.kind === "injured" && trip.returnHealthCost > 0)
          markInjury(state, person);
        person.mood = Math.max(
          0,
          Math.min(100, person.mood + trip.story.moodDelta),
        );
        person.fatigue = Math.min(
          100,
          person.fatigue + trip.story.fatigueDelta,
        );
        if (trip.story.illnessDays)
          person.illness = {
            sinceDay: person.illness?.sinceDay ?? state.day,
            daysLeft: Math.max(
              person.illness?.daysLeft ?? 0,
              trip.story.illnessDays,
            ),
          };
        trip.story.applied = {
          health: person.health - before.health,
          mood: person.mood - before.mood,
          fatigue: person.fatigue - before.fatigue,
        };
        state.dayNotes.push(returnAccount(trip));
      }
      if (state.shelter) {
        if (trip.gear && trip.gearBroken) {
          state.shelter.inventory[trip.gear] = 0;
          state.dayNotes.push(
            `${GEAR[trip.gear].name}在路上损坏，已经无法使用。`,
          );
        }
        if (trip.gearFound) {
          state.shelter.inventory[trip.gearFound] = 1;
          state.dayNotes.push(
            `${PEOPLE[trip.person].name}带回了${GEAR[trip.gearFound].name}。`,
          );
        }
      }
      const items = Object.entries(trip.loot)
        .filter(([, n]) => n > 0)
        .map(
          ([key, n]) =>
            `${RESOURCE_NAMES[key as keyof typeof RESOURCE_NAMES]} +${n}`,
        )
        .join("、");
      actions.push(
        `${PEOPLE[trip.person].name}回来了 · 外出${state.day - trip.departedDay + 1}天 · ${items || "空手而归，物资点已被搬空"}`,
      );
      state.dayNotes.push(
        `${PEOPLE[trip.person].name}的脚步声终于出现在门外。${items ? "带回的物资已经清点入库。" : "没有找到物资，至少人回来了。"}`,
      );
    } else {
      actions.push(
        `${PEOPLE[trip.person].name}仍在外出 · 已${state.day - trip.departedDay + 1}天 · 暂无消息，归期未知`,
      );
    }
  }
}
function launchSurvivalTrip(
  state: GameState,
  id: PersonId,
  task: Task,
  gear?: GearId,
) {
  if (gear && !gearAvailable(state, gear)) return;
  const sh = state.shelter!,
    person = getPerson(state, id);
  const danger =
    (sh.outside === "high" ? 0.14 : sh.outside === "medium" ? 0.09 : 0.04) +
    (person.health < 50 ? 0.08 : 0) +
    (person.fatigue >= 60 ? 0.08 : 0);
  const missing =
    draw(state) <
    Math.max(
      0.015,
      danger -
        (gear === "axe" ? 0.07 : 0) -
        (gear === "mask" && sh.outside === "high" ? 0.08 : 0),
    );
  const duration = Math.max(
    1,
    2 + Math.floor(draw(state) * 4) - (gear === "map" ? 1 : 0),
  );
  const location = task.location ?? "food";
  const loot = { food: 0, water: 0, medicine: 0, materials: 0 };
  if (draw(state) >= (gear === "handbook" ? 0.1 : 0.25)) {
    loot[location] =
      1 + Math.floor(draw(state) * 4) + (id === "daughter" ? 1 : 0);
    if (draw(state) < 0.45) loot[location === "water" ? "food" : "water"] = 1;
    if (gear === "radio") loot.water++;
    if (gear === "cards") loot.food++;
  }
  if (draw(state) < 0.16) loot.medicine = 1;
  const absent = GEAR_IDS.filter((g) => !sh.inventory[g]);
  const gearFound =
    absent.length && draw(state) < 0.16
      ? absent[Math.floor(draw(state) * absent.length)]
      : undefined;
  const healthCost =
    Math.floor(draw(state) * 5) +
    (sh.outside === "high" && gear !== "mask" ? 8 : 0) +
    (sh.outside === "medium" && gear !== "axe" ? 4 : 0);
  const trip: Expedition = {
    id: `expedition:${state.day}:${id}`,
    person: id,
    location,
    departedDay: state.day,
    returnDay: missing ? null : state.day + duration - 1,
    returnedDay: null,
    lostDay: null,
    protected: gear === "mask",
    loot,
    returnHealthCost: healthCost,
    ...(gear ? { gear } : {}),
    ...(gearFound ? { gearFound } : {}),
  };
  trip.story = makeReturnStory(state, trip);
  if (gear) trip.gearBroken = draw(state) < (gear === "cards" ? 0.3 : 0.18);
  state.expeditions.push(trip);
  state.dayNotes.push(
    `${PEOPLE[id].name}${gear ? `带着${GEAR[gear].name}` : "空手"}前往${LOCATION_NAMES[location]}。${sh.outside === "high" ? "外面辐尘很重，" : "街口的风还没停，"}归期与收获都未知。`,
  );
}
