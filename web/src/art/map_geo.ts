// 스테이지 지도의 땅 좌표 (아이소메트릭 3/4 시점, 2026-11-14 사용자 요청: "아이소메트릭 계열의 3/4 시점, 길이 배경이랑 같이 이어지게").
// 땅은 마름모 타일 격자: 땅 좌표 (gx, gy) 한 칸 = 화면에서 가로 TA*2, 세로 TB*2 마름모.
//   +gx = 화면 오른쪽 아래, +gy = 왼쪽 아래, h = 위로 (px).
// 길은 격자를 따라 지그재그: 가게마다 왼쪽 꼭대기(앞 가게와의 경계) → 오른쪽 아래로 내려가 V 바닥 → 오른쪽 위로 올라가 다음 경계.
// 가게 건물은 V 안쪽(길 위쪽)에, 정면(입구)이 길 한쪽을 본다. 입구 앞마당에 ∞(무한 영업) 발판.
// 스테이지 발판은 길바닥 위에 박혀 있다 (길 가운데 선 위, 일정한 간격).
// 이 파일은 계산만 (그림·DOM 없음): StageMap(버튼 위치)과 MapArt(그림)가 같이 쓴다.

import { R, V, v } from "../engine/geom.ts";
import * as D from "../core/defs.ts";
import type { ShopDef } from "../core/defs.ts";

export const TA = 64.0; // 타일 반 너비 (화면 px)
export const TB = 26.0; // 타일 반 높이 (사용자 건물 그림들의 평균 각도에 맞춤, 2026-11-14)
export const K = TB / TA; // 땅에 누운 원의 세로/가로 비
export const OY = 590.0; // 땅 (0,0) 의 화면 y = 가게 경계(길 꼭대기)의 높이
export const ARM = 13; // 길 한 팔의 길이 (타일): 꼭대기 → V 바닥
export const ZONE_W = 2 * ARM * TA; // 가게 구역 하나의 화면 너비 (1664)
export const LOT_W = 1280.0; // 끝의 "새 가게 준비 중" 빈터
export const ROAD = 1.0; // 길 반폭 (타일)
export const CURB_H = 12.0; // 인도가 길보다 높은 만큼 (px)
export const YARD = 2.0; // 가게 입구 앞마당 깊이 (타일)
export const SIDE = 1.0; // 가게 옆 인도 폭 (타일)
// 가게 경계(길 꼭대기)에는 미식가 이벤트 발판이 서도록 앞뒤를 비운다 (2026-11-16, 예전 1.85 / 3.7)
export const CORNER_R = 1.6; // 길이 꺾이는 곳을 이 반지름(타일)의 1/4 원으로 둥글게 (2026-11-16 사용자 "길이 너무 각진 것 같아, 모서리 둥글게")
export const NODE_S0 = 2.5; // 구역 안 첫 스테이지 자리 (길 위 거리, 타일)
export const NODE_DS = 3.5; // 스테이지 간격 (타일)
const LOT_ROAD = 5.5;
const SPUR_NODE_GX = 4; // 입구가 오른쪽 팔을 볼 때 ∞ 샛길이 갈라지는 발판 (가게 안 5번째)
const SPUR_NODE_GY = 2; // 왼쪽 팔을 볼 때 (가게 안 3번째) // 빈터에서 길이 더 가는 길이

/** 땅 좌표 → 화면 좌표 (h = 땅에서 위로 px) */
export function iso(gx: number, gy: number, h = 0.0): V {
  return v((gx - gy) * TA, OY + (gx + gy) * TB - h);
}

/** 땅 위 네모 (gx x0~x1, gy y0~y1) */
export interface GRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function grect(x0: number, y0: number, x1: number, y1: number): GRect {
  return { x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1) };
}

export function grow(r: GRect, d: number): GRect {
  return { x0: r.x0 - d, y0: r.y0 - d, x1: r.x1 + d, y1: r.y1 + d };
}

export function inRect(r: GRect, gx: number, gy: number): boolean {
  return gx >= r.x0 && gx <= r.x1 && gy >= r.y0 && gy <= r.y1;
}

/** 네모를 높이 h 에 눕힌 마름모 (화면 꼭짓점: 위 · 오른쪽 · 아래 · 왼쪽) */
export function diamond(r: GRect, h = 0.0): V[] {
  return [iso(r.x0, r.y0, h), iso(r.x1, r.y0, h), iso(r.x1, r.y1, h), iso(r.x0, r.y1, h)];
}

/**
 * 건물 그림을 땅 격자에 맞추는 값. 그림마다 그린 각도가 조금씩 달라서 (왼쪽 아래 면·오른쪽 아래 면의 기울기),
 * 세로줄은 그대로 두고 살짝 기울이고(c) 세로로 늘리거나 줄여서(d) 바닥 모서리가 격자 방향과 맞게 한다.
 * 그리기: 앞 모서리 화면 위치로 옮기고 transform(1, c, 0, d) 후 그림을 (-fx·k, -fy·k) 에 k 배로.
 */
export interface ArtFit {
  k: number; // 그림 px → 화면 px
  c: number; // 세로 기울임 (x 1px 당 y)
  d: number; // 세로 배율
  fx: number; // 그림 속 앞 모서리 (그림 px)
  fy: number;
  iw: number; // 그림 크기 (그림 px)
  ih: number;
}

/**
 * 가게 건물 자리: nx · ny = 바닥 크기 (타일, nx 는 gx 방향 = 왼쪽 아래 면의 길이, ny 는 gy 방향 = 오른쪽 아래 면의 길이),
 * front = 입구 면 (gx = 오른쪽 아래 면, gy = 왼쪽 아래 면), art = 사용자 그림 맞춤, tall = 그림이 없을 때 직접 그리는 건물 높이 (px).
 */
export interface BuildingSpec {
  nx: number;
  ny: number;
  front?: "gx" | "gy";
  art?: ArtFit;
  tall?: number;
}

/**
 * 그림 속 바닥 세 꼭짓점 (L 왼쪽 · F 앞 · R 오른쪽, 그림 px) 과 화면 가로 크기 w 로 건물 자리 만들기.
 * 세로 배율은 너무 일그러지지 않게 0.85~1.2 로 묶는다 (그 밖이면 각도가 조금 덜 맞음).
 */
function fitArt(iw: number, ih: number, L: [number, number], F: [number, number], R: [number, number], w: number, front: "gx" | "gy"): BuildingSpec {
  const k = w / iw;
  const sL = (F[1] - L[1]) / Math.max(1, F[0] - L[0]);
  const sR = (F[1] - R[1]) / Math.max(1, R[0] - F[0]);
  const d = Math.min(1.2, Math.max(0.85, (2 * K) / Math.max(0.05, sL + sR)));
  const c = (d * (sR - sL)) / 2;
  return { nx: ((F[0] - L[0]) * k) / TA, ny: ((R[0] - F[0]) * k) / TA, front, art: { k, c, d, fx: F[0], fy: F[1], iw, ih } };
}

// 사용자 그림 (public/assets/art/map/<id>.webp, 배경 오린 뒤 크기 기준). 바닥 꼭짓점은 그림에서 잰 값.
export const BUILDINGS: Record<string, BuildingSpec> = {
  pocha: fitArt(1000, 699, [20, 535], [355, 665], [985, 530], 700, "gx"),
  bunsik: fitArt(1000, 1193, [100, 1000], [660, 1180], [950, 985], 560, "gy"),
  market: fitArt(1000, 640, [15, 512], [460, 713], [990, 544], 780, "gx"),
  beach: fitArt(1000, 817, [20, 650], [350, 805], [985, 650], 660, "gx"),
  suljip: fitArt(1000, 684, [15, 565], [745, 683], [995, 486], 790, "gy"),
};
const LOT_SPEC: BuildingSpec = { nx: 5.0, ny: 5.0, tall: 200.0 };

/** 가게 구역 하나 (shop 이 null 이면 끝의 빈터) */
export interface Zone {
  index: number;
  shop: ShopDef | null;
  x0: number; // 화면 띠 (왼쪽 경계 ~ 오른쪽 경계)
  x1: number;
  peak: [number, number]; // 왼쪽 경계의 길 꼭대기 (땅 좌표)
  corner: [number, number]; // V 바닥
  front: "gx" | "gy"; // 건물 입구가 보는 쪽: gx = 오른쪽 아래(오른쪽 팔), gy = 왼쪽 아래(왼쪽 팔)
  spec: BuildingSpec;
  foot: GRect; // 건물 바닥
  frontCorner: [number, number]; // 건물 바닥 맨 앞 꼭짓점 (gx 최대, gy 최대)
  spurS: number; // ∞ 샛길이 갈라지는 길 위 거리 (빈터는 -1)
  spurBase: [number, number];
  spurEnd: [number, number]; // ∞ 발판 자리
  notch: GRect | null; // 입구 앞마당 (길처럼 낮은 바닥)
  bounds: R; // 건물 그림이 차지하는 화면 네모 (이름표·버튼 자리용)
}

export interface MapLayout {
  zones: Zone[];
  width: number;
  pathPts: [number, number][]; // 길 가운데 선의 꺾이는 점 (땅 좌표)
  pathS: number[]; // 각 점까지의 길 위 거리
  roads: GRect[]; // 길바닥 (낮은 곳) 네모들 — 소품 피하기용 (그리는 길은 roadOutline, 모서리가 둥금)
  endS: number; // 길이 끝나는 곳 (공사 표지)
  corners: Corner[]; // 길이 90도로 꺾이는 곳 (둥글게 그림)
}

/** 길이 꺾이는 곳: 길 위 거리 s, 꺾이는 점, 들어오는 방향·나가는 방향 (땅 좌표 단위 벡터) */
export interface Corner {
  s: number;
  p: [number, number];
  din: [number, number];
  dout: [number, number];
}

export function zoneX(i: number): number {
  return i * ZONE_W;
}

export function worldWidth(): number {
  return D.SHOPS.length * ZONE_W + LOT_W;
}

/** 스테이지 lv 의 길 위 거리 */
export function levelS(lv: number): number {
  const i = D.shopIndexForLevel(lv);
  const k = D.levelInShop(lv) - 1;
  return i * 2 * ARM + NODE_S0 + NODE_DS * k;
}

/** 미식가 이벤트 발판의 길 위 거리: 그 가게와 다음 가게 사이 (길 꼭대기) */
export function eventS(shopId: string): number {
  return (D.shopIndex(shopId) + 1) * 2 * ARM;
}

/** 미식가 이벤트 발판의 화면 위치 (길바닥) */
export function eventPos(shopId: string): V {
  const [gx, gy] = pathAt(eventS(shopId));
  return iso(gx, gy);
}

/** 그림에 입구 방향이 없을 때 구역 i 의 건물 입구 쪽 (짝수 구역 = 오른쪽 아래, 홀수 = 왼쪽 아래) */
function frontOf(i: number): "gx" | "gy" {
  return i % 2 === 0 ? "gx" : "gy";
}

let cache: MapLayout | null = null;

export function layout(): MapLayout {
  if (cache !== null) return cache;
  const n = D.SHOPS.length;
  const zones: Zone[] = [];
  const roads: GRect[] = [];
  const pts: [number, number][] = [[-6, 0]];
  for (let i = 0; i <= n; i++) {
    const shop = i < n ? D.SHOPS[i] : null;
    const px = ARM * i;
    const py = -ARM * i;
    const cx = px + ARM;
    const cy = py;
    pts.push([px, py]);
    if (shop === null) {
      // 빈터: 길이 조금 더 가다가 끝나고, 그 위쪽에 울타리 친 공사터
      roads.push(grect(px - ROAD, py - ROAD, px + LOT_ROAD, py + ROAD));
      pts.push([px + LOT_ROAD - 0.5, py]);
      const fc: [number, number] = [px + 6.0, py - ROAD - SIDE];
      const foot = grect(fc[0] - LOT_SPEC.nx, fc[1] - LOT_SPEC.ny, fc[0], fc[1]);
      zones.push({
        index: i, shop: null, x0: zoneX(i), x1: zoneX(i) + LOT_W, peak: [px, py], corner: [px + LOT_ROAD, py], front: "gx",
        spec: LOT_SPEC, foot, frontCorner: fc, spurS: -1, spurBase: fc, spurEnd: fc, notch: null, bounds: specBounds(LOT_SPEC, foot, fc),
      });
      continue;
    }
    pts.push([cx, cy]);
    roads.push(grect(i === 0 ? -8 : px - ROAD, py - ROAD, cx + ROAD, py + ROAD)); // 왼쪽 팔
    roads.push(grect(cx - ROAD, cy - ARM - ROAD, cx + ROAD, cy + ROAD)); // 오른쪽 팔
    const spec = BUILDINGS[shop.id] ?? { nx: 4.0, ny: 4.0, tall: 240.0 };
    const front = spec.front ?? frontOf(i);
    let fc: [number, number];
    let spurS: number;
    let spurBase: [number, number];
    let spurEnd: [number, number];
    let notch: GRect;
    const half = 0.85;
    // ∞ 샛길은 건물 입구 쪽 팔의 스테이지 발판(입구에 가장 가까운 것)에서 곧장 앞마당으로 갈라진다.
    // 발판에서 갈라져야 ∞ 발판이 스테이지 발판과 위아래로 겹치지 않고 비스듬히 놓인다.
    if (front === "gx") {
      // 입구가 오른쪽 팔을 본다: 앞마당은 오른쪽 팔과 건물 사이
      fc = [cx - ROAD - YARD, cy - ROAD - SIDE];
      spurS = i * 2 * ARM + NODE_S0 + NODE_DS * SPUR_NODE_GX;
      const d = spurS - i * 2 * ARM - ARM;
      spurBase = [cx, cy - d];
      spurEnd = [cx - ROAD - YARD * 0.52, cy - d];
      notch = grect(cx - ROAD - YARD + 0.05, spurBase[1] - half, cx - ROAD + 0.1, spurBase[1] + half);
    } else {
      fc = [cx - ROAD - SIDE, cy - ROAD - YARD];
      spurS = i * 2 * ARM + NODE_S0 + NODE_DS * SPUR_NODE_GY;
      const d = spurS - i * 2 * ARM;
      spurBase = [px + d, cy];
      spurEnd = [px + d, cy - ROAD - YARD * 0.52];
      notch = grect(spurBase[0] - half, cy - ROAD - YARD + 0.05, spurBase[0] + half, cy - ROAD + 0.1);
    }
    const foot = grect(fc[0] - spec.nx, fc[1] - spec.ny, fc[0], fc[1]);
    zones.push({
      index: i, shop, x0: zoneX(i), x1: zoneX(i + 1), peak: [px, py], corner: [cx, cy], front, spec, foot, frontCorner: fc,
      spurS, spurBase, spurEnd, notch, bounds: specBounds(spec, foot, fc),
    });
  }
  const pathS: number[] = [];
  let s = -6.0;
  pts.forEach((p, k) => {
    if (k > 0) s += Math.abs(p[0] - pts[k - 1][0]) + Math.abs(p[1] - pts[k - 1][1]);
    pathS.push(s);
  });
  // 꺾이는 곳 (방향이 바뀌는 점)
  const corners: Corner[] = [];
  for (let k = 1; k < pts.length - 1; k++) {
    const din = unit(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    const dout = unit(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]);
    if (Math.abs(din[0] - dout[0]) + Math.abs(din[1] - dout[1]) > 1e-6) corners.push({ s: pathS[k], p: pts[k], din, dout });
  }
  cache = { zones, width: worldWidth(), pathPts: pts, pathS, roads, endS: s, corners };
  return cache;
}

/** 건물 그림이 차지할 화면 네모 */
function specBounds(spec: BuildingSpec, foot: GRect, fc: [number, number]): R {
  const f = iso(fc[0], fc[1]);
  const a = spec.art;
  if (a !== undefined) {
    // 기울인 그림의 네모: 가로는 그대로, 위 끝은 그림 가운데 위 (빈 모서리는 셈하지 않음)
    const x0 = -a.fx * a.k;
    const x1 = (a.iw - a.fx) * a.k;
    const yTop = a.c * ((x0 + x1) * 0.5) + a.d * (-a.fy * a.k);
    const yBot = Math.max(a.c * x0, a.c * x1) + a.d * ((a.ih - a.fy) * a.k);
    return new R(f.x + x0, f.y + yTop, x1 - x0, yBot - yTop);
  }
  const left = iso(foot.x0, foot.y1);
  const right = iso(foot.x1, foot.y0);
  const top = iso(foot.x0, foot.y0, spec.tall ?? 200.0);
  return new R(left.x, top.y, right.x - left.x, f.y - top.y);
}

function unit(x: number, y: number): [number, number] {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

/** 꺾이는 곳 근처면 그 곳 (둥근 1/4 원 위) */
function cornerNear(s: number): Corner | null {
  for (const c of layout().corners) if (Math.abs(s - c.s) < CORNER_R) return c;
  return null;
}

/** 둥근 모서리 위의 점과 접선: 꺾이는 점에서 CORNER_R 앞(A)부터 뒤(B)까지를 1/4 원으로 (길 위 거리는 각진 길 그대로 씀) */
function onCorner(c: Corner, s: number): { p: [number, number]; t: [number, number] } {
  const R = CORNER_R;
  const th = ((s - (c.s - R)) / (2 * R)) * (Math.PI / 2);
  const ax = c.p[0] - c.din[0] * R;
  const ay = c.p[1] - c.din[1] * R;
  const cx = ax + c.dout[0] * R;
  const cy = ay + c.dout[1] * R;
  const cos = Math.cos(th);
  const sin = Math.sin(th);
  const p: [number, number] = [cx - c.dout[0] * R * cos + c.din[0] * R * sin, cy - c.dout[1] * R * cos + c.din[1] * R * sin];
  const t = unit(c.dout[0] * sin + c.din[0] * cos, c.dout[1] * sin + c.din[1] * cos);
  return { p, t };
}

/** 각진 길 위의 점 (앞뒤 끝 밖은 첫·마지막 방향으로 늘림) */
function sharpAt(s: number): [number, number] {
  const L = layout();
  const p = L.pathPts;
  const ss = L.pathS;
  if (s <= ss[0]) {
    const d = unit(p[1][0] - p[0][0], p[1][1] - p[0][1]);
    return [p[0][0] + d[0] * (s - ss[0]), p[0][1] + d[1] * (s - ss[0])];
  }
  for (let k = 1; k < p.length; k++) {
    if (s <= ss[k]) {
      const t = (s - ss[k - 1]) / Math.max(1e-6, ss[k] - ss[k - 1]);
      return [p[k - 1][0] + (p[k][0] - p[k - 1][0]) * t, p[k - 1][1] + (p[k][1] - p[k - 1][1]) * t];
    }
  }
  const n = p.length - 1;
  const d = unit(p[n][0] - p[n - 1][0], p[n][1] - p[n - 1][1]);
  return [p[n][0] + d[0] * (s - ss[n]), p[n][1] + d[1] * (s - ss[n])];
}

/** 길 가운데 선의 방향 (땅 좌표 단위 벡터, 둥근 모서리 반영) */
export function pathTangent(s: number): [number, number] {
  const c = cornerNear(s);
  if (c !== null) return onCorner(c, s).t;
  const [dx, dy] = pathDir(s);
  return unit(dx, dy);
}

/** 그릴 길 테두리 (땅 좌표 다각형): 가운데 선을 양쪽으로 ROAD 만큼 — 꺾이는 곳은 둥글게 */
export function roadOutline(): [number, number][] {
  const L = layout();
  const s0 = L.pathS[0] - 2.0;
  const s1 = L.endS + 0.5;
  const ss: number[] = [];
  for (let s = s0; s < s1; s += 0.5) ss.push(s);
  for (const c of L.corners) for (let k = 0; k <= 16; k++) ss.push(c.s - CORNER_R + (2 * CORNER_R * k) / 16);
  ss.push(s1);
  ss.sort((a, b) => a - b);
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (const s of ss) {
    const [x, y] = pathAt(s);
    const [tx, ty] = pathTangent(s);
    left.push([x - ty * ROAD, y + tx * ROAD]);
    right.push([x + ty * ROAD, y - tx * ROAD]);
  }
  return left.concat(right.reverse());
}

/** 길 위 거리 s 의 땅 좌표 (길 가운데 선, 꺾이는 곳은 둥근 1/4 원 위) */
export function pathAt(s: number): [number, number] {
  const c = cornerNear(s);
  if (c !== null) return onCorner(c, s).p;
  return pathAtSharp(s);
}

function pathAtSharp(s: number): [number, number] {
  return sharpAt(s);
}

/** 길 위 거리 s 에서 가는 방향 (땅 좌표 단위 벡터) */
export function pathDir(s: number): [number, number] {
  const L = layout();
  const p = L.pathPts;
  const ss = L.pathS;
  for (let k = 1; k < p.length; k++) {
    if (s <= ss[k] || k === p.length - 1) {
      const dx = Math.sign(p[k][0] - p[k - 1][0]);
      const dy = Math.sign(p[k][1] - p[k - 1][1]);
      return [dx, dy];
    }
  }
  return [1, 0];
}

/** 스테이지 lv 발판의 화면 위치 (길바닥) */
export function levelPos(lv: number): V {
  const [gx, gy] = pathAt(levelS(lv));
  return iso(gx, gy);
}

export function zoneOf(shopId: string): Zone {
  return layout().zones[D.shopIndex(shopId)];
}

/** ∞ 발판의 화면 위치 */
export function endlessPos(shopId: string): V {
  const z = zoneOf(shopId);
  return iso(z.spurEnd[0], z.spurEnd[1]);
}
