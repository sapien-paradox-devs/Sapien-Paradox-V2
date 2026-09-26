/**
 * Deterministic identicon generator — a 5×5 symmetric grid coloured from the
 * Jewel palette, like GitHub's default avatars. Pure function, no network, no
 * external service.
 *
 * The same seed always produces the same icon. The frontend falls back to the
 * user's email when `avatarSeed` is null.
 */

const PALETTE = [
  { fg: "#2952e3", bg: "#e8edfd" }, // cobalt
  { fg: "#f5a623", bg: "#fdf1dc" }, // saffron
  { fg: "#ff6b57", bg: "#fde8e5" }, // coral
  { fg: "#14b8a6", bg: "#e0f5f2" }, // teal
];

function hash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

type Cell = { x: number; y: number; size: number };

function cells(seed: string, gridSize: number): { filled: Cell[]; colorIndex: number } {
  const h = hash(seed);
  const half = Math.ceil(gridSize / 2);
  const cellSize = 1 / gridSize;
  const filled: Cell[] = [];

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < half; col++) {
      const bit = (row * half + col) % 15;
      if ((h >> bit) & 1) {
        filled.push({ x: col * cellSize, y: row * cellSize, size: cellSize });
        const mirror = gridSize - 1 - col;
        if (mirror !== col) {
          filled.push({ x: mirror * cellSize, y: row * cellSize, size: cellSize });
        }
      }
    }
  }

  return { filled, colorIndex: (h >> 15) & 3 };
}

export function avatarSvg(seed: string, size: number): string {
  const { filled, colorIndex } = cells(seed, 5);
  const { fg, bg } = PALETTE[colorIndex];
  const rects = filled
    .map((c) => `<rect x="${c.x}" y="${c.y}" width="${c.size}" height="${c.size}" fill="${fg}"/>`)
    .join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" width="${size}" height="${size}" shape-rendering="crispEdges">`,
    `<rect width="1" height="1" fill="${bg}"/>`,
    rects,
    `</svg>`,
  ].join("");
}

export function avatarDataUrl(seed: string, size: number): string {
  return `data:image/svg+xml,${encodeURIComponent(avatarSvg(seed, size))}`;
}
