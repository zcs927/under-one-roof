"use client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCommentDots,
  faShieldHalved,
  faArrowRight,
  faMugHot,
} from "@fortawesome/free-solid-svg-icons";
import {
  IDS,
  PEOPLE,
  TASK_NAMES,
  LOCATION_NAMES,
  portraitStyle,
} from "@/game/config";
import { attitude } from "@/game/attitude";
import { rationPreview, reservations } from "@/game/resources";
import { activeExpedition, isAway } from "@/game/expeditions";
import { departureError, isAlive, residents } from "@/game/presence";
import { deathRisk } from "@/game/life";
import { planErrors } from "@/game/settlement";
import { unable, taskLabel } from "@/game/tasks";
import type { Action } from "@/game/reducer";
import type { Offer } from "@/game/negotiation";
import type { GameState, PersonId, Task } from "@/game/types";
import { Tag } from "./primitives";
const attitudeText = {
  accept: "愿意接受",
  concern: "有所顾虑",
  refuse: "明确拒绝",
};
export function Planning({
  state,
  send,
  onTalk,
}: {
  state: GameState;
  send: (a: Action) => void;
  onTalk: (id: PersonId) => void;
}) {
  const preview = rationPreview(state),
    errors = planErrors(state);
  const bagAway =
    !!state.flags.protectionLost ||
    state.expeditions.some(
      (trip) =>
        trip.returnedDay === null && trip.lostDay === null && trip.protected,
    );
  const changeTask = (id: PersonId, task: Task) => {
    const pending = state.promises.some(
      (p) =>
        p.person === id &&
        p.kind === "rest" &&
        p.dueDay === state.day &&
        p.status === "pending",
    );
    if (
      pending &&
      task.kind !== "rest" &&
      state.plan.tasks[id].kind === "rest" &&
      !window.confirm(
        "你答应了今天让对方休息。改派工作将导致失信，仍然修改吗？",
      )
    )
      return;
    send({ type: "task", id, task });
  };
  return (
    <section className="planning-layout">
      <div>
        <div className="section-heading">
          <div>
            <p className="eyebrow">MAKE A PLAN, TOGETHER</p>
            <h2>今天，谁来做什么？</h2>
          </div>
          <button
            onClick={() =>
              IDS.forEach(
                (id) =>
                  !state.plan.tasks[id].locked &&
                  isAlive(state, id) &&
                  !isAway(state, id) &&
                  changeTask(id, { kind: "rest" }),
              )
            }
          >
            全家休息
          </button>
        </div>
        {residents(state).length === 1 && (
          <p className="warning">
            最后一名活着的留守者不能外出。等待不会停止饥渴和伤病，物资耗尽仍会死亡。
          </p>
        )}
        <div className="task-grid">
          {IDS.map((id) => {
            const person = state.people.find((p) => p.id === id)!;
            if (!person.alive)
              return (
                <article className="task-card deceased-task" key={id}>
                  <div className="task-person">
                    <div
                      className="avatar avatar-away"
                      style={portraitStyle(id)}
                    />
                    <div>
                      <h3>{PEOPLE[id].name}</h3>
                      <small>第{person.deathDay}天死亡</small>
                    </div>
                    <Tag tone="danger">已离世</Tag>
                  </div>
                  <p>{person.deathReason}</p>
                  <p className="muted">不能再分配任务或给予治疗。</p>
                </article>
              );
            const trip = activeExpedition(state, id);
            if (trip)
              return (
                <article className="task-card away-task" key={id}>
                  <div className="task-person">
                    <div className="avatar" style={portraitStyle(id)} />
                    <div>
                      <h3>{PEOPLE[id].name}</h3>
                      <small>
                        外出第 {state.day - trip.departedDay + 1} 天
                      </small>
                    </div>
                    <Tag tone="warn">外出未归</Tag>
                  </div>
                  <p>正在探索{LOCATION_NAMES[trip.location]}，归期未知。</p>
                  <p className="muted">
                    不在住所内，不能接受任务、用药、照护或协商。带回的物资只有归来后才会入库。
                  </p>
                  {trip.protected && (
                    <p className="notice">唯一的防护包仍由对方携带。</p>
                  )}
                </article>
              );
            const task = state.plan.tasks[id],
              a = attitude(state, id);
            return (
              <article className="task-card" key={id}>
                <div className="task-person">
                  <div className="avatar" style={portraitStyle(id)} />
                  <div>
                    <h3>{PEOPLE[id].name}</h3>
                    <small>
                      {id === state.player
                        ? "这是你的安排"
                        : PEOPLE[id].role.split(" · ")[0]}
                    </small>
                  </div>
                  <Tag
                    tone={
                      a.level === "accept"
                        ? "good"
                        : a.level === "refuse"
                          ? "danger"
                          : "warn"
                    }
                  >
                    {id === state.player
                      ? "由你决定"
                      : task.locked
                        ? "自主出发"
                        : attitudeText[a.level]}
                  </Tag>
                </div>
                <label>
                  今日任务
                  <select
                    aria-label={`${PEOPLE[id].name}的任务`}
                    value={task.kind}
                    disabled={task.locked}
                    onChange={(e) => {
                      const kind = e.target.value as Task["kind"];
                      changeTask(id, {
                        kind,
                        ...(kind === "search" ? { location: "food" } : {}),
                        ...(kind === "care"
                          ? {
                              target: IDS.find(
                                (x) =>
                                  x !== id &&
                                  isAlive(state, x) &&
                                  !isAway(state, x) &&
                                  state.plan.tasks[x].kind !== "search",
                              ),
                            }
                          : {}),
                      });
                    }}
                  >
                    {Object.entries(TASK_NAMES).map(([key, label]) => (
                      <option
                        key={key}
                        value={key}
                        disabled={
                          (key !== "rest" && unable(state, id)) ||
                          (key === "search" && !!departureError(state, id))
                        }
                      >
                        {label}
                        {key === "search" && departureError(state, id)
                          ? "（必须留守）"
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {task.kind === "search" && (
                  <label>
                    搜集地点
                    <select
                      aria-label={`${PEOPLE[id].name}的搜集地点`}
                      value={task.location ?? "food"}
                      disabled={task.locked}
                      onChange={(e) =>
                        changeTask(id, {
                          ...task,
                          location: e.target.value as Task["location"],
                        })
                      }
                    >
                      {Object.entries(LOCATION_NAMES).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {task.kind === "care" && (
                  <label>
                    照护对象
                    <select
                      aria-label={`${PEOPLE[id].name}的照护对象`}
                      value={task.target ?? ""}
                      onChange={(e) =>
                        changeTask(id, {
                          ...task,
                          target: e.target.value as PersonId,
                        })
                      }
                    >
                      {IDS.filter(
                        (x) =>
                          x !== id &&
                          isAlive(state, x) &&
                          !isAway(state, x) &&
                          state.plan.tasks[x].kind !== "search",
                      ).map((x) => (
                        <option key={x} value={x}>
                          {PEOPLE[x].name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {deathRisk(person) > 0 && (
                  <p className="warning">
                    当前死亡风险约{Math.round(deathRisk(person) * 100)}% /
                    晚，今晚也可能撑不过去。
                  </p>
                )}
                <p className="task-benefit">
                  {task.kind === "rest"
                    ? "健康 +5 · 疲劳 −25 · 情绪 +3"
                    : task.kind === "repair"
                      ? `材料 −1 · 安全度 +${id === "dad" ? 20 : 12} · 疲劳 +15`
                      : task.kind === "care"
                        ? `目标健康 +${id === "brother" ? 13 : 8} · 情绪 +${id === "mom" ? 10 : 5} · 自身疲劳 +10`
                        : `随机收获，可能空手 · 可能当天或数天后返回，也可能百日未归或在外死亡 · 出发疲劳 +20 · 健康 ${task.locked ? "−8" : task.protected ? "不变" : "−5"}`}
                </p>
                {id !== state.player && (
                  <blockquote
                    className={`task-thought ${a.level === "refuse" ? "thought-danger" : ""}`}
                  >
                    “{a.reasons.join(" ")}”
                  </blockquote>
                )}
                {task.locked && (
                  <p className="warning">
                    行动已由家人自行决定，今日外出名额已占用。
                  </p>
                )}
                {task.kind === "search" && id === state.player && (
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      disabled={bagAway}
                      checked={!!task.protected}
                      onChange={() =>
                        changeTask(id, { ...task, protected: !task.protected })
                      }
                    />
                    <FontAwesomeIcon icon={faShieldHalved} />{" "}
                    {bagAway ? "防护包由外出家人携带中" : "带上唯一的防护包"}
                  </label>
                )}
                {task.protected && id !== state.player && (
                  <Tag tone="good">防护包已预留</Tag>
                )}
                {task.extraFood && <Tag tone="warn">额外口粮 −1</Tag>}
                {id !== state.player && (
                  <button
                    className="talk-button"
                    onClick={() => onTalk(id)}
                    disabled={task.locked}
                  >
                    <FontAwesomeIcon icon={faCommentDots} /> 谈谈这个安排
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </div>
      <aside className="supplies-card">
        <p className="eyebrow">
          <FontAwesomeIcon icon={faMugHot} /> TONIGHT&apos;S TABLE
        </p>
        <h3>给今晚留一点准备</h3>
        <label>
          全家口粮
          <select
            aria-label="全家口粮"
            value={state.plan.ration}
            onChange={(e) =>
              send({
                type: "ration",
                ration: e.target.value as "normal" | "save" | "manual",
              })
            }
          >
            <option value="manual">仅手动喂食 · 没喂的人今晚不自动配给</option>
            <option value="normal">正常配给 · 每位在家成员1份</option>
            <option value="save">节省配给 · 在家人数的一半（向上取整）</option>
          </select>
        </label>
        <p className="muted">
          {state.plan.ration === "manual"
            ? "只使用你在人物卡实际喂过的食物和水，其余成员会继续饥渴。"
            : state.plan.ration === "save"
              ? "每人健康 −3、情绪 −3。适度节省，也需要留意身体。"
              : "吃饱喝足，今天没有额外的配给惩罚。"}
        </p>
        <label>
          药品给谁
          <select
            aria-label="药品给谁"
            value={state.plan.medicineTarget ?? ""}
            onChange={(e) => {
              const pending = state.promises.find(
                (p) => p.kind === "medicine" && p.status === "pending",
              );
              if (
                pending &&
                e.target.value !== pending.person &&
                !window.confirm(
                  "你已承诺今晚给药，改变治疗安排可能导致失信，仍然修改吗？",
                )
              )
                return;
              send({
                type: "medicine",
                id: (e.target.value || null) as PersonId | null,
              });
            }}
          >
            <option value="">今天不使用</option>
            {IDS.map((id) => (
              <option
                key={id}
                value={id}
                disabled={
                  state.resources.medicine < 1 ||
                  !isAlive(state, id) ||
                  isAway(state, id) ||
                  state.plan.tasks[id].kind === "search"
                }
              >
                {PEOPLE[id].name} ·{" "}
                {!isAlive(state, id)
                  ? "已死亡"
                  : isAway(state, id)
                    ? "外出未归"
                    : "健康 +15"}
              </option>
            ))}
          </select>
        </label>
        <p className="small">
          人物卡已喂过的不会重复扣；明确选“暂不给”的人今晚也不会自动获得这一项。饥渴会增加死亡风险。
        </p>
        <div className="supply-summary">
          <div>
            <span>预计基础消耗</span>
            <strong>
              食物 {preview.foodCost} / 饮水 {preview.waterCost}
            </strong>
          </div>
          <div>
            <span>已预留额外口粮</span>
            <strong>{preview.reserved.food} 份</strong>
          </div>
          <div>
            <span>已预留维修材料</span>
            <strong>{preview.reserved.materials} 件</strong>
          </div>
          <div>
            <span>现有药品</span>
            <strong>{state.resources.medicine} 份</strong>
          </div>
          <div>
            <span>已预留药品</span>
            <strong>{preview.reserved.medicine} 份</strong>
          </div>
        </div>
        {preview.shortage > 0 && (
          <p className="warning">
            按现有库存预估，晚间配给有缺口。外出者归期与收获未知，请勿依赖预计收益；短缺仍可继续。
          </p>
        )}
        {errors.length > 0 && (
          <div className="validation" role="status">
            {errors.map((e) => (
              <p key={e}>{e}</p>
            ))}
          </div>
        )}
        <button
          className="primary full"
          disabled={errors.length > 0}
          onClick={() => send({ type: "confirm" })}
        >
          检查今日计划 <FontAwesomeIcon icon={faArrowRight} />
        </button>
        <p className="small">
          配给按夜间实际在家人数结算。每天最多一人新出发，外出者可能数天未归；收获不保证。
        </p>
      </aside>
    </section>
  );
}
export function Negotiation({
  state,
  id,
  send,
  onClose,
}: {
  state: GameState;
  id: PersonId;
  send: (a: Action) => void;
  onClose: () => void;
}) {
  const a = attitude(state, id),
    task = state.plan.tasks[id],
    pending = state.promises.find(
      (p) => p.person === id && p.status === "pending",
    );
  const reserved = reservations(state);
  const protectionTaken =
    !!state.flags.protectionLost ||
    state.expeditions.some(
      (trip) =>
        trip.returnedDay === null && trip.lostDay === null && trip.protected,
    ) ||
    Object.entries(state.plan.tasks).some(
      ([other, t]) => other !== id && t.protected,
    );
  const offers: { id: Offer; title: string; cost: string; reason: string }[] = [
    {
      id: "explain",
      title: task.explained ? "已经认真解释过了" : "认真解释这次安排",
      cost: "今日态度 +10 · 不增加永久信任",
      reason: task.explained
        ? "今天已经解释过，不会重复加分"
        : task.kind === "rest"
          ? "休息无需额外协商"
          : "",
    },
    {
      id: "protection",
      title: task.protected ? "收回防护包" : "把防护包交给你",
      cost: "外出态度 +15 · 免除普通外出健康损失",
      reason:
        task.kind !== "search"
          ? "仅供外出使用"
          : protectionTaken
            ? "唯一的防护包已预留给别人"
            : "",
    },
    {
      id: "food",
      title: task.extraFood ? "取消额外口粮" : "给你多留一份口粮",
      cost: "食物 −1 · 态度 +10 · 情绪 +5",
      reason:
        task.kind === "rest"
          ? "休息无需额外口粮"
          : !task.extraFood && state.resources.food - reserved.food < 1
            ? "现有食物已用完或预留"
            : "",
    },
    {
      id: "medicine",
      title: "答应今晚给你药",
      cost: "预留药品1 · 必须今晚实际给药",
      reason: pending
        ? "先兑现已有承诺"
        : state.resources.medicine < 1
          ? "没有可预留药品"
          : state.plan.medicineTarget && state.plan.medicineTarget !== id
            ? "药品已预留给别人"
            : "",
    },
    {
      id: "rest",
      title: "答应明天让你休息",
      cost: "明天的实际任务必须为休息",
      reason: pending
        ? "先兑现已有承诺"
        : state.day === 100
          ? "第100天没有明天的任务"
          : "",
    },
  ];
  const last = state.memories.filter((m) => m.person === id).at(-1);
  return (
    <>
      <p className="eyebrow">
        {PEOPLE[id].name} · {taskLabel(task)}
      </p>
      <Tag
        tone={
          a.level === "refuse"
            ? "danger"
            : a.level === "concern"
              ? "warn"
              : "good"
        }
      >
        {attitudeText[a.level]}
      </Tag>
      <blockquote>“{a.reasons.join(" ")}”</blockquote>
      {last && <p className="memory-recall">对方还记得：{last.text}</p>}
      {a.hard && (
        <p className="warning">身体或物资限制需要先调整计划，让步无法绕过。</p>
      )}
      <div className="offer-list">
        {offers.map((o) => (
          <button
            key={o.id}
            disabled={!!o.reason || task.locked}
            onClick={() => send({ type: "offer", id, offer: o.id })}
          >
            <strong>{o.title}</strong>
            <small>{o.cost}</small>
            {o.reason && (
              <small className="warning">暂不可用：{o.reason}</small>
            )}
          </button>
        ))}
      </div>
      {pending && (
        <p className="notice">
          待兑现：{pending.kind === "medicine" ? "今晚给药" : "明天休息"}，第{" "}
          {pending.dueDay} 天夜间结算。兑现信任 +8，失信信任 −12、情绪 −5。
        </p>
      )}
      <button className="full" onClick={onClose}>
        回到计划，重新考虑分工
      </button>
    </>
  );
}
