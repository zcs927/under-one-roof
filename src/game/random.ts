import type { GameState } from "./types";
export function draw(state: GameState) {
  let x = state.rngState;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  state.rngState = x >>> 0;
  return state.rngState / 4294967296;
}
