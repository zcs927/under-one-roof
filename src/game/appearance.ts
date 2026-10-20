import { PEOPLE } from "./config";
import { isAway } from "./presence";
import type { GameState, Person } from "./types";

export type AppearanceKind = "normal" | "sick" | "injured" | "hungry";
export function appearanceFor(state: GameState, person: Person) {
  const hidden = !person.alive || isAway(state, person.id);
  const sick = !!person.illness;
  const injured = !!person.injury;
  const hungry = person.hungryDays >= 4 && person.fedDay !== state.day;
  const thirsty = person.thirstyDays >= 2 && person.wateredDay !== state.day;
  const weary = person.fatigue >= 70;
  const weak = person.health <= 35;
  const labels = [
    sick && "发烧",
    injured && "受伤",
    hungry && "饥饿",
    thirsty && "缺水",
    weary && "疲惫",
    weak && "虚弱",
  ].filter((v): v is string => !!v);
  const kind: AppearanceKind = sick
    ? "sick"
    : injured
      ? "injured"
      : hungry || thirsty || weary || weak
        ? "hungry"
        : "normal";
  return {
    kind,
    labels: hidden ? [] : labels,
    hidden,
    critical: !hidden && person.health <= 20,
  };
}
// Visual wounds reuse the actual damage. They never add a second health penalty.
export function markInjury(state: GameState, person: Person) {
  if (!person.alive) return;
  person.injury = { sinceDay: state.day, daysLeft: 3 };
}
export function settleInjury(state: GameState, person: Person) {
  if (
    !person.alive ||
    !person.injury ||
    person.injury.sinceDay >= state.day ||
    isAway(state, person.id) ||
    state.plan.tasks[person.id].kind !== "rest"
  )
    return;
  person.injury.daysLeft--;
  if (person.injury.daysLeft <= 0) {
    delete person.injury;
    state.dayNotes.push(
      `${PEOPLE[person.id].name}的外伤已经愈合，可以拆下绷带了。`,
    );
  }
}
export function ensureVisualInjuries(state: GameState): GameState {
  if (state.flags.appearanceInjuriesV1) return state;
  const s = structuredClone(state);
  s.flags.appearanceInjuriesV1 = true;
  for (const p of s.people) {
    if (!p.alive || p.injury) continue;
    const trip = s.expeditions
      .filter(
        (t) =>
          t.person === p.id &&
          t.returnedDay !== null &&
          t.story?.kind === "injured",
      )
      .sort((a, b) => b.returnedDay! - a.returnedDay!)[0];
    const treated = trip?.returnedDay
      ? Object.keys(s.flags).some((k) => {
          const parts = k.split(":");
          return (
            parts[0] === "treated" &&
            parts[2] === p.id &&
            Number(parts[1]) > trip.returnedDay! &&
            s.flags[k]
          );
        })
      : false;
    if (!treated && trip?.returnedDay && s.day - trip.returnedDay < 3)
      p.injury = {
        sinceDay: trip.returnedDay,
        daysLeft: 3 - (s.day - trip.returnedDay),
      };
    const latest = s.eventChanges
      .filter((c) => c.label === `${PEOPLE[p.id].name} · 健康`)
      .at(-1);
    if (latest && latest.delta < 0 && latest.reason.includes("抢劫受伤"))
      markInjury(s, p);
  }
  return s;
}
