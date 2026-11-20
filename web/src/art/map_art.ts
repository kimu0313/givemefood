// 스테이지 지도 그림 (아이소메트릭 3/4 시점, 2026-11-14 사용자 요청 "스테이지 부분을 3d 로, 아이소메트릭 계열의 3/4 시점.
// 스테이지 길도 배경이랑 따로 놀지 않고 길처럼 같이 이어지게").
// 땅 = 마름모 타일 (가게마다 동네 바닥 무늬, 경계는 타일 계단), 길 = 인도보다 한 단 낮은 진짜 길 (연석 옆면이 보임) —
// 가게들을 지그재그로 잇고, 가운데 흰 안내선(지나온 길은 실선, 갈 길은 점선), 가게 입구 앞마당으로 들어가는 샛길(∞).
// 건물(사용자 그림 또는 직접 그린 아이소 건물) · 배경 집 · 나무 · 가로등 · 소품은 앞뒤 순서대로 (뒤 → 앞) 그린다.
// 스테이지 발판·이름표·버튼은 StageMap 이 이 위에 올린다 (발판은 길바닥 위 자리에).

import { Color, R, V, fmod, rgb, v } from "../engine/geom.ts";
import type { Gfx } from "../engine/gfx.ts";
import { Node2D } from "../engine/node.ts";
import { Rng, strHash } from "../engine/rng.ts";
import * as D from "../core/defs.ts";
import * as ArtAssets from "./art_assets.ts";
import * as FoodArt from "./food_art.ts";
import * as G from "./map_geo.ts";
import * as I from "./iso_art.ts";
import { iso, type GRect, type Zone } from "./map_geo.ts";
import { WORLD_IMG_H, WORLD_SCALE } from "./map_world.ts";

/** 지도 배경 그림(map/world.webp)을 그릴지. 2026-11-20 사용자 "게임 스테이지 배경 없애 줘" → false (단색 바탕 + 길 띠). 그림 파일과 길 좌표는 그대로 둠 */
export const SHOW_WORLD_IMAGE = true; // 2026-11-20 사용자 "스테이지 배경 일단 이걸로 넣어 줘" → 다시 켬 (같은 그림 art_src/map_world.png)

// ---------------------------------------------------------------- 동네별 색

interface Theme {
  night: boolean;
  style: "slab" | "blocks" | "brick" | "sand" | "grass";
  base: Color;
  alt: Color;
  grout: Color;
  seam: Color;
  tree: string; // 나무 종류
  house: I.HouseStyle[]; // 배경 집 모양
}

const LIT = rgb(1.0, 0.82, 0.48);
const THEMES: Record<string, Theme> = {
  alley: {
    night: true, style: "slab", base: rgb(0.27, 0.29, 0.36), alt: rgb(0.23, 0.25, 0.31), grout: rgb(0.16, 0.17, 0.22), seam: rgb(0.12, 0.12, 0.16), tree: "round",
    house: [
      { wall: rgb(0.55, 0.32, 0.26), roof: null, trim: rgb(0.3, 0.2, 0.17), window: LIT, floors: 2, sign: "철물점", signBg: rgb(0.2, 0.32, 0.55), signFg: rgb(1, 1, 1) },
      { wall: rgb(0.5, 0.48, 0.44), roof: rgb(0.26, 0.38, 0.5), trim: rgb(0.28, 0.24, 0.22), window: LIT, floors: 1, sign: "세탁소", signBg: rgb(0.95, 0.93, 0.85) },
    ],
  },
  bunsik: {
    night: false, style: "blocks", base: rgb(0.83, 0.74, 0.6), alt: rgb(0.76, 0.52, 0.44), grout: rgb(0.62, 0.53, 0.42), seam: rgb(0.5, 0.42, 0.32), tree: "blossom",
    house: [
      { wall: rgb(0.98, 0.9, 0.78), roof: rgb(0.72, 0.42, 0.3), trim: rgb(0.5, 0.36, 0.26), window: rgb(0.62, 0.8, 0.9), floors: 3, sign: "햇살초등학교", signBg: rgb(0.2, 0.45, 0.3), signFg: rgb(1, 1, 1) },
      { wall: rgb(0.86, 0.66, 0.5), roof: null, trim: rgb(0.46, 0.32, 0.24), window: rgb(0.62, 0.8, 0.9), floors: 1, sign: "슈퍼", signBg: rgb(0.2, 0.55, 0.35), signFg: rgb(1, 1, 1) },
    ],
  },
  market: {
    night: true, style: "brick", base: rgb(0.44, 0.24, 0.22), alt: rgb(0.38, 0.2, 0.19), grout: rgb(0.24, 0.13, 0.13), seam: rgb(0.18, 0.1, 0.1), tree: "round",
    house: [
      { wall: rgb(0.36, 0.28, 0.4), roof: null, trim: rgb(0.2, 0.15, 0.22), window: LIT, floors: 2, sign: "옷가게", signBg: rgb(0.95, 0.3, 0.5), signFg: rgb(1, 1, 1) },
      { wall: rgb(0.6, 0.45, 0.3), roof: rgb(0.8, 0.3, 0.2), trim: rgb(0.32, 0.22, 0.15), window: LIT, floors: 1, sign: "떡집", awning: [rgb(0.9, 0.3, 0.2), rgb(1, 0.9, 0.6)] },
    ],
  },
  beach: {
    night: false, style: "sand", base: rgb(0.92, 0.81, 0.6), alt: rgb(0.86, 0.74, 0.52), grout: rgb(0.8, 0.68, 0.48), seam: rgb(0.7, 0.58, 0.4), tree: "pine",
    house: [
      { wall: rgb(0.95, 0.95, 0.93), roof: rgb(0.2, 0.45, 0.8), trim: rgb(0.3, 0.4, 0.55), window: rgb(0.6, 0.82, 0.95), floors: 1, sign: "구명대", signBg: rgb(0.9, 0.2, 0.2), signFg: rgb(1, 1, 1) },
      { wall: rgb(0.78, 0.6, 0.42), roof: rgb(0.85, 0.5, 0.25), trim: rgb(0.45, 0.3, 0.2), window: rgb(0.6, 0.82, 0.95), floors: 1, sign: "횟집", awning: [rgb(0.2, 0.45, 0.8), rgb(1, 1, 1)] },
    ],
  },
  suljip: {
    night: true, style: "slab", base: rgb(0.3, 0.24, 0.23), alt: rgb(0.26, 0.2, 0.2), grout: rgb(0.17, 0.13, 0.13), seam: rgb(0.12, 0.09, 0.09), tree: "round",
    house: [
      { wall: rgb(0.3, 0.3, 0.36), roof: null, trim: rgb(0.16, 0.16, 0.2), window: LIT, floors: 2, sign: "노래방", signBg: rgb(0.2, 0.1, 0.3), signFg: rgb(1.0, 0.45, 0.85) },
      { wall: rgb(0.5, 0.36, 0.28), roof: null, trim: rgb(0.25, 0.18, 0.14), window: LIT, floors: 1, sign: "호프", signBg: rgb(0.15, 0.12, 0.1), signFg: rgb(1.0, 0.8, 0.3) },
    ],
  },
  lot: {
    night: false, style: "grass", base: rgb(0.45, 0.6, 0.34), alt: rgb(0.4, 0.55, 0.3), grout: rgb(0.36, 0.5, 0.27), seam: rgb(0.3, 0.42, 0.22), tree: "round",
    house: [{ wall: rgb(0.8, 0.78, 0.72), roof: rgb(0.5, 0.5, 0.55), trim: rgb(0.4, 0.38, 0.36), window: rgb(0.62, 0.8, 0.9), floors: 1 }],
  },
};

export function themeOf(z: Zone): Theme {
  return THEMES[z.shop?.theme ?? "lot"] ?? THEMES.lot;
}

// 길 (인도보다 CURB_H 낮은 돌길)
const ROAD_BASE = rgb(0.84, 0.76, 0.64);
const ROAD_GROUT = rgb(0.66, 0.57, 0.47);
const CURB_FACE = rgb(0.6, 0.56, 0.52);
const CURB_TOP = rgb(0.9, 0.88, 0.84);

// ---------------------------------------------------------------- 바닥 무늬 (아이소 타일, 한 번 만들어 둠)

const RES = 2; // 무늬를 2배로 그려 두고 줄여 쓴다 (또렷하게)
const PN = 3; // 무늬 한 장 = PN × PN 타일 반복 단위
const patCache = new Map<string, CanvasPattern | null>();

/** 마름모 타일 무늬. h = 바닥 높이 (무늬 칸이 그 높이의 타일과 맞게) */
function tilePattern(ctx: CanvasRenderingContext2D, key: string, style: string, base: Color, alt: Color, grout: Color, h: number): CanvasPattern | null {
  const ck = `${key}@${h}`;
  if (patCache.has(ck)) return patCache.get(ck) ?? null;
  let pat: CanvasPattern | null = null;
  const src = patternCanvas(key, style, base, alt, grout);
  if (src !== null) {
    pat = ctx.createPattern(src, "repeat");
    if (pat !== null && typeof DOMMatrix !== "undefined") pat.setTransform(new DOMMatrix().translate(0, G.OY - h).scale(1 / RES, 1 / RES));
  }
  patCache.set(ck, pat);
  return pat;
}

const canvasCache = new Map<string, HTMLCanvasElement | null>();

function patternCanvas(key: string, style: string, base: Color, alt: Color, grout: Color): HTMLCanvasElement | null {
  if (canvasCache.has(key)) return canvasCache.get(key) ?? null;
  if (typeof document === "undefined") return null;
  const W = PN * 2 * G.TA;
  const H = PN * 2 * G.TB;
  const c = document.createElement("canvas");
  c.width = W * RES;
  c.height = H * RES;
  const x = c.getContext("2d");
  canvasCache.set(key, null);
  if (x === null) return null;
  canvasCache.set(key, c);
  const rng = new Rng(strHash(key));
  const P2 = PN * 2;
  const hash = (gx: number, gy: number, salt: number): number => {
    const a = ((gx + gy) % P2 + P2) % P2;
    const b = ((gx - gy) % P2 + P2) % P2;
    let hh = (a * 73856093) ^ (b * 19349663) ^ (salt * 83492791);
    hh = Math.imul(hh ^ (hh >>> 13), 1274126177);
    return ((hh ^ (hh >>> 16)) >>> 0) / 4294967296;
  };
  x.fillStyle = grout.css();
  x.fillRect(0, 0, c.width, c.height);
  if (style === "sand" || style === "grass") {
    x.fillStyle = base.css();
    x.fillRect(0, 0, c.width, c.height);
    x.scale(RES, RES);
    const n = style === "sand" ? 260 : 340;
    for (let k = 0; k < n; k++) {
      const px = rng.randf() * W;
      const py = rng.randf() * H;
      const col = rng.randf() < 0.5 ? alt : base.lightened(0.08);
      for (const dx of [-W, 0, W]) {
        for (const dy of [-H, 0, H]) {
          const qx = px + dx;
          const qy = py + dy;
          if (qx < -12 || qx > W + 12 || qy < -12 || qy > H + 12) continue;
          if (style === "sand") {
            x.fillStyle = col.css();
            x.beginPath();
            x.ellipse(qx, qy, 2.2, 1.2, 0, 0, Math.PI * 2);
            x.fill();
          } else {
            x.strokeStyle = (rng.randf() < 0.5 ? alt.darkened(0.12) : base.lightened(0.14)).css();
            x.lineWidth = 2;
            x.beginPath();
            x.moveTo(qx, qy);
            x.lineTo(qx - 3, qy - 8);
            x.moveTo(qx + 2, qy);
            x.lineTo(qx + 5, qy - 7);
            x.stroke();
          }
        }
      }
    }
    return c;
  }
  // 타일 무늬: 땅 좌표 → 무늬 좌표 (아이소 변환) 로 놓고 네모를 그리면 마름모가 된다
  x.setTransform(RES * G.TA, RES * G.TB, -RES * G.TA, RES * G.TB, 0, 0);
  const lw = 0.035;
  const quad = (x0: number, y0: number, w: number, hh: number, col: Color, inset: number) => {
    x.fillStyle = col.css();
    x.fillRect(x0 + inset, y0 + inset, w - inset * 2, hh - inset * 2);
    // 왼쪽 위 모서리는 밝게, 오른쪽 아래는 어둡게 (살짝 도톰)
    x.lineWidth = lw;
    x.strokeStyle = col.lightened(0.14).css();
    x.beginPath();
    x.moveTo(x0 + inset, y0 + hh - inset);
    x.lineTo(x0 + inset, y0 + inset);
    x.lineTo(x0 + w - inset, y0 + inset);
    x.stroke();
    x.strokeStyle = col.darkened(0.16).css();
    x.beginPath();
    x.moveTo(x0 + w - inset, y0 + inset);
    x.lineTo(x0 + w - inset, y0 + hh - inset);
    x.lineTo(x0 + inset, y0 + hh - inset);
    x.stroke();
  };
  const tint = (col: Color, t: number) => (t >= 0 ? col.lightened(t) : col.darkened(-t));
  for (let gx = -2; gx <= P2 + 2; gx++) {
    for (let gy = -P2 - 2; gy <= P2 + 2; gy++) {
      const r0 = hash(gx, gy, 1);
      if (style === "slab") {
        const col = tint(r0 < 0.18 ? alt : base, (hash(gx, gy, 2) - 0.5) * 0.12);
        quad(gx, gy, 1, 1, col, 0.035);
      } else if (style === "blocks") {
        // 보도블록: 한 타일 = 2×2 작은 블록, 군데군데 붉은 블록
        const red = r0 < 0.22;
        for (let a = 0; a < 2; a++) {
          for (let b = 0; b < 2; b++) {
            const col = tint(red ? alt : base, (hash(gx * 2 + a, gy * 2 + b, 3) - 0.5) * 0.1);
            quad(gx + a * 0.5, gy + b * 0.5, 0.5, 0.5, col, 0.025);
          }
        }
      } else if (style === "brick") {
        // 벽돌: gx 방향으로 긴 벽돌, 줄마다 반 칸 어긋남
        for (let row = 0; row < 4; row++) {
          const off = row % 2 === 0 ? 0 : 0.25;
          for (let k = -1; k < 2; k++) {
            const bx = gx + off + k * 0.5;
            const col = tint(hash(gx * 4 + k, gy * 4 + row, 4) < 0.25 ? alt : base, (hash(gx * 4 + k, gy * 4 + row, 5) - 0.5) * 0.14);
            const x0 = Math.max(bx, gx);
            const x1 = Math.min(bx + 0.5, gx + 1);
            if (x1 - x0 > 0.02) quad(x0, gy + row * 0.25, x1 - x0, 0.25, col, 0.02);
          }
        }
      } else {
        // 길: 작은 네모 돌 (2×2)
        for (let a = 0; a < 2; a++) {
          for (let b = 0; b < 2; b++) {
            const col = tint(base, (hash(gx * 2 + a, gy * 2 + b, 6) - 0.5) * 0.12);
            quad(gx + a * 0.5, gy + b * 0.5, 0.5, 0.5, col, 0.03);
          }
        }
      }
    }
  }
  return c;
}

// ---------------------------------------------------------------- 해변 물길

/**
 * 해변 가게 둘레를 바다와 잇는 물길 (2026-11-14 사용자: "바다랑 연결해줘"): 바다 속에서 내려와 건물 양옆을 지나
 * 건물 바닥 왼쪽·오른쪽 모서리를 감싸고 그림 속 바위 둘레 물 밑으로 들어간다. 화면 좌표, 부드럽게 이은 닫힌 곡선.
 * 맨 위 두 점은 바다 속이라 그 사이 변은 바다에 덮여 안 보인다.
 */
function inletShape(z: Zone): V[] {
  const f = z.foot;
  const L = iso(f.x0, f.y1); // 건물 바닥 왼쪽 꼭짓점
  const R = iso(f.x1, f.y0); // 오른쪽 꼭짓점
  const ctrl: V[] = [
    v(L.x - 150, 130),
    v(L.x - 145, 330),
    v(L.x - 125, 540),
    iso(f.x0 - 1.3, f.y1 + 0.2),
    iso(f.x0 + 0.3, f.y1 + 0.45),
    iso(f.x0 + 1.5, f.y1 - 0.5), // 여기부터 건물 그림 밑 (안 보임)
    iso(f.x1 - 1.0, f.y0 + 2.0),
    iso(f.x1 - 0.4, f.y0 + 0.6),
    iso(f.x1 + 0.45, f.y0 - 0.3),
    v(R.x + 75, R.y - 110),
    v(R.x + 110, 340),
    v(R.x + 125, 130),
  ];
  return smoothClosed(ctrl, 10);
}

/** 닫힌 꺾은선을 캣멀-롬 곡선으로 (점마다 n 조각) */
function smoothClosed(c: V[], n: number): V[] {
  const out: V[] = [];
  const m = c.length;
  for (let i = 0; i < m; i++) {
    const p0 = c[(i - 1 + m) % m];
    const p1 = c[i];
    const p2 = c[(i + 1) % m];
    const p3 = c[(i + 2) % m];
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, cc: number, d: number) => 0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (-a + 3 * b - 3 * cc + d) * t3);
      out.push(v(f(p0.x, p1.x, p2.x, p3.x), f(p0.y, p1.y, p2.y, p3.y)));
    }
  }
  return out;
}

function insidePoly(p: V, poly: V[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** 점에서 닫힌 꺾은선 테두리까지 거리 */
function edgeDist(p: V, poly: V[]): number {
  let best = 1e9;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j];
    const dx = poly[i].x - a.x;
    const dy = poly[i].y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / Math.max(1e-6, dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t));
  }
  return best;
}

/** 점이 물길 안이거나 물가에서 margin 안쪽 */
function nearPoly(p: V, poly: V[], margin: number): boolean {
  return insidePoly(p, poly) || edgeDist(p, poly) < margin;
}

// ---------------------------------------------------------------- 그림 조각 (앞뒤 순서로 그림)

interface Sprite {
  depth: number; // gx + gy (클수록 앞)
  x0: number; // 화면 가로 범위 (안 보이면 건너뜀)
  x1: number;
  draw: (g: Gfx) => void;
}

export class MapArt extends Node2D {
  size = v(1920, 1080);
  locked: boolean[] = []; // 구역마다 잠김 (어둡게 + 자물쇠)
  spurOpen: boolean[] = []; // 구역마다 무한 영업 샛길이 열림 (파란 안내선)
  walkedS = -6.0; // 지나온 길 (이 거리까지 흰 실선)
  /** 보이는 가로 범위 (그 밖은 그리지 않음) */
  viewX0 = -1e9;
  viewX1 = 1e9;

  private t = 0.0;
  private sprites: Sprite[] | null = null;
  private zonePaths: Path2D[] | null = null;
  private roadPaths: { top: Path2D; floor: Path2D } | null = null;
  private puddles: [V, number][] | null = null;
  private inlets = new Map<number, { poly: V[]; ripples: V[] }>();

  /** 해변 물길 (구역마다 한 번 만들어 둠) + 물 위 잔물결 자리 */
  private inlet(z: Zone): { poly: V[]; ripples: V[] } {
    let w = this.inlets.get(z.index);
    if (w === undefined) {
      const poly = inletShape(z);
      const ripples: V[] = [];
      const rng = new Rng(strHash(`ripples_${z.index}`));
      let x0 = 1e9;
      let x1 = -1e9;
      let y1 = 0;
      for (const p of poly) {
        x0 = Math.min(x0, p.x);
        x1 = Math.max(x1, p.x);
        y1 = Math.max(y1, p.y);
      }
      for (let k = 0; k < 400 && ripples.length < 22; k++) {
        const p = v(rng.randfRange(x0, x1), rng.randfRange(290, y1));
        if (insidePoly(p, poly) && edgeDist(p, poly) > 22 && ripples.every((q) => q.distanceTo(p) > 60)) ripples.push(p);
      }
      w = { poly, ripples };
      this.inlets.set(z.index, w);
    }
    return w;
  }

  process(dt: number): void {
    this.t += dt;
  }

  private seen(x0: number, x1: number): boolean {
    return x1 >= this.viewX0 - 40 && x0 <= this.viewX1 + 40;
  }

  draw(g: Gfx): void {
    if (typeof Path2D === "undefined") return;
    const L = G.layout();
    if (G.WORLD_ART) {
      this.drawWorld(g, L);
      return;
    }
    this.drawGround(g, L);
    this.drawRoad(g, L);
    this.drawSprites(g, L);
    this.drawWeather(g, L);
    this.drawDim(g, L);
  }

  /**
   * 그림 지도 (G.WORLD_ART): 사용자 그림 한 장(보이는 부분만 잘라 키워서) → 지나온 길·갈 길 안내선·∞ 샛길 → 가게 건물 그림
   * → 분식집 벚꽃 잎 → 안 연 가게 어둡게. 땅·길·집·나무는 그림에 다 있다.
   */
  private drawWorld(g: Gfx, L: G.MapLayout): void {
    const ctx = g.ctx;
    if (SHOW_WORLD_IMAGE) {
      const img = ArtAssets.worldMap();
      if (img !== null) {
        const k = WORLD_SCALE;
        const sx0 = Math.max(0, Math.floor((this.viewX0 - 60) / k));
        const sx1 = Math.min(img.width, Math.ceil((this.viewX1 + 60) / k));
        if (sx1 > sx0) {
          ctx.save();
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, sx0, 0, sx1 - sx0, WORLD_IMG_H, sx0 * k, 0, (sx1 - sx0) * k, WORLD_IMG_H * k);
          ctx.restore();
        }
      }
    } else {
      // 2026-11-20 사용자 "게임 스테이지 배경 없애 줘": 배경 그림 대신 차분한 단색 바탕 + 스테이지를 잇는 길 띠만
      const x0 = Math.max(0, this.viewX0 - 60);
      const x1 = Math.min(L.width, this.viewX1 + 60);
      const grad = ctx.createLinearGradient(0, 0, 0, this.size.y);
      grad.addColorStop(0, "#3a3550");
      grad.addColorStop(1, "#2a2438");
      ctx.fillStyle = grad;
      ctx.fillRect(x0, 0, x1 - x0, this.size.y);
      this.drawPlainRoad(g, L);
    }
    ctx.save();
    this.drawGuide(g, L);
    ctx.restore();
    for (const z of L.zones) {
      if (z.shop === null || !this.seen(z.bounds.x - 40, z.bounds.endX + 40)) continue;
      this.drawBuilding(g, z);
    }
    if (SHOW_WORLD_IMAGE) this.drawWeather(g, L, false); // 배경이 없으면 벚꽃 잎도 안 날림
    this.drawDim(g, L);
  }

  /** 배경 그림이 없을 때 스테이지를 잇는 길 (먹선 테두리 + 옅은 길 띠, ∞ 샛길 포함) */
  private drawPlainRoad(g: Gfx, L: G.MapLayout): void {
    const ctx = g.ctx;
    const pts: V[] = [];
    for (let s = -6; s < L.endS; s += 0.25) {
      const [x, y] = G.pathAt(s);
      pts.push(iso(x, y));
    }
    const [ex, ey] = G.pathAt(L.endS);
    pts.push(iso(ex, ey));
    const spurs: [V, V][] = [];
    for (const z of L.zones) if (z.spurS >= 0) spurs.push([iso(z.spurBase[0], z.spurBase[1]), iso(z.spurEnd[0], z.spurEnd[1])]);
    const path = () => {
      ctx.beginPath();
      pts.forEach((p, k) => (k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      for (const [a, b] of spurs) {
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
    };
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    path();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 104;
    ctx.translate(0, 8);
    ctx.stroke();
    ctx.translate(0, -8);
    ctx.strokeStyle = "#1f1a2a";
    ctx.lineWidth = 100;
    ctx.stroke();
    ctx.strokeStyle = "#5b5470";
    ctx.lineWidth = 86;
    ctx.stroke();
    ctx.restore();
  }

  /** 골목 포장마차 동네엔 비, 동네 분식집 동네엔 벚꽃 잎 (화면에 보이는 구역만, 그림 지도는 벚꽃만) */
  private drawWeather(g: Gfx, L: G.MapLayout, rain = true): void {
    const tt = this.t;
    for (const z of L.zones) {
      const theme = z.shop?.theme ?? "lot";
      if (!this.seen(z.x0, z.x1)) continue;
      const w = z.x1 - z.x0;
      if (theme === "alley" && rain) {
        const ctx = g.ctx;
        ctx.save();
        ctx.strokeStyle = "rgba(190,210,255,0.32)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let k = 0; k < 150; k++) {
          const x = z.x0 + fmod(k * 137.5 + tt * 90, w);
          const y = 110 + fmod(k * 97.3 + tt * 820, 980);
          ctx.moveTo(x, y);
          ctx.lineTo(x - 7, y + 24);
        }
        ctx.stroke();
        ctx.restore();
      } else if (theme === "bunsik") {
        for (let k = 0; k < 36; k++) {
          const x = z.x0 + fmod(k * 211.7 + tt * 26 + Math.sin(tt * 0.9 + k) * 26, w);
          const y = 120 + fmod(k * 131.1 + tt * 46, 940);
          const a = tt * 1.8 + k;
          const ctx = g.ctx;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(a);
          ctx.fillStyle = k % 3 === 0 ? "rgba(255,255,255,0.85)" : "rgba(255,170,200,0.9)";
          ctx.beginPath();
          ctx.ellipse(0, 0, 6, 3.4 * Math.abs(Math.cos(a * 0.7)) + 1.2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  // ---------------------------------------------------------------- 땅

  /** 구역 땅 (타일 계단 경계, 인도 높이 CURB_H) */
  private zonePath(L: G.MapLayout, i: number): Path2D {
    if (this.zonePaths === null) {
      this.zonePaths = L.zones.map((z, k) => {
        const p = new Path2D();
        const h = G.CURB_H;
        const m0 = Math.floor((-160 - G.OY) / (2 * G.TB));
        const m1 = Math.ceil((1240 - G.OY) / (2 * G.TB));
        const yAt = (m: number, odd: boolean) => G.OY - h + (2 * m + (odd ? 1 : 0)) * G.TB;
        // 왼쪽 경계 (위 → 아래)
        if (k === 0) {
          p.moveTo(-400, yAt(m0, false));
          p.lineTo(-400, yAt(m1, false));
        } else {
          p.moveTo(z.x0, yAt(m0, false));
          for (let m = m0; m < m1; m++) {
            p.lineTo(z.x0, yAt(m, false));
            p.lineTo(z.x0 - G.TA, yAt(m, true));
          }
          p.lineTo(z.x0, yAt(m1, false));
        }
        // 오른쪽 경계 (아래 → 위)
        if (k === L.zones.length - 1) {
          p.lineTo(L.width + 400, yAt(m1, false));
          p.lineTo(L.width + 400, yAt(m0, false));
        } else {
          for (let m = m1; m > m0; m--) {
            p.lineTo(z.x1, yAt(m, false));
            p.lineTo(z.x1 - G.TA, yAt(m - 1, true));
          }
          p.lineTo(z.x1, yAt(m0, false));
        }
        p.closePath();
        return p;
      });
    }
    return this.zonePaths[i];
  }

  private drawGround(g: Gfx, L: G.MapLayout): void {
    const ctx = g.ctx;
    for (const z of L.zones) {
      if (!this.seen(z.x0 - G.TA, z.x1)) continue;
      const th = themeOf(z);
      const path = this.zonePath(L, z.index);
      ctx.save();
      ctx.clip(path);
      ctx.fillStyle = tilePattern(ctx, `g_${z.shop?.theme ?? "lot"}`, th.style, th.base, th.alt, th.grout, G.CURB_H) ?? th.base.css();
      ctx.fillRect(Math.max(z.x0 - G.TA, this.viewX0 - 40), -40, Math.min(z.x1, this.viewX1 + 40) - Math.max(z.x0 - G.TA, this.viewX0 - 40), 1160);
      this.groundExtras(g, z, th);
      ctx.restore();
      // 동네 경계: 타일 계단을 따라 어두운 선
      if (z.index > 0) {
        ctx.save();
        ctx.strokeStyle = th.seam.withA(0.8).css();
        ctx.lineWidth = 4;
        ctx.beginPath();
        const h = G.CURB_H;
        for (let y = G.OY - h - 30 * 2 * G.TB; y < 1200; y += 2 * G.TB) {
          ctx.moveTo(z.x0, y);
          ctx.lineTo(z.x0 - G.TA, y + G.TB);
          ctx.lineTo(z.x0, y + 2 * G.TB);
        }
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  /** 바닥에 붙은 것들 (웅덩이·바다·불빛) */
  private groundExtras(g: Gfx, z: Zone, th: Theme): void {
    const theme = z.shop?.theme ?? "lot";
    if (theme === "alley" || theme === "suljip") {
      if (this.puddles === null) {
        const rng = new Rng(strHash("puddles"));
        this.puddles = [];
        for (let k = 0; k < 160; k++) this.puddles.push([v(rng.randfRange(0, G.layout().width), rng.randfRange(160, 1060)), rng.randfRange(26, 60)]);
      }
      for (const [p, r] of this.puddles) {
        if (p.x < z.x0 || p.x > z.x1 || !this.seen(p.x - r, p.x + r)) continue;
        I.puddle(g, p, r, theme === "alley" ? rgb(1.0, 0.82, 0.5, 0.16) : rgb(1.0, 0.4, 0.75, 0.14));
      }
    }
    if (theme === "beach") this.sea(g, z);
    if (th.night) {
      // 가게 불빛이 땅에 번짐
      const b = z.bounds;
      I.flatGlow(g, v(b.center().x, b.endY - 10), 360, rgb(1.0, 0.7, 0.4, 0.2));
    }
  }

  /** 해변 위쪽 바다 (해안선이 물결치며 밀려옴) + 바다에서 가게 둘레까지 들어오는 물길 */
  private sea(g: Gfx, z: Zone): void {
    const ctx = g.ctx;
    const shore = (x: number, back: number) => {
      const t = (x - z.x0) / (z.x1 - z.x0);
      return 300 - Math.sin(t * Math.PI) * 70 + Math.sin(x * 0.012 + this.t * 1.2) * 7 - back;
    };
    const x0 = z.x0 - G.TA;
    const x1 = z.x1;
    const step = 32;
    // 물길 (물가가 조금씩 출렁임)
    const w = this.inlet(z);
    const tt = this.t;
    const water = new Path2D();
    w.poly.forEach((p, k) => {
      const q = p.add(v(Math.sin(p.y * 0.03 + tt * 1.3) * 3.5, Math.sin(p.x * 0.025 + tt * 1.1) * 2.0));
      if (k === 0) water.moveTo(q.x, q.y);
      else water.lineTo(q.x, q.y);
    });
    water.closePath();
    const wet = rgb(0.94, 0.86, 0.66).css(); // 젖은 모래
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, -40);
    for (let x = x0; x <= x1 + step; x += step) ctx.lineTo(x, shore(x, -24));
    ctx.lineTo(x1 + step, -40);
    ctx.closePath();
    ctx.fillStyle = wet;
    ctx.fill();
    ctx.strokeStyle = wet;
    ctx.lineJoin = "round";
    ctx.lineWidth = 44;
    ctx.stroke(water);
    const sea = new Path2D();
    sea.moveTo(x0, -40);
    for (let x = x0; x <= x1 + step; x += step) sea.lineTo(x, shore(x, 0));
    sea.lineTo(x1 + step, -40);
    sea.closePath();
    // 바다와 물길을 같은 색 띠로 칠해 이음매가 없게 (가게 쪽은 그림 속 바위 둘레 물빛)
    const gr = ctx.createLinearGradient(0, 0, 0, 780);
    gr.addColorStop(0, rgb(0.08, 0.32, 0.56).css());
    gr.addColorStop(320 / 780, rgb(0.2, 0.6, 0.78).css());
    gr.addColorStop(1, rgb(0.22, 0.53, 0.66).css());
    ctx.fillStyle = gr;
    ctx.fill(sea);
    ctx.fill(water);
    // 물길 물가: 찰랑이는 거품 + 잔물결 (바다 물가선 아래 물길 안에서만)
    ctx.save();
    const below = new Path2D();
    below.moveTo(x0, 1200);
    for (let x = x0; x <= x1 + step; x += step) below.lineTo(x, shore(x, 0) + 4);
    below.lineTo(x1 + step, 1200);
    below.closePath();
    ctx.clip(below);
    ctx.clip(water);
    ctx.strokeStyle = rgb(0.93, 0.98, 1.0, 0.6).css();
    ctx.lineWidth = 7;
    ctx.stroke(water);
    const ph = fmod(tt * 0.45, 1.0);
    ctx.strokeStyle = rgb(0.93, 0.98, 1.0, 0.4 * (1.0 - ph)).css();
    ctx.lineWidth = 10 + 34 * ph;
    ctx.stroke(water);
    w.ripples.forEach((p, k) => {
      const bob = Math.sin(tt * 1.4 + k * 1.7);
      const pts: V[] = [];
      for (let j = 0; j <= 6; j++) {
        const x = -15 + j * 5;
        pts.push(p.add(v(x + bob * 4, Math.sin(x * 0.32 + tt * 2.2 + k) * 2.4)));
      }
      g.polyline(pts, rgb(0.95, 0.99, 1.0, 0.45 + 0.25 * bob), 3);
    });
    ctx.restore();
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      for (let x = x0; x <= x1 + step; x += step) {
        const y = shore(x, 8 + k * 44 + fmod(this.t * 6, 44));
        if (x === x0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = rgb(0.9, 0.97, 1.0, 0.7 - k * 0.15).css();
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    ctx.restore();
    // 먼바다의 작은 배들과 갈매기
    I.boat(g, v(z.x0 + 250, 226), 0.9, this.t, rgb(0.85, 0.25, 0.2));
    I.boat(g, v(z.x1 - 330, 212), 0.75, this.t + 2.0, rgb(0.2, 0.45, 0.8));
    for (let k = 0; k < 4; k++) {
      const x = z.x0 + fmod(k * 410 + this.t * (30 + k * 6), z.x1 - z.x0);
      const y = 150 + Math.sin(this.t * 0.8 + k * 2.1) * 18 + k * 12;
      I.seagull(g, v(x, y), 0.9 + (k % 2) * 0.2, this.t + k);
    }
  }

  // ---------------------------------------------------------------- 길 (인도보다 낮은 돌길)

  private paths(L: G.MapLayout): { top: Path2D; floor: Path2D } {
    if (this.roadPaths !== null) return this.roadPaths;
    const top = new Path2D();
    const floor = new Path2D();
    const add = (p: Path2D, r: GRect, h: number) => {
      const d = G.diamond(r, h);
      p.moveTo(d[0].x, d[0].y);
      for (let k = 1; k < 4; k++) p.lineTo(d[k].x, d[k].y);
      p.closePath();
    };
    // 큰 길 = 모서리가 둥근 띠 하나 (G.roadOutline), ∞ 샛길 앞마당은 네모
    const outline = G.roadOutline();
    for (const [p, h] of [
      [top, G.CURB_H],
      [floor, 0.0],
    ] as [Path2D, number][]) {
      outline.forEach(([gx, gy], k) => {
        const q = iso(gx, gy, h);
        if (k === 0) p.moveTo(q.x, q.y);
        else p.lineTo(q.x, q.y);
      });
      p.closePath();
    }
    for (const z of L.zones) {
      if (z.notch === null) continue;
      add(top, z.notch, G.CURB_H);
      add(floor, z.notch, 0.0);
    }
    this.roadPaths = { top, floor };
    return this.roadPaths;
  }

  private drawRoad(g: Gfx, L: G.MapLayout): void {
    const ctx = g.ctx;
    const ps = this.paths(L);
    ctx.save();
    ctx.lineJoin = "round";
    // 연석 윗돌 (인도 쪽 테두리) → 구멍(연석 옆면 색) → 그 안에 길바닥
    ctx.strokeStyle = I.INK.withA(0.55).css();
    ctx.lineWidth = 14;
    ctx.stroke(ps.top);
    ctx.strokeStyle = CURB_TOP.css();
    ctx.lineWidth = 10;
    ctx.stroke(ps.top);
    ctx.fillStyle = CURB_FACE.css();
    ctx.fill(ps.top);
    ctx.clip(ps.top);
    ctx.fillStyle = tilePattern(ctx, "road", "pave", ROAD_BASE, ROAD_BASE, ROAD_GROUT, 0.0) ?? ROAD_BASE.css();
    ctx.fill(ps.floor);
    // 동네 분식집 앞 횡단보도 (학교 앞) — 발판 사이에
    for (const z of L.zones) {
      if (z.shop?.theme !== "bunsik") continue;
      const base = z.index * 2 * G.ARM;
      for (const sOff of [4.25, 18.25]) this.crosswalk(g, base + sOff);
    }
    // 연석 옆면 아래 그늘
    ctx.save();
    ctx.translate(0, 8);
    ctx.strokeStyle = "rgba(40,25,15,0.18)";
    ctx.lineWidth = 10;
    ctx.stroke(ps.top);
    ctx.restore();
    this.drawGuide(g, L);
    ctx.restore();
    // 길 끝 공사 표지
    const [ex, ey] = G.pathAt(L.endS);
    if (this.seen(iso(ex, ey).x - 120, iso(ex, ey).x + 120)) this.barrier(g, ex + 0.2, ey);
  }

  /** 길을 가로지르는 흰 줄무늬 (길 방향으로 긴 줄 5개를 길 폭에 나란히) */
  private crosswalk(g: Gfx, s: number): void {
    const [cx, cy] = G.pathAt(s);
    const [tx, ty] = G.pathTangent(s);
    const nx = -ty;
    const ny = tx;
    const p = iso(cx, cy);
    if (!this.seen(p.x - 120, p.x + 120)) return;
    for (let k = -2; k <= 2; k++) {
      const o = k * 0.36;
      const pts: V[] = [];
      for (const [a, b] of [
        [-0.42, -0.1],
        [0.42, -0.1],
        [0.42, 0.1],
        [-0.42, 0.1],
      ]) {
        pts.push(iso(cx + tx * a + nx * (o + b), cy + ty * a + ny * (o + b)));
      }
      g.polygon(pts, rgb(0.98, 0.97, 0.94, 0.88));
    }
  }

  /** 가운데 안내선: 지나온 길 실선, 갈 길 점선, ∞ 샛길 (열리면 파랑) */
  private drawGuide(g: Gfx, L: G.MapLayout): void {
    const ctx = g.ctx;
    // 길 위 거리를 잘게 나눠 따라감 (꺾이는 곳은 둥글게)
    const line = (s0: number, s1: number): V[] => {
      const out: V[] = [];
      if (s1 <= s0) return out;
      for (let s = s0; s < s1; s += 0.25) {
        const [x, y] = G.pathAt(s);
        out.push(iso(x, y));
      }
      const [bx, by] = G.pathAt(s1);
      out.push(iso(bx, by));
      return out;
    };
    const stroke = (pts: V[]) => {
      if (pts.length < 2) return;
      ctx.beginPath();
      pts.forEach((p, k) => (k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    };
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const ahead = line(Math.max(-6, this.walkedS), L.endS);
    ctx.setLineDash([22, 20]);
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 7;
    stroke(ahead);
    L.zones.forEach((z, i) => {
      if (z.spurS < 0) return;
      const a = iso(z.spurBase[0], z.spurBase[1]);
      const b = iso(z.spurEnd[0], z.spurEnd[1]);
      if (!this.seen(Math.min(a.x, b.x), Math.max(a.x, b.x))) return;
      ctx.strokeStyle = this.spurOpen[i] ? "rgba(110,170,255,0.98)" : "rgba(255,255,255,0.55)";
      stroke([a, b]);
    });
    ctx.setLineDash([]);
    const walked = line(-6, Math.min(this.walkedS, L.endS));
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 18;
    stroke(walked);
    ctx.strokeStyle = "rgba(255,255,255,0.97)";
    ctx.lineWidth = 8;
    stroke(walked);
  }

  /** 길 끝 공사 표지 (길을 가로질러) */
  private barrier(g: Gfx, gx: number, gy: number): void {
    const p0 = iso(gx, gy - 0.9);
    const p1 = iso(gx, gy + 0.9);
    for (const p of [p0, p1]) g.rect(new R(p.x - 4, p.y - 46, 8, 46), rgb(0.35, 0.3, 0.28));
    const top0 = p0.add(v(0, -46));
    const top1 = p1.add(v(0, -46));
    const band = [top0, top1, top1.add(v(0, 22)), top0.add(v(0, 22))];
    g.polygon(band, rgb(0.97, 0.96, 0.93));
    for (let k = 0; k < 5; k++) {
      const a = top0.lerp(top1, k / 5);
      const b = top0.lerp(top1, (k + 0.5) / 5);
      g.polygon([a, b, b.add(v(0, 22)), a.add(v(0, 22))], rgb(0.9, 0.25, 0.18));
    }
    g.polyline(band.concat([band[0]]), I.INK, 2.5);
    g.circle(top0.add(v(0, -10)), 8, rgb(1.0, 0.6, 0.2, 0.5 + 0.4 * Math.sin(this.t * 5.0)));
    g.circle(top1.add(v(0, -10)), 8, rgb(1.0, 0.6, 0.2, 0.5 + 0.4 * Math.cos(this.t * 5.0)));
  }

  // ---------------------------------------------------------------- 서 있는 것들 (건물·집·나무·가로등·소품)

  private drawSprites(g: Gfx, L: G.MapLayout): void {
    if (this.sprites === null) this.sprites = this.buildSprites(L);
    for (const s of this.sprites) if (this.seen(s.x0, s.x1)) s.draw(g);
    // 야시장: 길 위로 걸친 전구 줄 (맨 위에)
    for (const z of L.zones) if (z.shop?.theme === "market" && this.seen(z.x0, z.x1)) this.stringLights(g, z);
  }

  private buildSprites(L: G.MapLayout): Sprite[] {
    const out: Sprite[] = [];
    const add = (gx: number, gy: number, halfW: number, draw: (g: Gfx) => void) => {
      const p = iso(gx, gy);
      out.push({ depth: gx + gy, x0: p.x - halfW, x1: p.x + halfW, draw });
    };
    const blocked: GRect[] = [];
    for (const r of L.roads) blocked.push(G.grow(r, 0.45));
    // 스테이지·∞ 발판 자리 (앞에 큰 것이 서서 가리지 않게)
    const nodePts: V[] = [];
    for (const z of L.zones) {
      if (z.shop === null) continue;
      for (let lv = z.shop.first_level; lv <= z.shop.last_level; lv++) nodePts.push(G.levelPos(lv));
      nodePts.push(iso(z.spurEnd[0], z.spurEnd[1]));
      if (D.eventFor(z.shop.id) !== null) nodePts.push(G.eventPos(z.shop.id)); // 미식가 이벤트 발판
    }
    const hidesNode = (gx: number, gy: number, height: number, halfW: number): boolean => {
      const b = iso(gx, gy);
      for (const n of nodePts) {
        if (Math.abs(b.x - n.x) < halfW + 80 && b.y > n.y - 20 && b.y - height < n.y + 70) return true;
        if (b.distanceTo(n) < 100) return true;
      }
      return false;
    };
    const free = (gx: number, gy: number, rad: number): boolean => {
      for (const r of blocked) if (G.inRect(G.grow(r, rad), gx, gy)) return false;
      const p = iso(gx, gy);
      return p.x > 30 && p.x < L.width - 30 && p.y > 170 && p.y < 1070;
    };

    L.zones.forEach((z) => {
      const th = themeOf(z);
      const theme = z.shop?.theme ?? "lot";
      const [px, py] = z.peak;
      // 가게 건물
      blocked.push(G.grow(z.foot, 0.5));
      if (z.notch !== null) blocked.push(G.grow(z.notch, 0.3));
      const fc = z.frontCorner;
      out.push({ depth: fc[0] + fc[1], x0: z.bounds.x - 20, x1: z.bounds.endX + 20, draw: (g) => this.drawBuilding(g, z) });
      // 경계 위·아래 배경 집 (다음 구역과 사이)
      if (z.index < L.zones.length - 1) {
        const P: [number, number] = [px + G.ARM, py - G.ARM];
        const north = G.grect(P[0] - 5.5, P[1] - 5.5, P[0] - 2.0, P[1] - 2.0);
        const south = G.grect(P[0] + 3.6, P[1] + 3.6, P[0] + 7.0, P[1] + 7.0);
        const nst = th.house[0];
        const sst = { ...themeOf(L.zones[z.index + 1]).house[themeOf(L.zones[z.index + 1]).house.length > 1 ? 1 : 0], floors: 1, roof: null };
        blocked.push(G.grow(north, 0.4), G.grow(south, 0.4));
        out.push({ depth: north.x1 + north.y1, x0: iso(north.x0, north.y1).x, x1: iso(north.x1, north.y0).x, draw: (g) => I.house(g, north, nst, z.index * 2 + 1) });
        out.push({ depth: south.x1 + south.y1, x0: iso(south.x0, south.y1).x, x1: iso(south.x1, south.y0).x, draw: (g) => I.house(g, south, sst, z.index * 2 + 2) });
      }
      // 가로등 (길 옆 인도, 스테이지 사이)
      if (z.shop !== null) {
        const base = z.index * 2 * G.ARM;
        // 위쪽(길 뒤) 인도에만: 길 앞에 서면 기둥이 길과 발판을 가린다
        const spots: [number, number][] = [
          [3.7, 1],
          [22.2, 1],
        ];
        for (const [sl, side] of spots) {
          const s = base + sl;
          const [gx, gy] = G.pathAt(s);
          const [dx, dy] = G.pathDir(s);
          // 왼쪽 팔(dx=1): 위쪽 = -gy. 오른쪽 팔(dy=-1): 위쪽 = -gx
          const nx = dx !== 0 ? 0 : -1;
          const ny = dx !== 0 ? -1 : 0;
          const off = G.ROAD + 0.42;
          const lx = gx + nx * off * side;
          const ly = gy + ny * off * side;
          const lit = th.night ? 1.0 : 0.0;
          const seed = Math.round(s * 10);
          add(lx, ly, 140, (g) => I.lamp(g, lx, ly, lit, 0.88 + 0.12 * Math.sin(this.t * 6.3 + seed) * Math.sin(this.t * 2.9 + seed * 0.3)));
          blocked.push(G.grect(lx - 0.6, ly - 0.6, lx + 0.6, ly + 0.6));
        }
      }
      // 동네 소품
      const rng = new Rng(strHash(`props_${theme}_${z.index}`));
      const rand = (lo: number, hi: number) => rng.randfRange(lo, hi);
      const water = theme === "beach" ? this.inlet(z).poly : null;
      const tryPlace = (n: number, rad: number, height: number, halfW: number, make: (gx: number, gy: number, k: number) => void) => {
        let placed = 0;
        for (let attempt = 0; attempt < n * 30 && placed < n; attempt++) {
          // 구역 화면 띠 안에서 아무 곳이나 → 땅 좌표로
          const sx = rand(z.x0 + 40, z.x1 - 40);
          const sy = rand(180, 1060);
          const a = sx / G.TA;
          const b = (sy - G.OY) / G.TB;
          const gx = (a + b) * 0.5;
          const gy = (b - a) * 0.5;
          if (!free(gx, gy, rad)) continue;
          if (hidesNode(gx, gy, height, halfW)) continue;
          if (theme === "beach" && iso(gx, gy).y < 360) continue; // 바다
          if (water !== null && nearPoly(iso(gx, gy), water, 30 + halfW * 0.4)) continue; // 물길
          make(gx, gy, placed);
          blocked.push(G.grect(gx - rad, gy - rad, gx + rad, gy + rad));
          placed++;
        }
      };
      const treeKind = th.tree;
      tryPlace(theme === "beach" ? 6 : 9, 0.9, 130, 60, (gx, gy, k) => {
        const kind = theme === "beach" && k % 2 === 1 ? "palm" : treeKind;
        const s = 0.9 + ((k * 37) % 10) * 0.03;
        add(gx, gy, 70, (g) => I.tree(g, gx, gy, s, kind, k + z.index * 31));
      });
      const flower = theme === "bunsik" ? rgb(1.0, 0.6, 0.75) : theme === "lot" ? rgb(1.0, 0.85, 0.35) : null;
      tryPlace(5, 0.6, 50, 40, (gx, gy, k) => add(gx, gy, 45, (g) => I.bush(g, gx, gy, 1.0, k % 2 === 0 ? flower : null)));
      switch (theme) {
        case "alley":
          // 비 오는 골목 포장마차: 빨간 등 줄, 플라스틱 테이블 + 소주, 자판기, 소주 상자
          tryPlace(2, 1.4, 120, 110, (gx, gy) => add(gx + 1.0, gy, 110, (g) => I.lanternLine(g, [gx - 1.0, gy], [gx + 1.0, gy], 1.0, this.t)));
          tryPlace(3, 0.8, 50, 60, (gx, gy, k) => add(gx, gy, 60, (g) => I.tableSet(g, gx, gy, k % 2 === 0 ? rgb(0.86, 0.22, 0.18) : rgb(0.2, 0.45, 0.8))));
          tryPlace(2, 0.5, 70, 40, (gx, gy, k) => add(gx, gy, 40, (g) => (k === 0 ? I.vending(g, gx, gy, rgb(0.85, 0.2, 0.18), true) : I.crates(g, gx, gy, rgb(0.2, 0.55, 0.3), 3))));
          break;
        case "bunsik":
          // 학교 앞 동네 분식집: 어린이 보호구역 표지판, 자전거, 벤치, 꽃 화분 (길엔 횡단보도, 벚꽃 잎이 날림)
          tryPlace(2, 0.5, 120, 50, (gx, gy) => add(gx, gy, 50, (g) => I.schoolSign(g, gx, gy)));
          tryPlace(3, 0.6, 40, 40, (gx, gy, k) => add(gx, gy, 40, (g) => I.bicycle(g, gx, gy, [rgb(0.25, 0.55, 0.85), rgb(0.95, 0.45, 0.6), rgb(0.35, 0.7, 0.4)][k % 3])));
          tryPlace(2, 0.9, 40, 60, (gx, gy, k) => add(gx, gy, 60, (g) => I.bench(g, gx, gy, k % 2 === 0 ? "gx" : "gy")));
          tryPlace(3, 0.5, 50, 40, (gx, gy) => add(gx, gy, 40, (g) => I.planter(g, gx, gy, rgb(1.0, 0.85, 0.35))));
          break;
        case "market":
          // 야시장: 줄무늬 천막 노점들, 과일 상자, 의자
          tryPlace(3, 1.0, 110, 80, (gx, gy, k) => {
            const tents: [Color, Color][] = [
              [rgb(0.92, 0.3, 0.25), rgb(1.0, 0.92, 0.75)],
              [rgb(0.25, 0.55, 0.85), rgb(1.0, 0.95, 0.85)],
              [rgb(0.95, 0.7, 0.15), rgb(0.9, 0.35, 0.25)],
            ];
            const goods = [
              [rgb(0.95, 0.35, 0.3), rgb(1.0, 0.75, 0.2), rgb(0.5, 0.75, 0.3)],
              [rgb(0.95, 0.85, 0.6), rgb(0.85, 0.55, 0.3)],
              [rgb(1.0, 0.6, 0.75), rgb(0.6, 0.85, 1.0), rgb(1.0, 0.95, 0.5)],
            ];
            add(gx, gy, 80, (g) => I.stall(g, gx, gy, tents[k % 3][0], tents[k % 3][1], goods[k % 3], 1.0));
          });
          tryPlace(3, 0.5, 40, 40, (gx, gy, k) => add(gx, gy, 40, (g) => I.crates(g, gx, gy, k % 2 === 0 ? rgb(0.95, 0.65, 0.15) : rgb(0.25, 0.5, 0.8), 2)));
          tryPlace(3, 0.35, 30, 20, (gx, gy) => add(gx, gy, 20, (g) => I.stool(g, gx, gy)));
          break;
        case "beach":
          // 해변: 서핑보드, 모래성 (바다엔 배와 갈매기)
          tryPlace(2, 0.5, 100, 30, (gx, gy, k) => add(gx, gy, 30, (g) => I.surfboard(g, gx, gy, k === 0 ? rgb(0.98, 0.55, 0.2) : rgb(0.3, 0.75, 0.85), k === 0 ? -0.12 : 0.15)));
          tryPlace(1, 0.6, 50, 40, (gx, gy) => add(gx, gy, 40, (g) => I.sandcastle(g, gx, gy)));
          tryPlace(4, 1.0, 100, 80, (gx, gy, k) =>
            add(gx, gy, 80, (g) => I.parasol(g, gx, gy, [rgb(0.95, 0.3, 0.25), rgb(0.2, 0.5, 0.9), rgb(0.98, 0.75, 0.2), rgb(0.3, 0.7, 0.45)][k % 4], rgb(0.98, 0.97, 0.94))),
          );
          tryPlace(3, 0.7, 30, 50, (gx, gy, k) => add(gx, gy, 50, (g) => I.deckChair(g, gx, gy, k % 2 === 0 ? rgb(0.2, 0.55, 0.9) : rgb(0.95, 0.5, 0.3))));
          break;
        case "suljip":
          // 밤 도심 실내 포차 거리: 네온 간판, 세워 둔 택시, 자판기, 소주 상자
          tryPlace(3, 0.5, 140, 70, (gx, gy, k) => {
            const signs: [string, Color][] = [
              ["소주", rgb(0.3, 0.95, 0.55)],
              ["포차", rgb(1.0, 0.4, 0.75)],
              ["24시", rgb(0.4, 0.8, 1.0)],
            ];
            add(gx, gy, 70, (g) => I.neonSign(g, gx, gy, signs[k % 3][0], signs[k % 3][1], this.t, k * 2.3 + z.index));
          });
          tryPlace(2, 1.3, 50, 90, (gx, gy) => add(gx, gy, 90, (g) => I.taxi(g, gx, gy)));
          tryPlace(2, 0.5, 40, 40, (gx, gy, k) => add(gx, gy, 40, (g) => (k === 0 ? I.vending(g, gx, gy, rgb(0.2, 0.4, 0.75), true) : I.crates(g, gx, gy, rgb(0.2, 0.55, 0.3), 2))));
          tryPlace(3, 0.35, 30, 20, (gx, gy) => add(gx, gy, 20, (g) => I.stool(g, gx, gy)));
          break;
        default:
          tryPlace(5, 0.4, 40, 20, (gx, gy) => add(gx, gy, 20, (g) => I.cone(g, gx, gy)));
      }
    });
    out.sort((a, b) => a.depth - b.depth);
    return out;
  }

  /** 야시장: 가게 경계 쪽 길 위로 지그재그로 걸친 전구 줄 (트럭 앞은 비움) */
  private stringLights(g: Gfx, z: Zone): void {
    for (const s0 of [0.6, 20.6]) this.stringRun(g, z.index * 2 * G.ARM + s0);
  }

  private stringRun(g: Gfx, start: number): void {
    const pts: V[] = [];
    for (let k = 0; k <= 3; k++) {
      const s = start + k * 1.75;
      const [gx, gy] = G.pathAt(s);
      const [dx] = G.pathDir(s);
      const side = k % 2 === 0 ? 1 : -1;
      const off = (G.ROAD + 0.4) * side;
      pts.push(iso(gx + (dx !== 0 ? 0 : -off), gy + (dx !== 0 ? -off : 0), 150));
    }
    const colors = [rgb(1.0, 0.4, 0.35), rgb(1.0, 0.85, 0.3), rgb(0.45, 0.8, 1.0), rgb(0.5, 1.0, 0.55)];
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k];
      const b = pts[k + 1];
      const curve: V[] = [];
      for (let j = 0; j <= 10; j++) {
        const t = j / 10;
        curve.push(a.lerp(b, t).add(v(0, Math.sin(t * Math.PI) * 26)));
      }
      g.polyline(curve, rgb(0.1, 0.08, 0.06, 0.8), 2.5);
      for (let j = 1; j < 10; j += 2) {
        const c = colors[(k * 5 + j) % colors.length];
        const tw = 0.75 + 0.25 * Math.sin(this.t * 4 + k + j);
        g.circle(curve[j].add(v(0, 6)), 13, c.withA(0.22 * tw));
        g.circle(curve[j].add(v(0, 6)), 5, c);
      }
    }
  }

  // ---------------------------------------------------------------- 가게 건물

  private drawBuilding(g: Gfx, z: Zone): void {
    const fc = iso(z.frontCorner[0], z.frontCorner[1]);
    // 바닥 그림자 (해변은 물길 위라 각진 그림자가 튀어서 뺀다: 그림에 바위 둘레 물이 있음)
    if (z.shop?.theme !== "beach") {
      const foot = G.diamond(G.grow(z.foot, 0.25), 0);
      g.polygon(foot.map((p) => p.add(v(8, 4))), rgb(0, 0, 0, 0.22));
    }
    if (z.shop === null) {
      this.drawLot(g, z);
      return;
    }
    const img = ArtAssets.mapBuilding(z.shop.id);
    const sp = z.spec;
    const a = sp.art;
    if (img !== null && a !== undefined) {
      if (themeOf(z).night) I.flatGlow(g, fc.add(v(0, -10)), 260, rgb(1.0, 0.7, 0.4, 0.22));
      // 그림 속 앞 모서리를 건물 자리 앞 꼭짓점에 맞춤 (그림은 원본 그대로 — map_geo.fitArt 가 c 0 · d 1)
      const ctx = g.ctx;
      ctx.save();
      ctx.translate(fc.x, fc.y);
      ctx.transform(1, a.c, 0, a.d, 0, 0);
      ctx.drawImage(img, -a.fx * a.k, -a.fy * a.k, a.iw * a.k, a.ih * a.k);
      ctx.restore();
      return;
    }
    switch (z.shop.theme) {
      case "market":
        this.truck(g, z);
        break;
      case "beach":
        this.beachTent(g, z);
        break;
      default:
        this.indoorPocha(g, z);
    }
  }

  /** 야시장 푸드트럭 (긴 쪽이 오른쪽 아래 면 = 입구) */
  private truck(g: Gfx, z: Zone): void {
    const f = z.foot;
    const cab = G.grect(f.x0, f.y1 - 1.5, f.x1, f.y1);
    const body = G.grect(f.x0, f.y0, f.x1, f.y1 - 1.5);
    const teal = rgb(0.16, 0.62, 0.6);
    const H0 = 30.0;
    const H1 = 220.0;
    // 바퀴 (오른쪽 면 아래)
    const wheel = (r: GRect, at: number) =>
      I.onRightFace(g, r, H0, (w) => {
        const c = v(w * at, 6);
        FoodArt.ellipse(g, c, 30, 30, rgb(0.1, 0.1, 0.11));
        FoodArt.ellipse(g, c, 13, 13, rgb(0.62, 0.62, 0.66));
      });
    wheel(body, 0.22);
    wheel(cab, 0.5);
    I.box(g, body, H0, H1, I.shades(teal), I.INK, 3);
    I.box(g, cab, H0, 160, I.shades(teal.darkened(0.08)), I.INK, 3);
    I.onLeftFace(g, cab, 160, (w) => {
      g.rect(new R(10, 14, w - 20, 50), rgb(0.7, 0.88, 0.98));
      g.rect(new R(10, 14, (w - 20) * 0.3, 50), rgb(1, 1, 1, 0.35));
      g.rect(new R(w * 0.5 - 22, 92, 44, 12), rgb(0.95, 0.9, 0.5));
    });
    I.onRightFace(g, cab, 160, (w) => g.rect(new R(10, 18, w - 26, 44), rgb(0.62, 0.8, 0.9)));
    // 판매 창 (오른쪽 면) + 안쪽 사람 + 선반
    I.onRightFace(g, body, H1, (w) => {
      const win = new R(22, 46, w - 44, 92);
      g.rect(win.grow(5), rgb(0.85, 0.85, 0.88));
      g.rect(win, rgb(1.0, 0.72, 0.36));
      for (let k = 0; k < 2; k++) {
        const px = win.x + win.w * (0.32 + k * 0.38);
        g.circle(v(px, win.y + 38), 18, rgb(0.3, 0.16, 0.1, 0.65));
        FoodArt.roundedRect(g, new R(px - 26, win.y + 54, 52, 40), rgb(0.3, 0.16, 0.1, 0.65), 18);
      }
      g.rect(new R(win.x - 10, win.endY, win.w + 20, 14), rgb(0.88, 0.88, 0.9));
      g.rect(new R(win.x - 10, win.endY + 14, win.w + 20, 5), rgb(0.5, 0.5, 0.55));
      // 줄무늬 띠
      for (let k = 0; k < 8; k++) g.rect(new R(win.x + (win.w * k) / 8, win.endY + 30, win.w / 8 + 0.5, 18), k % 2 === 0 ? rgb(0.98, 0.98, 0.95) : teal.darkened(0.2));
    });
    // 차양 (판매 창 위로 비스듬히)
    const ya = body.y0 + 0.25;
    const yb = body.y1 - 0.15;
    const Ha = H1 - 30;
    const out = 0.9;
    for (let k = 0; k < 8; k++) {
      const t0 = k / 8;
      const t1 = (k + 1) / 8;
      const y0 = yb + (ya - yb) * t0;
      const y1 = yb + (ya - yb) * t1;
      g.polygon([iso(body.x1, y0, Ha), iso(body.x1, y1, Ha), iso(body.x1 + out, y1, Ha - 34), iso(body.x1 + out, y0, Ha - 34)], k % 2 === 0 ? rgb(0.98, 0.42, 0.3) : rgb(1.0, 0.95, 0.85));
    }
    g.polyline([iso(body.x1, yb, Ha), iso(body.x1 + out, yb, Ha - 34), iso(body.x1 + out, ya, Ha - 34), iso(body.x1, ya, Ha)], I.INK, 2.5);
    for (let k = 0; k < 7; k++) {
      const p = iso(body.x1 + out, yb + ((ya - yb) * (k + 0.5)) / 7, Ha - 40);
      g.circle(p, 10, rgb(1.0, 0.85, 0.4, 0.3));
      g.circle(p, 4, rgb(1.0, 0.9, 0.5));
    }
    // 지붕 간판
    const sign = G.grect(body.x1 - 0.55, body.y0 + 0.4, body.x1 - 0.4, body.y1 - 0.2);
    I.box(g, sign, H1, H1 + 58, I.shades(rgb(0.98, 0.84, 0.25)), I.INK, 3);
    I.onRightFace(g, sign, H1 + 58, (w) => FoodArt.text(g, z.shop?.short ?? "야시장", v(w * 0.5, 29), 38, rgb(0.55, 0.15, 0.1), w - 10));
  }

  /** 해변 포장마차: 나무 바닥 + 기둥 + 줄무늬 천막 (입구 = 왼쪽 아래 면) */
  private beachTent(g: Gfx, z: Zone): void {
    const f = z.foot;
    const wood = rgb(0.72, 0.52, 0.32);
    I.box(g, f, 0, 16, I.shades(wood), I.INK, 2.5);
    const post = (gx: number, gy: number) => I.box(g, G.grect(gx - 0.12, gy - 0.12, gx + 0.12, gy + 0.12), 16, 180, I.shades(rgb(0.55, 0.38, 0.24)), I.INK, 2);
    post(f.x0 + 0.2, f.y0 + 0.2);
    // 안쪽: 뒤 벽(천) + 불빛 + 뒤 선반
    const back = G.grect(f.x0 + 0.1, f.y0 + 0.1, f.x1 - 0.1, f.y0 + 0.3);
    I.box(g, back, 16, 170, I.shades(rgb(0.95, 0.92, 0.84)), I.INK, 2);
    const sideW = G.grect(f.x0 + 0.1, f.y0 + 0.1, f.x0 + 0.3, f.y1 - 0.1);
    I.box(g, sideW, 16, 170, I.shades(rgb(0.95, 0.92, 0.84)), I.INK, 2);
    I.flatGlow(g, iso((f.x0 + f.x1) * 0.5, (f.y0 + f.y1) * 0.5, 16), 220, rgb(1.0, 0.75, 0.4, 0.4));
    const shelf = G.grect(f.x0 + 0.5, f.y0 + 0.4, f.x1 - 0.6, f.y0 + 0.9);
    I.box(g, shelf, 16, 90, I.shades(rgb(0.6, 0.42, 0.26)), I.INK, 2);
    I.onLeftFace(g, shelf, 90, (w) => {
      for (let k = 0; k < 6; k++) g.rect(new R(12 + k * ((w - 24) / 6), -24, 10, 24), [rgb(0.3, 0.6, 0.35), rgb(0.9, 0.85, 0.75), rgb(0.35, 0.55, 0.85)][k % 3]);
    });
    // 수조 (조개·새우)
    const tank = G.grect(f.x1 - 1.6, f.y0 + 1.2, f.x1 - 0.5, f.y1 - 1.4);
    I.box(g, tank, 16, 70, { top: rgb(0.55, 0.85, 0.95, 0.85), left: rgb(0.45, 0.75, 0.9, 0.85), right: rgb(0.35, 0.62, 0.8, 0.85) }, I.INK, 2);
    // 앞 계산대 (입구 쪽)
    const counter = G.grect(f.x0 + 0.4, f.y1 - 0.75, f.x1 - 0.4, f.y1 - 0.25);
    I.box(g, counter, 16, 72, I.shades(rgb(0.85, 0.66, 0.42)), I.INK, 2.5);
    I.onLeftFace(g, counter, 72, (w) => {
      for (let k = 1; k < 6; k++) g.rect(new R((w * k) / 6 - 1.5, 6, 3, 50), rgb(0.6, 0.42, 0.26, 0.6));
    });
    for (const gx of [f.x0 + 0.9, f.x0 + 2.0, f.x0 + 3.1, f.x0 + 4.2]) {
      if (gx < f.x1 - 0.4 && Math.abs(gx - z.spurEnd[0]) > 0.75) I.stool(g, gx, f.y1 + 0.45, rgb(0.2, 0.5, 0.9));
    }
    post(f.x1 - 0.2, f.y0 + 0.2);
    post(f.x0 + 0.2, f.y1 - 0.2);
    post(f.x1 - 0.2, f.y1 - 0.2);
    I.tentRoof(g, f, 180, 90, rgb(0.2, 0.45, 0.85), rgb(0.97, 0.97, 0.95), 8, 0.4);
    // 처마 간판 (왼쪽 아래 면을 따라)
    const eave = G.grect(f.x0, f.y0, f.x1, f.y1 + 0.42);
    I.onLeftFace(g, eave, 214, (w) => {
      const r = new R(w * 0.2, 0, w * 0.6, 40);
      FoodArt.roundedRect(g, r, rgb(0.98, 0.95, 0.85), 10, rgb(0.15, 0.3, 0.55), 4);
      FoodArt.text(g, z.shop?.short ?? "바다포차", r.center(), 26, rgb(0.15, 0.3, 0.6), r.w - 10);
    });
    // 매달린 등
    for (let k = 0; k < 3; k++) {
      const p = iso(f.x0 + 1 + k * 1.5, f.y1 + 0.3, 150);
      g.line(p.add(v(0, -26)), p, I.INK, 2);
      g.circle(p.add(v(0, 10)), 14, rgb(1.0, 0.55, 0.3));
      I.glow(g, p.add(v(0, 10)), 36, rgb(1.0, 0.75, 0.4, 0.4));
    }
  }

  /** 실내 포차: 2층 건물, 1층은 큰 유리창 + 주황 차양 + 간판 (입구 = 오른쪽 아래 면) */
  private indoorPocha(g: Gfx, z: Zone): void {
    const f = z.foot;
    const H = 290.0;
    const wall = rgb(0.44, 0.28, 0.22);
    I.flatGlow(g, iso(f.x1 + 1.0, (f.y0 + f.y1) * 0.5), 300, rgb(1.0, 0.6, 0.25, 0.28));
    I.box(g, f, 0, H, I.shades(wall), I.INK, 3);
    // 벽돌 줄
    const bricks = (w: number, dark: number) => {
      for (let y = 12; y < H; y += 18) g.rect(new R(0, y, w, 2), wall.darkened(0.2 + dark));
    };
    I.onLeftFace(g, f, H, (w) => {
      bricks(w, 0);
      for (let k = 0; k < 2; k++) {
        const r = new R(24 + k * (w * 0.5), 34, w * 0.5 - 48, 70);
        g.rect(r.grow(4), rgb(0.22, 0.14, 0.1));
        g.rect(r, LIT);
      }
      const side = new R(24, 160, w - 48, 90);
      g.rect(side.grow(4), rgb(0.22, 0.14, 0.1));
      g.rect(side, rgb(1.0, 0.7, 0.35));
    });
    I.onRightFace(g, f, H, (w) => {
      bricks(w, 0.1);
      // 2층 창
      for (let k = 0; k < 3; k++) {
        const r = new R(22 + (k * (w - 44)) / 3, 30, (w - 44) / 3 - 18, 66);
        g.rect(r.grow(4), rgb(0.2, 0.12, 0.1));
        g.rect(r, LIT.darkened(0.15));
      }
      // 간판 (네온 테두리)
      const sign = new R(w * 0.14, 112, w * 0.72, 46);
      I.glow(g, sign.center(), sign.w * 0.6, rgb(1.0, 0.45, 0.2, 0.35));
      FoodArt.roundedRect(g, sign, rgb(0.14, 0.08, 0.07), 12, rgb(1.0, 0.55, 0.25), 4);
      FoodArt.text(g, z.shop?.short ?? "실내포차", sign.center(), 32, rgb(1.0, 0.82, 0.45), sign.w - 16);
      // 1층 큰 유리창 + 사람들
      const glass = new R(18, 186, w * 0.68, 96);
      g.rect(glass.grow(5), rgb(0.2, 0.12, 0.1));
      g.rect(glass, rgb(1.0, 0.66, 0.3));
      for (let k = 0; k < 3; k++) {
        const px = glass.x + glass.w * (0.2 + k * 0.3);
        g.circle(v(px, glass.y + 40), 16, rgb(0.3, 0.14, 0.08, 0.6));
        FoodArt.roundedRect(g, new R(px - 24, glass.y + 54, 48, 42), rgb(0.3, 0.14, 0.08, 0.6), 16);
      }
      g.rect(new R(glass.x, glass.y, glass.w * 0.12, glass.h), rgb(1, 1, 1, 0.14));
      const door = new R(glass.endX + 16, 176, w - glass.endX - 34, 114);
      g.rect(door.grow(4), rgb(0.2, 0.12, 0.1));
      g.rect(door, rgb(0.95, 0.62, 0.3));
    });
    // 주황 차양 (1층 위로 비스듬히)
    const ya = f.y0 + 0.1;
    const yb = f.y1 - 0.1;
    const Ha = 108.0;
    for (let k = 0; k < 10; k++) {
      const y0 = yb + ((ya - yb) * k) / 10;
      const y1 = yb + ((ya - yb) * (k + 1)) / 10;
      g.polygon([iso(f.x1, y0, Ha), iso(f.x1, y1, Ha), iso(f.x1 + 0.8, y1, Ha - 30), iso(f.x1 + 0.8, y0, Ha - 30)], k % 2 === 0 ? rgb(0.95, 0.45, 0.12) : rgb(1.0, 0.7, 0.3));
    }
    g.polyline([iso(f.x1, yb, Ha), iso(f.x1 + 0.8, yb, Ha - 30), iso(f.x1 + 0.8, ya, Ha - 30), iso(f.x1, ya, Ha)], I.INK, 2.5);
    // 지붕: 난간 + 물탱크 + 실외기
    const inset = G.grow(f, -0.15);
    g.polygon(G.diamond(inset, H), wall.darkened(0.25));
    I.box(g, G.grect(f.x0 + 0.5, f.y0 + 0.5, f.x0 + 1.5, f.y0 + 1.5), H, H + 46, I.shades(rgb(0.36, 0.52, 0.7)), I.INK, 2);
    I.box(g, G.grect(f.x1 - 1.4, f.y0 + 1.2, f.x1 - 0.6, f.y0 + 2.0), H, H + 26, I.shades(rgb(0.86, 0.86, 0.84)), I.INK, 2);
  }

  /** 끝의 빈터: 흙바닥 + 울타리 + 고깔 + 간판 */
  private drawLot(g: Gfx, z: Zone): void {
    const f = z.foot;
    g.polygon(G.diamond(f, G.CURB_H), rgb(0.6, 0.46, 0.32));
    const rng = new Rng(strHash("lot"));
    for (let k = 0; k < 14; k++) {
      const p = iso(rng.randfRange(f.x0 + 0.3, f.x1 - 0.3), rng.randfRange(f.y0 + 0.3, f.y1 - 0.3), G.CURB_H);
      FoodArt.ellipse(g, p, 16, 6, rgb(0.52, 0.39, 0.26));
    }
    // 모래 더미
    const pile = iso(f.x0 + 1.5, f.y0 + 1.6, G.CURB_H);
    g.polygon([pile.add(v(-80, 10)), pile.add(v(-20, -44)), pile.add(v(10, -50)), pile.add(v(80, 10)), pile.add(v(0, 36))], rgb(0.78, 0.62, 0.4));
    g.polyline([pile.add(v(-80, 10)), pile.add(v(-20, -44)), pile.add(v(10, -50)), pile.add(v(80, 10))], I.INK, 2.5);
    // 울타리 (앞 두 면은 낮게)
    const wood = I.shades(rgb(0.7, 0.52, 0.32));
    const fence = (ax: number, ay: number, bx: number, by: number) => {
      const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 0.7));
      for (let k = 0; k <= n; k++) {
        const gx = ax + ((bx - ax) * k) / n;
        const gy = ay + ((by - ay) * k) / n;
        I.box(g, G.grect(gx - 0.07, gy - 0.07, gx + 0.07, gy + 0.07), G.CURB_H, G.CURB_H + 70, wood, I.INK, 1.5);
      }
      for (const hh of [30, 58]) g.line(iso(ax, ay, G.CURB_H + hh), iso(bx, by, G.CURB_H + hh), rgb(0.6, 0.43, 0.26), 6);
    };
    fence(f.x0, f.y0, f.x1, f.y0);
    fence(f.x0, f.y0, f.x0, f.y1);
    fence(f.x1, f.y0, f.x1, f.y1);
    for (let k = 0; k < 3; k++) I.cone(g, f.x0 + 1.2 + k * 1.3, f.y1 - 0.2);
    // 간판
    const post = iso(f.x0 + 3.2, f.y0 + 2.6, G.CURB_H);
    const sr = new R(post.x - 140, post.y - 230, 280, 92);
    g.rect(new R(post.x - 70, sr.endY, 10, post.y - sr.endY), rgb(0.4, 0.28, 0.18));
    g.rect(new R(post.x + 60, sr.endY, 10, post.y - sr.endY), rgb(0.4, 0.28, 0.18));
    FoodArt.roundedRect(g, sr, rgb(0.98, 0.84, 0.25), 14, rgb(0.25, 0.2, 0.15), 5);
    FoodArt.text(g, "새 가게\n준비 중", sr.center(), 30, rgb(0.25, 0.2, 0.15), sr.w);
  }

  // ---------------------------------------------------------------- 아직 못 가는 동네

  private drawDim(g: Gfx, L: G.MapLayout): void {
    L.zones.forEach((z, i) => {
      if (!this.locked[i] || !this.seen(z.x0, z.x1)) return;
      const col = rgb(0.03, 0.02, 0.05, 0.5);
      const b = new R(z.x0, 0, z.x1 - z.x0, this.size.y);
      g.rect(b, col);
      for (let k = 0; k < 8; k++) {
        const a = (col.a * (k + 0.5)) / 8.0;
        if (b.x > 1.0) g.rect(new R(b.x - 80.0 + k * 10.0, 0.0, 10.5, b.h), col.withA(a));
        if (b.endX < L.width - 1.0) g.rect(new R(b.endX + 70.0 - k * 10.0, 0.0, 10.5, b.h), col.withA(a));
      }
      FoodArt.lockIcon(g, z.bounds.center().add(v(0, -20)), 1.6, rgb(0.95, 0.92, 0.86));
    });
  }
}
