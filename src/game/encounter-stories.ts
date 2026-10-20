import {
  change,
  giveAid,
  mood,
  robbery,
  visitorClue,
  visitorSecret,
} from "./encounter-effects";
import type { GameState, Resource } from "./types";
export interface EncounterChoice {
  id: string;
  title: string;
  detail: string;
  cost?: Partial<Record<Resource, number>>;
  apply: (s: GameState) => string;
}
export interface EncounterDefinition {
  id: string;
  title: string;
  cue: string;
  text: string;
  question: string;
  reply: (s: GameState) => string;
  choices: EncounterChoice[];
  leave: string;
}
const refuse = (title: string): EncounterChoice => ({
  id: "leave",
  title,
  detail: "不消耗物资 · 保持门锁关闭",
  apply: () =>
    "你隔门拒绝了。外面的人等了片刻才离开。家中的物资保住了，也无从得知这次求助究竟是真是假。",
});
const gift = (
  resource: Resource,
  title: string,
  text: string,
  opened = false,
): EncounterChoice => ({
  id: opened ? "open" : "give",
  title,
  detail: `${resource === "food" ? "食物" : resource === "water" ? "饮水" : "药品"} −1 · ${opened ? "开门有被偷、被抢和受伤的风险" : "隔门较谨慎，但仍可能被骗"}`,
  cost: { [resource]: 1 },
  apply: (s) => giveAid(s, text, opened),
});
export const stories: EncounterDefinition[] = [
  {
    id: "neighbor-food",
    title: "隔壁老陈来敲门",
    cue: "咚、咚……三声很轻的敲门。",
    text: "门缝底下塞进来一张油污纸条：‘我是隔壁老陈。孩子已经两天没吃东西了，能不能借一罐吃的？’隔着厚厚的门板，声音听起来有些陌生。架子上的口粮，我们自己也得省着吃。",
    question: "门外真是认识的邻居吗？",
    reply: visitorClue,
    choices: [
      gift(
        "food",
        "从门缝递出一份食物",
        "你只拉开一道窄缝，把罐头递了出去。他抱紧它，说了两次谢谢。脚步声很快消失了。这份帮助能否换来平安或回报，还要等以后才知道。",
      ),
      gift(
        "food",
        "开门让他进来取食物",
        "你把人让到门边。他没有多拿东西，只抱着一罐食物离开，说若找到补给会再来。屋里的人松了一口气。",
        true,
      ),
      refuse("把口粮留给家里"),
    ],
    leave:
      "你没有回应。纸条在门缝里等了一会儿，被悄悄抽走了。今天的口粮没有减少。",
  },
  {
    id: "child-water",
    title: "门外的小红靴",
    cue: "有个孩子在门外喊：‘有人吗？’",
    text: "透过门缝，你看见一双沾满灰的小红靴。孩子举着空瓶，说妈妈在楼下等他，能不能给一点水。楼梯间太暗，看不清后面是否还有别人。",
    question: "是孩子在求助，还是有人借孩子试探？",
    reply: visitorClue,
    choices: [
      gift(
        "water",
        "隔门递出一份水",
        "你递出水后便关紧门。孩子小声道谢，远处的女人接过瓶子，抱着他往楼下走。这一次，求助是真的。",
      ),
      gift(
        "water",
        "开门让孩子进来装水",
        "孩子在门边装好水，没有往屋里走。楼梯上的女人向你点了点头，他们一起离开了。",
        true,
      ),
      refuse("告诉他这里也没有余水"),
    ],
    leave: "你没有出声。空瓶碰了碰门，随后敲门声停了。",
  },
  {
    id: "barter-water",
    title: "一瓶水，一罐饭",
    cue: "门外响起金属杯轻碰的声音。",
    text: "一个裹着雨衣的陌生人愿用一份封口水换一份食物。他把瓶子放在门边，让你先看封口。但封条也能重新粘上，煮沸更无法消除所有污染。",
    question: "冒一点风险换水，还是把门打开做笔更大的交易？",
    reply: visitorClue,
    choices: [
      {
        id: "trade",
        title: "交换，拿回后先煮沸",
        detail: "食物 −1 · 真水可得饮水 +1，也可能是假货",
        cost: { food: 1 },
        apply(s) {
          if (visitorSecret(s).identity !== "honest") {
            mood(s, -3);
            return "食物递出后，陌生人转身就走。瓶子里散着刺鼻的油味，根本不能喝。你没把脏水算进饮水库存，白白损失了一份食物。";
          }
          change(s, "water", 1);
          return "你让他后退几步，交换后仔细检查并处理了饮水。瓶内没有异常，饮水 +1。这次交易是真的。";
        },
      },
      {
        id: "open",
        title: "开门验货，换两份水",
        detail: "食物 −1 · 成交可得饮水 +2；也可能遭抢",
        cost: { food: 1 },
        apply(s) {
          if (visitorSecret(s).identity === "raiders") return robbery(s);
          if (visitorSecret(s).identity === "fraud") {
            mood(s, -4);
            const stolen = -change(s, "water", -1);
            return `他趁你验货时抓起食物就跑，递来的瓶子装的是脏水。${stolen ? "门边还少了一份饮水。" : "幸好门边没有多余饮水可偷。"}这是一场骗局。`;
          }
          change(s, "water", 2);
          return "你在门边逐瓶验过水，他也当面检查了罐头。双方照约定交换了物资，饮水 +2。";
        },
      },
      refuse("不冒这个险"),
    ],
    leave: "陌生人没等到回应，带着瓶子离开了。",
  },
  {
    id: "messenger",
    title: "袖口渗血的送信人",
    cue: "有人把一封折好的信塞进门缝。",
    text: "年轻人说想替人送完最后几封信，胳膊却被碎玻璃割伤。他只求一点药。袖口的暗红痕迹看着像血，但门外的人把手藏得很深。",
    question: "要为一位陌生伤者动用家里的药吗？",
    reply: visitorClue,
    choices: [
      gift(
        "medicine",
        "递出一份药",
        "年轻人在门外包扎好伤口，把信压在门边，又继续往楼上走。纸上写着：‘如果你还在，我明天再来找你。’我们把它放在日记旁。",
      ),
      gift(
        "medicine",
        "开门替他包扎",
        "伤口是真的。你在门边替他包扎好，他把剩余干净布条留下，继续挨家送信。今晚有人记住了你们的帮助。",
        true,
      ),
      refuse("药要留给家人"),
    ],
    leave: "你没有回应。年轻人留下一个信封，脚步声慢慢远去。你没有打开门。",
  },
  {
    id: "stranger-family",
    title: "雨里的陌生一家",
    cue: "门板被雨水和敲击声一起打湿。",
    text: "一个女人抱着裹在毯子里的身影，说他们的屋顶塌了，只想进来躲一会儿雨。身后的男人一直低着头。也可能是真正无处可去的一家人，也可能有人躲在那条毯子后面。",
    question: "给一点吃的，还是让陌生人进屋？",
    reply: visitorClue,
    choices: [
      gift(
        "food",
        "隔门给一份食物，请他们另找住处",
        "你把食物递出去，告诉他们楼道尽头还有一间空屋。女人道了谢，一家人扶着走远。",
      ),
      {
        id: "open",
        title: "开门让他们进来避雨",
        detail: "不预先消耗 · 可能互助，也可能失窃或遭抢",
        apply(s) {
          const { identity } = visitorSecret(s);
          if (identity === "raiders") return robbery(s);
          if (identity === "fraud") {
            const water = -change(s, "water", -1),
              material = -change(s, "materials", -1);
            mood(s, -5);
            return `你去找干布的片刻，他们已不见了。${water || material ? `一同不见的还有${water ? `饮水${water}份` : ""}${water && material ? "、" : ""}${material ? `材料${material}份` : ""}。` : "他们翻乱了空箱子，什么也没找到。"}所谓一家人原来是在合伙行窃。`;
          }
          change(s, "water", 1);
          change(s, "materials", 1);
          mood(s, 3);
          return "毯子里是个熟睡的孩子。雨停前，男人帮你补好了窗缝，还留下一份水和一份修补材料。一家人随后去寻找自己的亲人，没有留下常住。";
        },
      },
      refuse("不开门，让他们继续找住处"),
    ],
    leave: "你熄灭靠门的灯，保持安静。敲门声终于被雨声盖住，脚步往别处去了。",
  },
  {
    id: "rescue-check",
    title: "自称救援队的人",
    cue: "‘救援登记！开门核对！’",
    text: "门外的人戴着袖章，声称在统计幸存者，想收一份口粮换取援助。他还要求进屋查看物资。袖章和证件都很旧，远处也听不到救援车辆的声音。",
    question: "这是救援人员，还是借登记寻找下手目标的人？",
    reply: visitorClue,
    choices: [
      {
        id: "give",
        title: "隔门交一份口粮，请他留下消息",
        detail: "食物 −1 · 可能获得帮助，也可能被假身份骗走",
        cost: { food: 1 },
        apply(s) {
          if (visitorSecret(s).identity === "honest") change(s, "safety", 5);
          return giveAid(
            s,
            "他没要求开门，留下真正能用的加固建议，还帮忙堵住门外的裂口。住所安全 +5。这不是救援名额的保证，但确实有人在帮忙。",
          );
        },
      },
      {
        id: "open",
        title: "开门让他进来登记",
        detail: "不预先消耗 · 可得到维修帮助，也可能被抢",
        apply(s) {
          if (visitorSecret(s).identity === "raiders") return robbery(s);
          if (visitorSecret(s).identity === "fraud") {
            const lost = -change(s, "food", -1);
            change(s, "safety", -5);
            mood(s, -4);
            return `他记下物资位置，收走${lost ? "一份食物" : "登记纸"}，说一会儿回来。你发现袖章背后只是旧衣布，才明白被骗了。对方还摸清了屋内布局，住所安全下降。`;
          }
          change(s, "safety", 8);
          mood(s, 2);
          return "他没有拿走物资，只检查了门锁并教家人补牢门框，住所安全 +8。他说资源不够，暂时无法保证撤离，让你们继续等广播。";
        },
      },
      refuse("不登记，也不透露家里的物资"),
    ],
    leave:
      "你没有回应。门外的人记了些什么，最后去了下一家。没有物资损失，也没有得到消息。",
  },
  {
    id: "neighbor-return",
    title: "又是那三声敲门",
    cue: "这个敲门的节奏，听过一次。",
    text: "‘上次那罐食物，谢谢了。’门外传来了似曾相识的声音。他说有消息要告诉你们。是邻居回来了，还是别人听说这间屋里还有补给？",
    question: "听他说完，还是直接开门迎接？",
    reply: visitorClue,
    choices: [
      {
        id: "listen",
        title: "隔着门听他说",
        detail: "不消耗物资 · 可能回报、坏消息或试探",
        apply(s) {
          const { identity, roll } = visitorSecret(s);
          if (identity !== "honest") {
            change(s, "safety", -3);
            mood(s, -3);
            return "那声音越听越不对。你拒绝开门，门外突然响起一脚踢门声：‘明明还有吃的！’他们试了门锁才离去。补给没丢，门板却受了损。上次的帮助似乎引来了别人的注意。";
          }
          if (roll < 0.45) {
            change(s, "water", 1);
            return "老陈把一份封口水留在门边，说是给你们留的。等脚步走远，你才把水拿回来。这次善意得到了回应，饮水 +1。";
          }
          if (roll < 0.75) {
            change(s, "safety", 3);
            return "老陈没带食水，只提醒楼下有人试门锁。你们顶牢了门后的柜子，住所安全 +3。他说自己也快撑不住了。";
          }
          mood(s, -2);
          return "老陈空着手回来。他说孩子仍在生病，能找到的口粮已经吃完，不知道还能去哪儿。我们没收到回礼，也没有更多物资可借，屋里的人沉默了很久。";
        },
      },
      {
        id: "open",
        title: "开门迎接熟悉的声音",
        detail: "不预先消耗 · 熟悉的敲门声也可能是诱饵",
        apply(s) {
          if (visitorSecret(s).identity !== "honest") return robbery(s);
          if (visitorSecret(s).roll < 0.5) {
            change(s, "food", 1);
            mood(s, 2);
            return "这次真是老陈。他带来一份食物，还告诉你隔壁街的近况。虽然不多，大家终于有了点盼头。";
          }
          mood(s, -2);
          return "老陈没有带来任何物资，只想坐一会儿。他的屋子已经空了，离开时也说不清下次能否再见。帮助过的人并不总有能力回报。";
        },
      },
      refuse("不回应，继续保持安静"),
    ],
    leave: "熟悉的敲门声没有得到回应，最终停了下来。",
  },
  {
    id: "marked-door",
    title: "粉笔记号下的脚步",
    cue: "没有喊声，只有门把手被轻轻转动。",
    text: "前些天递出物资后留下的粉笔记号还在。现在门外不止一双脚。有人低声说这间还有吃的，随后装出求助的语气，让你把门开开。",
    question: "他们似乎盯上了这间屋子。",
    reply: visitorClue,
    choices: [
      {
        id: "brace",
        title: "用一份材料加固门后",
        detail: "材料 −1，安全 +5 · 不开门，不透露库存",
        cost: { materials: 1 },
        apply(s) {
          change(s, "safety", 5);
          return "你们悄悄用木条抵住门板，材料 −1，住所安全 +5。对方试了几次没推开，只好作罢。那道粉笔记号被雨水冲淡了。";
        },
      },
      {
        id: "open",
        title: "开门与他们对质",
        detail: "高风险 · 可能被抢或受伤；留守和装备影响抵抗",
        apply: robbery,
      },
      refuse("熄灯，保持安静直到他们离开"),
    ],
    leave:
      "你们没有回应，屏住呼吸等着。门外的人最终以为这里已经空了，去找下一处目标。这一次没有失去物资。",
  },
];
