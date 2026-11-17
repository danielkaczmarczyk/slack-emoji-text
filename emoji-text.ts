#!/usr/bin/env bun
// Renders text as 3x5 block letters built from a Slack emoji.
//
// Usage:
//   bun emoji-text.ts                      # prompts for text and emoji
//   bun emoji-text.ts smiles-in-polish     # prompts for text only
//   bun emoji-text.ts | pbcopy             # prompts on stderr, result to clipboard
//   bun emoji-text.ts party-parrot < in.txt  # text from a file, one block per line

import { createInterface } from "node:readline/promises";

const EMPTY = ":empty:";
const DEFAULT_EMOJI = "smiles-in-polish";
const HEIGHT = 5;
const LETTER_GAP = 1;
const WORD_GAP = 2;

// Each glyph is 5 rows of 3 cells: "#" is filled, "." is empty.
const FONT: Record<string, string> = {
  A: "###|#.#|###|#.#|#.#",
  B: "##.|#.#|##.|#.#|##.",
  C: "###|#..|#..|#..|###",
  D: "##.|#.#|#.#|#.#|##.",
  E: "###|#..|##.|#..|###",
  F: "###|#..|##.|#..|#..",
  G: "###|#..|#.#|#.#|###",
  H: "#.#|#.#|###|#.#|#.#",
  I: "###|.#.|.#.|.#.|###",
  J: "..#|..#|..#|#.#|###",
  K: "#.#|#.#|##.|#.#|#.#",
  L: "#..|#..|#..|#..|###",
  M: "#.#|###|###|#.#|#.#",
  N: "##.|#.#|#.#|#.#|#.#",
  O: "###|#.#|#.#|#.#|###",
  P: "###|#.#|###|#..|#..",
  Q: "###|#.#|#.#|###|..#",
  R: "###|#.#|##.|#.#|#.#",
  S: "###|#..|###|..#|###",
  T: "###|.#.|.#.|.#.|.#.",
  U: "#.#|#.#|#.#|#.#|###",
  V: "#.#|#.#|#.#|#.#|.#.",
  W: "#.#|#.#|###|###|#.#",
  X: "#.#|#.#|.#.|#.#|#.#",
  Y: "#.#|#.#|.#.|.#.|.#.",
  Z: "###|..#|.#.|#..|###",
  "0": "###|#.#|#.#|#.#|###",
  "1": ".#.|##.|.#.|.#.|###",
  "2": "###|..#|###|#..|###",
  "3": "###|..#|###|..#|###",
  "4": "#.#|#.#|###|..#|..#",
  "5": "###|#..|###|..#|###",
  "6": "###|#..|###|#.#|###",
  "7": "###|..#|..#|..#|..#",
  "8": "###|#.#|###|#.#|###",
  "9": "###|#.#|###|..#|###",
  ".": "...|...|...|...|.#.",
  ",": "...|...|...|.#.|#..",
  "!": ".#.|.#.|.#.|...|.#.",
  "?": "###|..#|.#.|...|.#.",
  "-": "...|...|###|...|...",
  "+": "...|.#.|###|.#.|...",
  "'": ".#.|.#.|...|...|...",
  ":": "...|.#.|...|.#.|...",
  "/": "..#|..#|.#.|#..|#..",
};

function renderLine(line: string, emoji: string): string {
  const rows: string[][] = Array.from({ length: HEIGHT }, () => []);
  const pad = (n: number) => rows.forEach((r) => r.push(...Array(n).fill(EMPTY)));

  const words = line.toUpperCase().split(/\s+/).filter(Boolean);
  words.forEach((word, wi) => {
    if (wi > 0) pad(WORD_GAP);
    let drawn = 0;
    for (const ch of word) {
      const glyph = FONT[ch];
      if (!glyph) {
        console.error(`warning: no glyph for "${ch}", skipping`);
        continue;
      }
      if (drawn++ > 0) pad(LETTER_GAP);
      glyph.split("|").forEach((cells, y) => {
        for (const c of cells) rows[y].push(c === "#" ? emoji : EMPTY);
      });
    }
  });

  // Trailing empties are invisible, so drop them to keep the message short.
  return rows
    .map((r) => {
      let end = r.length;
      while (end > 0 && r[end - 1] === EMPTY) end--;
      // A fully blank row still needs one cell, or Slack collapses the line.
      return r.slice(0, Math.max(end, 1)).join("");
    })
    .join("\n");
}

function normalizeEmoji(raw: string): string {
  const name = raw.trim().replace(/^:+|:+$/g, "");
  return `:${name || DEFAULT_EMOJI}:`;
}

async function main() {
  let emojiArg = process.argv[2];
  let text: string;

  if (process.stdin.isTTY) {
    // Prompt on stderr so stdout stays clean for piping into pbcopy.
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    text = await rl.question("Text: ");
    if (!emojiArg) emojiArg = await rl.question(`Emoji [${DEFAULT_EMOJI}]: `);
    rl.close();
  } else {
    text = await Bun.stdin.text();
  }

  const emoji = normalizeEmoji(emojiArg ?? "");
  const blocks = text
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => renderLine(l, emoji));

  if (blocks.length === 0) {
    console.error("error: no text given");
    process.exit(1);
  }

  // A row of :empty: between blocks keeps multi-line text evenly spaced.
  console.log(blocks.join(`\n${EMPTY}\n`));
}

main();
