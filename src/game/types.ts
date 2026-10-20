export type PersonId = "mom" | "dad" | "daughter" | "brother";
export type Phase =
  "morning" | "event" | "planning" | "confirm" | "night" | "ending";
export type TaskKind = "rest" | "search" | "repair" | "care";
export type Location = "food" | "water" | "materials";
export type Resource = "food" | "water" | "medicine" | "materials" | "safety";
export type GearId = "radio" | "mask" | "axe" | "map" | "handbook" | "cards";
export interface ShelterState {
  inventory: Record<GearId, number>;
  outside: "high" | "medium" | "low";
  rescue: number;
  recent: string[];
  incident: {
    id: string;
    day: number;
    choice: string | null;
    outcome: string | null;
  };
}
export interface Person {
  injury?: { sinceDay: number; daysLeft: number };
  illness?: { sinceDay: number; daysLeft: number };
  id: PersonId;
  health: number;
  fatigue: number;
  mood: number;
  trust?: number;
  alive: boolean;
  deathDay: number | null;
  deathReason: string | null;
  hungryDays: number;
  thirstyDays: number;
  criticalDays: number;
  fedDay: number | null;
  wateredDay: number | null;
  refusedFoodDay: number | null;
  refusedWaterDay: number | null;
}
export interface PersonDefinition extends Person {
  name: string;
  role: string;
  personality: string;
  wish: string;
  skill: string;
  photo: string;
  opening: string;
  radio: string;
}
export interface Task {
  kind: TaskKind;
  location?: Location;
  target?: PersonId;
  explained?: boolean;
  extraFood?: boolean;
  protected?: boolean;
  locked?: boolean;
}
export interface Plan {
  tasks: Record<PersonId, Task>;
  ration: "normal" | "save" | "manual";
  medicineTarget: PersonId | null;
}
export interface Memory {
  id: string;
  day: number;
  person: PersonId;
  kind: "kept" | "broken" | "cared" | "respected" | "stopped";
  text: string;
  trustDelta: number;
  moodDelta: number;
  source: string;
}
export interface PromiseRecord {
  id: string;
  person: PersonId;
  kind: "medicine" | "rest";
  day: number;
  dueDay: number;
  status: "pending" | "kept" | "broken" | "cancelled";
}
export interface Change {
  label: string;
  before: number;
  delta: number;
  after: number;
  reason: string;
}
export interface Diary {
  day: number;
  event: string;
  choice: string;
  actions: string[];
  notes: string[];
  changes: Change[];
  summary?: DaySummary;
}
export interface DaySummary {
  foodDelta: number;
  waterDelta: number;
  foodLeft: number;
  waterLeft: number;
  alive: number;
  atHome: number;
  departed: string[];
  returned: string[];
  died: string[];
  hungry: string[];
  thirsty: string[];
}
export interface Autonomy {
  person: PersonId;
  signaledDay: number;
  resolved: boolean;
  outcome?: "formal" | "stay" | "stop" | "ignore" | "unwell";
}
export interface Ending {
  kind: "help" | "together" | "distance" | "extinct" | "abandoned";
  title: string;
  text: string;
  highlights: string[];
}
export interface Expedition {
  story?: ReturnStory;
  gear?: GearId;
  gearBroken?: boolean;
  gearFound?: GearId;
  id: string;
  person: PersonId;
  location: Location;
  departedDay: number;
  returnDay: number | null;
  returnedDay: number | null;
  lostDay: number | null;
  protected: boolean;
  loot: Record<Exclude<Resource, "safety">, number>;
  returnHealthCost: number;
}
export interface ReturnStory {
  kind: "empty" | "injured" | "ill" | "haul" | "found";
  title: string;
  text: string;
  moodDelta: number;
  fatigueDelta: number;
  illnessDays: number;
  acknowledged: boolean;
  applied?: { health: number; mood: number; fatigue: number };
}
export interface GameState {
  encounters?: EncounterState;
  shelter?: ShelterState;
  version: 2;
  player: PersonId;
  day: number;
  phase: Phase;
  people: Person[];
  resources: Record<Resource, number>;
  plan: Plan;
  memories: Memory[];
  promises: PromiseRecord[];
  diary: Diary[];
  choices: Record<string, string>;
  flags: Record<string, boolean>;
  autonomy: Autonomy | null;
  settled: number[];
  ending: Ending | null;
  dayNotes: string[];
  eventChanges: Change[];
  tutorialDone: boolean;
  rngState: number;
  expeditions: Expedition[];
}
export interface EncounterState {
  preparedDay?: number;
  current: {
    id: string;
    day: number;
    asked: boolean;
    choice: string | null;
    outcome: string | null;
    acknowledged: boolean;
    secret?: { identity: "honest" | "fraud" | "raiders"; roll: number };
  } | null;
  recent: string[];
  lastDay: number;
  followUp: { id: string; day: number } | null;
  queuedFollowUps?: { id: string; day: number }[];
}
export interface Attitude {
  level: "accept" | "concern" | "refuse";
  score: number;
  reasons: string[];
  hard: boolean;
}
export interface Choice {
  id: string;
  title: string;
  detail: string;
  cost: string;
  requires?: Partial<Record<Resource, number>>;
  effects?: Partial<Record<Resource, number>>;
  moodDelta?: number;
}
export interface StoryEvent {
  day: number;
  title: string;
  text: string;
  choices: Choice[];
}
