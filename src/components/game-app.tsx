"use client";
import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBookOpen,
  faCircleQuestion,
  faArrowLeft,
  faMoon,
  faVolumeXmark,
} from "@fortawesome/free-solid-svg-icons";
import { WEATHER } from "@/game/config";
import { useGame } from "@/game/use-game";
import { residents, isAway } from "@/game/presence";
import type { PersonId } from "@/game/types";
import type { Action } from "@/game/reducer";
import { Home } from "./home";
import { FamilyScene, PersonDetails } from "./family";
import { Modal } from "./primitives";
import { RoomJournal, type JournalView } from "./room-journal";
import { HelpPanel } from "./story-panels";
import { EncounterPopup } from "./encounter-popup";
import { ReturnPopup } from "./return-popup";
import { pendingReturns } from "@/game/return-stories";
export function GameApp() {
  const { session, start, send: dispatch, resume, home, dismiss } = useGame();
  const [help, setHelp] = useState(false),
    [journal, setJournal] = useState<JournalView | null>(null),
    [person, setPerson] = useState<PersonId | null>(null);
  const game = session.game;
  const returned = game ? pendingReturns(game) : [];
  const showReturn = session.playing && returned.length > 0 && !help && !person;
  const newStory = () => {
    if (game && !window.confirm("开始新故事会覆盖当前存档。确定继续吗？"))
      return;
    setJournal(null);
    setPerson(null);
    start();
  };
  const send = (action: Action) => {
    dispatch(action);
    if (action.type === "end-day") setJournal("today");
    if (action.type === "ack-return") setJournal("today");
    if (action.type === "next") {
      setJournal(null);
      setPerson(null);
    }
  };
  const openJournal = () => setJournal("today");
  const modals = (
    <>
      {help && (
        <Modal
          title="在这个屋里活下去"
          className="room-help"
          onClose={() => setHelp(false)}
        >
          <HelpPanel />
        </Modal>
      )}
      {game && journal && !showReturn && (
        <Modal
          title={`家庭日记 · 第${game.day}天`}
          wide
          className="room-journal"
          onClose={() => setJournal(null)}
        >
          <RoomJournal
            state={game}
            send={send}
            view={journal}
            onView={setJournal}
            onNew={newStory}
          />
        </Modal>
      )}
      {game && person && (
        <Modal
          title={`${person === "mom" ? "妈妈" : person === "dad" ? "爸爸" : person === "daughter" ? "姐姐" : "弟弟"}记在心里的事`}
          className="room-memories"
          onClose={() => setPerson(null)}
        >
          <PersonDetails state={game} id={person} onNegotiate={() => {}} />
        </Modal>
      )}
      {session.playing &&
        game?.phase === "morning" &&
        game.encounters?.current &&
        !game.encounters.current.acknowledged &&
        !help &&
        !journal &&
        !showReturn &&
        !person && (
          <EncounterPopup state={game} send={send} error={session.error} />
        )}
      {game && showReturn && (
        <ReturnPopup
          key={returned[0].id}
          state={game}
          trip={returned[0]}
          remaining={returned.length}
          send={send}
        />
      )}
    </>
  );
  if (!session.playing || !game)
    return (
      <>
        <Home
          game={game}
          ready={session.ready}
          invalid={session.invalidSave}
          message={session.saveMessage}
          onNew={newStory}
          onContinue={resume}
          onHelp={() => setHelp(true)}
        />
        {modals}
      </>
    );
  const away = game.people.filter((p) => isAway(game, p.id)).length;
  return (
    <div
      className={`shelter-room-app ${game.phase === "morning" ? "" : "is-evening"}`}
    >
      <header className="room-hud">
        <button className="room-back" onClick={home} aria-label="返回开始页">
          <FontAwesomeIcon icon={faArrowLeft} />
          <span>同一屋檐下</span>
        </button>
        <div className="room-date">
          <span>
            第 <strong>{String(game.day).padStart(2, "0")}</strong> 天
          </span>
          <small>/ 100</small>
        </div>
        <nav>
          <button onClick={openJournal} aria-label="打开家庭日记">
            <FontAwesomeIcon icon={faBookOpen} />
          </button>
          <button onClick={() => setHelp(true)} aria-label="打开玩法说明">
            <FontAwesomeIcon icon={faCircleQuestion} />
          </button>
        </nav>
      </header>
      <main className="room-playfield">
        <div className="room-above">
          <span>{WEATHER[(game.day - 1) % WEATHER.length]}</span>
          <span>
            {game.phase === "morning"
              ? "早晨，门外还很安静。"
              : game.phase === "night"
                ? "夜深了。桌上多了一页日记。"
                : "最后一页，写下这一家的结局。"}
          </span>
        </div>
        <FamilyScene
          key={game.day}
          state={game}
          onPerson={setPerson}
          onDiary={openJournal}
          onLedger={() => setJournal("family")}
          send={send}
        />
        <footer className="room-dock">
          <div className="room-whispers">
            <span>
              {residents(game).length}人在家{away ? ` · ${away}人未归` : ""}
            </span>
            <small role="status" className={session.saved ? "" : "warning"}>
              {session.saved ? "已经记下。" : session.saveMessage}
            </small>
          </div>
          <p>点人物照顾家人，点物品拿取，点日记做决定。</p>
          <button
            className="room-end-day"
            onClick={() =>
              game.phase === "morning"
                ? send({ type: "end-day" })
                : openJournal()
            }
          >
            <FontAwesomeIcon icon={faMoon} />{" "}
            {game.phase === "morning"
              ? "结束今天"
              : game.phase === "night"
                ? "翻开今晚的小结"
                : "翻开最后一页"}{" "}
            →
          </button>
        </footer>
        <p className="room-phone-note">
          <FontAwesomeIcon icon={faVolumeXmark} />{" "}
          房间里很安静。横屏能看得更清楚。
        </p>
      </main>
      {session.error && (
        <div className="error-banner room-error" role="alert">
          <span>{session.error}</span>
          <button onClick={dismiss}>知道了</button>
        </div>
      )}
      {modals}
    </div>
  );
}
