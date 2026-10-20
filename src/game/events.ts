import { PEOPLE, RESOURCE_NAMES } from "./config";
import { normalize } from "./initial";
import { signalAutonomy, resolveAutonomy } from "./autonomy";
import { unable } from "./tasks";
import { isAway } from "./expeditions";
import { departureError, isAlive, residents } from "./presence";
import { longEvent } from "./chronicle";
import type {
  GameState,
  StoryEvent,
  Autonomy,
  Resource,
  Choice,
} from "./types";
const choice = (
  id: string,
  title: string,
  detail: string,
  cost: string,
  requires?: Choice["requires"],
): Choice => ({ id, title, detail, cost, requires });
function buildEvent(state: GameState): StoryEvent {
  const home = residents(state);
  if (home.length === 1)
    return {
      day: state.day,
      title: "最后一名留守者",
      text: `屋里只剩${PEOPLE[home[0].id].name}一名活人。有人还在外面，也有人可能已经离世。不能再让住所空下来，今天只能用剩余物资维持，等门外的消息；如果始终没人回来，饥渴和伤病仍会继续。`,
      choices: [
        choice(
          "wait",
          "留在家里，等待消息",
          "不能外出。仍可使用现有药品、休息或维修，晚间照常消耗物资。",
          "没有新的物资收益",
        ),
      ],
    };
  if (home.length === 0)
    return {
      day: state.day,
      title: "空屋的一天",
      text: "屋里没有人。接雨的桶还在滴答作响，桌上的物资无人动过。今天只能等待远行者的消息。",
      choices: [
        choice(
          "wait",
          "等待家人的消息",
          "继续经过一天，不凭空维修或获得物资。",
          "无住所配给 · 安全度照常损耗",
        ),
      ],
    };
  const day = state.day;
  if (day > 7) return longEvent(state);
  if (day === 1)
    return {
      day,
      title: "停水之后",
      text: `${PEOPLE[state.player].opening}\n水龙头咳了一声，彻底停了。弟弟举起一只空罐头：‘五号水库准备好了。’没有人笑太久。窗上的木板松了，柜底也许还有遗漏的口粮，今天只能先顾一头。`,
      choices: [
        choice(
          "secure",
          "先加固门窗",
          "让家里的每一个人睡得安心一点。",
          "材料 −1 · 安全度 +8",
          { materials: 1 },
        ),
        choice(
          "inventory",
          "再找一遍家里的角落",
          "也许柜子里还有被忘记的东西。",
          "食物 +2",
        ),
      ],
    };
  if (day === 2)
    return {
      day,
      title: "邻居来借药",
      text: "门被敲了三下，停住，又敲两下——是隔壁约好的暗号。孩子烧得说胡话，邻居拿着一只空药盒。妈妈下意识去摸药箱，爸爸却先按住盖子：‘我们自己的呢？’弟弟不再摆弄罐头。给，还是留下，都得有人承担。",
      choices: [
        choice(
          "help",
          "给他们一份药",
          "我知道谁都不容易。希望这点药能帮到他们。",
          "药品 −1 · 林岚感到被理解",
          { medicine: 1 },
        ),
        choice(
          "decline",
          "说明我们的困难",
          "我们也需要为家人的身体留一点准备。",
          "保留药品",
        ),
      ],
    };
  if (day === 3) {
    const s = signalAutonomy(state),
      id = s.autonomy?.person;
    if (id && (!isAlive(state, id) || isAway(state, id)))
      return {
        day,
        title: "门边少了一只背包",
        text: `${PEOPLE[id].name}${isAlive(state, id) ? "还没有回来" : "已经离世"}。地图旁的铅笔停在原来的位置。今天先照顾留下的人。`,
        choices: [
          choice(
            "stay",
            "一起留在家里",
            "等待消息，照顾留守者。",
            "不消耗资源",
          ),
          choice(
            "stop",
            "先商量一个安全计划",
            "暂时不再催促远行的人。",
            "不消耗资源",
          ),
        ],
      };
    if (!id)
      return {
        day,
        title: "我也能做点什么",
        text: "大家的身体都不太适合出门。今天先照顾彼此，再慢慢寻找别的办法。",
        choices: [
          choice(
            "stay",
            "一起留在家里",
            "把今天交给休息与照护。",
            "不消耗资源",
          ),
          choice(
            "stop",
            "先商量一个安全计划",
            "今天没有家人会独自外出。",
            "不消耗资源",
          ),
        ],
      };
    return {
      day,
      title: "我也能做点什么",
      text: `${PEOPLE[id].name}站在门边，背着昨天就整理好的包。\n“我不是只能等着别人照顾。我熟悉那家食品店，让我做点什么吧。”\n你注意到地图上被反复圈起的路线，现在还有机会谈一谈。`,
      choices: [
        choice(
          "formal",
          "认真安排一次搜集",
          "把食品店交给对方，仍可协商装备。",
          "信任 +6 · 占用今日外出名额",
        ),
        choice(
          "stay",
          "听完想法，商量着留下",
          "在家维修、照护或休息，也是在帮助大家。",
          "信任 +3",
        ),
        choice(
          "stop",
          "直接阻止外出",
          "我现在没有办法接受你冒险。",
          "信任 −8 · 情绪 −5",
        ),
        choice(
          "ignore",
          "先不作回应",
          "继续沉默会让对方选择独自出门。",
          "自主搜集 · 健康 −8 · 无防护包",
        ),
      ],
    };
  }
  if (day === 4)
    return {
      day,
      title: "雨夜漏水",
      text: `${state.autonomy?.outcome === "formal" ? "昨天出门的人把湿地图晾在门后，那条路线没有白商量。" : state.autonomy?.outcome === "ignore" ? "门边还留着昨天独自出门踩下的泥印，谁也没提那件事。" : "门边的背包还在，有些话还没谈完。"}\n凌晨，雨水沿裂墙灌下来。弟弟给接水的锅排了号，叫它‘漏雨乐队’。爸爸没有接这个笑话：横梁又潮了一块。剩下的材料可以封窗，也可以先省下来，冒险多接一点水。`,
      choices: [
        choice(
          "patch",
          "用材料修补窗框",
          "先让今晚不那么潮湿。",
          "材料 −1 · 安全度 +8",
          { materials: 1 },
        ),
        choice(
          "water",
          "把容器放到漏水处",
          "接一点水，但住所会变得更潮湿。",
          "饮水 +2 · 安全度 −6",
        ),
      ],
    };
  if (day === 5)
    return {
      day,
      title: "门外的回音",
      text: state.flags.helped
        ? "门外又是三下、两下。那天发烧的孩子退烧了，邻居把几瓶水推过门缝：‘药不能白拿。’弟弟偷偷在门后画了一颗歪星星，但水还没多到可以放心喝。收下这份人情，还是让它再帮另一个人？"
        : "门外又是三下、两下。邻居没有再提借药，只把一瓶水举到猫眼前：‘换点吃的，公平交易。’爸爸问清数量，妈妈站得远了一些。末日里的关系，也会记账。",
      choices: state.flags.helped
        ? [
            choice(
              "gift",
              "收下回礼",
              "互相帮助，让人觉得日子还有盼头。",
              "饮水 +4",
            ),
            choice(
              "share",
              "请他们把水带给更需要的人",
              "我们还撑得住，也许有人更需要。",
              "所有家人的信任 +3",
            ),
          ]
        : [
            choice(
              "trade",
              "拿一份食物换水",
              "按商量好的条件交换。",
              "食物 −1 · 饮水 +3",
              { food: 1 },
            ),
            choice(
              "no",
              "今天先不交换",
              "认真道谢，把补给留给家里。",
              "不消耗资源",
            ),
          ],
    };
  if (day === 6)
    return {
      day,
      title: "修好那台收音机",
      text: `“${PEOPLE[state.player].radio}”\n收音机的沙沙声里，突然挤出半句‘……土豆……集合……’。弟弟立刻坐直：‘土豆特工来救我们了？’姐姐把纸抢过来：‘是图书馆！先记频率。’声音又断了。再拆一点材料试试，还是把它留给快撑不住的窗框？`,
      choices: [
        choice(
          "radio",
          "再试着修一次",
          "把一线希望留在今晚的声音里。",
          "材料 −1 · 获得援助信息",
          { materials: 1 },
        ),
        choice(
          "keep",
          "先把材料留下",
          "我们也需要随时修补这个家。",
          "保留材料",
        ),
      ],
    };
  return {
    day,
    title: "今晚坐在一起",
    text: `${state.flags.radio ? "姐姐把‘图书馆集合’的纸条压在收音机下。至少，明天有了方向。" : "收音机依旧沉默，地图上没有新的集合点。明天还得靠自己。"}\n第七天，弟弟把最完整的一只罐头当花瓶，插了一根干树枝。‘这叫末日大餐。’爸爸把摇晃的桌腿垫稳。大家看着剩下的口粮：分出一点坐下来吃，还是忍一忍，先把屋子收拾牢？`,
    choices: [
      choice(
        "dinner",
        "分出一点食物，坐下来吃饭",
        "这顿饭很简单，但大家都在。",
        "食物 −1 · 全家情绪 +8 · NPC信任 +4",
        { food: 1 },
      ),
      choice(
        "tidy",
        "一起把住所整理好",
        "留一点食物，让明天的家更安全。",
        "安全度 +4",
      ),
    ],
  };
}
export function eventFor(state: GameState): StoryEvent {
  const event = buildEvent(state);
  for (const person of state.people.filter(
    (p) => !p.alive || isAway(state, p.id),
  )) {
    const role = PEOPLE[person.id].role.split(" · ")[0];
    event.text = event.text.replaceAll(role, "留守的家人");
  }
  if (state.day === 4 && state.autonomy && isAway(state, state.autonomy.person))
    event.text = event.text.replace(
      "昨天出门的人把湿地图晾在门后，那条路线没有白商量。",
      "昨天出门的人还没回来，地图旁的空位让人不安。",
    );
  if (state.day === 6 && isAway(state, state.player))
    event.text = event.text.replace(
      `“${PEOPLE[state.player].radio}”`,
      "留守者又试了一遍收音机。",
    );
  return event;
}
export function choiceError(state: GameState, c: Choice): string | undefined {
  for (const [key, value] of Object.entries(c.requires ?? {}))
    if (state.resources[key as Resource] < (value ?? 0))
      return `${RESOURCE_NAMES[key as Resource]}不足`;
  if (
    state.day === 3 &&
    c.id === "formal" &&
    state.autonomy &&
    (unable(state, state.autonomy.person) ||
      isAway(state, state.autonomy.person) ||
      departureError(state, state.autonomy.person))
  )
    return "身体或留守人数不允许这次外出";
  return undefined;
}
export function chooseEvent(
  state: GameState,
  id: string,
): { state: GameState; error?: string } {
  if (state.choices[String(state.day)]) return { state };
  if (state.phase !== "event") return { state, error: "当前不在事件阶段" };
  const c = eventFor(state).choices.find((c) => c.id === id);
  if (!c) return { state, error: "此事件选项不存在" };
  const error = choiceError(state, c);
  if (error) return { state, error };
  let next = structuredClone(state);
  if (id === "wait") {
    next.choices[String(state.day)] = id;
    next.phase = "planning";
    next.dayNotes.push(
      residents(state).length
        ? "最后的留守者没有外出，继续消耗存货等待消息。"
        : "空屋无人执行事件，继续等待消息。",
    );
    return { state: next };
  }
  const change = (key: Resource, delta: number) => {
    const before = next.resources[key];
    next.resources[key] += delta;
    next.eventChanges.push({
      label: RESOURCE_NAMES[key],
      before,
      delta,
      after: next.resources[key],
      reason: eventFor(state).title,
    });
  };
  if (state.day === 1) {
    if (id === "secure") {
      change("materials", -1);
      change("safety", 8);
    } else change("food", 2);
  }
  if (state.day > 7) {
    for (const [key, delta] of Object.entries(c.effects ?? {}))
      change(key as Resource, delta ?? 0);
    if (c.moodDelta)
      for (const person of residents(next)) person.mood += c.moodDelta;
  }
  if (state.day === 2 && id === "help") {
    change("medicine", -1);
    next.flags.helped = true;
    const mom = next.people.find((p) => p.id === "mom")!;
    if (mom.alive) {
      if (mom.trust !== undefined) mom.trust += 5;
      else mom.mood += 5;
    }
  }
  if (state.day === 3)
    next = resolveAutonomy(next, id as NonNullable<Autonomy["outcome"]>);
  if (state.day === 4) {
    if (id === "patch") {
      change("materials", -1);
      change("safety", 8);
    } else {
      change("water", 2);
      change("safety", -6);
    }
  }
  if (state.day === 5) {
    if (id === "gift") change("water", 4);
    if (id === "share")
      for (const p of next.people)
        if (p.alive && p.trust !== undefined) p.trust += 3;
    if (id === "trade") {
      change("food", -1);
      change("water", 3);
    }
  }
  if (state.day === 6 && id === "radio") {
    change("materials", -1);
    next.flags.radio = true;
  }
  if (state.day === 7) {
    if (id === "dinner") {
      change("food", -1);
      for (const p of residents(next)) {
        p.mood += 8;
        if (p.trust !== undefined) p.trust += 4;
      }
    } else change("safety", 4);
  }
  next.choices[String(state.day)] = id;
  next.phase = "planning";
  next.dayNotes.push(`${eventFor(state).title}：${c.title}`);
  const aftermath: Record<string, string> = {
    secure: "爸爸用最后一颗钉子锁住木板。门外一声响，屋里四个人都停了手。",
    inventory:
      "姐姐从柜底翻出两份口粮。弟弟说这是‘五号仓库’，伸出的手又缩了回去。",
    help: "药盒从门缝递出去。妈妈松开肩膀，爸爸重新数了一遍剩药。",
    decline: "门外脚步远了。药还在，妈妈却把药箱盖了很久才扣上。",
    patch: "雨被挡在窗外。爸爸看着空了的材料盒，开始拆旧家具上的螺丝。",
    water: "锅里多了水，墙上的湿痕也长了一截。弟弟把睡垫往干处拖。",
    gift: "四瓶水排在桌上，弟弟想画星星，姐姐先在瓶盖写了日期。",
    share: "水被带走了。四个人没多喝一口，却记住了门外还有别的家。",
    trade: "交换隔着门缝完成。姐姐把每一份食物和水都记在账本上。",
    no: "门再次锁好。爸爸把食物放回原处，谁也没问邻居还会不会来。",
    radio: "‘图书馆，白天集合。’这次听清了。弟弟划掉‘土豆特工’，认真抄下路线。",
    keep: "收音机被关掉。剩下的材料还在，屋里重新只剩接雨的滴答声。",
    dinner:
      "四个人分着简单的饭，没有谁真的吃饱。桌子却终于不只是清点物资的地方。",
    tidy: "爸爸拧紧门闩，妈妈收药，姐姐叠地图，弟弟倒掉积水。今晚先守住这里。",
  };
  if (aftermath[id]) {
    let line = aftermath[id];
    for (const absent of state.people.filter(
      (p) => !p.alive || isAway(state, p.id),
    ))
      line = line.replaceAll(
        PEOPLE[absent.id].role.split(" · ")[0],
        "留守的家人",
      );
    if (residents(state).length !== 4)
      line = line.replaceAll("四个人", "留守的人");
    next.dayNotes.push(line);
  }
  return { state: normalize(next) };
}
