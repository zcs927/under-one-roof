"use client";
import { useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDoorClosed,
  faBookOpen,
  faArrowRight,
} from "@fortawesome/free-solid-svg-icons";
import { encounterChoiceError, encounterFor } from "@/game/encounters";
import type { GameState } from "@/game/types";
import type { Action } from "@/game/reducer";
import { residents } from "@/game/presence";
import { gearAvailable } from "@/game/shelter";
import { Modal } from "./primitives";

export function EncounterPopup({
  state,
  send,
  error,
}: {
  state: GameState;
  send: (a: Action) => void;
  error: string;
}) {
  const event = encounterFor(state),
    current = state.encounters?.current;
  const narrativeRef = useRef<HTMLParagraphElement>(null);
  const choice = current?.choice,
    asked = current?.asked;
  useEffect(() => {
    if (choice || asked) narrativeRef.current?.focus();
  }, [choice, asked]);
  if (!event || !current) return null;
  const resolved = current.choice !== null;
  return (
    <Modal
      title={event.title}
      className="doorstep-modal"
      onClose={() => send({ type: "encounter-close" })}
    >
      <div className="doorstep-cue" aria-hidden="true">
        <FontAwesomeIcon icon={resolved ? faBookOpen : faDoorClosed} />
        <span>第 {state.day} 天 · 门外的故事</span>
      </div>
      <p className="doorstep-sound">{event.cue}</p>
      <p className="doorstep-narrative">{event.text}</p>
      {current.asked && (
        <p
          className="doorstep-reply"
          role="status"
          ref={!resolved ? narrativeRef : undefined}
          tabIndex={-1}
        >
          {event.reply}
        </p>
      )}
      {resolved ? (
        <>
          <div className="doorstep-result" role="status">
            <small>这一刻，我们作了决定。</small>
            <p ref={narrativeRef} tabIndex={-1}>
              {current.outcome}
            </p>
            <ul
              className="doorstep-changes"
              aria-label="本次剧情的物资和伤势变化"
            >
              {state.eventChanges
                .filter(
                  (c) =>
                    c.reason.startsWith("门外") && !c.label.includes("情绪"),
                )
                .map((c, i) => (
                  <li key={i} className={c.delta < 0 ? "loss" : "gain"}>
                    {c.label} {c.delta > 0 ? "+" : ""}
                    {c.delta}{" "}
                    <span>
                      （{c.before} → {c.after}）
                    </span>
                  </li>
                ))}
            </ul>
          </div>
          <p className="doorstep-stock">
            屋里还剩：食物 {state.resources.food} · 饮水 {state.resources.water}{" "}
            · 药品 {state.resources.medicine}
          </p>
          <button
            className="doorstep-return"
            onClick={() => send({ type: "encounter-close" })}
          >
            记进日记，回到屋里 <FontAwesomeIcon icon={faArrowRight} />
          </button>
        </>
      ) : (
        <>
          <p className="doorstep-question">{event.question}</p>
          <p className="doorstep-stock">
            屋里还剩：食物 {state.resources.food} · 饮水 {state.resources.water}{" "}
            · 药品 {state.resources.medicine}
          </p>
          <div className="doorstep-choices">
            <aside className="doorstep-risk">
              求助也可能是骗局。隔门可减少损失，开门可能失窃、遭抢或受伤。
              <span>
                {residents(state).length} 人留守 · 住所安全{" "}
                {state.resources.safety}/100 ·{" "}
                {gearAvailable(state, "axe")
                  ? "旧斧头在家，可用于抵抗"
                  : "家里没有可用的斧头"}
              </span>
            </aside>
            {event.reply && !current.asked && (
              <button
                aria-label="先隔着门问清情况"
                onClick={() => send({ type: "encounter", id: "ask" })}
              >
                <strong>先隔着门问清情况</strong>
                <small>不消耗物资 · 听完仍可决定是否帮助</small>
              </button>
            )}
            {event.choices.map((c) => {
              const reason = encounterChoiceError(state, c.id);
              return (
                <button
                  key={c.id}
                  aria-label={c.title}
                  disabled={!!reason}
                  onClick={() => send({ type: "encounter", id: c.id })}
                >
                  <strong>
                    {c.title} <span aria-hidden="true">↗</span>
                  </strong>
                  <small>{reason ?? c.detail}</small>
                </button>
              );
            })}
          </div>
          <p className="doorstep-footnote">
            关闭或按 Esc：保持安静，不回应。不会消耗物资。
          </p>
        </>
      )}
      {error && (
        <p className="doorstep-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
