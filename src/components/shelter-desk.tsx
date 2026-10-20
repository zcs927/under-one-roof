"use client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faRadio,
  faShieldHalved,
  faHammer,
  faMap,
  faBook,
  faDice,
  faCheck,
  faBookOpen,
  faTruck,
} from "@fortawesome/free-solid-svg-icons";
import { PEOPLE } from "@/game/config";
import { GEAR, GEAR_IDS, gearCarrier, OUTSIDE } from "@/game/shelter";
import { incidentFor, incidentChoiceError } from "@/game/shelter-events";
import type { GameState, GearId } from "@/game/types";
import type { Action } from "@/game/reducer";
export const gearIcons: Record<GearId, typeof faRadio> = {
  radio: faRadio,
  mask: faShieldHalved,
  axe: faHammer,
  map: faMap,
  handbook: faBook,
  cards: faDice,
};
export function ShelterDesk({
  state,
  send,
}: {
  state: GameState;
  send: (a: Action) => void;
}) {
  const sh = state.shelter;
  if (!sh) return null;
  const incident = incidentFor(state),
    done = sh.incident.choice !== null;
  return (
    <div className="shelter-desk">
      <section
        id="today-journal"
        tabIndex={-1}
        className="incident-journal"
        aria-label="今日避难日记"
      >
        <div className="journal-heading">
          <span>
            <FontAwesomeIcon icon={faBookOpen} /> 避难日记
          </span>
          <small>第 {String(state.day).padStart(3, "0")} 页</small>
        </div>
        <h2>{incident.title}</h2>
        <p className="incident-story">{incident.text}</p>
        {done ? (
          <div className="incident-result" role="status">
            <strong>
              <FontAwesomeIcon icon={faCheck} />{" "}
              {incident.choices.find((c) => c.id === sh.incident.choice)
                ?.title ?? "暂不处理"}
            </strong>
            <p>{sh.incident.outcome}</p>
            <small>这件事已经记在今天的日记里。</small>
          </div>
        ) : (
          <div className="incident-options">
            {incident.choices.map((c) => {
              const error = incidentChoiceError(state, c);
              return (
                <button
                  key={c.id}
                  disabled={!!error}
                  onClick={() => send({ type: "incident", id: c.id })}
                >
                  <strong>
                    {c.gear && <FontAwesomeIcon icon={gearIcons[c.gear]} />}{" "}
                    {c.title}
                  </strong>
                  <span>{c.detail}</span>
                  {error && <small>{error}</small>}
                </button>
              );
            })}
            <button
              className="incident-leave"
              onClick={() => send({ type: "incident", id: "leave" })}
            >
              <strong>暂不处理</strong>
              <span>{incident.leave}</span>
            </button>
          </div>
        )}
      </section>
      <aside className="shelter-cabinet" aria-label="物品与救援">
        <div className="cabinet-heading">
          <span className="eyebrow">THE THINGS WE KEPT</span>
          <h3>带进来的，才是活路</h3>
          <p>道具各一件。带出门，就没法留在家里用。</p>
        </div>
        <div className="gear-grid">
          {GEAR_IDS.map((g) => {
            const carrier = gearCarrier(state, g),
              owned = !!sh.inventory[g];
            return (
              <div
                key={g}
                className={`gear-slot ${!owned ? "gear-missing" : carrier ? "gear-away" : ""}`}
                title={GEAR[g].use}
              >
                <FontAwesomeIcon icon={gearIcons[g]} />
                <strong>{GEAR[g].name}</strong>
                <small>
                  {!owned
                    ? "缺失 / 损坏"
                    : carrier
                      ? `${PEOPLE[carrier].role.split(" · ")[0]}带出`
                      : "在家可用"}
                </small>
                <span>{GEAR[g].use}</span>
              </div>
            );
          })}
        </div>
        <div className="rescue-track">
          <strong>
            <FontAwesomeIcon icon={faTruck} /> 第100天的车队{" "}
            <span>{sh.rescue}/3</span>
          </strong>
          <div className="rescue-steps">
            {["确认频率", "做出标记", "备好补给"].map((v, i) => (
              <span className={i < sh.rescue ? "complete" : ""} key={v}>
                {i < sh.rescue ? "✓" : i + 1} {v}
              </span>
            ))}
          </div>
          <p>
            {sh.rescue === 3
              ? "地址和名额已经确认，接下来要自己撑到第100天。"
              : sh.rescue === 0
                ? "先听清广播。熬到100天，还得让人知道我们在这里。"
                : sh.rescue === 1
                  ? "接下来要做屋顶标记。留意地图，别把每件有用的东西都带出去。"
                  : "标记已完成。留下一点饮水或修车物资，等下一次联络。"}
          </p>
        </div>
        <p className="outside-note">
          <strong>{OUTSIDE[sh.outside].name}</strong> ·{" "}
          {OUTSIDE[sh.outside].text}
        </p>
      </aside>
    </div>
  );
}
