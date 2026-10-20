"use client";
import { useEffect, useReducer } from "react";
import { createGame } from "./initial";
import { createFamilyGame, enterFamilyMode } from "./family-mode";
import { transition, type Action } from "./reducer";
import { clearGame, loadGame, saveGame, type LoadResult } from "./storage";
import type { GameState, PersonId } from "./types";
interface Session {
  game: GameState | null;
  ready: boolean;
  error: string;
  saveMessage: string;
  saved: boolean;
  invalidSave: boolean;
  playing: boolean;
}
type SessionAction =
  | { type: "hydrate"; result: LoadResult }
  | { type: "start"; id?: PersonId; seed?: number }
  | { type: "play" }
  | { type: "home" }
  | { type: "game"; action: Action }
  | { type: "save-result"; message: string; saved: boolean }
  | { type: "dismiss" };
export function sessionReducer(
  session: Session,
  action: SessionAction,
): Session {
  if (action.type === "hydrate")
    return {
      ...session,
      ready: true,
      game: action.result.status === "valid" ? action.result.state : null,
      invalidSave: action.result.status === "invalid",
      saveMessage:
        action.result.status === "valid" ? "进度已保存" : action.result.message,
      saved: action.result.status === "valid",
    };
  if (action.type === "start")
    return {
      ...session,
      game: action.id
        ? createGame(action.id, action.seed)
        : createFamilyGame(action.seed),
      playing: true,
      error: "",
      invalidSave: false,
    };
  if (action.type === "play")
    return {
      ...session,
      game: session.game ? enterFamilyMode(session.game) : null,
      playing: !!session.game,
    };
  if (action.type === "home") return { ...session, playing: false };
  if (action.type === "dismiss") return { ...session, error: "" };
  if (action.type === "save-result")
    return { ...session, saveMessage: action.message, saved: action.saved };
  if (action.type === "game" && session.game) {
    const result = transition(session.game, action.action);
    return { ...session, game: result.state, error: result.error ?? "" };
  }
  return session;
}
export function useGame() {
  const [session, dispatch] = useReducer(sessionReducer, {
    game: null,
    ready: false,
    error: "",
    saveMessage: "正在读取存档…",
    saved: false,
    invalidSave: false,
    playing: false,
  });
  useEffect(() => {
    let result: LoadResult;
    try {
      result = loadGame(window.localStorage);
    } catch {
      result = {
        status: "unavailable",
        message: "无法访问本地存储，本次只能保留会话内进度。",
      };
    }
    dispatch({ type: "hydrate", result });
  }, []);
  useEffect(() => {
    if (!session.ready || !session.game) return;
    let result;
    try {
      result = saveGame(window.localStorage, session.game);
    } catch {
      result = {
        ok: false,
        message: "无法自动保存，本次进度仅保留在当前会话。",
      };
    }
    dispatch({
      type: "save-result",
      message: result.message,
      saved: result.ok,
    });
  }, [session.ready, session.game]);
  const start = (id?: PersonId) => {
    try {
      clearGame(window.localStorage);
    } catch {
      /* 不可用时仍允许在会话内游玩。 */
    }
    const seed = window.crypto.getRandomValues(new Uint32Array(1))[0];
    dispatch({ type: "start", id, seed });
  };
  return {
    session,
    start,
    send: (action: Action) => dispatch({ type: "game", action }),
    resume: () => dispatch({ type: "play" }),
    home: () => dispatch({ type: "home" }),
    dismiss: () => dispatch({ type: "dismiss" }),
  };
}
