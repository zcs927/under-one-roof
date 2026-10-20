import { PEOPLE } from "./config";
import type { GameState, Person } from "./types";
export function settleIllness(state: GameState, person: Person) {
  if (!person.alive || !person.illness || person.illness.sinceDay >= state.day)
    return;
  person.health = Math.max(0, person.health - 6);
  person.fatigue = Math.min(100, person.fatigue + 8);
  person.illness.daysLeft--;
  state.dayNotes.push(
    `${PEOPLE[person.id].name}仍在发烧，健康 −6、疲劳 +8。食水不能代替治疗。`,
  );
  if (person.illness.daysLeft <= 0) {
    delete person.illness;
    state.dayNotes.push(
      `${PEOPLE[person.id].name}熬过了这次发烧，接下来仍要慢慢恢复身体。`,
    );
  }
}
