"use client";
import { useId, useState } from "react";
import { appearanceFor } from "@/game/appearance";
import { getPerson } from "@/game/initial";
import art from "@/game/character-art.json";
import type { GameState, PersonId } from "@/game/types";
import { assetUrl } from "@/game/assets";

export function CharacterSprite({
  state,
  id,
}: {
  state: GameState;
  id: PersonId;
}) {
  const visual = appearanceFor(state, getPerson(state, id));
  const [ready, setReady] = useState(false);
  const clipId = useId();
  if (visual.hidden) return null;
  const sheet = art[id];
  const cell =
    sheet.cells[{ normal: 0, sick: 1, injured: 2, hungry: 3 }[visual.kind]];
  const changed = visual.kind !== "normal";
  return (
    <div
      className={`scene-character character-${id} appearance-${visual.kind} ${changed && ready ? "has-state-art" : ""} ${visual.critical ? "is-critical" : ""}`}
      data-person={id}
      data-appearance={visual.kind}
      data-conditions={visual.labels.join("、")}
      aria-hidden="true"
    >
      {changed && (
        <svg
          className="character-state-art"
          viewBox={cell.viewBox.join(" ")}
          preserveAspectRatio="xMidYMax meet"
          style={{ opacity: ready ? 1 : 0 }}
        >
          <defs>
            <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
              <rect
                x={cell.clip[0]}
                y={cell.clip[1]}
                width={cell.clip[2]}
                height={cell.clip[3]}
              />
            </clipPath>
          </defs>
          <image
            href={assetUrl(sheet.src)}
            width={sheet.width}
            height={sheet.height}
            clipPath={`url(#${clipId})`}
            onLoad={() => setReady(true)}
          />
        </svg>
      )}
      {visual.labels.length > 0 && (
        <span className="character-state-note">
          {visual.labels.join(" · ")}
        </span>
      )}
    </div>
  );
}
