"use client";
import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPersonWalkingArrowRight,
  faMoon,
  faHouse,
} from "@fortawesome/free-solid-svg-icons";
import { PEOPLE, portraitStyle } from "@/game/config";
import { outingError } from "@/game/family-mode";
import { residents } from "@/game/presence";
import { attitude } from "@/game/attitude";
import { GEAR, GEAR_IDS, gearAvailable, OUTSIDE } from "@/game/shelter";
import { supplyNeed } from "@/game/supplies";
import { gearIcons } from "./shelter-desk";
import type { GameState, GearId, Location, PersonId } from "@/game/types";
import type { Action } from "@/game/reducer";
import { Tag } from "./primitives";

export function OutingPicker({
  state,
  send,
}: {
  state: GameState;
  send: (a: Action) => void;
}) {
  const [location, setLocation] = useState<Location>(
    state.resources.water < state.resources.food ? "water" : "food",
  );
  const [gear, setGear] = useState<GearId | undefined>(undefined);
  const [selected, setSelected] = useState<PersonId | null>(null);
  const home = residents(state);
  const refused =
    selected &&
    !state.flags.outingSent &&
    state.flags[`outingRefused:${selected}`];
  const sent = state.expeditions.find((t) => t.departedDay === state.day);
  return (
    <section className="outing-panel" aria-label="今天谁外出">
      <div className="outing-heading">
        <div>
          <p className="eyebrow">
            DAY {String(state.day).padStart(3, "0")} · MORNING
          </p>
          <h2>今天，谁出去找补给？</h2>
          <p className="muted">
            点一位在家的家人。也可以都留下，等门外的脚步声。
          </p>
        </div>
        <Tag>{home.length} 人在家</Tag>
      </div>
      {!state.flags.outingSent && (
        <div className="outing-destinations" role="group" aria-label="寻找什么">
          {(["food", "water"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={location === value}
              onClick={() => setLocation(value)}
            >
              {value === "food" ? "寻找食物" : "寻找饮水"}
            </button>
          ))}
        </div>
      )}
      {state.shelter && !state.flags.outingSent && (
        <div className="outing-kit">
          <p>
            <strong>{OUTSIDE[state.shelter.outside].name}</strong> ·{" "}
            {OUTSIDE[state.shelter.outside].text}
          </p>
          <label>
            带哪件道具？
            <select
              aria-label="外出携带道具"
              value={gear ?? ""}
              onChange={(e) =>
                setGear(e.target.value ? (e.target.value as GearId) : undefined)
              }
            >
              <option value="">不带道具 · 留给家里</option>
              {GEAR_IDS.map((g) => (
                <option key={g} value={g} disabled={!gearAvailable(state, g)}>
                  {GEAR[g].name}
                  {!gearAvailable(state, g) ? "（不在家中）" : ""} ·{" "}
                  {GEAR[g].use}
                </option>
              ))}
            </select>
          </label>
          {gear && (
            <small>
              <FontAwesomeIcon icon={gearIcons[gear]} />{" "}
              带走后家中无法使用，可能在路上损坏或丢失。
            </small>
          )}
        </div>
      )}
      <div className="outing-people">
        {home.map((p) => {
          const error = outingError(state, p.id, location);
          return (
            <button
              key={p.id}
              className={`outing-person ${selected === p.id ? "selected" : ""}`}
              disabled={!!error}
              aria-label={`让${PEOPLE[p.id].role.split(" · ")[0]}${PEOPLE[p.id].name}外出`}
              onClick={() => {
                setSelected(p.id);
                send({ type: "outing", id: p.id, location, gear });
              }}
            >
              <span className="outing-portrait" style={portraitStyle(p.id)} />
              <strong>{PEOPLE[p.id].role.split(" · ")[0]}</strong>
              <span>{PEOPLE[p.id].name}</span>
              <small>
                {error ? (
                  state.flags.outingSent ? (
                    "今天留守"
                  ) : error.includes("最后") ? (
                    "必须留守"
                  ) : (
                    "需要休息"
                  )
                ) : (
                  <>
                    <FontAwesomeIcon icon={faPersonWalkingArrowRight} />{" "}
                    点击派出
                  </>
                )}
              </small>
            </button>
          );
        })}
      </div>
      {refused && selected && (
        <div
          className="outing-response"
          role="status"
          aria-label="家人拒绝外出"
        >
          <div className="avatar" style={portraitStyle(selected)} />
          <div>
            <strong>{PEOPLE[selected].role.split(" · ")[0]}拒绝外出</strong>
            <p>
              “
              {attitude(state, selected, {
                kind: "search",
                location,
              }).reasons.join(" ")}
              ”
            </p>
            <div className="button-row">
              <button
                className="force-outing"
                onClick={() =>
                  send({
                    type: "outing",
                    id: selected,
                    location,
                    force: true,
                    gear,
                  })
                }
              >
                强制{PEOPLE[selected].role.split(" · ")[0]}外出
              </button>
              <button onClick={() => setSelected(null)}>换个人出去</button>
            </div>
            <small>强制的代价：情绪 −10，信任 −8。</small>
          </div>
        </div>
      )}
      {state.flags.outingSent && sent && (
        <p className="outing-sent" role="status">
          <FontAwesomeIcon icon={faPersonWalkingArrowRight} />{" "}
          {PEOPLE[sent.person].name}已经出发。归期未知，今天其余人留守。
        </p>
      )}
      {home.length === 1 && (
        <p className="warning">
          <FontAwesomeIcon icon={faHouse} />{" "}
          最后一人必须留守，无法再派出。照顾好自己，等待家人归来。
        </p>
      )}
    </section>
  );
}
export function EndDay({
  state,
  send,
}: {
  state: GameState;
  send: (a: Action) => void;
}) {
  const home = residents(state);
  const hungry = home.filter(
    (p) => supplyNeed(state, p, "food") !== "fine",
  ).length;
  const thirsty = home.filter(
    (p) => supplyNeed(state, p, "water") !== "fine",
  ).length;
  return (
    <section className="end-day-panel">
      <div>
        <h3>照顾完家人，就让今天过去吧。</h3>
        <p className={hungry || thirsty ? "warning" : "muted"}>
          {hungry || thirsty
            ? `有 ${hungry} 人需要食物、${thirsty} 人需要饮水。先看人物状态，再决定要不要省下这一份。`
            : "在家的家人暂时还能支撑。可以省下补给，也别忘了伤病。"}
        </p>
        <small>
          食物和水只在主动给予时扣除。
          {state.shelter?.incident.choice === null
            ? "未处理的记事将按‘暂不处理’结算。"
            : "今天的记事已经决定。"}
        </small>
      </div>
      <button className="primary" onClick={() => send({ type: "end-day" })}>
        <FontAwesomeIcon icon={faMoon} /> 结束今天
      </button>
    </section>
  );
}
