import { DAY_LIMIT, PEOPLE, RESOURCE_NAMES } from "./config";
import { residents } from "./presence";
import type { Choice, GameState, Resource, StoryEvent } from "./types";
function option(
  id: string,
  title: string,
  detail: string,
  effects: Partial<Record<Resource, number>> = {},
  moodDelta = 0,
): Choice {
  const requires = Object.fromEntries(
    Object.entries(effects)
      .filter(([, n]) => (n ?? 0) < 0)
      .map(([k, n]) => [k, -(n ?? 0)]),
  );
  return {
    id,
    title,
    detail,
    effects,
    requires: Object.keys(requires).length ? requires : undefined,
    moodDelta,
    cost:
      Object.entries(effects)
        .map(
          ([k, n]) =>
            `${RESOURCE_NAMES[k as Resource]} ${(n ?? 0) > 0 ? "+" : ""}${n}`,
        )
        .join(" · ") ||
      (moodDelta ? `在家成员情绪 +${moodDelta}` : "不消耗资源"),
  };
}
const pass = () => option("pass", "把物资留给家里", "关好门，继续今天的分工。");
const chapters: { title: string; text: string; choices: () => Choice[] }[] = [
  {
    title: "门缝里的交换单",
    text: "一张纸被塞进门缝：两份吃的，换四份水。对方约好把东西留在门外，不必走进废城。但这不是白送。",
    choices: () => [
      option("water-trade", "用两份食物换水", "先清点数量，再隔门交换。", {
        food: -2,
        water: 4,
      }),
      pass(),
    ],
  },
  {
    title: "推车上的罐头",
    text: "来人不缺罐头，却想要饮水。屋里的人重新检查封口，没人愿意吃进一场新的病。",
    choices: () => [
      option("food-trade", "用两份水换口粮", "只收封口完好的罐头。", {
        water: -2,
        food: 4,
      }),
      pass(),
    ],
  },
  {
    title: "门闩上的一道缝",
    text: "夜里有人试过门。没有闯进来，但门闩旁多了一道裂口。工具箱里剩下的材料，也许该先用在这里。",
    choices: () => [
      option("brace", "补上门闩", "用一件材料换今晚的安全。", {
        materials: -1,
        safety: 8,
      }),
      pass(),
    ],
  },
  {
    title: "最后一卷绷带",
    text: "熟悉的邻居带来一份药。他需要一点食物，愿意隔门交换。药箱和口粮箱同时摊开，谁也没有催促。",
    choices: () => [
      option("medicine-trade", "换来一份药", "食物会少一点，病人多一个机会。", {
        food: -2,
        medicine: 1,
      }),
      pass(),
    ],
  },
  {
    title: "接雨桶的铁锈",
    text: "桶沿锈出了一圈红色。用现有材料做一道滤层，能把今天接到的雨水留下；否则宁可少喝，也不能赌肚子。",
    choices: () => [
      option("filter", "做一层过滤网", "雨水收集有材料成本。", {
        materials: -1,
        water: 3,
      }),
      pass(),
    ],
  },
  {
    title: "一把螺丝的价钱",
    text: "门外有人愿意用三件零件换两份饮水。零件能修门，水却是今晚就要喝的。每一种短缺都有声音。",
    choices: () => [
      option("parts", "交换维修零件", "水少两份，材料多三件。", {
        water: -2,
        materials: 3,
      }),
      pass(),
    ],
  },
  {
    title: "收音机里的重播",
    text: "收音机反复播同一句注意事项，救援并没有立刻到来。屋里的人把音量调小，仍留了一张纸，记下所有可能有用的频率。",
    choices: () => [
      option(
        "listen",
        "轮流听完这段广播",
        "交接值守，不把广播当成已经获救。",
        {},
        3,
      ),
      pass(),
    ],
  },
  {
    title: "被老鼠咬开的箱角",
    text: "食物箱角落有了牙印。先加一层铁皮，还是抬到高处暂时应付？无论如何，都得再数一遍库存。",
    choices: () => [
      option("box", "用铁皮加固箱子", "材料也可以留着修门。", {
        materials: -1,
        safety: 5,
      }),
      option("move", "把箱子抬高", "暂时应付，继续安排今天的任务。 "),
    ],
  },
  {
    title: "门后的旧日历",
    text: "旧日历已经翻过好几页。有人把重要的经历补在背面，名字、出发日期和归来的日期，一个都不省。",
    choices: () => [
      option(
        "record",
        "一起核对墙上的记录",
        "确认谁还在，谁仍没有消息。",
        {},
        3,
      ),
      pass(),
    ],
  },
  {
    title: "窗框上的冷风",
    text: "风从窗框裂口钻进来，纸地图被吹到地上。住所还站着，但每一处补丁都在老去。",
    choices: () => [
      option("window", "补好窗框", "材料一件，换更稳的住所。", {
        materials: -1,
        safety: 8,
      }),
      pass(),
    ],
  },
  {
    title: "药盒上的说明书",
    text: "药盒的字快被磨掉了。邻居想用食物换药。留下说明书，把真正的药换出去，还是继续备着？",
    choices: () => [
      option("medicine-food", "用一份药换食物", "这会减少急救余地。", {
        medicine: -1,
        food: 3,
      }),
      pass(),
    ],
  },
  {
    title: "一顿很小的饭",
    text: "饥饿让话变得尖锐。有人把一份口粮放到桌子中间，想让还在屋里的人坐下来，把分工说清楚。",
    choices: () => [
      option(
        "share-table",
        "分出一份食物坐一会儿",
        "只是额外的一小份，仍需正常晚间配给。",
        { food: -1 },
        6,
      ),
      pass(),
    ],
  },
];
export function longEvent(state: GameState): StoryEvent {
  const day = state.day,
    dead = state.people.filter((p) => !p.alive),
    home = residents(state);
  if (day === DAY_LIMIT)
    return {
      day,
      title: "第一百道刻痕",
      text: `墙上终于有了一百道刻痕。屋里还坐着${home.length}个人。${dead.length ? dead.map((p) => PEOPLE[p.id].name).join("、") + "的名字留在旧日历上，没能陪大家走到这里。" : "每一个留下的人，都记得这一路有多难。"}最后一晚仍要吃饭、照护和守门，活过今天才算走完这段路。`,
      choices: [
        option("remember", "记下每一位家人的名字", "把这一百天留下来。"),
        option(
          "last-meal",
          "分出一份口粮坐在一起",
          "今晚的配给仍需安排。",
          { food: -1 },
          6,
        ),
      ],
    };
  if (day % 10 === 0)
    return {
      day,
      title: `第${day}道刻痕`,
      text: `又走过十天。${home.map((p) => PEOPLE[p.id].name).join("、")}核对了物资和人员记录。${dead.length ? "有些名字已经只能写在回忆里。" : "门边的留言板还留着所有人的名字。"}离一百天还有${DAY_LIMIT - day}天，今天也不能省略吃饭和照护。`,
      choices: [
        option("mark", "核对名字与日期", "记录不会替代实际补给。", {}, 3),
        pass(),
      ],
    };
  const chapter = chapters[(day - 8) % chapters.length];
  return {
    day,
    title: chapter.title,
    text: chapter.text,
    choices: chapter.choices(),
  };
}
