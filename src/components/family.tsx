"use client";
import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPersonWalkingArrowRight,
  faArrowLeft,
} from "@fortawesome/free-solid-svg-icons";
import { IDS, PEOPLE } from "@/game/config";
import { getPerson } from "@/game/initial";
import { unable } from "@/game/tasks";
import { activeExpedition, isAway } from "@/game/expeditions";
import { isAlive, residents } from "@/game/presence";
import { deathRisk } from "@/game/life";
import { supplyNeed } from "@/game/supplies";
import {
  GEAR,
  GEAR_IDS,
  gearAvailable,
  gearCarrier,
  OUTSIDE,
} from "@/game/shelter";
import { outingError } from "@/game/family-mode";
import { attitude } from "@/game/attitude";
import { portraitStyle } from "@/game/config";
import type { GameState, GearId, Location, PersonId } from "@/game/types";
import type { Action } from "@/game/reducer";
import { SceneObjects, OBJECT_NAMES, type SceneObject } from "./scene-objects";
import { Meter, Tag } from "./primitives";
import { CharacterSprite } from "./character-sprite";
import { appearanceFor } from "@/game/appearance";
export function thought(state: GameState, id: PersonId) {
  const person = getPerson(state, id);
  if (!person.alive)
    return `第${person.deathDay}天死亡：${person.deathReason}。`;
  const trip = activeExpedition(state, id);
  if (trip)
    return `已外出${state.day - trip.departedDay + 1}天，暂无消息。只能看到出发前留下的记录。`;
  if (person.illness) return "身上忽冷忽热，想坐下来休息，也需要有人照顾。";
  if (person.injury) return "伤口还疼，先好好养一养。";
  if (unable(state, id)) return "今天实在有些撑不住，想休息或有人照顾。";
  if (state.autonomy?.person === id && !state.autonomy.resolved)
    return "地图翻了又翻，背包已放在门边。我也想承担一些事。";
  const promise = state.promises.find(
    (p) => p.person === id && p.status === "pending",
  );
  if (promise)
    return `我记得你答应过${promise.kind === "medicine" ? "今晚给我药" : "明天让我休息"}。`;
  return PEOPLE[id].wish;
}
export function FamilyScene({
  state,
  onPerson,
  onDiary,
  onLedger,
  send,
}: {
  state: GameState;
  onPerson: (id: PersonId) => void;
  onDiary: () => void;
  onLedger: () => void;
  send: (a: Action) => void;
}) {
  const [inspected, setInspected] = useState<PersonId | null>(null);
  const [object, setObject] = useState<SceneObject | null>(null);
  const [gear, setGear] = useState<GearId | undefined>(undefined);
  const [feeding, setFeeding] = useState<"food" | "water" | "medicine" | null>(
    null,
  );
  const [planning, setPlanning] = useState(false);
  const [location, setLocation] = useState<Location>("food");
  const spots = useRef<Partial<Record<PersonId, HTMLButtonElement | null>>>({});
  const previous = useRef<HTMLElement | null>(null);
  const positions: Record<
    PersonId,
    { left: number; top: number; width: number; height: number }
  > = {
    mom: { left: 7, top: 16, width: 19, height: 50 },
    dad: { left: 27, top: 27, width: 23, height: 30 },
    daughter: { left: 55, top: 23, width: 24, height: 32 },
    brother: { left: 80, top: 37, width: 17, height: 37 },
  };
  const close = () => {
    setInspected(null);
    setObject(null);
    setPlanning(false);
    previous.current?.focus();
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) {
        setInspected(null);
        setObject(null);
        setPlanning(false);
        setFeeding(null);
        previous.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
  const person = inspected ? getPerson(state, inspected) : null;
  useEffect(() => {
    if (
      inspected &&
      (!isAlive(state, inspected) || isAway(state, inspected)) &&
      document.activeElement === document.body
    )
      document
        .querySelector<HTMLButtonElement>(
          'button[aria-label="翻开桌上的家庭日记"]',
        )
        ?.focus();
  }, [inspected, state]);
  const selectedGear = gear && gearAvailable(state, gear) ? gear : undefined;
  const choosePerson = (id: PersonId) => {
    previous.current = spots.current[id] ?? null;
    setObject(null);
    setPlanning(false);
    if (feeding) {
      send(
        feeding === "medicine"
          ? { type: "treat", id }
          : { type: "feed", id, resource: feeding, give: true },
      );
      setFeeding(null);
    }
    setInspected(inspected === id && !feeding ? null : id);
  };
  const chooseObject = (id: SceneObject) => {
    previous.current = document.activeElement as HTMLElement;
    setInspected(null);
    setObject(id);
    setFeeding(null);
  };
  const request = (destination: Location, force = false) => {
    if (!inspected) return;
    setLocation(destination);
    send({
      type: "outing",
      id: inspected,
      location: destination,
      force,
      gear: selectedGear,
    });
  };
  const isGear = object !== null && GEAR_IDS.includes(object as GearId);
  const carrier = isGear ? gearCarrier(state, object as GearId) : undefined;
  const atHome =
    object && isGear ? gearAvailable(state, object as GearId) : false;
  return (
    <div className={`room-camera room-phase-${state.phase}`}>
      <div
        className="scene-photo"
        role="group"
        aria-label={`末日避难所，${residents(state).length}名活人在家`}
      >
        {IDS.filter((id) => isAlive(state, id) && !isAway(state, id)).map(
          (id) => (
            <CharacterSprite key={`sprite-${id}`} state={state} id={id} />
          ),
        )}
        {IDS.filter((id) => isAlive(state, id) && !isAway(state, id)).map(
          (id) => {
            const p = positions[id];
            return (
              <button
                key={id}
                ref={(el) => {
                  spots.current[id] = el;
                }}
                className={`person-hotspot ${inspected === id ? "is-inspected" : ""} ${feeding ? "is-feed-target" : ""}`}
                style={{
                  left: `${p.left}%`,
                  top: `${p.top}%`,
                  width: `${p.width}%`,
                  height: `${p.height}%`,
                }}
                aria-label={`查看${PEOPLE[id].role.split(" · ")[0]}${PEOPLE[id].name}的状态`}
                aria-describedby={`character-condition-${id}`}
                aria-expanded={inspected === id}
                onClick={() => choosePerson(id)}
              >
                <span className="hotspot-name">
                  {PEOPLE[id].role.split(" · ")[0]}
                </span>
                <span className="sr-only" id={`character-condition-${id}`}>
                  当前状态：
                  {appearanceFor(state, getPerson(state, id)).labels.join(
                    "、",
                  ) || "状态尚可"}
                </span>
              </button>
            );
          },
        )}
        <SceneObjects
          state={state}
          selectedGear={selectedGear}
          onObject={chooseObject}
          onJournal={() => {
            setInspected(null);
            setObject(null);
            onDiary();
          }}
        />
        {feeding && (
          <div className="room-action-hint" role="status">
            拿出一份
            {feeding === "food" ? "食物" : feeding === "water" ? "水" : "药"}
            ，点要照顾的家人。
            <button onClick={() => setFeeding(null)}>放回去</button>
          </div>
        )}
        {selectedGear && !feeding && (
          <div className="room-kit-hint">
            准备带上{GEAR[selectedGear].name}，点人物安排外出。
            <button onClick={() => setGear(undefined)}>留下</button>
          </div>
        )}
        {inspected && person?.alive && !isAway(state, inspected) && (
          <section
            id="scene-person-status"
            className="scene-person-status room-person-paper"
            aria-label={`${PEOPLE[inspected].name}的状态`}
            aria-live="polite"
            style={
              {
                "--popover-left":
                  positions[inspected].left < 50
                    ? `${positions[inspected].left + positions[inspected].width - 2}%`
                    : `calc(${positions[inspected].left}% - 292px)`,
                "--person-top": `${positions[inspected].top}%`,
              } as React.CSSProperties
            }
          >
            <div className="scene-status-heading">
              <div>
                <strong>
                  {PEOPLE[inspected].role.split(" · ")[0]} ·{" "}
                  {PEOPLE[inspected].name}
                </strong>
                <small>
                  {unable(state, inspected) ? "身体需要恢复" : "还在这里"}
                </small>
              </div>
              <button
                className="status-close"
                aria-label="关闭人物状态"
                onClick={close}
              >
                ×
              </button>
            </div>
            {planning ? (
              <>
                <p className="room-person-thought">
                  <FontAwesomeIcon icon={faPersonWalkingArrowRight} /> 让
                  {PEOPLE[inspected].role.split(" · ")[0]}出门
                </p>
                <p className="paper-small">
                  {state.shelter
                    ? OUTSIDE[state.shelter.outside].text
                    : "门外归期未知。"}
                </p>
                <p className="paper-small">
                  携带：{selectedGear ? GEAR[selectedGear].name : "不带道具"}
                  。点屋里的道具可更换。
                </p>
                {outingError(state, inspected, location) ? (
                  <p className="paper-warning">
                    {outingError(state, inspected, location)}
                  </p>
                ) : state.flags[`outingRefused:${inspected}`] ? (
                  <div className="person-refusal" role="status">
                    <strong>
                      {PEOPLE[inspected].role.split(" · ")[0]}拒绝外出
                    </strong>
                    <p>
                      “
                      {attitude(state, inspected, {
                        kind: "search",
                        location,
                      }).reasons.join(" ")}
                      ”
                    </p>
                    <small>强制的代价：情绪−10，信任−8。</small>
                    <button
                      className="force-outing"
                      onClick={() => request(location, true)}
                    >
                      强制{PEOPLE[inspected].role.split(" · ")[0]}外出
                    </button>
                    <button onClick={close}>换个人出去</button>
                  </div>
                ) : (
                  <div className="person-outing-choices">
                    <button onClick={() => request("food")}>去找食物</button>
                    <button onClick={() => request("water")}>去找饮水</button>
                  </div>
                )}
                <button
                  className="paper-text-button"
                  onClick={() => setPlanning(false)}
                >
                  <FontAwesomeIcon icon={faArrowLeft} /> 先看看身体
                </button>
              </>
            ) : (
              <>
                <div className="scene-status-meters">
                  <Meter
                    label="健康"
                    value={person.health}
                    warning={person.health <= 30}
                  />
                  <Meter
                    label="疲劳"
                    value={person.fatigue}
                    warning={person.fatigue >= 80}
                  />
                  <Meter label="心情" value={person.mood} />
                </div>
                <p className="room-person-thought">
                  “{thought(state, inspected)}”
                </p>
                <div className="feeding-status">
                  {person.injury && (
                    <p className="paper-warning person-illness">
                      有外伤 · 还需在家休息约{person.injury.daysLeft}
                      晚，或用1份药治疗。
                    </p>
                  )}
                  {person.illness && (
                    <p className="paper-warning person-illness">
                      正在发烧 · 还需休息约{person.illness.daysLeft}
                      天，或用1份药治疗。期间不能再次外出。
                    </p>
                  )}
                  {(["food", "water"] as const).map((r) => {
                    const days =
                      r === "food" ? person.hungryDays : person.thirstyDays;
                    const given =
                      (r === "food" ? person.fedDay : person.wateredDay) ===
                      state.day;
                    const need = supplyNeed(state, person, r);
                    return (
                      <span
                        className={need === "urgent" ? "paper-warning" : ""}
                        key={r}
                      >
                        {given
                          ? r === "food"
                            ? "今天吃过了"
                            : "今天喝过了"
                          : `${days}天未${r === "food" ? "进食" : "喝水"} · ${need === "urgent" ? "急需" : need === "soon" ? "该补充" : "还能撑住"}`}
                      </span>
                    );
                  })}
                </div>
                {(["food", "water"] as const).map((resource) => {
                  const given =
                    (resource === "food"
                      ? person.fedDay
                      : person.wateredDay) === state.day;
                  return (
                    <div className="feeding-actions" key={resource}>
                      <button
                        aria-label={`给${PEOPLE[inspected].name}喂${resource === "food" ? "食物" : "水"}1份`}
                        disabled={
                          state.phase !== "morning" ||
                          given ||
                          state.resources[resource] < 1
                        }
                        onClick={() =>
                          send({
                            type: "feed",
                            id: inspected,
                            resource,
                            give: true,
                          })
                        }
                      >
                        {given
                          ? "今天给过了"
                          : `${resource === "food" ? "给一份食物" : "给一份水"} −1`}
                        <small>剩{state.resources[resource]}</small>
                      </button>
                      <button
                        disabled={state.phase !== "morning" || given}
                        onClick={() =>
                          send({
                            type: "feed",
                            id: inspected,
                            resource,
                            give: false,
                          })
                        }
                      >
                        暂不给
                      </button>
                    </div>
                  );
                })}
                <button
                  className="room-medicine"
                  aria-label={`给${PEOPLE[inspected].name}用药1份`}
                  disabled={
                    state.phase !== "morning" ||
                    state.resources.medicine < 1 ||
                    (person.health >= 100 &&
                      !person.illness &&
                      !person.injury) ||
                    state.flags[`treated:${state.day}:${inspected}`]
                  }
                  onClick={() => send({ type: "treat", id: inspected })}
                >
                  {state.flags[`treated:${state.day}:${inspected}`]
                    ? "今天用过药了"
                    : `用药 −1 · 剩${state.resources.medicine}`}
                </button>
                {deathRisk(person, !!state.shelter) > 0 && (
                  <p className="paper-warning">
                    伤势危险，可能今晚就撑不过去。
                  </p>
                )}
                <div className="scene-status-footer">
                  <button
                    disabled={state.phase !== "morning"}
                    onClick={() => setPlanning(true)}
                  >
                    安排外出 →
                  </button>
                  <button onClick={() => onPerson(inspected)}>
                    记在心里的事
                  </button>
                </div>
              </>
            )}
          </section>
        )}
        {object && (
          <section
            className="room-object-note"
            aria-label={`${OBJECT_NAMES[object]}的信息`}
            aria-live="polite"
          >
            <div className="scene-status-heading">
              <strong>{OBJECT_NAMES[object]}</strong>
              <button
                aria-label="关闭物品信息"
                className="status-close"
                onClick={close}
              >
                ×
              </button>
            </div>
            {isGear ? (
              <>
                <p>{GEAR[object as GearId].use}</p>
                <p>
                  {carrier
                    ? `${PEOPLE[carrier].name}带在身上，回来前家中不能使用。`
                    : atHome
                      ? "就放在这里。可以带出门，也可以留着应付家里的事。"
                      : "原来的位置空了。外出或交易也许能再找到。"}
                </p>
                <button
                  disabled={!atHome || state.phase !== "morning"}
                  onClick={() => {
                    setGear(object as GearId);
                    close();
                  }}
                >
                  下次外出带上它
                </button>
              </>
            ) : object === "door" || object === "safety" ? (
              <>
                <p>
                  {state.shelter
                    ? OUTSIDE[state.shelter.outside].text
                    : "门外没有动静。"}
                </p>
                <p>
                  门窗安全度 {state.resources.safety}/100。必须留一名活人在家。
                </p>
                {state.people
                  .filter((p) => isAway(state, p.id))
                  .map((p) => (
                    <p key={p.id}>
                      {PEOPLE[p.id].name} · 已外出
                      {state.day -
                        activeExpedition(state, p.id)!.departedDay +
                        1}
                      天，归期未知。
                    </p>
                  ))}
                {residents(state).length === 1 && (
                  <p className="paper-warning">最后一名留守者不能外出。</p>
                )}
                <button
                  onClick={() => {
                    close();
                    onLedger();
                  }}
                >
                  看看家人的记录
                </button>
              </>
            ) : (
              <>
                <p className="object-amount">
                  {
                    state.resources[
                      object as "food" | "water" | "medicine" | "materials"
                    ]
                  }
                  <small>{object === "materials" ? "件材料" : "份"}</small>
                </p>
                <p>
                  {object === "materials"
                    ? "修门、净水、与门外的人交换。翻开日记，看看今天需要什么。"
                    : "每次给一位家人，立即减少一份。夜里不会自动分配。"}
                </p>
                {object !== "materials" && (
                  <button
                    disabled={
                      state.phase !== "morning" ||
                      state.resources[object as "food" | "water" | "medicine"] <
                        1
                    }
                    onClick={() => {
                      setFeeding(object as "food" | "water" | "medicine");
                      close();
                    }}
                  >
                    拿出一份给家人
                  </button>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
export function PersonDetails({
  state,
  id,
  onNegotiate,
}: {
  state: GameState;
  id: PersonId;
  onNegotiate: () => void;
}) {
  const p = getPerson(state, id),
    d = PEOPLE[id],
    memories = state.memories.filter((m) => m.person === id),
    promises = state.promises.filter(
      (m) => m.person === id && m.status === "pending",
    );
  return (
    <>
      <div className="person-heading">
        <div className="avatar large-avatar" style={portraitStyle(id)} />
        <div>
          <Tag>
            {id === state.player && !state.flags.familyManagement
              ? "你扮演的角色"
              : "家庭成员"}
          </Tag>
          <h3>{d.name}</h3>
          <p className="muted">{d.role}</p>
        </div>
      </div>
      <p className="skill">{d.skill}</p>
      {isAway(state, id) && (
        <p className="warning">
          家人仍在外出，归期未知。下方数值是最后记录，不代表当前状况；回来前无法照护、用药或协商。
        </p>
      )}
      <div className="stats">
        <Meter label="健康" value={p.health} warning={p.health <= 30} />
        <Meter label="疲劳" value={p.fatigue} warning={p.fatigue >= 80} />
        <Meter label="情绪" value={p.mood} />
      </div>
      {p.illness && (
        <p className="warning">
          正在发烧，休息约{p.illness.daysLeft}天或使用药品；目前不能再次外出。
        </p>
      )}
      {(id !== state.player || state.flags.familyManagement) && (
        <p className="relationship">
          对你的关系{" "}
          <Tag
            tone={
              (p.trust ?? 0) >= 65
                ? "good"
                : (p.trust ?? 0) < 40
                  ? "danger"
                  : "neutral"
            }
          >
            {(p.trust ?? 0) >= 65
              ? "信任"
              : (p.trust ?? 0) < 40
                ? "生疏"
                : "观望"}
          </Tag>
          <span className="muted">来自共同经历和承诺</span>
        </p>
      )}
      <blockquote>“{thought(state, id)}”</blockquote>
      {unable(state, id) && (
        <p className="warning">
          当前只能休息或接受家人照护，信任和让步不能改变身体限制。
        </p>
      )}
      <h4>尚未到期的承诺</h4>
      {promises.length ? (
        promises.map((p) => (
          <div className="memory" key={p.id}>
            <Tag tone="warn">第 {p.dueDay} 天夜间到期</Tag>
            <p>
              {p.kind === "medicine" ? "今晚实际给药" : "明天的实际任务为休息"}
            </p>
          </div>
        ))
      ) : (
        <p className="muted">没有待兑现的承诺。</p>
      )}
      <h4>记在心里的事</h4>
      {memories.length ? (
        memories.toReversed().map((m) => (
          <div className="memory" key={m.id}>
            <small>第 {m.day} 天</small>
            <p>{m.text}</p>
            {m.trustDelta !== 0 && (
              <Tag tone={m.trustDelta > 0 ? "good" : "danger"}>
                信任 {m.trustDelta > 0 ? "+" : ""}
                {m.trustDelta}
              </Tag>
            )}
          </div>
        ))
      ) : (
        <p className="muted">故事刚开始，重要的经历会留在这里。</p>
      )}
      {(id !== state.player || state.flags.familyManagement) &&
        state.phase === "planning" &&
        !isAway(state, id) && (
          <button className="primary full" onClick={onNegotiate}>
            谈谈今天的安排
          </button>
        )}
    </>
  );
}
