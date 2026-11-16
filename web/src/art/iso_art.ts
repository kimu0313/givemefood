// 아이소메트릭 지도용 작은 그림 도구: 상자(윗면·왼쪽 아래 면·오른쪽 아래 면), 면 위에 그리기(간판·창문이 면을 따라 기울어짐),
// 박공·모임 지붕, 나무·가로등·벤치·화분·파라솔·상자 같은 소품, 배경 집.
// 빛은 왼쪽 위에서: 왼쪽 아래 면(+gy 면)이 밝고, 오른쪽 아래 면(+gx 면)이 어둡다.

import { Color, PI, R, TAU, V, rgb, v } from "../engine/geom.ts";
import type { Gfx } from "../engine/gfx.ts";
import { Rng } from "../engine/rng.ts";
import * as FoodArt from "./food_art.ts";
import { K, TA, TB, diamond, iso, type GRect } from "./map_geo.ts";

export const INK = rgb(0.16, 0.11, 0.09);

export interface BoxColors {
  top: Color;
  left: Color;
  right: Color;
}

/** 한 색으로 세 면 (윗면 밝게, 오른쪽 면 어둡게) */
export function shades(c: Color): BoxColors {
  return { top: c.lightened(0.12), left: c, right: c.darkened(0.24) };
}

/** 상자: 바닥 r, 높이 h0~h1 */
export function box(g: Gfx, r: GRect, h0: number, h1: number, c: BoxColors, ink: Color | null = INK, inkW = 2.5): void {
  const L = [iso(r.x0, r.y1, h0), iso(r.x1, r.y1, h0), iso(r.x1, r.y1, h1), iso(r.x0, r.y1, h1)];
  const Rf = [iso(r.x1, r.y1, h0), iso(r.x1, r.y0, h0), iso(r.x1, r.y0, h1), iso(r.x1, r.y1, h1)];
  g.polygon(L, c.left);
  g.polygon(Rf, c.right);
  g.polygon(diamond(r, h1), c.top);
  if (ink === null) return;
  const ctx = g.ctx;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineWidth = inkW;
  ctx.strokeStyle = ink.css();
  ctx.beginPath();
  const sil = [iso(r.x0, r.y1, h0), iso(r.x1, r.y1, h0), iso(r.x1, r.y0, h0), iso(r.x1, r.y0, h1), iso(r.x0, r.y0, h1), iso(r.x0, r.y1, h1)];
  sil.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  const f0 = iso(r.x1, r.y1, h0);
  const f1 = iso(r.x1, r.y1, h1);
  ctx.moveTo(f0.x, f0.y);
  ctx.lineTo(f1.x, f1.y);
  const a = iso(r.x0, r.y1, h1);
  const b = iso(r.x1, r.y0, h1);
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(f1.x, f1.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

/** 왼쪽 아래 면(gy = r.y1) 위에 그리기: 지역 좌표 x = 면 왼쪽 끝부터 오른쪽으로 (px), y = 위(h1)부터 아래로. fn(면 너비) */
export function onLeftFace(g: Gfx, r: GRect, h1: number, fn: (w: number) => void): void {
  const ctx = g.ctx;
  const o = iso(r.x0, r.y1, h1);
  ctx.save();
  ctx.transform(1, K, 0, 1, o.x, o.y);
  fn((r.x1 - r.x0) * TA);
  ctx.restore();
}

/** 오른쪽 아래 면(gx = r.x1) 위에 그리기: x = 앞 모서리부터 오른쪽으로 */
export function onRightFace(g: Gfx, r: GRect, h1: number, fn: (w: number) => void): void {
  const ctx = g.ctx;
  const o = iso(r.x1, r.y1, h1);
  ctx.save();
  ctx.transform(1, -K, 0, 1, o.x, o.y);
  fn((r.y1 - r.y0) * TA);
  ctx.restore();
}

/** 윗면(높이 h) 위에 그리기: 지역 좌표 = 땅 좌표 (r.x0, r.y0 기준, 타일 단위) */
export function onTop(g: Gfx, r: GRect, h: number, fn: () => void): void {
  const ctx = g.ctx;
  const o = iso(r.x0, r.y0, h);
  ctx.save();
  ctx.transform(TA, TB, -TA, TB, o.x, o.y);
  fn();
  ctx.restore();
}

/** 땅에 누운 타원 (그림자·웅덩이·빛) */
export function flatEllipse(g: Gfx, c: V, rx: number, color: Color): void {
  FoodArt.ellipse(g, c, rx, rx * K, color);
}

/** 땅에 비친 둥근 빛 */
export function flatGlow(g: Gfx, c: V, r: number, color: Color): void {
  const ctx = g.ctx;
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.scale(1.0, K);
  const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  gr.addColorStop(0, color.css());
  gr.addColorStop(1, color.withA(0).css());
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** 둥근 빛 (공중) */
export function glow(g: Gfx, c: V, r: number, color: Color): void {
  const ctx = g.ctx;
  const gr = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
  gr.addColorStop(0, color.css());
  gr.addColorStop(1, color.withA(0).css());
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, TAU);
  ctx.fill();
}

// ---------------------------------------------------------------- 지붕

/** 박공지붕: 처마 높이 h, 용마루가 rise 만큼 위. axis = 용마루 방향 (gx: 왼쪽 위 ↘ 오른쪽 아래, gy: 오른쪽 위 ↙ 왼쪽 아래) */
export function gableRoof(g: Gfx, r: GRect, h: number, rise: number, axis: "gx" | "gy", roof: Color, wall: BoxColors, over = 0.25): void {
  const o = over;
  const ink = INK;
  const poly = (pts: V[], c: Color) => {
    g.polygon(pts, c);
    g.polyline(pts.concat([pts[0]]), ink, 2.5);
  };
  if (axis === "gx") {
    const ym = (r.y0 + r.y1) * 0.5;
    const rA = iso(r.x0 - o, ym, h + rise);
    const rB = iso(r.x1 + o, ym, h + rise);
    poly([iso(r.x0 - o, r.y0 - o, h), iso(r.x1 + o, r.y0 - o, h), rB, rA], roof.darkened(0.12)); // 뒤 비탈
    poly([iso(r.x1, r.y0, h), iso(r.x1, r.y1, h), iso(r.x1, ym, h + rise)], wall.right); // 오른쪽 박공
    poly([iso(r.x0 - o, r.y1 + o, h), iso(r.x1 + o, r.y1 + o, h), rB, rA], roof); // 앞 비탈
  } else {
    const xm = (r.x0 + r.x1) * 0.5;
    const rA = iso(xm, r.y0 - o, h + rise);
    const rB = iso(xm, r.y1 + o, h + rise);
    poly([iso(r.x0 - o, r.y0 - o, h), iso(r.x0 - o, r.y1 + o, h), rB, rA], roof.lightened(0.06)); // 뒤 비탈
    poly([iso(r.x0, r.y1, h), iso(r.x1, r.y1, h), iso(xm, r.y1, h + rise)], wall.left); // 왼쪽 박공
    poly([iso(r.x1 + o, r.y0 - o, h), iso(r.x1 + o, r.y1 + o, h), rB, rA], roof.darkened(0.18)); // 앞 비탈
  }
}

/** 모임지붕(천막): 처마 네모 r(+over) 높이 h → 꼭대기 한 점 h + rise. 줄무늬 stripes 개 (두 색 번갈아) */
export function tentRoof(g: Gfx, r: GRect, h: number, rise: number, a: Color, b: Color, stripes = 8, over = 0.35): void {
  const e = { x0: r.x0 - over, y0: r.y0 - over, x1: r.x1 + over, y1: r.y1 + over };
  const apex = iso((r.x0 + r.x1) * 0.5, (r.y0 + r.y1) * 0.5, h + rise);
  const corners = [iso(e.x0, e.y0, h), iso(e.x1, e.y0, h), iso(e.x1, e.y1, h), iso(e.x0, e.y1, h)];
  // 뒤(위쪽 두 면) → 앞(아래쪽 두 면) 순서: 0-1 (-gy 면), 3-0 (-gx 면), 1-2 (+gx 면), 2-3 (+gy 면)
  const faces: [number, number, number][] = [
    [0, 1, -0.16],
    [3, 0, -0.08],
    [1, 2, -0.22],
    [2, 3, 0.04],
  ];
  for (const [i, j, light] of faces) {
    const p = corners[i];
    const q = corners[j];
    for (let k = 0; k < stripes; k++) {
      const t0 = k / stripes;
      const t1 = (k + 1) / stripes;
      const c = (k % 2 === 0 ? a : b);
      const col = light >= 0 ? c.lightened(light) : c.darkened(-light);
      g.polygon([p.lerp(q, t0), p.lerp(q, t1), apex], col);
    }
    g.polyline([p, q, apex, p], INK, 2.5);
  }
  // 처마 끝 물결 장식 (앞 두 면)
  for (const [i, j] of [
    [1, 2],
    [2, 3],
  ]) {
    const p = corners[i];
    const q = corners[j];
    for (let k = 0; k < stripes; k++) {
      const m = p.lerp(q, (k + 0.5) / stripes);
      const c = k % 2 === 0 ? a : b;
      g.circle(m.add(v(0, 3)), Math.max(6.0, p.distanceTo(q) / stripes * 0.42), c.darkened(0.05));
    }
  }
}

// ---------------------------------------------------------------- 소품

export function treeShadow(g: Gfx, b: V, s: number): void {
  flatEllipse(g, b.add(v(10 * s, 2)), 44.0 * s, rgb(0, 0, 0, 0.26));
}

/** 둥근 나무 (kind: round 초록 / blossom 벚꽃 / pine 소나무 / palm 야자) */
export function tree(g: Gfx, gx: number, gy: number, s = 1.0, kind = "round", seed = 0): void {
  const b = iso(gx, gy);
  treeShadow(g, b, s);
  const trunk = rgb(0.4, 0.27, 0.18);
  if (kind === "pine") {
    g.rect(rectAt(b.x - 6 * s, b.y - 34 * s, 12 * s, 36 * s), trunk);
    const greens = [rgb(0.13, 0.33, 0.27), rgb(0.16, 0.4, 0.3), rgb(0.2, 0.47, 0.33)];
    for (let k = 0; k < 3; k++) {
      const y = b.y - (40 + k * 34) * s;
      const w = (54 - k * 12) * s;
      const tri = [v(b.x - w, y + 10 * s), v(b.x + w, y + 10 * s), v(b.x, y - 50 * s)];
      g.polygon(tri, greens[k]);
      g.polygon([v(b.x, y - 50 * s), v(b.x + w, y + 10 * s), v(b.x + w * 0.2, y + 10 * s)], greens[k].darkened(0.2));
      g.polyline(tri.concat([tri[0]]), INK, 2.0);
    }
    return;
  }
  if (kind === "palm") {
    const top = b.add(v(14 * s, -120 * s));
    g.polyline([b, b.add(v(4 * s, -50 * s)), top], rgb(0.5, 0.36, 0.22), 12 * s);
    const leaf = rgb(0.22, 0.55, 0.3);
    for (let k = 0; k < 6; k++) {
      const a = -PI * 0.5 + (k - 2.5) * 0.55;
      const tip = top.add(v(Math.cos(a) * 70 * s, Math.sin(a) * 30 * s + 26 * s));
      const mid = top.lerp(tip, 0.5).add(v(0, -14 * s));
      g.polyline([top, mid, tip], k % 2 === 0 ? leaf : leaf.darkened(0.15), 11 * s);
    }
    g.circle(top, 9 * s, rgb(0.45, 0.3, 0.16));
    return;
  }
  g.rect(rectAt(b.x - 7 * s, b.y - 40 * s, 14 * s, 42 * s), trunk);
  g.rect(rectAt(b.x + 1 * s, b.y - 40 * s, 6 * s, 42 * s), trunk.darkened(0.25));
  const base = kind === "blossom" ? rgb(0.98, 0.72, 0.8) : rgb(0.24, 0.5, 0.3);
  const rng = new Rng(seed * 7919 + 17);
  const blobs: [number, number, number][] = [
    [-24, -58, 30],
    [24, -56, 28],
    [0, -84, 34],
    [-10, -60, 26],
  ];
  for (const [dx, dy, r] of blobs) g.circle(b.add(v(dx * s, dy * s)), (r + 3) * s, INK);
  for (const [dx, dy, r] of blobs) {
    const c = base.darkened(dx > 0 ? 0.16 : 0.0);
    g.circle(b.add(v(dx * s, dy * s)), r * s, c);
  }
  g.circle(b.add(v(-8 * s, -94 * s)), 14 * s, base.lightened(0.18));
  if (kind === "blossom") {
    for (let k = 0; k < 7; k++) g.circle(b.add(v(rng.randfRange(-40, 40) * s, rng.randfRange(-110, -40) * s)), 3.5 * s, rgb(1, 1, 1, 0.7));
  }
}

function rectAt(x: number, y: number, w: number, h: number): R {
  return new R(x, y, w, h);
}

/** 키 작은 덤불 (꽃 색 flower, null 이면 꽃 없음) */
export function bush(g: Gfx, gx: number, gy: number, s = 1.0, flower: Color | null = null): void {
  const b = iso(gx, gy);
  flatEllipse(g, b.add(v(6, 2)), 34 * s, rgb(0, 0, 0, 0.24));
  const leaf = rgb(0.22, 0.46, 0.28);
  const blobs: [number, number, number][] = [
    [-16, -14, 18],
    [16, -13, 17],
    [0, -26, 21],
  ];
  for (const [dx, dy, r] of blobs) g.circle(b.add(v(dx * s, dy * s)), (r + 2.5) * s, INK);
  for (const [dx, dy, r] of blobs) g.circle(b.add(v(dx * s, dy * s)), r * s, leaf.darkened(dx > 0 ? 0.18 : 0.0));
  g.circle(b.add(v(-6 * s, -36 * s)), 7 * s, rgb(1, 1, 1, 0.16));
  if (flower !== null) {
    for (const [dx, dy] of [
      [-18, -18],
      [-2, -34],
      [12, -24],
      [20, -10],
      [-8, -10],
    ]) {
      g.circle(b.add(v(dx * s, dy * s)), 4.5 * s, flower);
      g.circle(b.add(v(dx * s, dy * s)), 1.6 * s, rgb(1.0, 0.95, 0.75));
    }
  }
}

/** 가로등 (나무 틀 + 창호지 등). lit = 0~1 불빛 세기 */
export function lamp(g: Gfx, gx: number, gy: number, lit: number, flick: number): void {
  const p = iso(gx, gy);
  const top = p.add(v(0, -104));
  if (lit > 0) flatGlow(g, p, 130.0, rgb(1.0, 0.74, 0.42, 0.34 * lit * flick));
  flatEllipse(g, p.add(v(3, 2)), 18.0, rgb(0, 0, 0, 0.35));
  const ink = rgb(0.2, 0.14, 0.11);
  box(g, { x0: gx - 0.13, y0: gy - 0.13, x1: gx + 0.13, y1: gy + 0.13 }, 0, 12, shades(rgb(0.4, 0.31, 0.25)), ink, 2);
  g.rect(rectAt(p.x - 5, top.y + 16, 10, p.y - top.y - 26), ink);
  g.rect(rectAt(p.x - 2, top.y + 18, 3, p.y - top.y - 30), rgb(0.44, 0.34, 0.27));
  const bx = rectAt(top.x - 16, top.y - 18, 32, 36);
  g.rect(rectAt(bx.x - 3, bx.y - 3, bx.w + 6, bx.h + 6), ink);
  const paper = lit > 0 ? rgb(1.0, 0.78 * flick + 0.14, 0.42) : rgb(0.86, 0.8, 0.66);
  g.rect(bx, paper);
  g.rect(rectAt(bx.x, bx.y + bx.h * 0.5 - 2, bx.w, 4), rgb(0.4, 0.26, 0.16, 0.8));
  g.rect(rectAt(top.x - 2, bx.y, 4, bx.h), rgb(0.4, 0.26, 0.16, 0.8));
  g.polygon([v(top.x - 26, bx.y - 2), v(top.x + 26, bx.y - 2), v(top.x + 11, bx.y - 15), v(top.x - 11, bx.y - 15)], ink);
  g.circle(v(top.x, bx.y - 18), 5, ink);
  if (lit > 0) glow(g, top, 72.0, rgb(1.0, 0.82, 0.5, 0.48 * lit * flick));
}

/** 벤치 (axis = 긴 방향) */
export function bench(g: Gfx, gx: number, gy: number, axis: "gx" | "gy"): void {
  const L = 0.75;
  const W = 0.22;
  const r = axis === "gx" ? { x0: gx - L, y0: gy - W, x1: gx + L, y1: gy + W } : { x0: gx - W, y0: gy - L, x1: gx + W, y1: gy + L };
  flatEllipse(g, iso(gx, gy).add(v(4, 3)), 56.0, rgb(0, 0, 0, 0.2));
  const leg = shades(rgb(0.3, 0.3, 0.32));
  const ends = axis === "gx" ? [gx - L + 0.1, gx + L - 0.16] : [gy - L + 0.1, gy + L - 0.16];
  for (const e of ends) {
    const lr = axis === "gx" ? { x0: e, y0: gy - W, x1: e + 0.07, y1: gy + W } : { x0: gx - W, y0: e, x1: gx + W, y1: e + 0.07 };
    box(g, lr, 0, 16, leg, null);
  }
  box(g, r, 16, 22, shades(rgb(0.72, 0.5, 0.3)), INK, 2);
  const back = axis === "gx" ? { x0: gx - L, y0: gy - W, x1: gx + L, y1: gy - W + 0.07 } : { x0: gx - W, y0: gy - L, x1: gx - W + 0.07, y1: gy + L };
  box(g, back, 22, 40, shades(rgb(0.68, 0.46, 0.28)), INK, 2);
}

/** 네모 화분 + 덤불 */
export function planter(g: Gfx, gx: number, gy: number, flower: Color | null): void {
  const r = { x0: gx - 0.32, y0: gy - 0.32, x1: gx + 0.32, y1: gy + 0.32 };
  flatEllipse(g, iso(gx, gy).add(v(4, 3)), 40.0, rgb(0, 0, 0, 0.22));
  box(g, r, 0, 20, shades(rgb(0.62, 0.6, 0.58)), INK, 2);
  const b = iso(gx, gy, 20);
  const leaf = rgb(0.24, 0.5, 0.3);
  for (const [dx, dy, rr] of [
    [-12, -6, 14],
    [12, -5, 13],
    [0, -16, 16],
  ] as [number, number, number][]) {
    g.circle(b.add(v(dx, dy)), rr + 2, INK);
  }
  for (const [dx, dy, rr] of [
    [-12, -6, 14],
    [12, -5, 13],
    [0, -16, 16],
  ] as [number, number, number][]) {
    g.circle(b.add(v(dx, dy)), rr, leaf.darkened(dx > 0 ? 0.16 : 0));
  }
  if (flower !== null) for (const [dx, dy] of [[-10, -12], [6, -22], [14, -8]]) g.circle(b.add(v(dx, dy)), 4, flower);
}

/** 플라스틱 상자 더미 */
export function crates(g: Gfx, gx: number, gy: number, color: Color, n = 2): void {
  flatEllipse(g, iso(gx, gy).add(v(4, 3)), 36.0, rgb(0, 0, 0, 0.24));
  for (let k = 0; k < n; k++) {
    const r = { x0: gx - 0.26, y0: gy - 0.22, x1: gx + 0.26, y1: gy + 0.22 };
    box(g, r, k * 20, k * 20 + 18, shades(k % 2 === 0 ? color : color.lightened(0.1)), INK, 2);
    onLeftFace(g, r, k * 20 + 18, (w) => {
      for (let j = 1; j < 4; j++) g.rect(rectAt((w * j) / 4 - 2, 4, 4, 10), color.darkened(0.35));
    });
  }
}

/** 빨간 플라스틱 의자 */
export function stool(g: Gfx, gx: number, gy: number, color = rgb(0.86, 0.22, 0.18)): void {
  flatEllipse(g, iso(gx, gy).add(v(2, 2)), 16.0, rgb(0, 0, 0, 0.26));
  const r = { x0: gx - 0.14, y0: gy - 0.14, x1: gx + 0.14, y1: gy + 0.14 };
  box(g, r, 0, 22, shades(color), INK, 2);
}

/** 고깔 */
export function cone(g: Gfx, gx: number, gy: number): void {
  const b = iso(gx, gy);
  flatEllipse(g, b.add(v(2, 2)), 16.0, rgb(0, 0, 0, 0.26));
  box(g, { x0: gx - 0.15, y0: gy - 0.15, x1: gx + 0.15, y1: gy + 0.15 }, 0, 5, shades(rgb(0.95, 0.45, 0.12)), INK, 2);
  const tri = [b.add(v(-12, -4)), b.add(v(12, -4)), b.add(v(0, -42))];
  g.polygon(tri, rgb(1.0, 0.5, 0.14));
  g.polygon([b.add(v(-8, -16)), b.add(v(8, -16)), b.add(v(5, -26)), b.add(v(-5, -26))], rgb(0.98, 0.96, 0.92));
  g.polyline(tri.concat([tri[0]]), INK, 2);
}

/** 파라솔 (해변) */
export function parasol(g: Gfx, gx: number, gy: number, a: Color, b: Color): void {
  const p = iso(gx, gy);
  flatEllipse(g, p.add(v(18, 4)), 66.0, rgb(0, 0, 0, 0.18));
  const top = p.add(v(0, -96));
  g.line(p, top, rgb(0.92, 0.92, 0.9), 5);
  const rx = 74.0;
  const ry = rx * K;
  const n = 8;
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * TAU;
    const a1 = ((k + 1) / n) * TAU;
    const q0 = top.add(v(Math.cos(a0) * rx, Math.sin(a0) * ry + 26));
    const q1 = top.add(v(Math.cos(a1) * rx, Math.sin(a1) * ry + 26));
    g.polygon([top.add(v(0, -10)), q0, q1], k % 2 === 0 ? a : b);
  }
  g.polyline(
    Array.from({ length: n + 1 }, (_, k) => {
      const t = (k / n) * PI;
      return top.add(v(Math.cos(t) * rx, Math.sin(t) * ry + 26));
    }),
    INK,
    2.5,
  );
  g.line(top.add(v(-rx, 26)), top.add(v(0, -10)), INK, 2.5);
  g.line(top.add(v(rx, 26)), top.add(v(0, -10)), INK, 2.5);
}

/** 해변 의자 */
export function deckChair(g: Gfx, gx: number, gy: number, color: Color): void {
  const r = { x0: gx - 0.5, y0: gy - 0.2, x1: gx + 0.5, y1: gy + 0.2 };
  flatEllipse(g, iso(gx, gy).add(v(4, 3)), 44.0, rgb(0, 0, 0, 0.18));
  box(g, r, 4, 10, shades(color), INK, 2);
  const back = { x0: gx - 0.5, y0: gy - 0.2, x1: gx - 0.36, y1: gy + 0.2 };
  box(g, back, 10, 34, shades(color.darkened(0.05)), INK, 2);
}

/** 자판기 */
export function vending(g: Gfx, gx: number, gy: number, color: Color, night: boolean): void {
  const r = { x0: gx - 0.3, y0: gy - 0.4, x1: gx + 0.3, y1: gy + 0.4 };
  flatEllipse(g, iso(gx, gy).add(v(6, 3)), 46.0, rgb(0, 0, 0, 0.24));
  if (night) flatGlow(g, iso(gx, gy + 0.6), 80.0, rgb(0.7, 0.9, 1.0, 0.25));
  box(g, r, 0, 92, shades(color), INK, 2.5);
  onLeftFace(g, r, 92, (w) => {
    g.rect(rectAt(5, 10, w - 10, 40), night ? rgb(0.85, 0.95, 1.0) : rgb(0.8, 0.88, 0.92));
    for (let k = 0; k < 3; k++) g.rect(rectAt(9 + k * ((w - 18) / 3), 16, (w - 18) / 3 - 4, 12), [rgb(0.9, 0.3, 0.2), rgb(0.3, 0.6, 0.9), rgb(0.95, 0.8, 0.2)][k]);
    g.rect(rectAt(w * 0.3, 62, w * 0.4, 10), rgb(0.12, 0.1, 0.1));
  });
}

/** 땅에 고인 물 */
export function puddle(g: Gfx, c: V, rx: number, tint: Color): void {
  FoodArt.ellipse(g, c, rx, rx * K, rgb(0.32, 0.38, 0.5, 0.55));
  FoodArt.ellipse(g, c.add(v(-rx * 0.15, -rx * K * 0.15)), rx * 0.6, rx * K * 0.45, tint);
}

// ---------------------------------------------------------------- 배경 집

export interface HouseStyle {
  wall: Color;
  roof: Color | null; // null 이면 평지붕 (난간)
  trim: Color;
  window: Color; // 창 색 (밤이면 불 켜진 노랑)
  sign?: string; // 1층 간판 글자
  signBg?: Color;
  signFg?: Color;
  awning?: [Color, Color];
  floors: number;
}

/** 작은 동네 집·가게 (바닥 r, 층 높이 76) */
export function house(g: Gfx, r: GRect, st: HouseStyle, seed: number): void {
  const FH = 76.0;
  const H = st.floors * FH;
  const wall = shades(st.wall);
  flatEllipse(g, iso(r.x1, r.y1).add(v(10, -4)), (r.x1 - r.x0 + r.y1 - r.y0) * TA * 0.42, rgb(0, 0, 0, 0.18));
  box(g, r, 0, H, wall, INK, 3);
  const rng = new Rng(seed * 104729 + 7);
  const win = (w: number, floor: number, count: number, lightK: number) => {
    const y = (st.floors - 1 - floor) * FH + 16;
    const ww = Math.min(46, (w - 20) / count - 14);
    for (let k = 0; k < count; k++) {
      const x = 12 + ((w - 24) * (k + 0.5)) / count - ww * 0.5;
      const lit = rng.randf() < 0.75;
      g.rect(rectAt(x - 3, y - 3, ww + 6, 42), st.trim);
      g.rect(rectAt(x, y, ww, 36), lit ? st.window.darkened(lightK) : st.wall.darkened(0.45));
      g.rect(rectAt(x + ww * 0.5 - 1.5, y, 3, 36), st.trim.withA(0.8));
    }
  };
  // 왼쪽 아래 면 (밝은 면): 1층 가게 + 위층 창
  onLeftFace(g, r, H, (w) => {
    for (let f = 1; f < st.floors; f++) win(w, f, Math.max(1, Math.round(w / 80)), 0.0);
    const y1 = (st.floors - 1) * FH;
    if (st.sign !== undefined) {
      const sb = st.signBg ?? rgb(0.96, 0.92, 0.8);
      g.rect(rectAt(8, y1 + 4, w - 16, 24), st.trim);
      g.rect(rectAt(10, y1 + 6, w - 20, 20), sb);
      FoodArt.text(g, st.sign, v(w * 0.5, y1 + 16), 17, st.signFg ?? rgb(0.55, 0.15, 0.1), w - 24);
      g.rect(rectAt(14, y1 + 34, w * 0.55, FH - 38), st.window);
      g.rect(rectAt(14 + w * 0.55 + 8, y1 + 30, w * 0.28, FH - 30), st.trim.darkened(0.2));
      if (st.awning !== undefined) {
        for (let k = 0; k < 6; k++) g.rect(rectAt(8 + ((w - 16) * k) / 6, y1 + 28, (w - 16) / 6 + 0.5, 8), k % 2 === 0 ? st.awning[0] : st.awning[1]);
      }
    } else {
      win(w, 0, Math.max(1, Math.round(w / 80)), 0.0);
    }
  });
  // 오른쪽 아래 면 (어두운 면): 창만
  onRightFace(g, r, H, (w) => {
    for (let f = 0; f < st.floors; f++) win(w, f, Math.max(1, Math.round(w / 90)), 0.25);
  });
  if (st.roof !== null) {
    gableRoof(g, r, H, 46.0, r.x1 - r.x0 >= r.y1 - r.y0 ? "gx" : "gy", st.roof, wall);
  } else {
    // 평지붕 + 난간 + 물탱크·실외기
    const inset = { x0: r.x0 + 0.12, y0: r.y0 + 0.12, x1: r.x1 - 0.12, y1: r.y1 - 0.12 };
    g.polygon(diamond(inset, H), st.wall.darkened(0.12));
    const tank = { x0: r.x0 + 0.4, y0: r.y0 + 0.4, x1: r.x0 + 1.1, y1: r.y0 + 1.1 };
    if (r.x1 - r.x0 > 2.2) box(g, tank, H, H + 34, shades(rgb(0.36, 0.52, 0.7)), INK, 2);
  }
}

// ---------------------------------------------------------------- 가게마다 동네 소품 (2026-11-16 사용자 "스테이지 배경도 현재 가게에 맞게 꾸며줘")

/** 골목 포장마차: 플라스틱 테이블 + 초록 소주병 + 의자 두 개 */
export function tableSet(g: Gfx, gx: number, gy: number, color: Color): void {
  flatEllipse(g, iso(gx, gy).add(v(4, 3)), 58.0, rgb(0, 0, 0, 0.24));
  stool(g, gx - 0.42, gy - 0.1, rgb(0.86, 0.22, 0.18));
  const r = { x0: gx - 0.3, y0: gy - 0.3, x1: gx + 0.3, y1: gy + 0.3 };
  // 다리 + 상판
  for (const [x, y] of [
    [r.x0 + 0.05, r.y1 - 0.05],
    [r.x1 - 0.05, r.y1 - 0.05],
    [r.x1 - 0.05, r.y0 + 0.05],
  ]) {
    const a = iso(x, y);
    g.line(a, a.add(v(0, -30)), color.darkened(0.35), 4);
  }
  box(g, r, 30, 36, shades(color), INK, 2);
  // 소주병 두 개 + 잔
  const top = iso(gx, gy, 36);
  for (const dx of [-10, 6]) {
    const b = top.add(v(dx, 2));
    g.rect(new R(b.x - 4, b.y - 22, 8, 22), rgb(0.25, 0.62, 0.36));
    g.rect(new R(b.x - 2, b.y - 30, 4, 8), rgb(0.25, 0.62, 0.36));
    g.rect(new R(b.x - 3, b.y - 15, 6, 6), rgb(0.95, 0.95, 0.9));
  }
  g.rect(new R(top.x + 14, top.y - 8, 6, 8), rgb(0.85, 0.92, 0.95, 0.9));
  stool(g, gx + 0.42, gy + 0.1, rgb(0.2, 0.45, 0.8));
}

/** 빨간 종이 등 (공중에 매달림, 밤엔 빛남) */
function lantern(g: Gfx, c: V, s: number, lit: number): void {
  if (lit > 0) glow(g, c, 34 * s, rgb(1.0, 0.45, 0.3, 0.35 * lit));
  FoodArt.ellipse(g, c, 11 * s, 14 * s, rgb(0.9, 0.18, 0.14));
  FoodArt.ellipse(g, c.add(v(-3 * s, -3 * s)), 4 * s, 6 * s, rgb(1.0, 0.55, 0.4, 0.8));
  g.rect(new R(c.x - 6 * s, c.y - 16 * s, 12 * s, 4 * s), rgb(0.2, 0.12, 0.08));
  g.rect(new R(c.x - 6 * s, c.y + 12 * s, 12 * s, 4 * s), rgb(0.2, 0.12, 0.08));
  g.line(c.add(v(0, 16 * s)), c.add(v(0, 24 * s)), rgb(0.95, 0.75, 0.2), 2);
}

/** 기둥 두 개 사이에 늘어진 줄 + 빨간 등 (골목 포장마차) */
export function lanternLine(g: Gfx, a: [number, number], b: [number, number], lit: number, t: number): void {
  const h = 110;
  const pa = iso(a[0], a[1]);
  const pb = iso(b[0], b[1]);
  for (const p of [pa, pb]) {
    flatEllipse(g, p.add(v(2, 2)), 12.0, rgb(0, 0, 0, 0.25));
    g.line(p, p.add(v(0, -h)), rgb(0.35, 0.24, 0.16), 6);
    g.line(p.add(v(-1, 0)), p.add(v(-1, -h)), rgb(0.5, 0.36, 0.24), 2);
  }
  const ta = pa.add(v(0, -h + 6));
  const tb = pb.add(v(0, -h + 6));
  const sag = 26;
  const pts: V[] = [];
  for (let k = 0; k <= 16; k++) {
    const u = k / 16;
    pts.push(ta.lerp(tb, u).add(v(0, Math.sin(u * PI) * sag)));
  }
  g.polyline(pts, rgb(0.15, 0.1, 0.08), 2.5);
  for (let k = 1; k <= 4; k++) {
    const u = k / 5;
    const c = ta.lerp(tb, u).add(v(Math.sin(t * 1.6 + k) * 2, Math.sin(u * PI) * sag + 20));
    lantern(g, c, 1.0, lit);
  }
}

/** 동네 분식집: 어린이 보호구역 표지판 */
export function schoolSign(g: Gfx, gx: number, gy: number): void {
  const p = iso(gx, gy);
  flatEllipse(g, p.add(v(3, 2)), 14.0, rgb(0, 0, 0, 0.25));
  g.line(p, p.add(v(0, -96)), rgb(0.62, 0.64, 0.68), 5);
  const c = p.add(v(0, -104));
  // 노란 테두리 + 빨간 띠 + 흰 글자 판
  FoodArt.roundedRect(g, new R(c.x - 46, c.y - 30, 92, 54), rgb(1.0, 0.82, 0.12), 8, INK, 2.5);
  FoodArt.roundedRect(g, new R(c.x - 40, c.y - 24, 80, 18), rgb(0.86, 0.2, 0.16), 4);
  FoodArt.text(g, "어린이", c.add(v(0, -15)), 15, rgb(1, 1, 1), 76);
  FoodArt.text(g, "보호구역", c.add(v(0, 9)), 17, INK, 84);
}

/** 자전거 (옆모습을 땅 위에 비스듬히) */
export function bicycle(g: Gfx, gx: number, gy: number, color: Color): void {
  const p = iso(gx, gy);
  flatEllipse(g, p.add(v(2, 3)), 34.0, rgb(0, 0, 0, 0.2));
  const w0 = p.add(v(-22, -16));
  const w1 = p.add(v(22, -6));
  for (const w of [w0, w1]) {
    g.circle(w, 14, rgb(0.15, 0.12, 0.1));
    g.circle(w, 10, rgb(0.85, 0.85, 0.82));
    g.circle(w, 3, INK);
  }
  const seat = p.add(v(-8, -40));
  const bar = p.add(v(14, -42));
  const ped = p.add(v(0, -12));
  g.polyline([w0, ped, seat.add(v(2, 6)), w0], color, 4);
  g.polyline([ped, bar.add(v(0, 6)), w1], color, 4);
  g.line(seat.add(v(2, 6)), bar.add(v(0, 6)), color, 4);
  g.line(seat.add(v(-6, 0)), seat.add(v(6, 0)), INK, 5);
  g.line(bar.add(v(-6, -2)), bar.add(v(8, 2)), INK, 4);
  // 앞 바구니
  g.rect(new R(bar.x + 4, bar.y + 2, 14, 10), rgb(0.85, 0.7, 0.45));
}

/** 야시장: 줄무늬 천막 노점 (상판 위 물건 + 전구 하나) */
export function stall(g: Gfx, gx: number, gy: number, a: Color, b: Color, goods: Color[], lit: number): void {
  const r = { x0: gx - 0.55, y0: gy - 0.4, x1: gx + 0.55, y1: gy + 0.4 };
  flatEllipse(g, iso(gx, gy).add(v(6, 4)), 72.0, rgb(0, 0, 0, 0.25));
  if (lit > 0) flatGlow(g, iso(gx, gy + 0.5), 110.0, rgb(1.0, 0.78, 0.4, 0.3 * lit));
  // 뒤 기둥
  for (const [x, y] of [
    [r.x0, r.y0],
    [r.x1, r.y0],
  ]) {
    const q = iso(x, y);
    g.line(q, q.add(v(0, -74)), rgb(0.3, 0.22, 0.16), 4);
  }
  box(g, r, 0, 28, shades(rgb(0.6, 0.42, 0.28)), INK, 2);
  onLeftFace(g, r, 28, (w) => g.rect(rectAt(4, 4, w - 8, 8), a.darkened(0.1)));
  // 상판 위 물건 (동그란 것들)
  for (let k = 0; k < 6; k++) {
    const x = r.x0 + 0.15 + (k % 3) * 0.38;
    const y = r.y0 + 0.2 + Math.floor(k / 3) * 0.38;
    const c = iso(x, y, 28);
    g.circle(c.add(v(0, -6)), 9, goods[k % goods.length]);
    g.circle(c.add(v(-3, -9)), 3, rgb(1, 1, 1, 0.6));
  }
  // 앞 기둥
  for (const [x, y] of [
    [r.x0, r.y1],
    [r.x1, r.y1],
  ]) {
    const q = iso(x, y);
    g.line(q, q.add(v(0, -74)), rgb(0.3, 0.22, 0.16), 4);
  }
  tentRoof(g, r, 74, 22, a, b, 6, 0.15);
  if (lit > 0) {
    const bulb = iso(gx, gy, 66);
    glow(g, bulb, 26, rgb(1.0, 0.85, 0.5, 0.6 * lit));
    g.circle(bulb, 5, rgb(1.0, 0.95, 0.75));
  }
}

/** 해변: 모래에 꽂힌 서핑보드 */
export function surfboard(g: Gfx, gx: number, gy: number, color: Color, lean: number): void {
  const p = iso(gx, gy);
  flatEllipse(g, p.add(v(10, 3)), 26.0, rgb(0, 0, 0, 0.2));
  const ctx = g.ctx;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(lean);
  FoodArt.roundedRect(g, new R(-11, -92, 22, 96), color, 11, INK, 2.5);
  g.line(v(0, -88), v(0, 0), rgb(1, 1, 1, 0.75), 3);
  g.rect(new R(-11, -52, 22, 6), color.darkened(0.25));
  ctx.restore();
}

/** 해변: 모래성 (깃발) */
export function sandcastle(g: Gfx, gx: number, gy: number): void {
  const sand = rgb(0.9, 0.76, 0.5);
  const r = { x0: gx - 0.32, y0: gy - 0.32, x1: gx + 0.32, y1: gy + 0.32 };
  flatEllipse(g, iso(gx, gy).add(v(4, 3)), 44.0, rgb(0, 0, 0, 0.18));
  box(g, r, 0, 18, shades(sand), INK, 2);
  const t = { x0: gx - 0.14, y0: gy - 0.14, x1: gx + 0.14, y1: gy + 0.14 };
  box(g, t, 18, 40, shades(sand.lightened(0.05)), INK, 2);
  const top = iso(gx, gy, 40);
  g.line(top, top.add(v(0, -22)), INK, 2);
  g.polygon([top.add(v(0, -22)), top.add(v(14, -17)), top.add(v(0, -12))], rgb(0.95, 0.3, 0.25));
}

/** 실내 포차 거리: 세워 둔 주황 택시 (gx 방향으로 길쭉) */
export function taxi(g: Gfx, gx: number, gy: number): void {
  const body = rgb(0.95, 0.55, 0.15);
  const r = { x0: gx - 0.75, y0: gy - 0.38, x1: gx + 0.75, y1: gy + 0.38 };
  flatEllipse(g, iso(gx, gy).add(v(6, 6)), 92.0, rgb(0, 0, 0, 0.3));
  // 바퀴
  for (const x of [r.x0 + 0.3, r.x1 - 0.3]) {
    const w = iso(x, r.y1, 8);
    FoodArt.ellipse(g, w, 9, 11, rgb(0.12, 0.1, 0.1));
  }
  box(g, r, 6, 26, shades(body), INK, 2.5);
  const c = { x0: gx - 0.42, y0: gy - 0.3, x1: gx + 0.28, y1: gy + 0.3 };
  box(g, c, 26, 44, { top: body.lightened(0.15), left: rgb(0.55, 0.75, 0.9), right: rgb(0.45, 0.62, 0.78) }, INK, 2.5);
  // 지붕 택시 등 + 앞 전조등
  const lampC = iso(gx - 0.07, gy, 44);
  FoodArt.roundedRect(g, new R(lampC.x - 16, lampC.y - 13, 32, 12), rgb(0.98, 0.95, 0.85), 4, INK, 2);
  FoodArt.text(g, "TAXI", lampC.add(v(0, -7)), 10, INK, 30);
  const head = iso(r.x1, gy, 16);
  glow(g, head.add(v(4, 0)), 22, rgb(1.0, 0.95, 0.7, 0.5));
}

/** 실내 포차 거리: 기둥 위 네온 간판 (깜빡임) */
export function neonSign(g: Gfx, gx: number, gy: number, text: string, color: Color, t: number, seed: number): void {
  const p = iso(gx, gy);
  flatEllipse(g, p.add(v(2, 2)), 12.0, rgb(0, 0, 0, 0.25));
  g.line(p, p.add(v(0, -88)), rgb(0.22, 0.22, 0.26), 5);
  const flick = Math.sin(t * 9.0 + seed) > -0.92 ? 1.0 : 0.35;
  const c = p.add(v(0, -112));
  const w = 26 + text.length * 26;
  glow(g, c, w * 0.75, color.withA(0.35 * flick));
  FoodArt.roundedRect(g, new R(c.x - w * 0.5, c.y - 22, w, 44), rgb(0.08, 0.06, 0.1), 10, color.withA(0.4 + 0.6 * flick), 4);
  FoodArt.textOutlined(g, text, c.add(v(0, 1)), 26, rgb(1, 1, 1).lerp(color, 0.35).withA(0.5 + 0.5 * flick), color.withA(0.8 * flick), 6, w);
}

/** 바다 위 작은 배 (위아래로 둥실) */
export function boat(g: Gfx, c: V, s: number, t: number, hull: Color): void {
  const bob = Math.sin(t * 1.6 + c.x * 0.01) * 4;
  const b = c.add(v(0, bob));
  const ctx = g.ctx;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.scale(s, s);
  ctx.rotate(Math.sin(t * 1.3 + c.x) * 0.04);
  g.polygon([v(-46, -8), v(46, -8), v(34, 10), v(-36, 10)], hull);
  g.polygon([v(-46, -8), v(46, -8), v(44, -2), v(-44, -2)], rgb(0.98, 0.97, 0.94));
  g.polyline([v(-46, -8), v(46, -8), v(34, 10), v(-36, 10), v(-46, -8)], INK, 2.5);
  FoodArt.roundedRect(g, new R(-20, -30, 28, 22), rgb(0.97, 0.97, 0.95), 4, INK, 2);
  g.rect(new R(-15, -25, 8, 7), rgb(0.55, 0.78, 0.92));
  g.line(v(18, -8), v(18, -52), INK, 2.5);
  g.polygon([v(18, -52), v(36, -46), v(18, -40)], rgb(0.95, 0.3, 0.25));
  ctx.restore();
  // 물결
  g.arc(b.add(v(-30, 14)), 12, 0.2, PI - 0.2, rgb(1, 1, 1, 0.55), 2);
  g.arc(b.add(v(26, 14)), 10, 0.2, PI - 0.2, rgb(1, 1, 1, 0.45), 2);
}

/** 하늘을 나는 갈매기 (날갯짓) */
export function seagull(g: Gfx, c: V, s: number, t: number): void {
  const flap = Math.sin(t * 7.0 + c.x * 0.05) * 6 * s;
  g.polyline([c.add(v(-16 * s, -2 * s + flap)), c.add(v(-6 * s, -6 * s)), c, c.add(v(6 * s, -6 * s)), c.add(v(16 * s, -2 * s + flap))], rgb(0.98, 0.98, 0.98), 4 * s);
  g.polyline([c.add(v(-16 * s, -2 * s + flap)), c.add(v(-6 * s, -6 * s)), c, c.add(v(6 * s, -6 * s)), c.add(v(16 * s, -2 * s + flap))], INK.withA(0.6), 1.5);
}
