"use client";
import type { CSSProperties } from "react";
import { GEAR, gearCarrier } from "@/game/shelter";
import { PEOPLE } from "@/game/config";
import type { GameState, GearId, Resource } from "@/game/types";
export type SceneObject = GearId | Resource | "journal" | "door";
export const OBJECT_NAMES: Record<SceneObject, string> = {
  food: "口粮箱",
  water: "储水壶",
  medicine: "急救箱",
  materials: "工具箱",
  safety: "门闩",
  journal: "家庭日记",
  door: "避难所的门",
  radio: "收音机",
  mask: "防护面罩",
  axe: "旧斧头",
  map: "街区地图",
  handbook: "生存手册",
  cards: "纸牌",
};
const gearPositions: Record<
  GearId,
  { left: number; top: number; width: number; slot: number }
> = {
  radio: { left: 35, top: 49, width: 14, slot: 0 },
  mask: { left: 29, top: 12, width: 7, slot: 1 },
  axe: { left: 1, top: 25, width: 8, slot: 2 },
  map: { left: 52, top: 60, width: 13, slot: 3 },
  handbook: { left: 71, top: 60, width: 7, slot: 4 },
  cards: { left: 65, top: 70, width: 5.5, slot: 5 },
};
const supplies: {
  id: "food" | "water" | "medicine" | "materials";
  left: number;
  top: number;
  width: number;
  height: number;
}[] = [
  { id: "food", left: 1, top: 66, width: 14, height: 15 },
  { id: "water", left: 17, top: 78, width: 10, height: 20 },
  { id: "medicine", left: 0, top: 84, width: 17, height: 15 },
  { id: "materials", left: 85, top: 82, width: 10, height: 15 },
];
export function SceneObjects({
  state,
  onObject,
  selectedGear,
  onJournal,
}: {
  state: GameState;
  onObject: (id: SceneObject) => void;
  selectedGear?: GearId;
  onJournal: () => void;
}) {
  return (
    <>
      {Object.entries(gearPositions).map(([key, pos]) => {
        const gear = key as GearId,
          carrier = gearCarrier(state, gear),
          present = !!state.shelter?.inventory[gear] && !carrier;
        return (
          <button
            key={gear}
            className={`room-prop prop-${gear} ${present ? "prop-present" : "prop-absent"} ${selectedGear === gear ? "prop-selected" : ""}`}
            style={
              {
                left: `${pos.left}%`,
                top: `${pos.top}%`,
                width: `${pos.width}%`,
                "--atlas-x": `${(pos.slot % 3) * 50}%`,
                "--atlas-y": `${Math.floor(pos.slot / 3) * 100}%`,
              } as CSSProperties
            }
            aria-label={`查看场景里的${GEAR[gear].name}${carrier ? "，" + PEOPLE[carrier].name + "带出" : !present ? "，目前缺失" : ""}`}
            onClick={() => onObject(gear)}
          >
            {present && <span className="prop-art" aria-hidden="true" />}
            <span className="prop-caption">
              {GEAR[gear].name}
              {carrier
                ? ` · ${PEOPLE[carrier].role.split(" · ")[0]}带出`
                : !present
                  ? " · 空位"
                  : ""}
            </span>
            {selectedGear === gear && <span className="prop-picked">已选</span>}
          </button>
        );
      })}
      {supplies.map((p) => (
        <button
          key={p.id}
          className={`room-supply supply-${p.id}`}
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.width}%`,
            height: `${p.height}%`,
          }}
          aria-label={`查看${OBJECT_NAMES[p.id]}，剩余${state.resources[p.id]}份`}
          onClick={() => onObject(p.id)}
        >
          <span className="supply-count">{state.resources[p.id]}</span>
          <span className="prop-caption">{OBJECT_NAMES[p.id]}</span>
        </button>
      ))}
      <button
        className="room-door"
        aria-label="查看门外与未归的家人"
        onClick={() => onObject("door")}
      >
        <span className="prop-caption">门外的消息</span>
      </button>
      <button
        className={`room-diary ${state.phase === "morning" && state.shelter?.incident.choice === null ? "diary-unread" : ""}`}
        aria-label="翻开桌上的家庭日记"
        onClick={onJournal}
      >
        <span className="diary-art" aria-hidden="true" />
        <span className="prop-caption">日记 · 今天的决定</span>
        <span className="diary-mark" aria-hidden="true">
          ✦
        </span>
      </button>
    </>
  );
}
