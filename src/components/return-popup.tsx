"use client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faPersonWalking,
} from "@fortawesome/free-solid-svg-icons";
import { PEOPLE } from "@/game/config";
import { GEAR } from "@/game/shelter";
import { getPerson } from "@/game/initial";
import { lootDescription } from "@/game/return-stories";
import type { Expedition, GameState } from "@/game/types";
import type { Action } from "@/game/reducer";
import { Modal } from "./primitives";

export function ReturnPopup({
  state,
  trip,
  remaining,
  send,
}: {
  state: GameState;
  trip: Expedition;
  remaining: number;
  send: (a: Action) => void;
}) {
  const report = trip.story!,
    person = getPerson(state, trip.person);
  const close = () => send({ type: "ack-return", id: trip.id });
  return (
    <Modal
      title={`${PEOPLE[trip.person].name}回来了`}
      className="doorstep-modal return-popup"
      onClose={close}
    >
      <div className="doorstep-cue">
        <FontAwesomeIcon icon={faPersonWalking} />
        <span>
          第 {trip.returnedDay} 天 · 外出{" "}
          {trip.returnedDay! - trip.departedDay + 1} 天
        </span>
      </div>
      <p className="return-kicker">门外的脚步，终于停在了家门口。</p>
      <h3 className="return-title">{report.title}</h3>
      <p className="return-account">{report.text}</p>
      <div className="return-receipt">
        <small>放下背包，清点这一趟。</small>
        <p>{lootDescription(trip)}</p>
        {trip.gear && trip.gearBroken && (
          <p className="return-danger">
            {GEAR[trip.gear].name}在途中损坏了，已无法使用。
          </p>
        )}
        {report.applied && (
          <p className="return-effects">
            {(
              [
                ["健康", report.applied.health],
                ["疲劳", report.applied.fatigue],
                ["心情", report.applied.mood],
              ] as const
            )
              .filter(([, v]) => v !== 0)
              .map(([name, v]) => (
                <span key={name}>
                  {name} {v > 0 ? "+" : ""}
                  {v}
                </span>
              ))}
          </p>
        )}
      </div>
      {!person.alive ? (
        <p className="return-danger">
          人回到了家，却没能撑过第{person.deathDay}天。{person.deathReason}
          。家人已经记下这段经历。
        </p>
      ) : person.illness ? (
        <p className="return-danger">
          正在发烧，还需休息约{person.illness.daysLeft}
          天。明早可以用1份药治疗，也要继续照顾食水；退烧前不能再次派出。
        </p>
      ) : report.kind === "injured" ? (
        <p className="return-danger">
          这次带着伤回家。明早点人物可以给药，身体太差时需要先留在家里休息。
        </p>
      ) : (
        <p className="return-note">
          这一趟的收获和身体变化都已经记下，食水仍需主动分给家人。
        </p>
      )}
      <button className="doorstep-return" onClick={close}>
        {remaining > 1
          ? `还有${remaining - 1}位家人归来，继续听`
          : "记进日记，查看今天的小结"}{" "}
        <FontAwesomeIcon icon={faArrowRight} />
      </button>
    </Modal>
  );
}
