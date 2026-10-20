import { DAY_LIMIT, PEOPLE } from "./config";
import type { Ending, GameState } from "./types";
import { isAway, residents } from "./presence";
export function evaluateEnding(state: GameState): Ending | null {
  if (!state.settled.includes(state.day)) return null;
  const living = state.people.filter((p) => p.alive),
    home = residents(state),
    dead = state.people.filter((p) => !p.alive);
  const highlights = dead.map(
    (p) => `${PEOPLE[p.id].name} · 第${p.deathDay}天死亡 · ${p.deathReason}`,
  );
  if (!living.length)
    return {
      kind: "extinct",
      title: "最后一盏灯熄灭",
      text: `第${state.day}天，最后一位家人也没能撑过去。屋里再没有人清点水、修门或等待脚步声。这一家的生存记录停在了今天。`,
      highlights,
    };
  const missing = living.filter((p) => isAway(state, p.id));
  if (!home.length)
    return {
      kind: "abandoned",
      title: "住所里没有活着的留守者了",
      text: `第${state.day}天，住所失去了最后一名留守者。${missing.map((p) => PEOPLE[p.id].name).join("、")}仍在外面，没能及时赶回来。无人维持的避难所已经失守，生存到此结束。`,
      highlights: [
        ...highlights,
        ...missing.map((p) => `${PEOPLE[p.id].name} · 外出未归`),
      ],
    };
  if (state.day < DAY_LIMIT) return null;
  const trust = living.filter((p) => p.trust !== undefined),
    average = trust.length
      ? trust.reduce((n, p) => n + (p.trust ?? 0), 0) / trust.length
      : 60;
  if (state.shelter?.rescue === 3)
    return {
      kind: "together",
      title:
        dead.length || missing.length
          ? "车队来了，带着空位出发"
          : "第一百天，终于有人敲对了门",
      text: `公路上的喇叭响了三短一长。墙上的标记、交出去的水和收音机里记下的口令，终于换来了这一刻。${home.length}位家人登上车。${missing.length ? missing.map((p) => PEOPLE[p.id].name).join("、") + "仍然没有回来，车队不能再等了。" : ""}${dead.length ? "有些名字只能由活着的人带走。" : "弟弟问司机，车上能不能喝一口不用数着分的水。"}`,
      highlights: [
        ...highlights,
        "确认广播频率、完成屋顶标记、准备车队补给：救援准备3/3",
        ...state.memories
          .slice(-2)
          .map((m) => `第${m.day}天 · ${PEOPLE[m.person].name}：${m.text}`),
      ],
    };
  if (missing.length)
    return {
      kind: "help",
      title: "百日之后，仍有人未归",
      text: `第100晚，屋里有${home.length}名幸存者。${missing.map((p) => PEOPLE[p.id].name).join("、")}仍没有消息。我们活到了约定的日子，却没能让所有人回到屋里。`,
      highlights: [
        ...highlights,
        ...missing.map((p) => `${PEOPLE[p.id].name} · 仍在外，归期未知`),
      ],
    };

  return {
    kind: average >= 60 ? "together" : "distance",
    title: dead.length
      ? "带着空位，活到第一百天"
      : average >= 60
        ? "一百天后的同一张饭桌"
        : "活下来之后，还有话要说",
    text: `${home.length}个人守到了第100晚。${dead.length ? "逝去家人的位置已经空了很久，他们的名字仍写在墙上。" : "四个人都还活着，这件事本身就很难。"}物资仍需精打细算，门窗仍要修补，但你们已经走过了最初的一百天。`,
    highlights: [
      ...highlights,
      ...state.memories
        .slice(-2)
        .map((m) => `第${m.day}天 · ${PEOPLE[m.person].name}：${m.text}`),
    ],
  };
}
