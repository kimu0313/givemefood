// 골목 포장마차 영업 화면 배경 (사용자가 보낸 일러스트 그림체: 굵은 먹선 + 평평한 셀 채색,
// 푸르스름한 겨울 저녁 거리 + 따뜻한 노점 불빛). StreetArt 가 theme "alley" 일 때 부른다.
//   뒤에서부터: 하늘 → 길 건너 가게들(간판·창) → 가로수 → 돌 화단 → 보도블록 → 우산 쓴 행인들 → 노점 불빛 → 쇠 기둥·휴지·컵

import polygonClipping from "polygon-clipping";
import { Color, PI, R, TAU, V, WHITE, fmod, fposmod, rgb, v } from "../engine/geom.ts";
import type { Gfx } from "../engine/gfx.ts";
import { Rng } from "../engine/rng.ts";
import * as Ink from "./ink.ts";
import * as FoodArt from "./food_art.ts";

const SKY_TOP = rgb(0.27, 0.34, 0.48);
const SKY_LOW = rgb(0.5, 0.58, 0.67);
const HAZE = rgb(0.45, 0.53, 0.63); // 멀리 있는 것에 섞는 저녁 공기 색
const TILE = rgb(0.63, 0.68, 0.74);
const TILE_LINE = rgb(0.49, 0.54, 0.61);
const TREE = rgb(0.19, 0.33, 0.33);
const TREE_LIT = rgb(0.26, 0.42, 0.41);
const STONE = rgb(0.66, 0.68, 0.7);
const POLE = rgb(0.64, 0.66, 0.7);
const SKIN = rgb(0.96, 0.82, 0.7);

const SIGNS: [string, Color, Color][] = [
  ["약국", rgb(0.78, 0.22, 0.2), WHITE],
  ["편의점", rgb(0.2, 0.42, 0.72), WHITE],
  ["세탁소", rgb(0.22, 0.55, 0.55), WHITE],
  ["부동산", rgb(0.93, 0.88, 0.76), rgb(0.25, 0.2, 0.16)],
  ["떡집", rgb(0.95, 0.74, 0.25), rgb(0.3, 0.2, 0.1)],
  ["안경", rgb(0.36, 0.33, 0.45), WHITE],
];

/** 배경 전체 (counterY 위쪽) = 안 움직이는 부분 + 움직이는 부분 */
export function draw(g: Gfx, size: V, counterY: number, t: number): void {
  drawStatic(g, size, counterY);
  drawLive(g, size, counterY, t);
}

/** 하늘·건물·가로수·화단·보도블록 (안 움직여서 한 번 그려 두고 다시 씀) */
export function drawStatic(g: Gfx, size: V, counterY: number): void {
  const wallTop = counterY - 280.0; // 돌 화단 윗면 (= 보도블록이 시작되는 곳 바로 위)
  const walkTop = wallTop + 44.0;
  sky(g, size, wallTop);
  buildings(g, size, wallTop);
  trees(g, size, wallTop);
  planter(g, size, wallTop, walkTop);
  sidewalk(g, size, walkTop, counterY);
}

/** 지나가는 행인 + 노점 불빛 */
export function drawLive(g: Gfx, size: V, counterY: number, t: number): void {
  const walkTop = counterY - 280.0 + 44.0;
  people(g, size, walkTop, t);
  // 노점 안쪽에서 새어 나오는 따뜻한 불빛
  for (let k = 0; k < 8; k++) {
    const y = counterY - 160.0 + k * 20.0;
    g.rect(new R(0, y, size.x, 20.0), rgb(1.0, 0.68, 0.38, 0.025 * (k + 1)));
  }
}

function sky(g: Gfx, size: V, wallTop: number): void {
  const n = 10;
  for (let i = 0; i < n; i++) {
    const y0 = (wallTop * i) / n;
    g.rect(new R(0, y0, size.x, wallTop / n + 1.0), SKY_TOP.lerp(SKY_LOW, i / (n - 1)));
  }
}

/** 길 건너 낮은 가게 건물들: 윗층 창 + 간판 띠 + 불 켜진 1층 유리창 */
function buildings(g: Gfx, size: V, wallTop: number): void {
  const rng = new Rng(2024);
  const baseY = wallTop + 6.0;
  const facades = [rgb(0.5, 0.55, 0.6), rgb(0.6, 0.58, 0.56), rgb(0.45, 0.52, 0.54), rgb(0.56, 0.52, 0.5), rgb(0.52, 0.56, 0.52)];
  let x = -40.0;
  let k = 0;
  while (x < size.x) {
    const w = rng.randfRange(240.0, 340.0);
    const top = rng.randfRange(78.0, 140.0);
    const col = facades[k % facades.length].lerp(HAZE, 0.25);
    const r = new R(x, top, w, baseY - top);
    Ink.rect(g, r, col, 3.0);
    // 지붕 테두리
    Ink.rect(g, new R(x - 6.0, top - 10.0, w + 12.0, 14.0), col.darkened(0.18), 3.0);
    // 윗층 창
    let wy = top + 26.0;
    while (wy < baseY - 150.0) {
      let wx = x + 22.0;
      while (wx < x + w - 52.0) {
        const lit = rng.randf() < 0.45;
        const wc = lit ? rgb(1.0, 0.84, 0.55) : rgb(0.3, 0.37, 0.47);
        Ink.rect(g, new R(wx, wy, 38.0, 30.0), wc, 2.5);
        g.line(v(wx + 19.0, wy), v(wx + 19.0, wy + 30.0), Ink.LINE, 2.0);
        wx += 62.0;
      }
      wy += 48.0;
    }
    // 간판 띠
    const sg = SIGNS[(k * 7 + 3) % SIGNS.length];
    const signR = new R(x + 18.0, baseY - 128.0, w - 36.0, 38.0);
    Ink.rect(g, signR, sg[1].lerp(HAZE, 0.1), 3.0);
    FoodArt.text(g, sg[0], signR.center(), 26, sg[2], signR.w);
    // 1층 유리창 (불 켜짐) + 문틀
    const shopR = new R(x + 18.0, baseY - 84.0, w - 36.0, 78.0);
    Ink.rect(g, shopR, rgb(1.0, 0.8, 0.52).lerp(HAZE, 0.15), 3.0);
    const bars = Math.trunc(shopR.w / 70.0);
    for (let b = 1; b < bars; b++) {
      const bx = shopR.x + (shopR.w * b) / bars;
      g.line(v(bx, shopR.y), v(bx, shopR.endY), Ink.LINE, 2.5);
    }
    // 가게 안 사람 그림자
    if (rng.randf() < 0.6) {
      const px = shopR.x + rng.randfRange(30.0, shopR.w - 30.0);
      g.circle(v(px, shopR.y + 30.0), 11.0, rgb(0.55, 0.42, 0.34, 0.55));
      g.rect(new R(px - 14.0, shopR.y + 40.0, 28.0, 38.0), rgb(0.55, 0.42, 0.34, 0.55));
    }
    x += w + rng.randfRange(0.0, 10.0);
    k += 1;
  }
}

interface TreeShape {
  cx: number;
  cy: number;
  r: number;
  crown: V[];
  grain: V[];
}

const treeCache = new Map<string, { trees: TreeShape[]; bush: V[] }>();

/** 가로수·덤불 모양 (다각형 합치기는 무거워서 한 번만 계산) */
function treeShapes(size: V, wallTop: number): { trees: TreeShape[]; bush: V[] } {
  const key = `${size.x}|${wallTop}`;
  const hit = treeCache.get(key);
  if (hit) return hit;
  const rng = new Rng(909);
  const out: TreeShape[] = [];
  let x = 120.0;
  while (x < size.x + 100.0) {
    const cx = x + rng.randfRange(-60.0, 60.0);
    const cy = wallTop - rng.randfRange(80.0, 115.0);
    const r = rng.randfRange(58.0, 76.0);
    const crown = merge([
      blob(v(cx, cy - r * 0.2), r, r * 0.72, Math.trunc(cx)),
      blob(v(cx - r * 0.7, cy + r * 0.25), r * 0.66, r * 0.55, Math.trunc(cx) + 3),
      blob(v(cx + r * 0.72, cy + r * 0.2), r * 0.7, r * 0.56, Math.trunc(cx) + 7),
    ]);
    const grain: V[] = [];
    for (let k = 0; k < 5; k++) grain.push(v(cx + rng.randfRange(-r, r) * 0.8, cy + rng.randfRange(-r * 0.4, r * 0.4)));
    out.push({ cx, cy, r, crown, grain });
    x += rng.randfRange(330.0, 450.0);
  }
  // 화단 위 덤불 (한 덩어리로 합쳐서 바깥선만)
  const parts: V[][] = [];
  let bx = -40.0;
  while (bx < size.x + 80.0) {
    parts.push(blob(v(bx, wallTop - 8.0), 58.0, 30.0, Math.trunc(bx) + 5));
    bx += 84.0;
  }
  parts.push([v(-60, wallTop - 8.0), v(size.x + 60.0, wallTop - 8.0), v(size.x + 60.0, wallTop + 6.0), v(-60, wallTop + 6.0)]);
  const res = { trees: out, bush: merge(parts) };
  treeCache.set(key, res);
  return res;
}

/** 가로수 (잎 덩어리 몇 개를 합친 실루엣 + 밝은 윗면 + 먹선) 와 화단 위 덤불 */
function trees(g: Gfx, size: V, wallTop: number): void {
  const shapes = treeShapes(size, wallTop);
  for (const tr of shapes.trees) {
    Ink.rect(g, new R(tr.cx - 9.0, tr.cy + tr.r * 0.3, 18.0, wallTop - tr.cy - tr.r * 0.3 + 4.0), rgb(0.32, 0.25, 0.22), 3.0);
    g.polygon(tr.crown, TREE);
    Ink.shade(g, tr.crown, v(-tr.r * 0.22, tr.r * 0.32), TREE_LIT);
    // 잎 결
    for (const p of tr.grain) g.arc(p, 12.0, PI * 0.15, PI * 0.85, TREE.darkened(0.3), 2.5);
    Ink.outline(g, tr.crown, 3.0);
  }
  g.polygon(shapes.bush, TREE.darkened(0.08));
  Ink.shade(g, shapes.bush, v(-10, 12), TREE_LIT.darkened(0.05));
  Ink.outline(g, shapes.bush, 3.0);
}

/** 다각형 여러 개를 하나의 바깥선으로 합친다 (가장 큰 덩어리) */
function merge(polys: V[][]): V[] {
  const geoms = polys.map((p) => [p.map((q) => [q.x, q.y] as [number, number])]);
  const res = polygonClipping.union(geoms[0], ...geoms.slice(1));
  let best: [number, number][] = [];
  let bestArea = -1;
  for (const poly of res) {
    const ring = poly[0];
    const a = area(ring);
    if (a > bestArea) {
      bestArea = a;
      best = ring;
    }
  }
  const pts = best.map(([x, y]) => v(x, y));
  if (pts.length > 1 && pts[0].x === pts[pts.length - 1].x && pts[0].y === pts[pts.length - 1].y) pts.pop();
  return pts;
}

function area(ring: [number, number][]): number {
  let a = 0.0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) * 0.5;
}

/** 돌 화단 벽 (윗면 밝게, 앞면 어둡게) */
function planter(g: Gfx, size: V, wallTop: number, walkTop: number): void {
  Ink.rect(g, new R(-10, wallTop, size.x + 20.0, 12.0), STONE.lightened(0.12), 3.0);
  Ink.rect(g, new R(-10, wallTop + 12.0, size.x + 20.0, walkTop - wallTop - 12.0), STONE.darkened(0.12), 3.0);
  for (let x = 0.0; x < size.x; x += 150.0) g.line(v(x, wallTop + 12.0), v(x, walkTop), Ink.LINE, 2.0);
}

/** 보도블록: 앞으로 올수록 줄이 굵어진다 (원근감) */
function sidewalk(g: Gfx, size: V, walkTop: number, counterY: number): void {
  g.rect(new R(0, walkTop, size.x, counterY - walkTop), TILE);
  let y = walkTop;
  let row = 0;
  let h = 18.0;
  while (y < counterY) {
    g.line(v(0, y), v(size.x, y), TILE_LINE, 2.0 + row * 0.2);
    const step = 60.0 + h * 2.0;
    let x = fmod(row * step * 0.5, step);
    while (x < size.x) {
      g.line(v(x, y), v(x, Math.min(y + h, counterY)), TILE_LINE, 2.0);
      x += step;
    }
    y += h;
    h += 5.0;
    row += 1;
  }
  // 젖은 바닥의 희미한 반사
  for (let k = 0; k < 6; k++) {
    const px = fmod(173.0 + k * 337.0, size.x);
    FoodArt.ellipse(g, v(px, walkTop + 70.0 + fmod(k * 53.0, 90.0)), 70.0, 9.0, rgb(1.0, 0.85, 0.6, 0.12));
  }
}

// ---------------------------------------------------------------- 행인

type Walker = [number, number, number, Color, Color, Color, number, string];

/** 우산 쓴 행인·서 있는 사람·화단에 앉은 사람. 걷는 사람은 천천히 지나간다 */
function people(g: Gfx, size: V, walkTop: number, t: number): void {
  const span = size.x + 300.0;
  const list: Walker[] = [
    // x, 발 높이(walkTop 기준), 크기, 코트, 머리, 우산 색(없으면 투명 0), 속도, 종류
    [790.0, 14.0, 0.46, rgb(0.32, 0.36, 0.42), rgb(0.18, 0.14, 0.12), rgb(0.9, 0.93, 0.95, 0.55), 0.0, "phone"],
    [700.0, 30.0, 0.52, rgb(0.55, 0.42, 0.3), rgb(0.12, 0.1, 0.1), rgb(0.2, 0.28, 0.45), 34.0, "walk"],
    [1200.0, 8.0, 0.42, rgb(0.3, 0.42, 0.38), rgb(0.3, 0.2, 0.14), rgb(0, 0, 0, 0), 0.0, "stand"],
    [1500.0, 40.0, 0.56, rgb(0.25, 0.27, 0.33), rgb(0.15, 0.12, 0.12), rgb(0.8, 0.3, 0.25), -28.0, "walk"],
    [1410.0, 12.0, 0.44, rgb(0.45, 0.47, 0.5), rgb(0.1, 0.09, 0.1), rgb(0.9, 0.93, 0.95, 0.55), 0.0, "stand"],
  ];
  // 멀리 있는 사람부터 (발 높이가 작은 순)
  list.sort((a, b) => a[1] - b[1]);
  for (const p of list) {
    const speed = p[6];
    const x = fposmod(p[0] + speed * t + 150.0, span) - 150.0;
    const feet = v(x, walkTop + p[1]);
    const walk = Math.abs(speed) > 0.0;
    person(g, feet, p[2], p[3], p[4], p[5], p[7], walk ? t * 4.0 + p[0] : 0.0);
  }
  // 화단에 앉은 사람
  sitter(g, v(610.0, walkTop - 30.0), 0.42);
}

function person(g: Gfx, feet: V, s: number, coat: Color, hair: Color, umbrella: Color, kind: string, phase: number): void {
  const c = coat.lerp(HAZE, 0.22);
  const lw = 3.0;
  const swing = kind === "walk" ? Math.sin(phase) * 9.0 : 0.0;
  // 다리 + 신발
  for (const side of [-1.0, 1.0]) {
    const lx = side * 12.0 + swing * side;
    Ink.rect(g, R.of(feet.add(v(lx - 9.0, -92.0).mul(s)), v(18.0, 86.0).mul(s)), rgb(0.2, 0.22, 0.28), lw);
    Ink.ellipse(g, feet.add(v(lx + 4.0, -4.0).mul(s)), 15.0 * s, 7.0 * s, rgb(0.15, 0.13, 0.13), lw);
  }
  // 코트
  const body = [v(-34, -246), v(34, -246), v(46, -210), v(54, -84), v(-54, -84), v(-46, -210)].map((p) => feet.add(p.mul(s)));
  g.polygon(body, c);
  Ink.shade(g, body, v(-14, 0).mul(s), c.darkened(0.18));
  Ink.outline(g, body, lw);
  g.line(feet.add(v(0, -236).mul(s)), feet.add(v(0, -88).mul(s)), Ink.LINE, 2.0);
  // 목도리
  Ink.rrect(g, R.of(feet.add(v(-30, -256).mul(s)), v(60, 22).mul(s)), c.lightened(0.35).lerp(rgb(0.85, 0.75, 0.55), 0.5), 8.0 * s, lw);
  // 머리
  const head = feet.add(v(0, -282).mul(s));
  Ink.circle(g, head, 28.0 * s, SKIN.lerp(HAZE, 0.15), lw);
  const hairPts = FoodArt.ellipsePoints(head.add(v(0, -6).mul(s)), 30.0 * s, 26.0 * s, 16, PI, TAU);
  hairPts.push(head.add(v(30, 2).mul(s)));
  hairPts.push(head.add(v(-30, 2).mul(s)));
  Ink.poly(g, hairPts, hair, lw);
  if (kind === "phone") {
    // 휴대폰 보는 사람: 손 + 화면 불빛
    Ink.rect(g, R.of(head.add(v(10, 22).mul(s)), v(16, 24).mul(s)), rgb(0.75, 0.88, 1.0), 2.5);
    g.circle(head.add(v(18, 34).mul(s)), 30.0 * s, rgb(0.7, 0.85, 1.0, 0.15));
  }
  if (umbrella.a > 0.0) {
    const top = head.add(v(6, -62).mul(s));
    g.line(top, feet.add(v(22, -160).mul(s)), Ink.LINE, 3.0);
    const dome = FoodArt.ellipsePoints(top.add(v(0, 20).mul(s)), 92.0 * s, 52.0 * s, 20, PI, TAU);
    Ink.poly(g, dome, umbrella, lw);
    const tip = top.add(v(0, 20 - 52).mul(s));
    for (let k = 1; k < 4; k++) g.line(tip, top.add(v(-92.0 + (184.0 * k) / 4.0, 20.0).mul(s)), Ink.LINE, 2.0);
  }
}

/** 화단 끝에 앉아 있는 사람 */
function sitter(g: Gfx, seat: V, s: number): void {
  const coat = rgb(0.55, 0.58, 0.62).lerp(HAZE, 0.2);
  const lw = 3.0;
  // 다리 (앞으로 내림)
  for (const side of [-1.0, 1.0]) Ink.rect(g, R.of(seat.add(v(side * 16.0 - 10.0, 0).mul(s)), v(20, 76).mul(s)), rgb(0.22, 0.24, 0.3), lw);
  const body = [v(-34, -150), v(34, -150), v(48, -110), v(50, 10), v(-50, 10), v(-48, -110)].map((p) => seat.add(p.mul(s)));
  g.polygon(body, coat);
  Ink.shade(g, body, v(-12, 0).mul(s), coat.darkened(0.18));
  Ink.outline(g, body, lw);
  Ink.rrect(g, R.of(seat.add(v(-30, -160).mul(s)), v(60, 22).mul(s)), rgb(0.2, 0.2, 0.24), 8.0 * s, lw);
  const head = seat.add(v(0, -186).mul(s));
  Ink.circle(g, head, 28.0 * s, SKIN.lerp(HAZE, 0.15), lw);
  const hairPts = FoodArt.ellipsePoints(head.add(v(0, -6).mul(s)), 30.0 * s, 26.0 * s, 16, PI, TAU);
  hairPts.push(head.add(v(30, 2).mul(s)));
  hairPts.push(head.add(v(-30, 2).mul(s)));
  Ink.poly(g, hairPts, rgb(0.35, 0.24, 0.18), lw);
  // 마스크
  Ink.rrect(g, R.of(head.add(v(-16, 4).mul(s)), v(32, 18).mul(s)), rgb(0.18, 0.18, 0.2), 6.0 * s, 2.5);
}

function blob(c: V, rx: number, ry: number, seed: number): V[] {
  const pts: V[] = [];
  const n = 22;
  for (let k = 0; k < n; k++) {
    const a = (TAU * k) / n;
    const wob = 1.0 + 0.08 * Math.sin(a * 6.0 + seed) + 0.05 * Math.sin(a * 11.0 + seed * 0.7);
    pts.push(c.add(v(Math.cos(a) * rx * wob, Math.sin(a) * ry * wob)));
  }
  return pts;
}

// ---------------------------------------------------------------- 노점 틀

/** 줄무늬 천막 (먹선 테두리) */
export function awning(g: Gfx, size: V, y: number, h: number, a: Color, b: Color): void {
  const stripe = 90.0;
  const bottom = y + h;
  const n = Math.trunc(Math.ceil(size.x / stripe)) + 1;
  for (let i = 0; i < n; i++) Ink.circle(g, v(i * stripe + stripe * 0.5, bottom), stripe * 0.5, i % 2 === 0 ? a : b, 4.0);
  for (let i = 0; i < n; i++) {
    g.rect(new R(i * stripe, y, stripe, bottom - y), i % 2 === 0 ? a : b);
    g.line(v(i * stripe, y), v(i * stripe, bottom), Ink.LINE, 3.0);
  }
  // 반원 윗부분의 선을 지우고(줄무늬 면이 덮음) 천막 위·아래 테두리
  g.rect(new R(0, y, size.x, 12.0), rgb(0, 0, 0, 0.15));
  g.line(v(0, bottom), v(size.x, bottom), rgb(0, 0, 0, 0.12), 6.0);
}

/** 노점 쇠 기둥 + 가로대 + 매달린 휴지·전구 + 오른쪽 기둥의 종이컵 */
export function frame(g: Gfx, size: V, top: number, counterY: number, t: number): void {
  for (const x of [0.0, size.x - 26.0]) {
    Ink.rect(g, new R(x, top, 26.0, counterY - top), POLE, 3.0);
    g.rect(new R(x + 17.0, top + 2.0, 7.0, counterY - top - 4.0), POLE.darkened(0.22));
    g.rect(new R(x + 5.0, top + 2.0, 4.0, counterY - top - 4.0), POLE.lightened(0.25));
  }
  // 휴지 롤 (가로대에 매달림)
  const roll = v(size.x * 0.5 - 320.0, top + 72.0);
  g.line(v(roll.x - 34.0, top + 8.0), roll.add(v(-34, -16)), Ink.LINE, 3.0);
  g.line(v(roll.x + 34.0, top + 8.0), roll.add(v(34, -16)), Ink.LINE, 3.0);
  Ink.rrect(g, R.of(roll.add(v(-48, -22)), v(96, 44)), rgb(0.97, 0.97, 0.95), 18.0, 3.0);
  Ink.ellipse(g, roll.add(v(48, 0)), 10.0, 22.0, rgb(0.88, 0.88, 0.86), 3.0);
  g.circle(roll.add(v(48, 0)), 4.0, rgb(0.6, 0.6, 0.6));
  const tail = [roll.add(v(-30, 20)), roll.add(v(20, 20)), roll.add(v(16, 64)), roll.add(v(-26, 60))];
  Ink.poly(g, tail, rgb(0.97, 0.97, 0.95), 3.0);
  // 종이컵 탑 (오른쪽 기둥)
  const cx = size.x - 70.0;
  const cupTop = top + 150.0;
  Ink.rect(g, new R(cx - 4.0, cupTop - 20.0, 8.0, 22.0), POLE.darkened(0.3), 2.5);
  for (let k = 0; k < 9; k++) {
    const y = cupTop + k * 18.0;
    const cup = [v(cx - 30.0, y), v(cx + 30.0, y), v(cx + 24.0, y + 26.0), v(cx - 24.0, y + 26.0)];
    Ink.poly(g, cup, rgb(0.97, 0.96, 0.92), 2.5);
    g.line(v(cx - 27.0, y + 12.0), v(cx + 27.0, y + 12.0), rgb(0.3, 0.6, 0.45), 4.0);
  }
  Ink.rrect(g, new R(cx - 34.0, cupTop + 9 * 18.0 + 4.0, 68.0, 16.0), rgb(0.3, 0.6, 0.45), 6.0, 2.5);
  // 큰 전구 두 개
  for (const bx of [118.0, size.x - 160.0]) {
    const by = top + 118.0;
    g.line(v(bx, top), v(bx, by - 20.0), Ink.LINE, 3.0);
    Ink.rect(g, new R(bx - 9.0, by - 24.0, 18.0, 12.0), rgb(0.3, 0.27, 0.22), 2.5);
    const flicker = 0.92 + 0.08 * Math.sin(t * 5.0 + bx);
    g.circle(v(bx, by), 80.0, rgb(1.0, 0.78, 0.4, 0.12 * flicker));
    g.circle(v(bx, by), 40.0, rgb(1.0, 0.82, 0.45, 0.2 * flicker));
    Ink.circle(g, v(bx, by), 15.0, rgb(1.0, 0.94, 0.72).mul(flicker), 3.0);
  }
}

