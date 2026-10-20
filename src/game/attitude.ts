import { getPerson } from "./initial";
import { reservationErrors } from "./resources";
import { taskError } from "./tasks";
import type { Attitude, GameState, PersonId } from "./types";
export function attitude(
  state: GameState,
  id: PersonId,
  task = state.plan.tasks[id],
): Attitude {
  const physical = taskError(state, id, task);
  if (physical)
    return { level: "refuse", score: -999, reasons: [physical], hard: true };
  if (
    task.kind === "rest" ||
    (id === state.player && !state.flags.familyManagement)
  )
    return {
      level: "accept",
      score: 100,
      reasons: [
        task.kind === "rest"
          ? "休息能让我恢复一点精神。"
          : "这是我自己作出的决定。",
      ],
      hard: false,
    };
  const resourceError = reservationErrors(state)[0];
  if (resourceError)
    return {
      level: "refuse",
      score: -999,
      reasons: [resourceError],
      hard: true,
    };
  const p = getPerson(state, id),
    reasons: { value: number; text: string }[] = [];
  let score = 10;
  const add = (value: number, text: string) => {
    score += value;
    reasons.push({ value, text });
  };
  if ((p.trust ?? 60) >= 65) add(15, "你兑现过承诺，我愿意相信你。");
  else if ((p.trust ?? 60) < 40) add(-15, "之前的事让我不太敢相信这个安排。");
  if (p.health <= 50 || p.fatigue >= 60)
    add(-20, "我现在的身体实在有些吃不消。");
  if (
    (id === "dad" && task.kind === "repair") ||
    (id === "daughter" && task.kind === "search") ||
    (["mom", "brother"].includes(id) && task.kind === "care")
  )
    add(10, "这是我擅长的事。");
  if (
    state.day === 1 &&
    state.flags[`firstConcern:${id}`] &&
    task.kind === "search"
  )
    add(-20, "外面的情况还不清楚，我需要多一点保障。");
  else if (
    state.autonomy?.person === id &&
    !state.autonomy.resolved &&
    task.kind === "search"
  )
    add(10, "我想证明自己也能帮上忙。");
  else if (
    state.flags[`support:${id}`] &&
    ["care", "repair"].includes(task.kind)
  )
    add(10, "留在家里也有值得我做的事。");
  if (task.explained) add(10, "你认真向我解释了这次安排。");
  if (task.protected && task.kind === "search")
    add(15, "有防护包会让我安心一些。");
  if (task.extraFood) add(10, "多一份口粮让我有力气做事。");
  if (state.promises.some((p) => p.person === id && p.status === "pending"))
    add(10, "我记得你答应过我的事。");
  const sorted = reasons.sort((a, b) => a.value - b.value);
  return {
    level: score >= 20 ? "accept" : score >= 0 ? "concern" : "refuse",
    score,
    reasons: sorted.length
      ? sorted.slice(0, 2).map((r) => r.text)
      : ["我可以试试，不过还有点担心。"],
    hard: false,
  };
}
