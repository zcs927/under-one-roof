import { LOCATION_NAMES, PEOPLE, RESOURCE_NAMES } from "./config";
import { GEAR } from "./shelter";
import { draw } from "./random";
import type { Expedition, GameState, ReturnStory } from "./types";

export const RETURN_KINDS = [
  "empty",
  "injured",
  "ill",
  "haul",
  "found",
] as const;
const texts = {
  empty: [
    [
      "背包里只剩灰尘",
      "货架早被搬空了。远处一声铁门撞响，引来几串急促的脚步。我躲进柜台下面，等到天色暗下来才敢走。背包什么也没装上，至少这次找到了回家的路。",
    ],
    [
      "最后一刻丢下了背包",
      "我找到一点东西，却在返程时被人追上。为了跑得快些，只能把搜到的东西丢进巷子。门口那几步，我已经没有力气回头看了。",
    ],
  ],
  injured: [
    [
      "围栏上的一道口子",
      "回来的近路被铁丝围住。我翻过去时，铁丝划开了胳膊，衣袖很快就湿了。绕路会更危险，只好用布条绑紧伤口，带着能带走的东西往家走。",
    ],
    [
      "楼梯塌下去的那一刻",
      "旧楼梯突然断了一截。我抓住扶手才没有掉下去，腿却磕在水泥边上。之后每走一步都疼，途中找来的东西也只能尽力背着。",
    ],
  ],
  ill: [
    [
      "门关上后，咳嗽才停不住",
      "为了绕过主街，我走进了一段积水的地下通道。冷水一直没过小腿。起初只是发冷，回到门口才发现自己在发抖，身上烫得厉害。",
    ],
    [
      "灰尘里的那间仓库",
      "仓库里空气浑浊，我还是进去搜了一圈。返程时喉咙开始刺痛，脚步越来越沉。敲响家门的那一刻，我只想先坐下来，身上却一阵冷一阵热。",
    ],
  ],
  haul: [
    [
      "柜子后面还有一道门",
      "被搬空的店里，储物柜后面竟藏着一间小库房。里面的补给还封着。我不敢点灯，摸黑一趟趟把东西搬到门口，最后把背包塞得几乎扣不上。",
    ],
    [
      "一辆没被翻过的补给车",
      "路边那辆车看起来和其他废车没区别。我试着撬开后门，才发现里面还有成箱的补给。能带的终究有限，但这次总算不是白跑。",
    ],
  ],
  found: [
    [
      "绕过主街，走回家",
      "主街一直有人影晃动。我沿着后巷慢慢找，只拿走确定能用的东西。返程时记住了几个还能避雨的屋檐，下次也许用得上。",
    ],
    [
      "一盏灯也没敢点",
      "大多数地方都空了，角落里还留着零散的东西。我听见外面有动静就停下来等，等安静了再走。东西不多，每一份都来得不容易。",
    ],
  ],
};
export function makeReturnStory(
  state: GameState,
  trip: Expedition,
): ReturnStory {
  const roll = draw(state),
    variant = Math.floor(draw(state) * 2);
  const total = Object.values(trip.loot).reduce((n, v) => n + v, 0);
  const kind =
    roll < 0.12
      ? "haul"
      : roll < 0.27
        ? "injured"
        : roll < (state.shelter?.outside === "high" ? 0.48 : 0.4) &&
            trip.gear !== "mask"
          ? "ill"
          : total === 0 && !trip.gearFound
            ? "empty"
            : "found";
  if (kind === "haul") {
    trip.loot[trip.location] =
      5 + Math.floor(draw(state) * 4) + (trip.person === "daughter" ? 1 : 0);
    trip.loot[trip.location === "water" ? "food" : "water"] =
      2 + Math.floor(draw(state) * 2);
  }
  if (kind === "injured")
    trip.returnHealthCost = Math.min(20, trip.returnHealthCost + 8);
  if (kind === "ill")
    trip.returnHealthCost = Math.min(20, trip.returnHealthCost + 5);
  const [title, text] = texts[kind][variant];
  return {
    kind,
    title,
    text: `“我去了${LOCATION_NAMES[trip.location]}。${text}”`,
    moodDelta: { empty: -6, injured: -5, ill: -4, haul: 7, found: 2 }[kind],
    fatigueDelta: { empty: 5, injured: 10, ill: 8, haul: 10, found: 3 }[kind],
    illnessDays: kind === "ill" ? 2 + Math.floor(draw(state) * 3) : 0,
    acknowledged: false,
  };
}
// Old trips keep their pre-existing loot, duration, damage, and random state.
export function legacyReturnStory(trip: Expedition): ReturnStory {
  const total = Object.values(trip.loot).reduce((n, v) => n + v, 0);
  const kind =
    total === 0 && !trip.gearFound
      ? "empty"
      : total >= 6
        ? "haul"
        : trip.returnHealthCost >= 8
          ? "injured"
          : "found";
  const [title] = texts[kind][0];
  return {
    kind,
    title,
    text: `“这趟去了${LOCATION_NAMES[trip.location]}。${total === 0 ? (trip.gearFound ? `没有找到食水，但发现了一件还能用的${GEAR[trip.gearFound].name}，已经带回来了。` : "一路上没找到能带回来的补给，最后只能空着背包回家。") : total >= 6 ? "这回找到了比预想更多的东西，一路背回来并不容易。" : "能找到的东西不多，我沿着来路慢慢走了回来。"}${trip.returnHealthCost ? "路上也吃了些苦头，回来时身体比出门时更差。" : "还好平安找到了家门。"}”`,
    moodDelta: 0,
    fatigueDelta: 0,
    illnessDays: 0,
    acknowledged: false,
  };
}
export function lootDescription(trip: Expedition) {
  const items = Object.entries(trip.loot)
    .filter(([, n]) => n > 0)
    .map(
      ([key, n]) =>
        `${RESOURCE_NAMES[key as keyof typeof RESOURCE_NAMES]} +${n}`,
    );
  if (trip.gearFound) items.push(`${GEAR[trip.gearFound].name} +1`);
  return items.join("、") || "空手回来，没有补给入库";
}
export function returnAccount(trip: Expedition) {
  if (!trip.story) return "";
  const effects = trip.story.applied;
  return `归来经历 · ${PEOPLE[trip.person].name}：${trip.story.title}。${trip.story.text} 清点：${lootDescription(trip)}。${effects?.health ? `归来时健康 ${effects.health}。` : ""}${trip.story.illnessDays ? `发烧，需要用药或休息恢复。` : ""}`;
}
export function pendingReturns(state: GameState) {
  return state.expeditions
    .filter((t) => t.returnedDay !== null && t.story && !t.story.acknowledged)
    .sort(
      (a, b) =>
        a.returnedDay! - b.returnedDay! || a.departedDay - b.departedDay,
    );
}
export function acknowledgeReturn(state: GameState, id: string): GameState {
  const trip = state.expeditions.find((t) => t.id === id);
  if (!trip?.story || trip.returnedDay === null || trip.story.acknowledged)
    return state;
  const next = structuredClone(state);
  next.expeditions.find((t) => t.id === id)!.story!.acknowledged = true;
  return next;
}
export function validReturnStory(value: unknown, returned: boolean): boolean {
  if (value === undefined) return true;
  const obj = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);
  const num = (v: unknown, min: number, max: number): v is number =>
    typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
  if (
    !obj(value) ||
    !RETURN_KINDS.includes(value.kind as ReturnStory["kind"]) ||
    typeof value.title !== "string" ||
    !value.title ||
    typeof value.text !== "string" ||
    !value.text ||
    !num(value.moodDelta, -10, 10) ||
    !num(value.fatigueDelta, 0, 15) ||
    !num(value.illnessDays, 0, 4) ||
    typeof value.acknowledged !== "boolean"
  )
    return false;
  if (value.illnessDays > 0 && value.kind !== "ill") return false;
  if (!returned) return value.applied === undefined && !value.acknowledged;
  return (
    obj(value.applied) &&
    num(value.applied.health, -100, 0) &&
    num(value.applied.mood, -100, 100) &&
    num(value.applied.fatigue, 0, 100)
  );
}
