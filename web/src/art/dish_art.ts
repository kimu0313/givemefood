// 메뉴마다 다른 그릇 (2026-11-12 사용자 요청 "메뉴마다 어울리는 그릇 디자인이 다 달랐으면").
// 그리는 순서: 그릇 뒤쪽(안쪽·접시면) → 음식 → 그릇 앞쪽(컵·냄비 벽). 먹선 그림체 (Ink).
// 크기 기준: s = 1 일 때 가로 ±85, 세로 -45 ~ +55 안. c = 그릇 가운데.
//
// kind
//   plate        둥근 접시 (col, rx, ring = 안쪽 테 색, edge = 가장자리 선 색, wrap = 비닐 씌운 초록 접시, extra = salt 소금 / chojang 초장)
//   rect_plate   긴 사각 접시          slate  검은 돌판          board_rect  나무 도마 접시     board_round  둥근 나무판
//   foil_tray    주름진 은박 접시       foil_sheet  은박지 한 장   cup  종이컵 (col, band = 띠, inside = 안쪽)
//   boat         종이 트레이 (check = 줄무늬)   basket  빨간 플라스틱 바구니 + 기름종이
//   pot          양은 냄비 (손잡이 2개)  wide_pot  넓은 전골냄비  steel_bowl  스테인리스 대접   bowl  사기 그릇 (pattern = 무늬 색)
// food = [음식 위치, 음식 크기, drawFood opts]

import { Color, PI, R, TAU, V, lerp, rgb, v } from "../engine/geom.ts";
import type { Gfx } from "../engine/gfx.ts";
import * as D from "../core/defs.ts";
import * as Ink from "./ink.ts";
import * as FoodArt from "./food_art.ts";
import * as ArtAssets from "./art_assets.ts";
import type { Opts } from "./food_art.ts";

const WHITE = rgb(0.97, 0.96, 0.92);
const STEEL = rgb(0.78, 0.8, 0.84);
const KRAFT = rgb(0.82, 0.64, 0.43);
const WOOD = rgb(0.74, 0.52, 0.31);

interface Dish {
  kind: string;
  col?: Color;
  rx?: number;
  ring?: Color;
  edge?: Color;
  wrap?: boolean;
  extra?: string;
  band?: Color;
  inside?: Color;
  check?: Color;
  pattern?: Color;
  food: [V, number, Opts];
}

export const DISHES: Record<string, Dish> = {
  // 골목 포장마차
  tteokbokki: { kind: "plate", col: rgb(0.3, 0.6, 0.38), wrap: true, food: [v(0, -2), 0.64, {}] },
  sundae: { kind: "plate", col: rgb(0.97, 0.93, 0.84), edge: rgb(0.66, 0.44, 0.28), extra: "salt", food: [v(-8, -2), 0.64, { sliced: true }] },
  odeng: { kind: "cup", col: WHITE, band: rgb(0.85, 0.22, 0.16), inside: rgb(0.66, 0.45, 0.2), food: [v(), 0.5, {}] },
  twigim: { kind: "basket", col: rgb(0.86, 0.22, 0.17), food: [v(0, -16), 0.6, {}] },
  // 동네 분식집
  ramen: { kind: "pot", col: rgb(0.93, 0.74, 0.32), food: [v(0, -2), 1.0, { noodles: true }] },
  gimbap: { kind: "foil_sheet", food: [v(0, -6), 0.64, { sliced: true }] },
  donkatsu: { kind: "plate", col: WHITE, rx: 84.0, ring: rgb(0.55, 0.42, 0.3), food: [v(0, -6), 0.68, { plated: true }] },
  jjolmyeon: { kind: "steel_bowl", food: [v(0, -16), 0.64, { sliced: true }] },
  // 야시장 푸드트럭
  tornado: { kind: "boat", col: KRAFT, food: [v(0, -26), 0.6, { plated: true }] },
  hotteok: { kind: "cup", col: KRAFT, band: rgb(0.55, 0.34, 0.18), inside: rgb(0.5, 0.36, 0.24), food: [v(0, -30), 0.44, { plated: true }] },
  dakgangjeong: { kind: "cup", col: rgb(0.86, 0.2, 0.15), band: WHITE, inside: rgb(0.45, 0.1, 0.06), food: [v(0, -24), 0.46, { sliced: true }] },
  hotdog: { kind: "boat", col: WHITE, check: rgb(0.86, 0.22, 0.18), food: [v(0, -22), 0.6, { plated: true }] },
  // 해변 포장마차
  clam: { kind: "foil_tray", food: [v(0, -6), 0.6, { open: true }] },
  shrimp: { kind: "board_rect", food: [v(0, -8), 0.64, {}] },
  squid: { kind: "slate", extra: "chojang", food: [v(-10, -6), 0.6, { sliced: true }] },
  pajeon: { kind: "board_round", food: [v(0, -6), 0.56, {}] },
  // 실내 포차
  budae: { kind: "wide_pot", food: [v(0, 0), 0.92, { stage: 99 }] },
  dakbal: { kind: "plate", col: STEEL, ring: rgb(0.6, 0.62, 0.66), food: [v(0, -6), 0.64, {}] },
  egg_roll: { kind: "rect_plate", col: WHITE, edge: rgb(0.32, 0.48, 0.75), food: [v(0, -4), 0.64, { sliced: true }] },
  golbaengi: { kind: "bowl", col: WHITE, pattern: rgb(0.25, 0.42, 0.78), food: [v(0, -16), 0.68, { sliced: true }] },
};

const DEFAULT: Dish = { kind: "bowl", col: WHITE, pattern: rgb(0.32, 0.48, 0.75), food: [v(0, -14), 0.74, { sliced: true, plated: true }] };

export function dish(menuId: string): Dish {
  return DISHES[menuId] ?? DEFAULT;
}

/** 음식이 담긴 그릇 (empty = 빈 그릇만) */
export function draw(g: Gfx, menuId: string, c: V, s: number, quality: number, empty = false): void {
  const d = dish(menuId);
  const w = FoodArt.inkW(s);
  back(g, d, c, s, w);
  if (!empty) food(g, menuId, d, c, s, quality);
  front(g, d, c, s, w);
  if (!empty && quality === D.Q.PERFECT) {
    FoodArt.sparkle(g, c.add(v(60, -44).mul(s)), 1.1 * s);
    FoodArt.sparkle(g, c.add(v(-62, -28).mul(s)), 0.7 * s);
  }
}

function food(g: Gfx, menuId: string, d: Dish, c: V, s: number, quality: number): void {
  const tex = ArtAssets.food(menuId);
  if (tex !== null) {
    ArtAssets.drawCentered(g, tex, c.add(v(0, -18).mul(s)), 110.0 * s, quality !== D.Q.BURNT ? 1.0 : 0.5);
    return;
  }
  const col = FoodArt.qualityColor(menuId, quality);
  if (menuId === "odeng") {
    // 종이컵에 꽂은 어묵 꼬치 2개 (막대는 컵 안으로)
    FoodArt.odengSkewer(g, c.add(v(-12, -44).mul(s)), -PI * 0.5 - 0.22, 0.5 * s, col);
    FoodArt.odengSkewer(g, c.add(v(14, -50).mul(s)), -PI * 0.5 + 0.2, 0.5 * s, col.darkened(0.04));
    return;
  }
  const f = d.food;
  FoodArt.drawFood(g, menuId, c.add(f[0].mul(s)), f[1] * s, col, f[2]);
}

// ---------------------------------------------------------------- 그릇 뒤쪽 (음식 아래)

function back(g: Gfx, d: Dish, c: V, s: number, w: number): void {
  const col = d.col ?? WHITE;
  switch (d.kind) {
    case "plate": {
      const rx = (d.rx ?? 78.0) * s;
      const ry = rx * 0.34;
      const pc = c.add(v(0, 16).mul(s));
      Ink.ellipse(g, pc.add(v(0, 6).mul(s)), rx, ry, col.darkened(0.28), w);
      Ink.ellipse(g, pc, rx, ry, col, w);
      FoodArt.ellipse(g, pc.add(v(0, 2).mul(s)), rx * 0.74, ry * 0.64, col.darkened(0.07));
      if (d.ring) g.polyline(FoodArt.ellipsePoints(pc.add(v(0, 1).mul(s)), rx * 0.86, ry * 0.8, 28), d.ring, 2.5 * s);
      if (d.edge) g.polyline(FoodArt.ellipsePoints(pc, rx * 0.93, ry * 0.9, 28), d.edge, 3.0 * s);
      if (d.wrap) {
        // 비닐 씌운 초록 접시: 비닐 반짝임
        g.line(pc.add(v(-rx * 0.62, -ry * 0.1)), pc.add(v(-rx * 0.3, ry * 0.62)), rgb(1, 1, 1, 0.38), 5.0 * s);
        g.line(pc.add(v(rx * 0.42, -ry * 0.62)), pc.add(v(rx * 0.66, ry * 0.12)), rgb(1, 1, 1, 0.3), 4.0 * s);
        g.polyline(FoodArt.ellipsePoints(pc, rx * 0.97, ry * 0.95, 28, PI * 1.1, PI * 1.6), rgb(1, 1, 1, 0.5), 2.5 * s);
      }
      break;
    }
    case "rect_plate": {
      const r = R.of(c.add(v(-84, 4).mul(s)), v(168, 40).mul(s));
      Ink.rrect(g, r.moved(v(0, 6).mul(s)), col.darkened(0.25), 14.0 * s, w);
      Ink.rrect(g, r, col, 14.0 * s, w);
      FoodArt.roundedRect(g, r.grow(-9.0 * s), col.darkened(0.06), 10.0 * s);
      FoodArt.roundedRect(g, r.grow(-4.0 * s), rgb(0, 0, 0, 0), 12.0 * s, d.edge ?? rgb(0.3, 0.45, 0.7), Math.max(1, Math.round(3.0 * s)));
      break;
    }
    case "slate": {
      const r = R.of(c.add(v(-84, 2).mul(s)), v(168, 44).mul(s));
      Ink.rrect(g, r.moved(v(0, 6).mul(s)), rgb(0.1, 0.1, 0.11), 8.0 * s, w);
      Ink.rrect(g, r, rgb(0.2, 0.2, 0.22), 8.0 * s, w);
      for (let k = 0; k < 4; k++) {
        const y = r.y + r.h * (0.22 + 0.2 * k);
        g.line(v(r.x + 12.0 * s, y), v(r.endX - 20.0 * s - k * 8.0 * s, y + 3.0 * s), rgb(1, 1, 1, 0.07), 3.0 * s);
      }
      break;
    }
    case "board_rect": {
      const r = R.of(c.add(v(-86, 4).mul(s)), v(172, 40).mul(s));
      Ink.rrect(g, r.moved(v(0, 7).mul(s)), WOOD.darkened(0.3), 6.0 * s, w);
      Ink.rrect(g, r, WOOD, 6.0 * s, w);
      for (let k = 0; k < 3; k++) {
        const pts: V[] = [];
        const y = r.y + r.h * (0.25 + 0.25 * k);
        for (let j = 0; j < 9; j++) pts.push(v(r.x + 10.0 * s + (j * (r.w - 20.0 * s)) / 8.0, y + Math.sin(j * 1.3 + k * 2.0) * 2.5 * s));
        g.polyline(pts, WOOD.darkened(0.18), 2.0 * s);
      }
      break;
    }
    case "board_round": {
      const pc = c.add(v(0, 14).mul(s));
      const rx = 80.0 * s;
      const ry = 30.0 * s;
      Ink.ellipse(g, pc.add(v(0, 7).mul(s)), rx, ry, WOOD.darkened(0.3), w);
      Ink.ellipse(g, pc, rx, ry, WOOD, w);
      for (let k = 0; k < 3; k++) g.polyline(FoodArt.ellipsePoints(pc, rx * (0.25 + 0.22 * k), ry * (0.25 + 0.22 * k), 24), WOOD.darkened(0.14), 2.0 * s);
      break;
    }
    case "foil_tray": {
      const pc = c.add(v(0, 14).mul(s));
      const pts: V[] = [];
      for (let k = 0; k < 48; k++) {
        const a = (TAU * k) / 48.0;
        const r = 1.0 + (k % 2 === 0 ? 0.05 : 0.0);
        pts.push(pc.add(v(Math.cos(a) * 76.0 * r, Math.sin(a) * 28.0 * r).mul(s)));
      }
      Ink.poly(g, Ink.moved(pts, v(0, 6).mul(s)), rgb(0.6, 0.62, 0.66), w);
      Ink.poly(g, pts, rgb(0.84, 0.86, 0.9), w);
      FoodArt.ellipse(g, pc.add(v(0, 2).mul(s)), 58.0 * s, 19.0 * s, rgb(0.76, 0.78, 0.83));
      for (let k = 0; k < 6; k++) {
        const a = (TAU * k) / 6.0 + 0.3;
        g.line(pc.add(v(Math.cos(a) * 30.0, Math.sin(a) * 10.0).mul(s)), pc.add(v(Math.cos(a) * 52.0, Math.sin(a) * 18.0).mul(s)), rgb(1, 1, 1, 0.5), 2.0 * s);
      }
      break;
    }
    case "foil_sheet": {
      const pts = [v(-84, 6), v(-40, -2), v(10, 4), v(76, -4), v(86, 22), v(80, 44), v(20, 38), v(-36, 46), v(-78, 38)].map((p) => c.add(p.mul(s)));
      Ink.poly(g, pts, rgb(0.84, 0.86, 0.9), w);
      const segs: [V, V][] = [
        [v(-60, 10), v(-30, 36)],
        [v(0, 8), v(24, 34)],
        [v(48, 4), v(70, 30)],
      ];
      for (const [a, b] of segs) {
        g.line(c.add(a.mul(s)), c.add(b.mul(s)), rgb(1, 1, 1, 0.75), 2.5 * s);
        g.line(c.add(a.add(v(5, 0)).mul(s)), c.add(b.add(v(5, 0)).mul(s)), rgb(0.6, 0.62, 0.68), 1.5 * s);
      }
      break;
    }
    case "cup":
      Ink.ellipse(g, c.add(v(0, -6).mul(s)), 40.0 * s, 11.0 * s, d.inside ?? col.darkened(0.3), w);
      break;
    case "boat": {
      const floorPts = [v(-80, -8), v(80, -8), v(86, 6), v(-86, 6)].map((p) => c.add(p.mul(s)));
      Ink.poly(g, floorPts, col.darkened(0.2), w);
      break;
    }
    case "basket": {
      const top = c.add(v(0, -2).mul(s));
      Ink.ellipse(g, top, 76.0 * s, 22.0 * s, col.darkened(0.35), w);
      // 기름종이: 뒤쪽 모서리가 바구니 위로 삐죽
      for (const side of [-1.0, 1.0]) {
        const paper = [v(side * 66, 4), v(side * 46, -34), v(side * 10, -10), v(side * 20, 8)].map((p) => top.add(p.mul(s)));
        Ink.poly(g, paper, rgb(0.98, 0.96, 0.9), w * 0.7);
        g.line(top.add(v(side * 52, -18).mul(s)), top.add(v(side * 28, -6).mul(s)), rgb(0.85, 0.3, 0.25, 0.6), 2.0 * s);
      }
      FoodArt.ellipse(g, top.add(v(0, 2).mul(s)), 60.0 * s, 14.0 * s, rgb(0.98, 0.96, 0.9));
      break;
    }
    case "pot":
    case "wide_pot": {
      const wide = d.kind === "wide_pot";
      const pc = c.add((wide ? v(0, -6) : v(0, -14)).mul(s));
      const rx = (wide ? 80.0 : 66.0) * s;
      const ry = (wide ? 22.0 : 18.0) * s;
      const potCol = wide ? STEEL : col;
      const handle = wide ? rgb(0.2, 0.2, 0.22) : potCol.darkened(0.2);
      for (const side of [-1.0, 1.0]) {
        const hx = pc.x + side * (rx + 10.0 * s);
        Ink.rrect(g, R.of(v(hx - 14.0 * s, pc.y - 4.0 * s), v(28.0, 12.0).mul(s)), handle, 5.0 * s, w * 0.8);
      }
      Ink.ellipse(g, pc, rx, ry, potCol.darkened(0.22), w);
      break;
    }
    case "steel_bowl":
      Ink.ellipse(g, c.add(v(0, -8).mul(s)), 74.0 * s, 18.0 * s, STEEL.darkened(0.22), w);
      break;
    case "bowl": {
      const rim = c.add(v(0, 6).mul(s));
      const body = FoodArt.ellipsePoints(rim, 76.0 * s, 52.0 * s, 16, 0.0, PI);
      g.polygon(body, col);
      Ink.shade(g, body, v(-16, -6).mul(s), col.darkened(0.1));
      const pat = d.pattern ?? FoodArt.BOWL_STRIPE;
      g.line(rim.add(v(-64, 24).mul(s)), rim.add(v(64, 24).mul(s)), pat, 4.0 * s);
      for (let k = 0; k < 5; k++) {
        const x = -44.0 + k * 22.0;
        g.circle(rim.add(v(x, 34 - Math.abs(x) * 0.12).mul(s)), 3.2 * s, pat);
      }
      Ink.outline(g, body, w);
      Ink.ellipse(g, rim, 76.0 * s, 15.0 * s, col.darkened(0.12), w);
      break;
    }
  }
}

// ---------------------------------------------------------------- 그릇 앞쪽 (음식 위)

function front(g: Gfx, d: Dish, c: V, s: number, w: number): void {
  const col = d.col ?? WHITE;
  switch (d.kind) {
    case "plate": {
      const rx = (d.rx ?? 78.0) * s;
      const pc = c.add(v(0, 16).mul(s));
      if (d.extra === "salt") {
        // 소금 + 후추 한 꼬집
        const sp = pc.add(v(rx * 0.68, -2.0 * s));
        FoodArt.ellipse(g, sp, 14.0 * s, 6.0 * s, rgb(0.94, 0.9, 0.82));
        for (let k = 0; k < 5; k++) g.circle(sp.add(v(-8 + k * 4, -1 + (k % 2) * 2).mul(s)), 1.4 * s, rgb(0.25, 0.2, 0.18));
      }
      break;
    }
    case "slate":
      if (d.extra === "chojang") sauceDish(g, c.add(v(56, 22).mul(s)), s, w, rgb(0.86, 0.2, 0.12));
      break;
    case "cup": {
      const top = c.add(v(0, -6).mul(s));
      const rx = 40.0 * s;
      const ry = 11.0 * s;
      const body = wall(top, rx, ry, c.add(v(0, 50).mul(s)), rx * 0.74, ry * 0.74);
      Ink.poly(g, body, col, w);
      const band = d.band ?? col.darkened(0.2);
      g.polyline(FoodArt.ellipsePoints(c.add(v(0, 16).mul(s)), rx * 0.9, ry * 0.9, 14, 0.15, PI - 0.15), band, 8.0 * s);
      g.line(c.add(v(-24, 4).mul(s)), c.add(v(-18, 40).mul(s)), rgb(1, 1, 1, 0.4), 4.0 * s);
      g.polyline(FoodArt.ellipsePoints(top, rx, ry, 14, 0.0, PI), col.lightened(0.25), 3.0 * s);
      break;
    }
    case "boat": {
      const wallPts = [v(-86, 6), v(86, 6), v(70, 32), v(-70, 32)].map((p) => c.add(p.mul(s)));
      Ink.poly(g, wallPts, col, w);
      if (d.check) {
        for (let k = 0; k < 7; k++) {
          const f = (k + 0.5) / 7.0;
          const a = c.add(v(lerp(-80.0, 80.0, f), 8.0).mul(s));
          const b = c.add(v(lerp(-65.0, 65.0, f), 30.0).mul(s));
          g.line(a, b, d.check, 9.0 * s);
        }
        Ink.outline(g, wallPts, w);
      }
      g.line(c.add(v(-78, 11).mul(s)), c.add(v(78, 11).mul(s)), rgb(1, 1, 1, 0.35), 3.0 * s);
      break;
    }
    case "basket": {
      const top = c.add(v(0, -2).mul(s));
      const body = wall(top, 76.0 * s, 22.0 * s, c.add(v(0, 32).mul(s)), 62.0 * s, 15.0 * s);
      Ink.poly(g, body, col, w);
      // 바구니 구멍 (격자)
      for (let row = 0; row < 2; row++) {
        for (let k = 0; k < 7; k++) {
          const x = -48.0 + k * 16.0;
          const y = 20.0 + row * 12.0 - Math.abs(x) * 0.04;
          FoodArt.roundedRect(g, R.of(c.add(v(x - 4.5, y - 3.0).mul(s)), v(9.0, 6.0).mul(s)), col.darkened(0.45), 2.0 * s);
        }
      }
      g.polyline(FoodArt.ellipsePoints(top, 76.0 * s, 22.0 * s, 16, 0.1, PI - 0.1), col.lightened(0.2), 3.5 * s);
      break;
    }
    case "pot":
    case "wide_pot": {
      const wide = d.kind === "wide_pot";
      const pc = c.add((wide ? v(0, -6) : v(0, -14)).mul(s));
      const rx = (wide ? 80.0 : 66.0) * s;
      const ry = (wide ? 22.0 : 18.0) * s;
      const depth = (wide ? 28.0 : 50.0) * s;
      const potCol = wide ? STEEL : col;
      const body = wall(pc, rx, ry, pc.add(v(0, depth)), rx * 0.9, ry * 0.8);
      Ink.poly(g, body, potCol, w);
      Ink.shade(g, body, v(14, 0).mul(s), potCol.darkened(0.12));
      g.line(pc.add(v(-rx * 0.62, ry + 6.0 * s)), pc.add(v(-rx * 0.56, ry + depth * 0.7)), rgb(1, 1, 1, 0.45), 4.0 * s);
      g.polyline(FoodArt.ellipsePoints(pc, rx, ry, 16, 0.05, PI - 0.05), potCol.lightened(0.25), 3.0 * s);
      if (!wide) {
        // 양은 냄비 찌그러진 자국
        g.arc(pc.add(v(rx * 0.3, depth * 0.55)), 7.0 * s, 0.3, 2.6, potCol.darkened(0.2), 2.0 * s);
      }
      break;
    }
    case "steel_bowl": {
      const top = c.add(v(0, -8).mul(s));
      const body = wall(top, 74.0 * s, 18.0 * s, c.add(v(0, 38).mul(s)), 38.0 * s, 9.0 * s);
      Ink.poly(g, body, STEEL, w);
      g.polyline(FoodArt.ellipsePoints(c.add(v(0, 6).mul(s)), 56.0 * s, 14.0 * s, 12, 0.5, 1.4), rgb(1, 1, 1, 0.65), 4.0 * s);
      g.polyline(FoodArt.ellipsePoints(top, 74.0 * s, 18.0 * s, 16, 0.05, PI - 0.05), STEEL.lightened(0.3), 3.0 * s);
      Ink.rrect(g, R.of(c.add(v(-26, 42).mul(s)), v(52, 10).mul(s)), STEEL.darkened(0.15), 4.0 * s, w * 0.7);
      break;
    }
  }
}

/**
 * 컵·냄비·바구니의 앞 벽: 위 테두리(타원 top, rx, ry) 아래로 바닥(타원 bot, brx, bry)까지.
 * Godot 판은 사다리꼴에서 테두리 타원을 뺐다. 여기서는 그 결과 모양을 바로 만든다:
 * 벽 윗선 = 테두리 앞쪽 곡선(오른쪽 → 아래 → 왼쪽), 옆선 = 테두리 양 끝 → 바닥 양 끝, 아랫선 = 바닥 타원 앞쪽
 */
function wall(top: V, rx: number, ry: number, bot: V, brx: number, bry: number): V[] {
  const pts: V[] = [];
  const n = 20; // 테두리 타원 40칸 중 앞쪽 반 (Godot 판과 같은 촘촘함)
  for (let k = 0; k <= n; k++) {
    const a = (PI * k) / n; // 0 (오른쪽) → PI (왼쪽), 아래쪽으로
    pts.push(new V(top.x + Math.cos(a) * rx, top.y + Math.sin(a) * ry));
  }
  for (const p of FoodArt.ellipsePoints(bot, brx, bry, 16, PI, 0.0)) pts.push(p);
  return pts;
}

/** 초장 종지 */
function sauceDish(g: Gfx, p: V, s: number, w: number, sauce: Color): void {
  Ink.ellipse(g, p.add(v(0, 4).mul(s)), 18.0 * s, 8.0 * s, WHITE.darkened(0.2), w * 0.7);
  Ink.ellipse(g, p, 18.0 * s, 8.0 * s, WHITE, w * 0.7);
  FoodArt.ellipse(g, p.add(v(0, 1).mul(s)), 12.0 * s, 4.5 * s, sauce);
}
