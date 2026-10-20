import { PEOPLE, RESOURCE_NAMES } from "./config";
import { residents } from "./presence";
import { draw } from "./random";
import { gearAvailable } from "./shelter";
import { markInjury } from "./appearance";
import type { EncounterState, GameState, Resource } from "./types";

type Secret = NonNullable<NonNullable<EncounterState["current"]>["secret"]>;
export function makeVisitorSecret(s: GameState, id: string): Secret {
  const chance = draw(s),
    roll = draw(s);
  const honest =
    id === "stranger-family" || id === "rescue-check"
      ? 0.45
      : id === "child-water"
        ? 0.55
        : 0.65;
  return {
    identity:
      id === "marked-door"
        ? "raiders"
        : chance < honest
          ? "honest"
          : chance < 0.85
            ? "fraud"
            : "raiders",
    roll,
  };
}
export function visitorSecret(s: GameState): Secret {
  const current = s.encounters?.current;
  if (current?.secret) return current.secret;
  // Stable fallback for old pending saves; stamped on resume before any game actions.
  let hash = s.rngState;
  for (const c of `${current?.day}:${current?.id}`)
    hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
  const sample = { ...s, rngState: hash || 1 };
  return makeVisitorSecret(sample, current?.id ?? "neighbor-food");
}
export function ensureEncounterSecret(s: GameState): GameState {
  if (
    !s.encounters?.current ||
    s.encounters.current.secret ||
    s.encounters.current.choice !== null
  )
    return s;
  const next = structuredClone(s);
  next.encounters!.current!.secret = visitorSecret(s);
  return next;
}
export function change(s: GameState, resource: Resource, delta: number) {
  const before = s.resources[resource];
  s.resources[resource] = Math.max(
    0,
    Math.min(resource === "safety" ? 100 : Infinity, before + delta),
  );
  const actual = s.resources[resource] - before;
  if (actual)
    s.eventChanges.push({
      label: RESOURCE_NAMES[resource],
      before,
      delta: actual,
      after: s.resources[resource],
      reason: "门外的故事",
    });
  return actual;
}
export function mood(s: GameState, delta: number) {
  for (const p of residents(s)) {
    const before = p.mood;
    p.mood = Math.max(0, Math.min(100, before + delta));
    if (before !== p.mood)
      s.eventChanges.push({
        label: `${PEOPLE[p.id].name} · 情绪`,
        before,
        delta: p.mood - before,
        after: p.mood,
        reason: "门外的故事",
      });
  }
}
export const FOLLOW_UP_IDS = ["neighbor-return", "marked-door"];
export function scheduleVisit(s: GameState, id: string) {
  const events = s.encounters!;
  const queue = [
    ...(events.followUp ? [events.followUp] : []),
    ...(events.queuedFollowUps ?? []),
  ];
  queue.push({ id, day: s.day + 3 + Math.floor(draw(s) * 3) });
  queue.sort((a, b) => a.day - b.day);
  events.followUp = queue.shift()!;
  events.queuedFollowUps = queue;
}
export function defenseChance(s: GameState) {
  const guards = residents(s).reduce(
    (n, p) =>
      n +
      (p.health >= 40 && p.fatigue < 80
        ? p.id === "mom" || p.id === "dad"
          ? 2
          : 1
        : 0),
    0,
  );
  return Math.min(
    0.82,
    0.12 +
      guards * 0.06 +
      s.resources.safety * 0.002 +
      (gearAvailable(s, "axe") ? 0.22 : 0),
  );
}
export function robbery(s: GameState): string {
  const defended = visitorSecret(s).roll < defenseChance(s);
  change(s, "safety", defended ? -4 : -12);
  mood(s, defended ? -2 : -8);
  if (defended)
    return "门刚开，他们就伸手推门！留守的家人一起顶住了门板，把人逼回楼梯间。这是一场抢劫。物资守住了，但门锁受损，住所安全下降，屋里很久没有人说话。";
  const stolen = (
    [
      ["food", -2],
      ["water", -1],
      ["materials", -1],
    ] as const
  )
    .map(([key, delta]) => {
      const actual = -change(s, key, delta);
      return actual ? `${RESOURCE_NAMES[key]}${actual}份` : "";
    })
    .filter(Boolean);
  const defenders = residents(s).sort((a, b) => {
    const priority = { dad: 0, mom: 1, daughter: 2, brother: 3 };
    return priority[a.id] - priority[b.id];
  });
  const p = defenders[0];
  let injury = "";
  if (p) {
    const before = p.health;
    p.health = Math.max(1, before - 15);
    const damage = before - p.health;
    if (damage) markInjury(s, p);
    if (damage)
      s.eventChanges.push({
        label: `${PEOPLE[p.id].name} · 健康`,
        before,
        delta: -damage,
        after: p.health,
        reason: "门外抢劫受伤",
      });
    injury = damage
      ? `${PEOPLE[p.id].name}在阻拦时受伤，健康 −${damage}。`
      : `${PEOPLE[p.id].name}已经十分虚弱，今晚仍有生命危险。`;
  }
  return `门一开，后面藏着的人猛地挤了进来。他们抢走了${stolen.length ? stolen.join("、") : "能找到的空箱子——家里已没有可拿的食水"}，砸坏门锁后逃走。${injury}住所安全下降。`;
}
export function visitorClue(s: GameState): string {
  const { identity, roll } = visitorSecret(s),
    id = s.encounters?.current?.id;
  if (id === "neighbor-food")
    return identity === "honest"
      ? "他能说出电梯总卡在三楼，也记得小豆画在墙上的恐龙。声音像老陈，但隔着门，还是看不清脸。他说可以在楼梯口等，绝不进屋。"
      : identity === "fraud"
        ? "他也说得出楼道的电梯，却把你们上次见面的地方说错了。追问孩子的名字时，他停了一下，说自己饿得记不清了。也许是疲惫，也许另有隐情。"
        : "门外的人一再说自己是老陈，却急着让你把门打开。楼梯下似乎还有鞋底蹭地的声音，听不清究竟有几个人。";
  if (id === "child-water")
    return identity === "honest"
      ? "孩子回答得很慢，说妈妈发烧了。远处传来压低的咳嗽声，但门缝太窄，你看不到大人的脸。"
      : "孩子回答时，总先看向楼梯拐角，像在等谁提醒。那边传来一声短促的口哨，也可能只是漏风。";
  if (id === "barter-water")
    return identity === "honest"
      ? "瓶盖的封条看起来完整，他愿意后退，让你先检查瓶子。水源仍没法核实。"
      : "瓶盖底下有一道胶痕。他不肯让你细看，一直催你先把食物递出去，说楼下有人在等。";
  if (id === "rescue-check")
    return identity === "honest"
      ? "他隔门报了集合点和一段广播口令，愿意在门外等。不过那张证件已经泡得模糊不清。"
      : "证件上的日期被污渍遮住了。他说不清集合点，只反复强调要进屋登记物资。";
  if (identity === "raiders")
    return "说话的人坚持要进屋，另一个方向却传来金属轻碰的声音。你看不到阴影里是否还有人。";
  if (identity === "fraud")
    return "他的说法前后有些对不上，还不时望向楼梯。也许太紧张，也可能在等人。隔着门很难确定。";
  return roll < 0.5
    ? "对方愿意退后，回答了你的问题，也没有催你开门。听起来像真在求助，但你仍看不清楼梯拐角。"
    : "对方说话有些磕绊，门外似乎不止一个人。他解释是同行的家人，证实不了，也无法排除。";
}
export function giveAid(
  s: GameState,
  honestText: string,
  opened = false,
): string {
  const { identity } = visitorSecret(s);
  if (identity === "raiders" && opened) return robbery(s);
  if (identity !== "honest") {
    mood(s, -4);
    if (identity === "raiders") {
      scheduleVisit(s, "marked-door");
      return "你把物资从窄缝递出，随即关紧了门。门外的人突然换了语气，问你屋里还剩多少。几个人低声商量后离开，门框上多了一道粉笔记号。物资没有再被抢，但这次求助显然有问题，他们可能还会回来。";
    }
    if (opened) {
      const lost = -change(s, "water", -1);
      change(s, "safety", -3);
      return `你转身拿东西的片刻，他把桌边${lost ? "一份饮水" : "装水的空壶"}藏进了衣服。人走后，你听见他在楼梯口与同伴分东西，才明白求助的说辞是编的。除了刚给出的物资，${lost ? "还丢了一份水" : "幸好已无多余饮水可偷"}。家人既害怕又懊恼。`;
    }
    return "物资刚递出去，求助的人便把它交给拐角的同伴。你听见他们笑着分起了今天从各家讨来的东西，先前的哭腔已经没了。这次被骗走了一份物资，没有得到回报。";
  }
  mood(s, opened ? 3 : 2);
  if (s.encounters!.current!.id === "neighbor-food")
    scheduleVisit(s, "neighbor-return");
  return honestText;
}
