import { emptyPlan } from "./initial";
import { chooseEvent } from "./events";
import { signalAutonomy } from "./autonomy";
import { negotiate, type Offer } from "./negotiation";
import { planErrors, settleDay } from "./settlement";
import { evaluateEnding } from "./ending";
import type { GameState, GearId, Location, PersonId, Task } from "./types";
import { isAway } from "./expeditions";
import { DAY_LIMIT } from "./config";
import { departureError, isAlive } from "./presence";
import { feedPerson, type FeedingResource } from "./feeding";
import { familyPlan, requestOuting } from "./family-mode";
import { chooseIncident, prepareShelterDay } from "./shelter-events";
import { treatPerson } from "./supplies";
import { chooseEncounter, closeEncounter } from "./encounters";
import { acknowledgeReturn } from "./return-stories";
export type Action =
  | {
      type: "outing";
      id: PersonId;
      location: Location;
      force?: boolean;
      gear?: GearId;
    }
  | { type: "incident"; id: string }
  | { type: "encounter"; id: string }
  | { type: "encounter-close" }
  | { type: "ack-return"; id: string }
  | { type: "treat"; id: PersonId }
  | { type: "end-day" }
  | { type: "feed"; id: PersonId; resource: FeedingResource; give: boolean }
  | { type: "event" }
  | { type: "choice"; id: string }
  | { type: "task"; id: PersonId; task: Task }
  | { type: "ration"; ration: "normal" | "save" | "manual" }
  | { type: "medicine"; id: PersonId | null }
  | { type: "offer"; id: PersonId; offer: Offer }
  | { type: "confirm" }
  | { type: "back" }
  | { type: "execute" }
  | { type: "next" }
  | { type: "tutorial" };
export function transition(
  state: GameState,
  action: Action,
): { state: GameState; error?: string } {
  if (action.type === "feed")
    return feedPerson(state, action.id, action.resource, action.give);
  if (action.type === "tutorial")
    return { state: { ...state, tutorialDone: true } };
  if (state.flags.familyManagement) {
    if (action.type === "ack-return")
      return { state: acknowledgeReturn(state, action.id) };
    if (action.type === "encounter") return chooseEncounter(state, action.id);
    if (action.type === "encounter-close")
      return { state: closeEncounter(state) };
    if (action.type === "incident") return chooseIncident(state, action.id);
    if (action.type === "treat") return treatPerson(state, action.id);
    if (action.type === "outing")
      return requestOuting(
        state,
        action.id,
        action.location,
        action.force,
        action.gear,
      );
    if (action.type === "end-day" && state.phase === "morning") {
      const responded = closeEncounter(state);
      const next =
        state.shelter?.incident.choice === null
          ? chooseIncident(responded, "leave").state
          : structuredClone(responded);
      next.phase = "confirm";
      next.plan = familyPlan();
      next.choices[String(next.day)] = "family-day";
      return settleDay(next);
    }
    if (action.type === "next" && state.phase === "night") {
      if (state.day === DAY_LIMIT) return { state };
      const next = structuredClone(state);
      next.day++;
      next.phase = "morning";
      next.plan = familyPlan();
      next.dayNotes = [];
      next.eventChanges = [];
      next.flags.outingSent = false;
      for (const id of ["mom", "dad", "daughter", "brother"])
        delete next.flags[`outingRefused:${id}`];
      return { state: state.shelter ? prepareShelterDay(next) : next };
    }
    return { state };
  }
  if (action.type === "event" && state.phase === "morning")
    return { state: { ...state, phase: "event" } };
  if (action.type === "choice") return chooseEvent(state, action.id);
  if (action.type === "execute") return settleDay(state);
  if (action.type === "next" && state.phase === "night") {
    if (state.day === DAY_LIMIT)
      return {
        state: { ...state, phase: "ending", ending: evaluateEnding(state) },
      };
    const next: GameState = {
      ...structuredClone(state),
      day: state.day + 1,
      phase: "morning",
      plan: emptyPlan(),
      dayNotes: [],
      eventChanges: [],
    };
    return { state: signalAutonomy(next) };
  }
  if (action.type === "back" && state.phase === "confirm")
    return { state: { ...state, phase: "planning" } };
  if (state.phase !== "planning") return { state };
  if (action.type === "confirm") {
    const error = planErrors(state)[0];
    return error ? { state, error } : { state: { ...state, phase: "confirm" } };
  }
  if (action.type === "offer") return negotiate(state, action.id, action.offer);
  const next = structuredClone(state);
  if (action.type === "task") {
    if (!isAlive(state, action.id))
      return { state, error: "家人已死亡，不能重新安排任务" };
    if (action.task.kind === "search" && departureError(state, action.id))
      return { state, error: departureError(state, action.id)! };
    if (isAway(state, action.id))
      return { state, error: "家人仍在外出，回来前无法重新安排任务" };
    const old = next.plan.tasks[action.id];
    if (old.locked) return { state, error: "自主行动已确定，不能改派" };
    const fixed = Object.entries(next.plan.tasks).find(
      ([id, t]) => id !== action.id && t.locked && t.kind === "search",
    );
    if (action.task.kind === "search" && fixed)
      return { state, error: "今天的外出名额已被自主行动占用" };
    next.plan.tasks[action.id] = { ...action.task, explained: old.explained };
  }
  if (action.type === "ration") next.plan.ration = action.ration;
  if (action.type === "medicine") {
    if (action.id && (!isAlive(state, action.id) || isAway(state, action.id)))
      return { state, error: "家人已死亡或仍在外，不能用药" };
    next.plan.medicineTarget = action.id;
  }
  return { state: next };
}
