"use client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faMoon,
  faSun,
  faRadio,
  faCheck,
  faShieldHalved,
} from "@fortawesome/free-solid-svg-icons";
import { IDS, PEOPLE, portraitStyle } from "@/game/config";
import { isAway } from "@/game/expeditions";
import { eventFor, choiceError } from "@/game/events";
import { rationPreview } from "@/game/resources";
import { attitude } from "@/game/attitude";
import { taskLabel } from "@/game/tasks";
import type { Action } from "@/game/reducer";
import type { Diary, GameState } from "@/game/types";
import { Tag } from "./primitives";
export function DailyEvent({
  state,
  send,
}: {
  state: GameState;
  send: (a: Action) => void;
}) {
  const e = eventFor(state);
  return (
    <section className="story-panel">
      <div className="story-icon">
        <FontAwesomeIcon icon={state.day === 6 ? faRadio : faSun} />
      </div>
      <p className="eyebrow">
        DAY {String(state.day).padStart(2, "0")} · TODAY&apos;S STORY
      </p>
      <h2>{e.title}</h2>
      <p className="story-text">{e.text}</p>
      <div className="choice-list">
        {e.choices.map((c) => {
          const error = choiceError(state, c);
          return (
            <button
              key={c.id}
              disabled={!!error}
              onClick={() => send({ type: "choice", id: c.id })}
            >
              <div>
                <strong>{c.title}</strong>
                <p>{c.detail}</p>
                <small>{error ?? c.cost}</small>
              </div>
              <FontAwesomeIcon icon={faArrowRight} />
            </button>
          );
        })}
      </div>
      <p className="small">
        确定代价已列出。家人的想法值得听见，未来仍有未知。
      </p>
    </section>
  );
}
export function Confirmation({
  state,
  send,
}: {
  state: GameState;
  send: (a: Action) => void;
}) {
  const preview = rationPreview(state);
  return (
    <section className="story-panel">
      <p className="eyebrow">BEFORE WE SET OUT</p>
      <h2>再一起确认一下</h2>
      <p className="muted">计划执行之后，这一天就会成为家人共同的记忆。</p>
      <div className="confirm-list">
        {IDS.map((id) => {
          const t = state.plan.tasks[id],
            a = attitude(state, id);
          return (
            <div key={id}>
              <strong>{PEOPLE[id].name}</strong>
              <span>
                {!state.people.find((p) => p.id === id)!.alive
                  ? "已死亡"
                  : isAway(state, id)
                    ? "持续探索 · 归期未知"
                    : taskLabel(t)}
              </span>
              <Tag tone={a.level === "concern" ? "warn" : "good"}>
                {!state.people.find((p) => p.id === id)!.alive
                  ? "无法再行动"
                  : isAway(state, id)
                    ? "外出未归"
                    : t.locked
                      ? "自主行动"
                      : id === state.player
                        ? "由你决定"
                        : a.level === "concern"
                          ? "仍有顾虑"
                          : "愿意接受"}
              </Tag>
              {t.protected && (
                <small>
                  <FontAwesomeIcon icon={faShieldHalved} /> 防护包
                </small>
              )}
            </div>
          );
        })}
      </div>
      <p>
        晚间配给：
        {state.plan.ration === "manual"
          ? "仅手动喂食"
          : state.plan.ration === "save"
            ? "节省"
            : "正常"}{" "}
        · 食物 {preview.foodCost} / 饮水 {preview.waterCost}
      </p>
      {IDS.some((id) => state.plan.tasks[id].kind === "search") && (
        <p className="warning">
          外出后人物将离开画面，无法立即改派。返回与物资均随机，可能空手，甚至第100天仍未归来。防护包不能保证按时回来。
        </p>
      )}
      {state.plan.medicineTarget && (
        <p>药品1份 → {PEOPLE[state.plan.medicineTarget].name}</p>
      )}
      {preview.shortage > 0 && (
        <p className="warning">
          按现有库存预计会有配给缺口。外出收获未知，仅在归来后入库；配给按实际在家人数结算。
        </p>
      )}
      {state.promises
        .filter((p) => p.status === "pending" && p.dueDay === state.day)
        .map((p) => (
          <p className="notice" key={p.id}>
            今晚将检验对{PEOPLE[p.person].name}的承诺：
            {p.kind === "medicine" ? "实际给药" : "实际休息"}。
          </p>
        ))}
      <div className="button-row">
        <button onClick={() => send({ type: "back" })}>返回修改</button>
        <button className="primary" onClick={() => send({ type: "execute" })}>
          执行今天的计划 <FontAwesomeIcon icon={faCheck} />
        </button>
      </div>
    </section>
  );
}
export function Night({
  state,
  send,
}: {
  state: GameState;
  send: (a: Action) => void;
}) {
  const record = state.diary.find((d) => d.day === state.day);
  return (
    <section className="story-panel night-panel">
      <div className="story-icon">
        <FontAwesomeIcon icon={faMoon} />
      </div>
      <p className="eyebrow">THE NIGHT WE SHARED</p>
      <h2>第 {state.day} 天的夜晚</h2>
      <p className="muted">门关上了。让我们看看，这一天留下了什么。</p>
      {record && (
        <>
          <DailySummaryCard record={record} />
          <details>
            <summary>查看今天的完整经过与状态变化</summary>
            <div className="night-actions">
              {record.actions.map((a, i) => (
                <p key={i}>{a}</p>
              ))}
            </div>
            {record.notes.length > 0 && (
              <blockquote>{record.notes.join("\n")}</blockquote>
            )}
            <div className="change-list">
              {record.changes.map((c, i) => (
                <div key={i}>
                  <span>
                    {c.label}
                    <small>{c.reason}</small>
                  </span>
                  <span>
                    {c.before} → {c.after}{" "}
                    <b className={c.delta > 0 ? "positive" : "negative"}>
                      {c.delta > 0 ? "+" : ""}
                      {c.delta}
                    </b>
                  </span>
                </div>
              ))}
            </div>
          </details>
        </>
      )}
      <button
        className="primary"
        onClick={() => {
          send({ type: "next" });
          window.scrollTo({ top: 0 });
        }}
      >
        {state.day === 100
          ? "看看这段生存的结局"
          : "迎接第 " + (state.day + 1) + " 天"}{" "}
        <FontAwesomeIcon icon={faArrowRight} />
      </button>
    </section>
  );
}
export function DailySummaryCard({ record }: { record: Diary }) {
  const s = record.summary;
  return (
    <article className="daily-summary" aria-label={`第${record.day}天生存小结`}>
      <header>
        <span className="eyebrow">
          DAY {String(record.day).padStart(3, "0")} / 100
        </span>
        <strong>今天的生存小结</strong>
      </header>
      <p className="summary-event">
        {record.event} · {record.choice}
      </p>
      {s && (
        <div className="summary-metrics">
          <div>
            <small>食物净变化</small>
            <strong className={s.foodDelta < 0 ? "negative" : "positive"}>
              {s.foodDelta > 0 ? "+" : ""}
              {s.foodDelta}
            </strong>
            <span>剩 {s.foodLeft} 份</span>
          </div>
          <div>
            <small>饮水净变化</small>
            <strong className={s.waterDelta < 0 ? "negative" : "positive"}>
              {s.waterDelta > 0 ? "+" : ""}
              {s.waterDelta}
            </strong>
            <span>剩 {s.waterLeft} 份</span>
          </div>
          <div>
            <small>活着的家人</small>
            <strong>{s.alive} / 4</strong>
            <span>{s.atHome} 人在家</span>
          </div>
        </div>
      )}
      {record.notes
        .filter(
          (n) =>
            n.startsWith("今日记事 ·") ||
            n.startsWith("门外的故事 ·") ||
            n.startsWith("归来经历 ·"),
        )
        .map((n, i) => (
          <p className="summary-story" key={`incident-${i}`}>
            {n}
          </p>
        ))}
      <ul>
        {record.notes
          .filter((n) => n.includes("拒绝外出") || n.includes("被强制派出"))
          .map((n, i) => (
            <li key={`decision-${i}`}>{n}</li>
          ))}
        {s ? (
          <>
            {s.departed.length > 0 && <li>出发：{s.departed.join("、")}。</li>}
            {s.returned.length > 0 && (
              <li>归来：{s.returned.join("、")}，物资已清点入库。</li>
            )}
            {s.died.length > 0 && (
              <li className="warning">没能撑过今天：{s.died.join("、")}。</li>
            )}
            {s.hungry.length > 0 && (
              <li className="warning">仍然饥饿：{s.hungry.join("、")}。</li>
            )}
            {s.thirsty.length > 0 && (
              <li className="warning">仍然缺水：{s.thirsty.join("、")}。</li>
            )}
            {!s.departed.length &&
              !s.returned.length &&
              !s.died.length &&
              !s.hungry.length &&
              !s.thirsty.length && (
                <li>今天没有人员伤亡，留守与补给已经记录。</li>
              )}
          </>
        ) : (
          record.actions.slice(0, 3).map((a, i) => <li key={i}>{a}</li>)
        )}
      </ul>
    </article>
  );
}
export function DiaryPanel({ state }: { state: GameState }) {
  return (
    <div className="diary-list">
      {Array.from(
        { length: Math.min(state.day + 1, 100) },
        (_, i) => i + 1,
      ).map((day) => {
        const record = state.diary.find((d) => d.day === day);
        return record ? (
          <details key={day}>
            <summary>
              第 {day} 天 · {record.event}
            </summary>
            <DailySummaryCard record={record} />
            <p className="choice-record">我们的选择：{record.choice}</p>
            {record.actions.map((a, i) => (
              <p key={i}>{a}</p>
            ))}
            {record.notes.map((n, i) => (
              <p className="muted" key={i}>
                {n}
              </p>
            ))}
            <div className="change-list">
              {record.changes.map((c, i) => (
                <div key={i}>
                  <span>{c.label}</span>
                  <span>
                    {c.before} → {c.after}
                  </span>
                </div>
              ))}
            </div>
          </details>
        ) : (
          <div className="locked-day" key={day}>
            第 {day} 天 · {day <= state.day ? "今天还没有结束" : "尚未解锁"}
          </div>
        );
      })}
      {state.diary.length === 0 && (
        <p className="muted">今晚结算后，第一篇日记会留在这里。</p>
      )}
    </div>
  );
}
export function EndingPanel({
  state,
  onDiary,
  onNew,
}: {
  state: GameState;
  onDiary: () => void;
  onNew: () => void;
}) {
  const e = state.ending;
  if (!e) return null;
  return (
    <section className="ending-panel">
      <p className="eyebrow">ONE HUNDRED DAYS, ONE FAMILY</p>
      <p className="ending-kicker">生存至第 {state.day} 天 / 100 天</p>
      <h1>{e.title}</h1>
      <p className="story-text">{e.text}</p>
      {state.diary.find((r) => r.day === state.day) && (
        <DailySummaryCard
          record={state.diary.find((r) => r.day === state.day)!}
        />
      )}
      <div className="ending-stats">
        <div>
          <strong>{state.day} 天</strong>
          <small>这一家的生存记录</small>
        </div>
        <div>
          <strong>{state.resources.safety}</strong>
          <small>住所安全度</small>
        </div>
        <div>
          <strong>{state.people.filter((p) => p.alive).length} / 4</strong>
          <small>幸存的家人</small>
        </div>
      </div>
      <div className="ending-family">
        {IDS.map((id) => (
          <div key={id}>
            <div
              className={`avatar large-avatar ${!state.people.find((p) => p.id === id)!.alive ? "avatar-away" : ""}`}
              style={portraitStyle(id)}
            />
            <strong>{PEOPLE[id].name}</strong>
            <small>
              {!state.people.find((p) => p.id === id)!.alive
                ? `第${state.people.find((p) => p.id === id)!.deathDay}天死亡`
                : isAway(state, id)
                  ? "外出未归 · 最后记录"
                  : `健康 ${state.people.find((p) => p.id === id)!.health}`}
            </small>
          </div>
        ))}
      </div>
      {e.highlights.map((h, i) => (
        <blockquote key={i}>{h}</blockquote>
      ))}
      <div className="button-row">
        <button onClick={onDiary}>回看家庭日记</button>
        <button className="primary" onClick={onNew}>
          开始另一个故事
        </button>
      </div>
    </section>
  );
}
export function HelpPanel() {
  return (
    <>
      <p className="muted">
        你管理这一家四口，不需要选择扮演谁。活到第100天之前，每一天都可能有人再也回不来。
      </p>
      <div className="help-steps">
        <article>
          <Tag>01 · 早上选人</Tag>
          <h3>今天，谁外出？</h3>
          <p>
            点击一位在家的家人寻找食物或水。愿意就出发；拒绝时可换人，也可强制派出，情绪−10、信任−8。每天至多一人新出发，也可以都留守。最后一名活人不能离开。
          </p>
        </article>
        <article>
          <Tag>02 · 主动照顾</Tag>
          <h3>点人物，给食物或水</h3>
          <p>
            每人每天每种可给一份，立即消耗库存1份。夜间绝不自动补给。健康家人可以暂缓，连续3天没水、5天没食物后会明显恶化，病危者仍可能当晚死亡。每份都应给真正需要的人。
          </p>
        </article>
        <article>
          <Tag>03 · 结束今天</Tag>
          <h3>小结之后，迎接明天</h3>
          <p>
            翻开今天的避难日记，用道具解决一件事，或省下物资。然后结束今天，看看谁回家、带回什么、谁没能撑过去。广播线索、屋顶标记和车队补给，关系到第100天能否获救。
          </p>
        </article>
      </div>
      <p className="notice">
        外出需要数天，归期与收获未知，也可能一直不归。污染、身体和装备影响危险；地图帮助找路，面罩抵挡辐尘，斧头用来防身。带出去的道具无法在家中处理事件，也可能损坏。收获只在返回时入库，刷新不重抽。死者消失且不可复活，住所没有活人留守时提前结束。
      </p>
    </>
  );
}
