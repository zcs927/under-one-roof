import type { GameState, GearId } from "./types";
import { draw } from "./random";
export const GEAR: Record<GearId, { name: string; use: string }> = {
  radio: { name: "收音机", use: "在家接收救援广播；外出可联系水源" },
  mask: { name: "防护面罩", use: "抵御外出污染，也能过滤接来的雨水" },
  axe: { name: "旧斧头", use: "防守和清理虫害，降低外出遭遇危险" },
  map: { name: "街区地图", use: "缩短外出时间，绘制救援标记" },
  handbook: { name: "生存手册", use: "在家净水修补；外出更容易找到补给" },
  cards: { name: "纸牌", use: "在家缓解紧张；外出能换一点口粮" },
};
export const GEAR_IDS = Object.keys(GEAR) as GearId[];
export function gearCarrier(state: GameState, gear: GearId) {
  return state.expeditions.find(
    (t) => t.gear === gear && t.returnedDay === null && t.lostDay === null,
  )?.person;
}
export function gearAvailable(state: GameState, gear: GearId) {
  return !!state.shelter?.inventory[gear] && !gearCarrier(state, gear);
}
export function outsideFor(state: GameState): "high" | "medium" | "low" {
  if (state.day <= 3) return "high";
  const roll = draw(state);
  return roll < 0.2 ? "high" : roll < 0.6 ? "medium" : "low";
}
export const OUTSIDE = {
  high: {
    name: "辐尘浓重",
    text: "外面灰尘呛人。没带面罩的人容易受伤，宁可等，也别盲目出门。",
  },
  medium: {
    name: "街区有动静",
    text: "附近有人活动。斧头能防身，地图能帮助早点回来。",
  },
  low: {
    name: "短暂的安静",
    text: "风暂时停了。这是出门的好窗口，仍不能保证平安或收获。",
  },
};
