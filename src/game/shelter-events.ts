import { PEOPLE, RESOURCE_NAMES } from "./config";
import { normalize } from "./initial";
import { residents } from "./presence";
import { draw } from "./random";
import { prepareEncounter } from "./encounters";
import { ensureEncounterSecret } from "./encounter-effects";
import { gearAvailable, GEAR, outsideFor } from "./shelter";
import type { GameState, GearId, Resource } from "./types";
export interface IncidentChoice {
  id: string;
  title: string;
  detail: string;
  cost?: Partial<Record<Resource, number>>;
  gear?: GearId;
  apply: (s: GameState) => string;
}
interface Incident {
  id: string;
  title: string;
  text: string;
  choices: IncidentChoice[];
  leave: string;
  neglect?: (s: GameState) => void;
}
function resources(s: GameState, delta: Partial<Record<Resource, number>>) {
  for (const [key, value] of Object.entries(delta)) {
    const resource = key as Resource,
      before = s.resources[resource];
    s.resources[resource] = Math.max(
      0,
      Math.min(resource === "safety" ? 100 : Infinity, before + (value ?? 0)),
    );
    s.eventChanges.push({
      label: RESOURCE_NAMES[resource],
      before,
      delta: s.resources[resource] - before,
      after: s.resources[resource],
      reason: "今日记事",
    });
  }
}
function spirits(s: GameState, n: number) {
  residents(s).forEach((p) => (p.mood += n));
}
function hurt(s: GameState, n: number) {
  const p = residents(s).toSorted((a, b) => a.health - b.health)[0];
  if (!p) return "";
  // Injuries become critical here; lethal condition is resolved with tonight's life check.
  const loss = Math.min(n, Math.max(0, p.health - 1));
  p.health -= loss;
  return `${PEOPLE[p.id].name}受了伤（健康−${loss}）${p.health <= 10 ? "，情况危急，今晚可能撑不过去" : ""}。`;
}
function breakGear(s: GameState, gear: GearId, chance: number) {
  if (draw(s) < chance) {
    s.shelter!.inventory[gear] = 0;
    return `${GEAR[gear].name}也坏了。`;
  }
  return "";
}
const choice = (
  id: string,
  title: string,
  detail: string,
  apply: IncidentChoice["apply"],
  extra: Partial<IncidentChoice> = {},
): IncidentChoice => ({ id, title, detail, apply, ...extra });
const entries: Incident[] = [
  {
    id: "airwaves",
    title: "滋啦声里，有人报出了日期",
    text: "收音机的红灯闪了一下。陌生人反复说：第100天，沿公路收容幸存者。爸爸伸手想调大音量，弟弟已经拿起笔。它会是真的吗？",
    choices: [
      choice(
        "listen",
        "用收音机听清频率",
        "收音机留在家中才能使用；可能因短路损坏。",
        (s) => {
          s.shelter!.rescue = Math.max(1, s.shelter!.rescue);
          return (
            "听清了集合口令：先做屋顶标记，再储备车队需要的饮水。救援线索 1/3。" +
            breakGear(s, "radio", 0.1)
          );
        },
        { gear: "radio" },
      ),
      choice(
        "borrow",
        "隔门请邻居传话",
        "给出1份食物换一条确定的频率。",
        (s) => {
          s.shelter!.rescue = Math.max(1, s.shelter!.rescue);
          return "邻居把频率写在纸上塞进门缝。第100天，车队会经过旧公路。救援线索 1/3。";
        },
        { cost: { food: 1 } },
      ),
    ],
    leave: "今天没有确认广播，暂时不知道车队怎样找到这栋屋子。",
  },
  {
    id: "mark",
    title: "他们得先看见我们",
    text: "广播不是救命符。车队要辨认屋顶上的标记；画错方向，司机可能只看到一片废楼。地图若被带出门，今天就只能等。",
    choices: [
      choice(
        "map",
        "按地图制作标记",
        "使用地图与1件材料；推进救援准备。",
        (s) => {
          s.shelter!.rescue = 2;
          return "标记朝向旧公路。爸爸画的箭头歪了，姐姐重新画了一遍。救援准备 2/3。";
        },
        { gear: "map", cost: { materials: 1 } },
      ),
      choice(
        "signal",
        "让邻居一起做标记",
        "给出2份食物，请熟悉路口的人帮忙。",
        (s) => {
          s.shelter!.rescue = 2;
          return "邻居在对面楼顶挂出相同标记。有人能认出我们了。救援准备 2/3。";
        },
        { cost: { food: 2 } },
      ),
    ],
    leave: "标记还没有做好，广播里不会凭空出现我们的地址。",
  },
  {
    id: "reserve",
    title: "两份水，换一个位置",
    text: "车队的中继台要一点饮水。司机答应把这一家记入第100天的名单。水放出去就不能拿回；屋里也有人盯着水箱。",
    choices: [
      choice(
        "water",
        "交出两份饮水",
        "饮水−2；确认第100天的撤离名额。",
        (s) => {
          s.shelter!.rescue = 3;
          spirits(s, 6);
          return "中继台确认了地址：第100天，门上画白色箭头。救援准备 3/3。接下来仍要自己撑过去。";
        },
        { cost: { water: 2 } },
      ),
      choice(
        "medicine",
        "用药品与材料交换",
        "药品−1、材料−2；保留家里的饮水。",
        (s) => {
          s.shelter!.rescue = 3;
          return "修车零件和药品换来了同样的承诺。救援准备 3/3。第100天之前，先让所有人活着。";
        },
        { cost: { medicine: 1, materials: 2 } },
      ),
    ],
    leave: "还没有确认名额，先把补给留在家里。",
  },
  {
    id: "knock",
    title: "三下敲门，停了一下，又两下",
    text: "门外的人自称送水工。他说自己还记得这里的门牌号。弟弟觉得声音像以前的叔叔，妈妈却示意大家别出声。",
    choices: [
      choice(
        "guard",
        "拿着斧头隔门交换",
        "需要斧头；大多能拿到少量水，也有受伤风险。",
        (s) => {
          if (draw(s) < 0.85) {
            resources(s, { water: 2 });
            return "确实是送水的人。他留下2份水，没提价，也没问屋里还剩几个人。";
          }
          return "那人伸手试门锁，随后跑了。" + hurt(s, 6);
        },
        { gear: "axe" },
      ),
      choice(
        "open",
        "打开一条门缝",
        "可能得到水，也可能损失口粮并受伤。",
        (s) => {
          if (draw(s) < 0.6) {
            resources(s, { water: 2 });
            return "门外的人把2份水轻轻放下。弟弟想道谢时，他已经走远。";
          }
          resources(s, { food: -1 });
          return "对方撞开门，抢走了最多1份食物。" + hurt(s, 10);
        },
      ),
    ],
    leave: "没人开门。脚步声远去，来人的身份仍不清楚。",
  },
  {
    id: "drips",
    title: "雨下进了屋里",
    text: "铁桶叮叮作响。它终于接满了，但水面浮着一层黑灰。小豆认真地说，只要闭着眼喝，就看不见脏东西。没有人笑。",
    choices: [
      choice(
        "filter",
        "按手册做过滤层",
        "生存手册、材料−1；获得3份水。",
        (s) => {
          resources(s, { water: 3 });
          return "砂、布、木炭一层层压好。水箱多了3份水，手册边角也被泡皱了。";
        },
        { gear: "handbook", cost: { materials: 1 } },
      ),
      choice(
        "mask",
        "拆下面罩的滤芯净水",
        "面罩可能报废，成功可得2份水。",
        (s) => {
          resources(s, { water: 2 });
          return "滤芯截住黑灰，留下2份水。" + breakGear(s, "mask", 0.4);
        },
        { gear: "mask" },
      ),
      choice(
        "boil",
        "试着煮一煮",
        "没有工具也能尝试；可能得2份水，也可能生病。",
        (s) => {
          if (draw(s) < 0.55) {
            resources(s, { water: 2 });
            return "煮过的水闻起来古怪，但暂时没有不适。留下2份水。";
          }
          return "水喝下去后，肚子先提出了反对。" + hurt(s, 12);
        },
      ),
    ],
    leave: "把水倒掉了。桶重新空着，至少没人拿身体冒险。",
  },
  {
    id: "pests",
    title: "口粮箱里有第二种呼吸声",
    text: "一只比拇指还长的虫子从箱角钻出来，后面还有几只。它们对罐头贴纸很感兴趣，对里面的东西更感兴趣。",
    choices: [
      choice(
        "axe",
        "用斧背清理箱角",
        "需要斧头，可能损坏；保住食物。",
        (s) =>
          "箱角被砸得不太好看，好在虫子没有继续吃下去。" +
          breakGear(s, "axe", 0.2),
        { gear: "axe" },
      ),
      choice(
        "seal",
        "把箱角重新封住",
        "材料−1；稳妥保住食物。",
        () => "妈妈把每个缝隙封好，弟弟负责对着虫子念搬家通知。",
        { cost: { materials: 1 } },
      ),
    ],
    leave: "暂不处理：虫子会吃掉最多1份食物。",
    neglect: (s) => resources(s, { food: -1 }),
  },
  {
    id: "trader",
    title: "一张写歪了的价目表",
    text: "推车上的人不收钱。他把两张纸举到窗前：水换吃的，药换罐头。曾经最值钱的东西，现在被拿来垫车轮。",
    choices: [
      choice(
        "water",
        "1份食物换2份水",
        "食物−1，饮水+2。",
        (s) => {
          resources(s, { water: 2 });
          return "交易在门缝里完成。水箱稍微重了一点，口粮箱轻了一点。";
        },
        { cost: { food: 1 } },
      ),
      choice(
        "food",
        "1份药品换3份食物",
        "药品−1，食物+3；之后受伤会更难处理。",
        (s) => {
          resources(s, { food: 3 });
          return "三份罐头进了屋。妈妈把空药格合上时，动作停了一下。";
        },
        { cost: { medicine: 1 } },
      ),
    ],
    leave: "没有交易。推车还会不会再来，谁也不知道。",
  },
  {
    id: "floor",
    title: "地板下面，是空的",
    text: "桌脚压住的木板发出空响。上一任住户也许藏过东西，也可能只是老鼠窝。撬开之后，这块地板就不会恢复原样。",
    choices: [
      choice(
        "book",
        "照手册拆开木板",
        "手册留在家中；稳妥找到一点材料和食物。",
        (s) => {
          resources(s, { materials: 1, food: 1 });
          return "一个旧饭盒和几枚螺丝。食物+1、材料+1。饭盒里还有一张写着“别忘了回来”的纸条。";
        },
        { gear: "handbook" },
      ),
      choice("pry", "徒手撬开看看", "可能找到补给，也可能被锈钉划伤。", (s) => {
        if (draw(s) < 0.55) {
          resources(s, { food: 2 });
          return "塑料袋里装着2份完好的口粮，居然没有被老鼠先发现。";
        }
        return "木板下面只有锈钉和湿纸。" + hurt(s, 8);
      }),
    ],
    leave: "地板没动。它继续承受四个人的重量。",
  },
  {
    id: "quiet",
    title: "已经没人想说话了",
    text: "弟弟把空罐头排成一列，说这是车队。姐姐让他别敲。过了很久，妈妈才意识到：今天还没人说过一句完整的话。",
    choices: [
      choice(
        "cards",
        "拿出纸牌玩一局",
        "需要纸牌；留守者情绪+8。",
        (s) => {
          spirits(s, 8);
          return "爸爸连输三局，坚持说桌子不平。大家终于笑了一次。留守者情绪+8。";
        },
        { gear: "cards" },
      ),
      choice(
        "meal",
        "把一份口粮放到中间",
        "食物−1；只改善情绪，不代替个人喂食。",
        (s) => {
          spirits(s, 10);
          return "罐头在桌上转了一圈。没人真正吃饱，但每个人都说了几句话。留守者情绪+10。";
        },
        { cost: { food: 1 } },
      ),
    ],
    leave: "暂不处理：沉默继续，留守者情绪−3。",
    neglect: (s) => spirits(s, -3),
  },
  {
    id: "wire",
    title: "修东西的人留下了一袋旧货",
    text: "电线、折断的天线和一个能合上的塑料壳。爸爸说这些不是垃圾，语气像在维护一位老朋友。",
    choices: [
      choice(
        "radio",
        "拼出一台能用的收音机",
        "材料−2；获得或修复收音机。",
        (s) => {
          s.shelter!.inventory.radio = 1;
          return "喇叭先尖叫，再安静，最后传出人声。收音机能用了。";
        },
        { cost: { materials: 2 } },
      ),
      choice(
        "tools",
        "交换一件缺少的工具",
        "食物−1；获得斧头、手册或纸牌中缺少的一件。",
        (s) => {
          const pool = (["axe", "handbook", "cards"] as GearId[]).filter(
            (g) => !s.shelter!.inventory[g],
          );
          if (!pool.length) {
            resources(s, { materials: 2 });
            return "工具已经都有了，对方改给2件材料。";
          }
          const gear = pool[Math.floor(draw(s) * pool.length)];
          s.shelter!.inventory[gear] = 1;
          return `留下了${GEAR[gear].name}。从今天起，有些事可以换一种办法解决。`;
        },
        { cost: { food: 1 } },
      ),
    ],
    leave: "旧货被收走。缺少的工具仍然缺着。",
  },
  {
    id: "neighbour",
    title: "隔壁要一份药",
    text: "门缝里塞进一张纸。隔壁的孩子在发烧，他们想借一份药。没有抵押，只有一行字：如果明天能出去，会记得你们。",
    choices: [
      choice(
        "help",
        "给出一份药",
        "药品−1；是否值得，要等明天才知道。",
        (s) => {
          s.flags.neighborAid = true;
          return "药从门缝递过去。那边连着说了三次谢谢。现在还没有任何回报。";
        },
        { cost: { medicine: 1 } },
      ),
    ],
    leave: "留下了药。隔壁没有再敲门，纸条被收进了抽屉。",
  },
  {
    id: "thanks",
    title: "门外留着一个湿纸袋",
    text: "纸袋上是昨天的字迹：孩子退烧了。我们走了很远，只找到这些。里面传来罐头碰在一起的声音。",
    choices: [
      choice("take", "收下这份回礼", "得到食物1、水2；帮助的后续。", (s) => {
        resources(s, { food: 1, water: 2 });
        s.flags.neighborAid = false;
        return "食物+1、饮水+2。原来昨天递出去的药，真的有人记得。";
      }),
    ],
    leave: "回礼暂存在门外，明天仍可收下。",
  },
  {
    id: "cold",
    title: "风从墙缝里进来",
    text: "小豆说夜里听见墙在吹口哨。姐姐把最后一条毯子让给他，自己靠在墙上，假装不冷。",
    choices: [
      choice(
        "patch",
        "照手册补好墙缝",
        "需要手册、材料−1；安全度+8。",
        (s) => {
          resources(s, { safety: 8 });
          return "墙终于不吹口哨了。安全度+8，今夜可以少抱紧自己一点。";
        },
        { gear: "handbook", cost: { materials: 1 } },
      ),
      choice(
        "burn",
        "烧掉纸牌取暖",
        "永久失去纸牌；避免今晚受寒。",
        (s) => {
          s.shelter!.inventory.cards = 0;
          return "最后一张红桃在火里卷起来。暖了一会儿，明天却再也没有这一副牌。";
        },
        { gear: "cards" },
      ),
    ],
    leave: "暂不处理：最虚弱的留守家人健康−5。",
    neglect: (s) => {
      hurt(s, 5);
    },
  },
  {
    id: "shadow",
    title: "有人在数我们的窗户",
    text: "路口的手电照了两次。对方没有喊话，像在等屋里的人先熄灯。桌上的补给箱这时显得格外响亮。",
    choices: [
      choice(
        "defend",
        "把斧头靠在门边",
        "需要斧头；赶走试探的人，斧头可能损坏。",
        (s) => {
          resources(s, { safety: 5 });
          return (
            "门闩响了一下，斧背也响了一下。脚步很快消失。" +
            breakGear(s, "axe", 0.25)
          );
        },
        { gear: "axe" },
      ),
      choice(
        "barricade",
        "用材料把门挡住",
        "材料−1；安全度+5。",
        (s) => {
          resources(s, { safety: 5 });
          return "堵门的柜子歪了，但来人没能进来。安全度+5。";
        },
        { cost: { materials: 1 } },
      ),
    ],
    leave: "暂不处理：来人可能拿走最多1份水，住所安全度−5。",
    neglect: (s) => resources(s, { water: -1, safety: -5 }),
  },
];
export const INCIDENT_IDS = entries.map((e) => e.id);
export function incidentFor(s: GameState) {
  return entries.find((e) => e.id === s.shelter?.incident.id) ?? entries[0];
}
export function prepareShelterDay(state: GameState): GameState {
  const next = structuredClone(state);
  if (!next.shelter) {
    next.shelter = {
      inventory: { radio: 1, mask: 1, map: 1, axe: 0, handbook: 0, cards: 0 },
      outside: "high",
      rescue: 0,
      recent: [],
      incident: { id: "airwaves", day: next.day, choice: null, outcome: null },
    };
  }
  const sh = next.shelter;
  sh.outside = outsideFor(next);
  let id: string;
  if (next.flags.neighborAid) id = "thanks";
  else if (sh.rescue === 1 && next.day >= 5 && next.day % 3 === 2) id = "mark";
  else if (sh.rescue === 2 && next.day >= 12 && next.day % 4 === 0)
    id = "reserve";
  else if (sh.rescue === 0 && (next.day === 1 || next.day % 6 === 0))
    id = "airwaves";
  else if (next.day === 2) id = "knock";
  else if (next.day === 3) id = "drips";
  else {
    const pool = entries.filter(
      (e) =>
        !["airwaves", "mark", "reserve", "thanks"].includes(e.id) &&
        !sh.recent.includes(e.id),
    );
    id = pool[Math.floor(draw(next) * pool.length)].id;
  }
  sh.recent = [...sh.recent, id].slice(-3);
  sh.incident = { id, day: next.day, choice: null, outcome: null };
  return prepareEncounter(next);
}
export function ensureShelter(state: GameState): GameState {
  return ensureEncounterSecret(
    state.shelter ? state : prepareShelterDay(state),
  );
}
export function incidentChoiceError(s: GameState, c: IncidentChoice) {
  if (!s.shelter || s.phase !== "morning") return "今天的决定已经结束";
  if (s.shelter.incident.choice !== null) return "今天已经决定过了";
  if (c.gear && !gearAvailable(s, c.gear))
    return `${GEAR[c.gear].name}不在家中或已经损坏`;
  for (const [key, cost] of Object.entries(c.cost ?? {}))
    if (s.resources[key as Resource] < (cost ?? 0))
      return `${RESOURCE_NAMES[key as Resource]}不足`;
  if (
    s.shelter.incident.id === "wire" &&
    c.id === "radio" &&
    s.expeditions.some(
      (t) => t.gear === "radio" && t.returnedDay === null && t.lostDay === null,
    )
  )
    return "收音机还在外面，无法在家中修理";
  if (
    s.shelter.incident.id === "wire" &&
    c.id === "radio" &&
    s.shelter.inventory.radio === 1
  )
    return "收音机还能用，先省下材料";
  return null;
}
export function chooseIncident(
  state: GameState,
  id: string,
): { state: GameState; error?: string } {
  if (!state.shelter || state.phase !== "morning")
    return { state, error: "只能在白天处理今天的记事" };
  if (state.shelter.incident.choice !== null) return { state };
  const incident = incidentFor(state),
    c = incident.choices.find((c) => c.id === id);
  if (id !== "leave" && !c) return { state, error: "没有这个选择" };
  const error = c ? incidentChoiceError(state, c) : null;
  if (error) return { state, error };
  const next = structuredClone(state);
  if (c?.cost)
    resources(
      next,
      Object.fromEntries(
        Object.entries(c.cost).map(([k, v]) => [k, -(v ?? 0)]),
      ),
    );
  let outcome: string;
  if (c) outcome = c.apply(next);
  else {
    incident.neglect?.(next);
    outcome = incident.leave;
  }
  next.shelter!.incident.choice = id;
  next.shelter!.incident.outcome = outcome;
  normalize(next);
  for (const p of next.people) {
    const before = state.people.find((x) => x.id === p.id)!;
    for (const key of ["health", "mood", "trust"] as const)
      if (p[key] !== before[key] && p[key] !== undefined)
        next.eventChanges.push({
          label: `${PEOPLE[p.id].name} · ${{ health: "健康", mood: "情绪", trust: "信任" }[key]}`,
          before: before[key] ?? 0,
          delta: (p[key] ?? 0) - (before[key] ?? 0),
          after: p[key] ?? 0,
          reason: "今日记事",
        });
  }
  next.dayNotes.push(
    `今日记事 · ${incident.title}：${c?.title ?? "暂不处理"}。${outcome}`,
  );
  return { state: normalize(next) };
}
