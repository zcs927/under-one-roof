"use client";
import { useEffect } from "react";
import { incidentChoiceError, incidentFor } from "@/game/shelter-events";
import { isAway } from "@/game/presence";
import { PEOPLE } from "@/game/config";
import type { GameState } from "@/game/types";
import type { Action } from "@/game/reducer";
import { DiaryPanel, Night, EndingPanel } from "./story-panels";
export type JournalView = "today" | "history" | "family";
export function RoomJournal({
  state,
  send,
  view,
  onView,
  onNew,
}: {
  state: GameState;
  send: (a: Action) => void;
  view: JournalView;
  onView: (v: JournalView) => void;
  onNew: () => void;
}) {
  useEffect(() => {
    document.querySelector(".room-journal")?.scrollTo({ top: 0 });
  }, [state.phase, view]);
  const incident = state.shelter ? incidentFor(state) : null;
  return (
    <>
      <nav className="journal-tabs" aria-label="日记页签">
        {(
          [
            { id: "today", label: "今天" },
            { id: "history", label: "之前的日子" },
            { id: "family", label: "家人与线索" },
          ] as const
        ).map((v) => (
          <button
            key={v.id}
            aria-pressed={view === v.id}
            onClick={() => onView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </nav>
      {view === "today" ? (
        state.phase === "ending" ? (
          <EndingPanel
            state={state}
            onDiary={() => onView("history")}
            onNew={onNew}
          />
        ) : state.phase === "night" ? (
          <Night state={state} send={send} />
        ) : incident && state.shelter ? (
          <article className="journal-entry" aria-label="今日避难日记">
            <p className="journal-dateline">
              第 {state.day} 天 / 100 ·{" "}
              {state.shelter.incident.choice === null
                ? "尚未写下决定"
                : "已经记下了"}
            </p>
            <h2>{incident.title}</h2>
            <p className="journal-prose">{incident.text}</p>
            {state.shelter.incident.choice !== null ? (
              <div className="journal-outcome" role="status">
                <h3>
                  {incident.choices.find(
                    (c) => c.id === state.shelter!.incident.choice,
                  )?.title ?? "暂不处理"}
                </h3>
                <p>{state.shelter.incident.outcome}</p>
                <small>这个决定已经留下，不能重来。</small>
              </div>
            ) : (
              <div className="journal-decisions">
                {incident.choices.map((c) => {
                  const error = incidentChoiceError(state, c);
                  return (
                    <button
                      key={c.id}
                      disabled={!!error}
                      onClick={() => send({ type: "incident", id: c.id })}
                    >
                      <strong>{c.title}</strong>
                      <span>{c.detail}</span>
                      {error && <small>{error}</small>}
                    </button>
                  );
                })}
                <button
                  className="journal-ignore"
                  onClick={() => send({ type: "incident", id: "leave" })}
                >
                  <strong>暂不处理</strong>
                  <span>{incident.leave}</span>
                </button>
              </div>
            )}
            <div className="journal-day-close">
              <p>食物和水由你亲手分配。没给的那一份，夜里不会替你扣。</p>
              <button onClick={() => send({ type: "end-day" })}>
                合上这一页，结束今天 →
              </button>
            </div>
          </article>
        ) : null
      ) : view === "history" ? (
        <DiaryPanel state={state} />
      ) : (
        <article className="journal-family-page">
          <p className="journal-dateline">留在这本日记里的名字</p>
          <h2>我们一家四口</h2>
          {state.people.map((p) => (
            <p key={p.id}>
              <strong>
                {PEOPLE[p.id].role.split(" · ")[0]} · {PEOPLE[p.id].name}
              </strong>
              <span>
                {!p.alive
                  ? `第${p.deathDay}天离世 · ${p.deathReason}`
                  : isAway(state, p.id)
                    ? "外出未归，仍在等消息"
                    : "今天还在屋里"}
              </span>
            </p>
          ))}
          <hr />
          <h2>第100天的车队</h2>
          <p>
            确认频率{" "}
            {state.shelter?.rescue && state.shelter.rescue >= 1 ? "✓" : "…"}
            　屋顶标记 {state.shelter && state.shelter.rescue >= 2 ? "✓" : "…"}
            　车队补给 {state.shelter?.rescue === 3 ? "✓" : "…"}
          </p>
          <p>
            {state.shelter?.rescue === 3
              ? "他们已经记下地址。我们还得自己撑到第100天。"
              : "广播里的话不一定是救命符。收音机、地图和物资都得用在合适的时候。"}
          </p>
        </article>
      )}
    </>
  );
}
