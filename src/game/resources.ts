import { IDS } from "./config";
import type { GameState } from "./types";
import { normalize } from "./initial";
import { residents } from "./presence";
import { settleSurvivalSupplies } from "./supplies";
export function reservations(state: GameState) {
  const tasks = Object.values(state.plan.tasks);
  return {
    food: tasks.filter((t) => t.extraFood && t.kind !== "rest").length,
    medicine: state.plan.medicineTarget ? 1 : 0,
    materials: tasks.filter((t) => t.kind === "repair").length,
    protection: state.shelter
      ? 0
      : tasks.filter((t) => t.protected).length +
        Number(!!state.flags.protectionLost) +
        state.expeditions.filter(
          (t) => t.returnedDay === null && t.lostDay === null && t.protected,
        ).length,
  };
}
export function reservationErrors(state: GameState): string[] {
  const r = reservations(state),
    errors: string[] = [];
  if (r.food > state.resources.food) errors.push("额外口粮超过现有食物");
  if (r.medicine > state.resources.medicine) errors.push("没有足够的药品");
  if (r.materials > state.resources.materials)
    errors.push("维修安排超过现有材料");
  if (r.protection > 1) errors.push("全家只有一个防护包");
  if (IDS.filter((id) => state.plan.tasks[id].kind === "search").length > 1)
    errors.push("每天最多一人外出");
  const promise = state.promises.find(
    (p) => p.status === "pending" && p.kind === "medicine",
  );
  if (
    promise &&
    state.plan.medicineTarget &&
    state.plan.medicineTarget !== promise.person
  )
    errors.push("药品已经承诺给另一名家人，请先取消治疗并处理失信提示");
  return errors;
}
export function rationPreview(state: GameState) {
  const r = reservations(state),
    home = residents(state);
  const unfed = home.filter(
    (p) => p.fedDay !== state.day && p.refusedFoodDay !== state.day,
  ).length;
  const unwatered = home.filter(
    (p) => p.wateredDay !== state.day && p.refusedWaterDay !== state.day,
  ).length;
  const amount = (n: number) =>
    state.plan.ration === "manual"
      ? 0
      : state.plan.ration === "save"
        ? Math.ceil(n / 2)
        : n;
  const foodCost = amount(unfed),
    waterCost = amount(unwatered);
  return {
    cost: Math.max(foodCost, waterCost),
    foodCost,
    waterCost,
    foodLeft: Math.max(0, state.resources.food - r.food - foodCost),
    waterLeft: Math.max(0, state.resources.water - waterCost),
    shortage:
      Math.max(0, foodCost - state.resources.food + r.food) +
      Math.max(0, waterCost - state.resources.water),
    unserved: home.filter(
      (p) => p.fedDay !== state.day || p.wateredDay !== state.day,
    ).length,
    withheld: home.filter(
      (p) => p.refusedFoodDay === state.day || p.refusedWaterDay === state.day,
    ).length,
    reserved: r,
  };
}
export function consumeRations(state: GameState): GameState {
  if (state.shelter) return settleSurvivalSupplies(state);
  const next = structuredClone(state),
    home = residents(next),
    preview = rationPreview(next);
  const foodEnough = next.resources.food >= preview.foodCost,
    waterEnough = next.resources.water >= preview.waterCost;
  next.resources.food = Math.max(0, next.resources.food - preview.foodCost);
  next.resources.water = Math.max(0, next.resources.water - preview.waterCost);
  let hungry = 0,
    thirsty = 0;
  for (const p of home) {
    const ate =
      p.fedDay === state.day ||
      (next.plan.ration !== "manual" &&
        p.refusedFoodDay !== state.day &&
        foodEnough);
    const drank =
      p.wateredDay === state.day ||
      (next.plan.ration !== "manual" &&
        p.refusedWaterDay !== state.day &&
        waterEnough);
    p.hungryDays = ate ? 0 : p.hungryDays + 1;
    p.thirstyDays = drank ? 0 : p.thirstyDays + 1;
    if (ate) p.fedDay = state.day;
    else hungry++;
    if (drank) p.wateredDay = state.day;
    else thirsty++;
    const reduced = next.plan.ration === "save" ? 3 : 0;
    p.health -= reduced + (ate ? 0 : 8) + (drank ? 0 : 12);
    p.mood -= reduced + (ate ? 0 : 3) + (drank ? 0 : 3);
  }
  if (hungry || thirsty)
    next.dayNotes.push(
      `今晚${hungry}人缺食物，${thirsty}人缺水；未喂食或选择暂不给的人会继续恶化，可能死亡。`,
    );
  return normalize(next);
}
