import type { PersonDefinition, PersonId } from "./types";
import { assetUrl } from "./assets";
export const IDS: PersonId[] = ["mom", "dad", "daughter", "brother"];
export const DAY_LIMIT = 100;
export const LIFE_DEFAULTS = {
  alive: true,
  deathDay: null,
  deathReason: null,
  hungryDays: 0,
  thirstyDays: 0,
  criticalDays: 0,
  fedDay: null,
  wateredDay: null,
  refusedFoodDay: null,
  refusedWaterDay: null,
};
const portrait = () => "/images/survivor-family-atlas.png";
export const PORTRAIT_POSITIONS: Record<PersonId, string> = {
  mom: "0% 0%",
  dad: "100% 0%",
  daughter: "0% 100%",
  brother: "100% 100%",
};
export const portraitStyle = (id: PersonId) => ({
  backgroundImage: `url('${assetUrl(PEOPLE[id].photo)}')`,
  backgroundSize: "200% 200%",
  backgroundPosition: PORTRAIT_POSITIONS[id],
});
export const PEOPLE: Record<PersonId, PersonDefinition> = {
  mom: {
    ...LIFE_DEFAULTS,
    id: "mom",
    name: "林岚",
    role: "妈妈 · 社区志愿者",
    personality: "温和、坚定，习惯照顾别人",
    wish: "不愿轻易放弃前来求助的人。",
    skill: "照护额外恢复 5 点情绪",
    health: 85,
    fatigue: 20,
    mood: 65,
    trust: 60,
    photo: portrait(),
    opening:
      "群聊安静了。我把最后几条求助消息抄在纸上，告诉自己，先照顾好家里的人。",
    radio: "如果有人能听见，我们这一栋还有人。",
  },
  dad: {
    ...LIFE_DEFAULTS,
    id: "dad",
    name: "周衡",
    role: "爸爸 · 维修工",
    personality: "可靠、固执，总想独自承担",
    wish: "想保护家人，却不愿承认自己累了。",
    skill: "维修额外增加 8 点安全度",
    health: 75,
    fatigue: 35,
    mood: 60,
    trust: 60,
    photo: portrait(),
    opening: "门锁还能用。我把工具箱放在手边，希望他们没看见我发抖的手。",
    radio: "给我一段电线。只要还没坏透，总能修好。",
  },
  daughter: {
    ...LIFE_DEFAULTS,
    id: "daughter",
    name: "周小满",
    role: "姐姐 · 17 岁学生",
    personality: "敏锐、勇敢，希望被认真对待",
    wish: "想证明自己也能承担责任。",
    skill: "搜集额外获得食物/饮水 2，材料 1",
    health: 90,
    fatigue: 10,
    mood: 55,
    trust: 55,
    photo: portrait(),
    opening:
      "我比他们更熟悉这几条街。可在他们眼里，我似乎永远是需要保护的那个。",
    radio: "这次让我试试。我真的知道该怎么调。",
  },
  brother: {
    ...LIFE_DEFAULTS,
    id: "brother",
    name: "周小豆",
    role: "弟弟 · 10 岁小学生",
    personality: "机灵、嘴硬，害怕时会不停说话",
    wish: "我能递水、拿绷带。别把我一直藏在柜子后面。",
    skill: "照护额外恢复 5 点健康",
    health: 65,
    fatigue: 20,
    mood: 60,
    trust: 60,
    photo: portrait(),
    opening:
      "我给每个空罐头编了号。三号负责接漏雨，四号负责报警。妈妈说，五号先别敲，外面可能有人。",
    radio: "等等，刚才那个声音不是怪物吧？我把它记下来了。",
  },
};
export const INITIAL_RESOURCES = {
  food: 3,
  water: 2,
  medicine: 3,
  materials: 3,
  safety: 60,
};
export const WEATHER = [
  "阴天 · 停水",
  "多云 · 微风",
  "阴天 · 街区寂静",
  "暴雨 · 低温",
  "雨停 · 潮湿",
  "薄雾 · 无信号",
  "晴天 · 新的一周",
];
export const TASK_NAMES = {
  rest: "休息",
  search: "外出搜集",
  repair: "维修住所",
  care: "照护家人",
};
export const LOCATION_NAMES = {
  food: "食品店",
  water: "供水点",
  materials: "五金店",
};
export const RESOURCE_NAMES = {
  food: "食物",
  water: "饮水",
  medicine: "药品",
  materials: "材料",
  safety: "安全度",
};
export const LIMITS = {
  unableHealth: 30,
  unableFatigue: 80,
  cautiousHealth: 50,
  cautiousFatigue: 60,
  trustHigh: 65,
  trustLow: 40,
  accept: 20,
  concern: 0,
  dailySafetyLoss: 4,
  endingSafety: 30,
  endingHealth: 30,
  endingTrust: 60,
};
