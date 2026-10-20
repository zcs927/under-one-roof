"use client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faHouseChimney,
  faBookOpen,
  faSeedling,
} from "@fortawesome/free-solid-svg-icons";
import type { GameState } from "@/game/types";
export function Home({
  game,
  ready,
  invalid,
  message,
  onNew,
  onContinue,
  onHelp,
}: {
  game: GameState | null;
  ready: boolean;
  invalid: boolean;
  message: string;
  onNew: () => void;
  onContinue: () => void;
  onHelp: () => void;
}) {
  return (
    <main className="welcome">
      <div className="welcome-art" />
      <div className="welcome-shade" />
      <section className="welcome-content">
        <p className="eyebrow">
          <FontAwesomeIcon icon={faHouseChimney} /> UNDER ONE ROOF
        </p>
        <h1>
          同一屋檐下<span>末日家人</span>
        </h1>
        <p className="lead">
          停水，断电，门外是废城。
          <br />
          屋里还有四个人要活下去。
        </p>
        <p className="muted">一百天，四个人。有人回来，也可能再也不见。</p>
        <div className="welcome-actions">
          <button className="primary" onClick={onNew} disabled={!ready}>
            开始新的故事 <FontAwesomeIcon icon={faArrowRight} />
          </button>
          <button onClick={onContinue} disabled={!ready || !game}>
            {game
              ? `继续 · 第 ${game.day} 天`
              : ready
                ? "还没有存档"
                : "正在读取存档"}
          </button>
        </div>
        {game && (
          <p className="small">
            这一家的故事 · {game.phase === "ending" ? "生存终章" : "进度已保留"}
          </p>
        )}
        {invalid && (
          <p role="alert" className="warning">
            {message}
          </p>
        )}
        {!game && ready && !invalid && <p className="small">{message}</p>}
        <button className="text-button" onClick={onHelp}>
          <FontAwesomeIcon icon={faBookOpen} /> 玩法说明
        </button>
        <p className="welcome-foot">
          一个关于生存、信任和家的故事 <span>001 — 100</span>
        </p>
      </section>
      <div className="welcome-note">
        <FontAwesomeIcon icon={faSeedling} />
        <span>家人的想法，也值得被听见。</span>
      </div>
    </main>
  );
}
