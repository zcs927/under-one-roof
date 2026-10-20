import type { CSSProperties } from "react";

/** Public assets need the same prefix as Next.js on project Pages sites. */
export function assetUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_BASE_PATH || ""}${path}`;
}

const sceneFiles = {
  home: "shelter-family.png",
  empty: "shelter-empty.png",
  room: "shelter-clean-table.png",
  props: "shelter-props-atlas.png",
  diary: "shelter-diary.png",
  mom: "characters/mom.png",
  dad: "characters/dad.png",
  daughter: "characters/daughter.png",
  brother: "characters/brother.png",
};

export const sceneArtStyle = Object.fromEntries(
  Object.entries(sceneFiles).map(([name, file]) => [
    `--art-${name}`,
    `url("${assetUrl(`/images/${file}`)}")`,
  ]),
) as CSSProperties;
