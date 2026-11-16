// 튀김·김밥·돈까스·쫄면 그리고 3~5번째 가게 메뉴의 임시 아트 (도형). FoodArt.drawFood 가 직접 그리지 않는 메뉴는 여기로 넘긴다.
// 크기 기준: s = 1 일 때 대략 가로 ±75, 세로 ±55 안에 들어가게 그린다.
//
// opts (공통)
//   pan / pot      조리도구까지 같이 그리기 (화구 위 프라이팬·냄비)
//   sliced         도마 손질이 끝난(또는 그릇에 담긴) 모습
//   stage          조리 단계 번호 (CookItem.stepIndex) — 면 넣기·말기 같은 단계별 모습
//   open           조개가 입을 벌린 모습
//   plated         그릇에 담긴 모습 (소스·토핑 추가)

import { Color, PI, R, TAU, V, rgb, v } from "../engine/geom.ts";
import type { Gfx } from "../engine/gfx.ts";
import * as D from "../core/defs.ts";
import type { CookItem } from "../core/cook_item.ts";
import * as Ink from "./ink.ts";
import * as FoodArt from "./food_art.ts";
import type { Opts } from "./food_art.ts";

const WOOD = rgb(0.78, 0.62, 0.4);
const PAN = rgb(0.15, 0.15, 0.17);
const PAN_IN = rgb(0.26, 0.26, 0.29);
const POT = rgb(0.66, 0.68, 0.72);
const GREEN = rgb(0.4, 0.7, 0.3);
const SESAME = rgb(0.98, 0.95, 0.85);

export function draw(g: Gfx, menuId: string, c: V, s: number, col: Color, opts: Opts): void {
  const stage = opts.stage === undefined ? 99 : Number(opts.stage);
  const sliced = Boolean(opts.sliced);
  switch (menuId) {
    case "twigim":
      twigim(g, c, s, col);
      break;
    case "gimbap":
      gimbap(g, c, s, sliced, stage);
      break;
    case "donkatsu":
      donkatsu(g, c, s, col, Boolean(opts.plated));
      break;
    case "jjolmyeon":
      jjolmyeon(g, c, s, col, Boolean(opts.pot), sliced);
      break;
    case "tornado":
      tornado(g, c, s, col);
      break;
    case "hotteok":
      if (opts.pan) griddle(g, c, s);
      hotteok(g, c, s, col);
      break;
    case "dakgangjeong":
      dakgangjeong(g, c, s, col, sliced);
      break;
    case "hotdog":
      hotdog(g, c, s, col, Boolean(opts.plated));
      break;
    case "clam":
      clams(g, c, s, col, opts.open === undefined ? true : Boolean(opts.open));
      break;
    case "shrimp":
      shrimp(g, c, s, col);
      break;
    case "squid":
      squid(g, c, s, col, sliced);
      break;
    case "pajeon":
      if (opts.pan) pan(g, c, s, 76.0);
      pajeon(g, c, s, col);
      break;
    case "budae":
      stew(g, c, s, col, stage >= 1, Boolean(opts.pot));
      break;
    case "dakbal":
      dakbal(g, c, s, col);
      break;
    case "egg_roll":
      eggRoll(g, c, s, col, stage, sliced, Boolean(opts.pan));
      break;
    case "golbaengi":
      golbaengi(g, c, s, sliced);
      break;
  }
}

/** 조리도구 위에서 그릴 때의 opts (조리 단계에 따라 모습이 바뀌는 메뉴) */
export function cookOpts(item: CookItem): Opts {
  const stage = item.stepIndex;
  switch (item.menuId) {
    case "pajeon":
    case "egg_roll":
    case "hotteok":
      return { pan: true, stage };
    case "jjolmyeon":
      return { pot: true, stage };
    case "clam":
      return { open: item.stepQuality() >= D.Q.COOKED };
  }
  return { stage };
}

/** 조리도구 위 음식 크기 배수 (화구 1칸 기준) */
export function cookScale(menuId: string): number {
  return menuId === "pajeon" ? 0.95 : 1.0;
}

/** 말풍선·재료통 아이콘의 위치·크기·opts */
export function iconLayout(menuId: string): { offset: V; scale: number; opts: Opts } {
  switch (menuId) {
    case "budae":
      return { offset: v(0, 6), scale: 0.5, opts: { pot: true, stage: 99 } };
    case "pajeon":
      return { offset: v(), scale: 0.4, opts: {} };
    case "egg_roll":
      return { offset: v(), scale: 0.46, opts: { sliced: true } };
    case "gimbap":
    case "golbaengi":
    case "dakgangjeong":
    case "squid":
    case "jjolmyeon":
      return { offset: v(), scale: 0.44, opts: { sliced: true, plated: true } };
  }
  return { offset: v(), scale: 0.42, opts: { plated: true, sliced: true } };
}

// ---------------------------------------------------------------- 조리도구

function pan(g: Gfx, c: V, s: number, r: number): void {
  g.circle(c, r * s, PAN);
  g.circle(c, (r - 7.0) * s, PAN_IN);
  g.rect(new R(c.x + (r - 6.0) * s, c.y - 7.0 * s, 44.0 * s, 14.0 * s), PAN);
}

function griddle(g: Gfx, c: V, s: number): void {
  FoodArt.roundedRect(g, R.of(c.sub(v(86, 66).mul(s)), v(172, 132).mul(s)), PAN, 18.0 * s);
  FoodArt.roundedRect(g, R.of(c.sub(v(78, 58).mul(s)), v(156, 116).mul(s)), PAN_IN, 14.0 * s);
}

function potBack(g: Gfx, c: V, s: number): V {
  FoodArt.roundedRect(g, new R(c.x - 68.0 * s, c.y - 26.0 * s, 136.0 * s, 84.0 * s), POT, 14.0 * s);
  g.rect(new R(c.x - 90.0 * s, c.y - 12.0 * s, 24.0 * s, 12.0 * s), rgb(0.3, 0.3, 0.32));
  g.rect(new R(c.x + 66.0 * s, c.y - 12.0 * s, 24.0 * s, 12.0 * s), rgb(0.3, 0.3, 0.32));
  const top = c.add(v(0, -26).mul(s));
  FoodArt.ellipse(g, top, 68.0 * s, 19.0 * s, rgb(0.5, 0.52, 0.56));
  return top;
}

function bubbles(g: Gfx, top: V, s: number, w: number): void {
  const t = FoodArt.clock();
  for (let k = 0; k < 6; k++) {
    const bx = Math.sin(k * 2.1 + t * 3.0) * w;
    const r = (2.5 + 2.5 * Math.abs(Math.sin(t * 5.0 + k))) * s;
    g.circle(top.add(v(bx, Math.sin(k * 1.7 + t * 4.0) * 7.0).mul(s)), r, rgb(1, 1, 1, 0.75));
  }
}

// ---------------------------------------------------------------- 동네 분식집

function blob(g: Gfx, c: V, rx: number, ry: number, angle: number, col: Color, wobble: number): V[] {
  const pts: V[] = [];
  const n = 18;
  for (let k = 0; k < n; k++) {
    const a = (TAU * k) / n;
    const wob = 1.0 + 0.09 * Math.sin(a * 5.0 + wobble) + 0.05 * Math.sin(a * 9.0 + wobble * 2.0);
    pts.push(c.add(v(Math.cos(a) * rx * wob, Math.sin(a) * ry * wob).rotated(angle)));
  }
  g.polygon(pts, col);
  return pts;
}

function crumbs(g: Gfx, c: V, rx: number, ry: number, angle: number, col: Color, s: number): void {
  for (let k = 0; k < 7; k++) {
    const a = k * 2.4;
    const p = v(Math.cos(a) * rx * 0.6, Math.sin(a) * ry * 0.55).rotated(angle);
    g.circle(c.add(p), 2.6 * s, col.lightened(0.22));
  }
}

function twigim(g: Gfx, c: V, s: number, col: Color): void {
  // 새우튀김 / 고구마튀김 / 김말이 (먹선 그림체)
  const w = FoodArt.inkW(s);
  Ink.poly(g, [c.add(v(28, -30).mul(s)), c.add(v(52, -42).mul(s)), c.add(v(46, -20).mul(s))], rgb(0.95, 0.42, 0.25), w * 0.7);
  const shrimpPts = blob(g, c.add(v(-18, -16).mul(s)), 52.0 * s, 15.0 * s, -0.25, col, 1);
  Ink.shade(g, shrimpPts, v(6, -6).mul(s), col.darkened(0.15));
  crumbs(g, c.add(v(-18, -16).mul(s)), 52.0 * s, 15.0 * s, -0.25, col, s);
  Ink.outline(g, shrimpPts, w);
  const potato = blob(g, c.add(v(-30, 22).mul(s)), 28.0 * s, 20.0 * s, 0.3, col.darkened(0.06), 4);
  Ink.outline(g, potato, w);
  Ink.circle(g, c.add(v(-30, 22).mul(s)), 12.0 * s, rgb(0.98, 0.78, 0.35).lerp(col, 0.3), w * 0.6);
  const roll = blob(g, c.add(v(32, 18).mul(s)), 40.0 * s, 17.0 * s, 0.15, col.darkened(0.03), 7);
  Ink.shade(g, roll, v(6, -6).mul(s), col.darkened(0.15));
  crumbs(g, c.add(v(32, 18).mul(s)), 40.0 * s, 17.0 * s, 0.15, col, s);
  Ink.outline(g, roll, w);
}

function gimbapSlice(g: Gfx, p: V, s: number): void {
  g.circle(p, 19.0 * s, rgb(0.1, 0.14, 0.1));
  g.circle(p, 16.0 * s, rgb(0.98, 0.98, 0.95));
  g.rect(new R(p.x - 9.0 * s, p.y - 3.0 * s, 6.0 * s, 6.0 * s), rgb(1.0, 0.82, 0.2));
  g.rect(new R(p.x - 2.0 * s, p.y - 8.0 * s, 5.0 * s, 6.0 * s), rgb(0.95, 0.5, 0.2));
  g.rect(new R(p.x + 3.0 * s, p.y - 1.0 * s, 6.0 * s, 6.0 * s), rgb(0.35, 0.65, 0.3));
  g.rect(new R(p.x - 3.0 * s, p.y + 3.0 * s, 6.0 * s, 5.0 * s), rgb(0.95, 0.55, 0.6));
}

const GIM = rgb(0.1, 0.14, 0.1);
const RICE = rgb(0.98, 0.97, 0.93);
const GIMBAP_FILLS = [rgb(1.0, 0.82, 0.2), rgb(0.95, 0.5, 0.2), rgb(0.35, 0.65, 0.3), rgb(0.95, 0.55, 0.6)];

/** 김밥: 도마 단계 stage 0 = 김만 / 1 = 김 + 밥 / 2 = 밥 위에 재료 / 3 = 만 김밥 한 줄 / sliced = 썬 김밥 */
function gimbap(g: Gfx, c: V, s: number, sliced: boolean, stage: number): void {
  const w = FoodArt.inkW(s);
  if (sliced || stage >= 4) {
    for (let k = 0; k < 6; k++) {
      const p = c.add(v(-42.0 + (k % 3) * 42.0, -18.0 + Math.floor(k / 3.0) * 36.0).mul(s));
      gimbapSlice(g, p, s);
    }
    return;
  }
  if (stage >= 3) {
    // 돌돌 만 김밥 한 줄 (오른쪽 끝 단면에 밥과 재료)
    const pts = FoodArt.capsule(c.add(v(-62, 0).mul(s)), c.add(v(50, 0).mul(s)), 22.0 * s);
    Ink.poly(g, pts, GIM, w);
    g.line(c.add(v(-58, -12).mul(s)), c.add(v(46, -12).mul(s)), rgb(0.35, 0.42, 0.33), 3.0 * s);
    for (let k = 0; k < 5; k++) g.line(c.add(v(-40 + k * 20, -18).mul(s)), c.add(v(-44 + k * 20, 18).mul(s)), rgb(0.18, 0.24, 0.17), 1.5 * s);
    const end = c.add(v(62, 0).mul(s));
    Ink.ellipse(g, end, 12.0 * s, 22.0 * s, GIM, w * 0.8);
    FoodArt.ellipse(g, end, 9.0 * s, 18.0 * s, RICE);
    for (let k = 0; k < GIMBAP_FILLS.length; k++) g.circle(end.add(v(-2 + (k % 2) * 4, -7 + k * 5).mul(s)), 2.8 * s, GIMBAP_FILLS[k]);
    return;
  }
  // 김 한 장 (그 위에 밥, 재료)
  const sheet = R.of(c.sub(v(72, 40).mul(s)), v(144, 80).mul(s));
  Ink.rrect(g, sheet, GIM, 6.0 * s, w);
  for (let k = 0; k < 4; k++) g.line(sheet.pos.add(v(10, 14 + k * 17).mul(s)), sheet.pos.add(v(134, 18 + k * 17).mul(s)), rgb(0.17, 0.23, 0.16), 1.5 * s);
  if (stage < 1) return;
  // 밥: 김 위쪽 끝은 조금 남기고 고르게 편 밥
  const rice = R.of(sheet.pos.add(v(6, 16).mul(s)), sheet.size.sub(v(12, 22).mul(s)));
  FoodArt.roundedRect(g, rice, RICE, 8.0 * s);
  for (let k = 0; k < 14; k++) {
    const a = k * 2.3;
    g.circle(rice.center().add(v(Math.cos(a) * rice.w * 0.4, Math.sin(a * 1.3) * rice.h * 0.35)), 1.6 * s, RICE.darkened(0.08));
  }
  if (stage < 2) return;
  // 재료: 단무지·당근·시금치·햄을 가로로 나란히
  for (let k = 0; k < GIMBAP_FILLS.length; k++) {
    const r = new R(c.x - 56.0 * s, c.y + (-6.0 + k * 9.0) * s, 112.0 * s, 7.0 * s);
    g.rect(r, GIMBAP_FILLS[k]);
    g.rect(r, Ink.LINE, false, 1.0 * s);
  }
}

/** 돈까스: 튀김기에서는 통째로, 접시에서는 썰어서 소스·양배추와 함께 */
function donkatsu(g: Gfx, c: V, s: number, col: Color, plated: boolean): void {
  if (plated) {
    // 양배추 채
    for (let k = 0; k < 7; k++) {
      const a = k * 0.5 - 1.5;
      g.line(c.add(v(40, 10).mul(s)), c.add(v(40, 10).mul(s)).add(v(Math.cos(a), Math.sin(a)).mul(30.0 * s)), rgb(0.78, 0.9, 0.55), 4.0 * s);
    }
    FoodArt.ellipse(g, c.add(v(44, 12).mul(s)), 18.0 * s, 12.0 * s, rgb(0.85, 0.94, 0.65));
    g.circle(c.add(v(50, -2).mul(s)), 6.0 * s, rgb(0.95, 0.3, 0.25));
    // 썬 돈까스 5조각
    for (let k = 0; k < 5; k++) {
      const p = c.add(v(-58.0 + k * 21.0, 4.0 - k * 2.0).mul(s));
      FoodArt.rotRect(g, p, v(19, 50).mul(s), 0.12, col);
      FoodArt.rotRect(g, p.add(v(2, 0).mul(s)), v(6, 42).mul(s), 0.12, rgb(0.98, 0.94, 0.86).lerp(col, 0.25));
    }
    // 갈색 소스
    const pts: V[] = [];
    for (let k = 0; k < 11; k++) pts.push(c.add(v(-60.0 + k * 9.0, -6.0 + Math.sin(k * 1.3) * 9.0).mul(s)));
    g.polyline(pts, rgb(0.36, 0.17, 0.08), 7.0 * s);
    return;
  }
  blob(g, c, 64.0 * s, 40.0 * s, -0.08, col, 2);
  crumbs(g, c, 64.0 * s, 40.0 * s, -0.08, col, s);
  for (let k = 0; k < 6; k++) {
    const a = k * 1.7;
    g.circle(c.add(v(Math.cos(a) * 30.0, Math.sin(a) * 16.0).mul(s)), 3.0 * s, col.lightened(0.2));
  }
}

/** 쫄면: 냄비에서는 끓는 물 속 면, 도마·그릇에서는 채소와 빨간 양념 (sliced = 비빈 뒤) */
function jjolmyeon(g: Gfx, c: V, s: number, col: Color, inPot: boolean, mixed: boolean): void {
  if (inPot) {
    const top = c.add(v(0, -4).mul(s));
    FoodArt.ellipse(g, top, 60.0 * s, 28.0 * s, rgb(0.66, 0.8, 0.95));
    noodleNest(g, top, s, col, 44.0, 18.0);
    bubbles(g, top, s, 40.0);
    return;
  }
  const noodle = mixed ? col.lerp(rgb(0.92, 0.42, 0.25), 0.55) : col;
  noodleNest(g, c.add(v(-6, 6).mul(s)), s, noodle, 56.0, 30.0);
  if (mixed) {
    for (let k = 0; k < 8; k++) {
      const a = k * 0.8;
      g.circle(c.add(v(Math.cos(a) * 34.0, Math.sin(a) * 16.0 + 4.0).mul(s)), 6.0 * s, rgb(0.85, 0.2, 0.12, 0.8));
    }
  }
  // 양배추·오이·당근 채
  for (let k = 0; k < 4; k++) {
    FoodArt.rotRect(g, c.add(v(-34 + k * 8, -24 + (k % 2) * 4).mul(s)), v(4, 24).mul(s), 0.4, rgb(0.4, 0.68, 0.3));
    FoodArt.rotRect(g, c.add(v(24 + k * 7, -26 + (k % 2) * 3).mul(s)), v(4, 22).mul(s), -0.3, rgb(0.98, 0.6, 0.2));
  }
  FoodArt.ellipse(g, c.add(v(-4, -26).mul(s)), 22.0 * s, 9.0 * s, rgb(0.85, 0.95, 0.7));
  if (!mixed) blob(g, c.add(v(4, -6).mul(s)), 22.0 * s, 14.0 * s, 0.0, rgb(0.85, 0.18, 0.1), 4);
  // 삶은 달걀 반쪽
  g.circle(c.add(v(44, 10).mul(s)), 15.0 * s, rgb(0.99, 0.98, 0.95));
  g.circle(c.add(v(44, 10).mul(s)), 7.0 * s, rgb(1.0, 0.8, 0.2));
  for (let k = 0; k < 6; k++) {
    const a = k * 2.1;
    g.circle(c.add(v(Math.cos(a) * 30.0, Math.sin(a) * 18.0).mul(s)), 1.8 * s, SESAME);
  }
}

/** 둥글게 쌓인 면 (쫄면) */
function noodleNest(g: Gfx, c: V, s: number, col: Color, rx: number, ry: number): void {
  FoodArt.ellipse(g, c, rx * s, ry * s, col.darkened(0.08));
  for (let k = 0; k < 5; k++) {
    const pts: V[] = [];
    const y = -ry * 0.6 + k * ry * 0.3;
    for (let j = 0; j < 10; j++) {
      const x = -rx * 0.85 + j * rx * 0.19;
      pts.push(c.add(v(x, y + Math.sin(j * 1.2 + k * 1.7) * 5.0).mul(s)));
    }
    g.polyline(pts, col.lightened(0.12), 4.5 * s);
  }
}

// ---------------------------------------------------------------- 야시장 푸드트럭

function hotdog(g: Gfx, c: V, s: number, col: Color, plated: boolean): void {
  g.line(c.add(v(-86, 6).mul(s)), c.add(v(-40, 2).mul(s)), WOOD, 6.0 * s);
  FoodArt.capsuleH(g, c.add(v(-34, 0).mul(s)), c.add(v(50, 0).mul(s)), 24.0 * s, col);
  for (let k = 0; k < 9; k++) g.circle(c.add(v(-38 + k * 11, -12 + (k % 3) * 9).mul(s)), 2.2 * s, col.lightened(0.25));
  if (plated) {
    const pts: V[] = [];
    for (let k = 0; k < 9; k++) pts.push(c.add(v(-34 + k * 10, -8 + (k % 2 === 0 ? 8 : -6)).mul(s)));
    g.polyline(pts, rgb(0.86, 0.12, 0.1), 4.0 * s);
    const pts2: V[] = [];
    for (let k = 0; k < 9; k++) pts2.push(c.add(v(-30 + k * 10, 6 + (k % 2 === 1 ? 6 : -6)).mul(s)));
    g.polyline(pts2, rgb(0.98, 0.82, 0.15), 3.5 * s);
  }
}

function tornado(g: Gfx, c: V, s: number, col: Color): void {
  g.line(c.add(v(-86, 0).mul(s)), c.add(v(86, 0).mul(s)), WOOD, 5.0 * s);
  for (let k = 0; k < 9; k++) {
    const x = (-60.0 + k * 15.0) * s;
    const tilt = k % 2 === 0 ? 0.35 : -0.35;
    const pts = FoodArt.ellipsePoints(v(), 6.0 * s, 28.0 * s, 16);
    pts.pop();
    const p = pts.map((q) => c.add(v(x, 0)).add(q.rotated(tilt)));
    g.polygon(p, k % 2 === 0 ? col : col.darkened(0.08));
  }
  for (let k = 0; k < 5; k++) g.circle(c.add(v(-50 + k * 25, -18 + (k % 2) * 30).mul(s)), 2.5 * s, rgb(0.95, 0.3, 0.2, 0.8));
}

function hotteok(g: Gfx, c: V, s: number, col: Color): void {
  for (let k = 0; k < 2; k++) {
    const p = c.add(v(-30 + k * 58, -6 + k * 12).mul(s));
    g.circle(p, 36.0 * s, col);
    g.arc(p, 30.0 * s, 0.0, TAU, col.darkened(0.1), 3.0 * s);
    g.circle(p.add(v(8, -6).mul(s)), 8.0 * s, rgb(0.45, 0.22, 0.08, 0.7));
    g.circle(p.add(v(-10, 8).mul(s)), 3.0 * s, col.lightened(0.25));
  }
}

function dakgangjeong(g: Gfx, c: V, s: number, col: Color, glazed: boolean): void {
  const spots = [v(-34, -18), v(0, -26), v(34, -14), v(-24, 16), v(12, 14), v(42, 22), v(-48, 14)];
  const piece = glazed ? rgb(0.7, 0.22, 0.1) : col;
  for (let k = 0; k < spots.length; k++) {
    blob(g, c.add(spots[k].mul(s)), 20.0 * s, 16.0 * s, k, piece, k);
    g.circle(c.add(spots[k].add(v(-6, -6)).mul(s)), 5.0 * s, piece.lightened(glazed ? 0.3 : 0.15));
  }
  if (glazed) {
    for (let k = 0; k < 10; k++) {
      const a = k * 2.2;
      g.circle(c.add(v(Math.cos(a) * 44.0, Math.sin(a) * 24.0).mul(s)), 2.2 * s, SESAME);
    }
    for (let k = 0; k < 4; k++) g.circle(c.add(v(-30 + k * 22, -2 + (k % 2) * 10).mul(s)), 4.0 * s, rgb(0.85, 0.66, 0.4));
  }
}

// ---------------------------------------------------------------- 해변 포장마차

function shell(g: Gfx, p: V, s: number, open: boolean, meat: Color, angle: number): void {
  const shellCol = rgb(0.9, 0.86, 0.8);
  const fan: V[] = [p];
  for (let k = 0; k < 13; k++) {
    const a = angle - PI * 0.5 - 0.95 + (1.9 * k) / 12.0;
    const r = (30.0 + 3.0 * Math.sin(k * 2.5)) * s;
    fan.push(p.add(v(Math.cos(a), Math.sin(a)).mul(r)));
  }
  g.polygon(fan, shellCol);
  for (let k = 0; k < 5; k++) {
    const a = angle - PI * 0.5 - 0.7 + (1.4 * k) / 4.0;
    g.line(p, p.add(v(Math.cos(a), Math.sin(a)).mul(28.0 * s)), shellCol.darkened(0.15), 2.0 * s);
  }
  if (open) {
    FoodArt.ellipse(g, p.add(v(0, -10).rotated(angle).mul(s)), 16.0 * s, 10.0 * s, meat);
    g.circle(p.add(v(-4, -13).rotated(angle).mul(s)), 3.5 * s, meat.lightened(0.3));
  }
}

function clams(g: Gfx, c: V, s: number, col: Color, open: boolean): void {
  shell(g, c.add(v(-34, 14).mul(s)), s, open, col, -0.3);
  shell(g, c.add(v(34, 16).mul(s)), s, open, col, 0.3);
  shell(g, c, s * 1.1, open, col, 0.0);
}

function oneShrimp(g: Gfx, p: V, s: number, col: Color, flip: boolean): void {
  const dir = flip ? -1.0 : 1.0;
  const a0 = flip ? PI * 0.85 : PI * 0.15;
  const pts: V[] = [];
  for (let k = 0; k < 10; k++) {
    const a = a0 + (dir * PI * 1.1 * k) / 9.0;
    pts.push(p.add(v(Math.cos(a), Math.sin(a)).mul(24.0 * s)));
  }
  g.polyline(pts, col, 15.0 * s);
  for (let k = 1; k < 9; k += 2) g.circle(pts[k], 3.0 * s, col.lightened(0.2));
  const tail = pts[pts.length - 1];
  g.polygon([tail, tail.add(v(-10 * dir, -14).mul(s)), tail.add(v(10 * dir, -12).mul(s))], col.darkened(0.15));
  g.circle(pts[0], 3.0 * s, rgb(0.1, 0.08, 0.08));
}

function shrimp(g: Gfx, c: V, s: number, col: Color): void {
  oneShrimp(g, c.add(v(-26, 0).mul(s)), s, col, false);
  oneShrimp(g, c.add(v(28, 4).mul(s)), s, col, true);
  for (let k = 0; k < 8; k++) g.circle(c.add(v(-50 + k * 14, 38).mul(s)), 2.0 * s, rgb(1, 1, 1, 0.8));
}

function squid(g: Gfx, c: V, s: number, col: Color, sliced: boolean): void {
  if (sliced) {
    for (let k = 0; k < 5; k++) {
      const p = c.add(v(-44.0 + k * 22.0, -12.0 + (k % 2) * 8.0).mul(s));
      g.arc(p, 11.0 * s, 0.0, TAU, col, 7.0 * s);
    }
    for (let k = 0; k < 4; k++) {
      const x = (-36.0 + k * 22.0) * s;
      const pts: V[] = [];
      for (let j = 0; j < 6; j++) pts.push(c.add(v(x / s + Math.sin(j * 1.3 + k) * 4.0, 16.0 + j * 5.0).mul(s)));
      g.polyline(pts, col.darkened(0.1), 4.0 * s);
    }
    return;
  }
  // 몸통(가로로 누운 오징어) + 지느러미 + 다리
  FoodArt.capsuleH(g, c.add(v(-30, -2).mul(s)), c.add(v(26, -2).mul(s)), 22.0 * s, col);
  g.polygon([c.add(v(-40, -2).mul(s)), c.add(v(-70, -26).mul(s)), c.add(v(-64, 22).mul(s))], col.darkened(0.05));
  for (let k = 0; k < 5; k++) {
    const pts: V[] = [];
    for (let j = 0; j < 7; j++) pts.push(c.add(v(46.0 + j * 6.0, -14.0 + k * 7.0 + Math.sin(j * 1.2 + k) * 3.0).mul(s)));
    g.polyline(pts, col.darkened(0.08), 3.5 * s);
  }
  g.line(c.add(v(-26, -8).mul(s)), c.add(v(20, -8).mul(s)), col.lightened(0.2), 3.0 * s);
}

function pajeon(g: Gfx, c: V, s: number, col: Color): void {
  blob(g, c, 62.0 * s, 58.0 * s, 0.0, col, 3);
  for (let k = 0; k < 7; k++) {
    const y = -40.0 + k * 13.0;
    g.line(c.add(v(-44, y).mul(s)), c.add(v(44, y + 6.0).mul(s)), rgb(0.35, 0.62, 0.25), 4.0 * s);
  }
  const bits = [v(-24, -20), v(18, -26), v(30, 12), v(-14, 24), v(4, 0)];
  for (const b of bits) g.arc(c.add(b.mul(s)), 7.0 * s, 0.2, PI * 1.4, rgb(0.98, 0.5, 0.3), 4.0 * s);
  g.circle(c.add(v(-30, 6).mul(s)), 4.0 * s, rgb(0.85, 0.2, 0.15));
  g.circle(c.add(v(26, -6).mul(s)), 4.0 * s, rgb(0.85, 0.2, 0.15));
}

// ---------------------------------------------------------------- 실내 포차

function eggRoll(g: Gfx, c: V, s: number, col: Color, stage: number, sliced: boolean, withPan: boolean): void {
  if (withPan) {
    FoodArt.roundedRect(g, R.of(c.sub(v(78, 54).mul(s)), v(156, 108).mul(s)), PAN, 12.0 * s);
    FoodArt.roundedRect(g, R.of(c.sub(v(70, 46).mul(s)), v(140, 92).mul(s)), PAN_IN, 8.0 * s);
    g.rect(new R(c.x + 76.0 * s, c.y - 7.0 * s, 40.0 * s, 14.0 * s), PAN);
  }
  if (sliced) {
    for (let k = 0; k < 5; k++) {
      const p = c.add(v(-48.0 + k * 24.0, 0.0).mul(s));
      FoodArt.roundedRect(g, R.of(p.sub(v(11, 22).mul(s)), v(22, 44).mul(s)), col, 6.0 * s);
      g.arc(p, 7.0 * s, 0.0, TAU * 0.85, col.darkened(0.15), 2.0 * s);
      g.circle(p.add(v(-2, -12).mul(s)), 2.5 * s, rgb(0.95, 0.4, 0.25));
      g.circle(p.add(v(3, 12).mul(s)), 2.5 * s, GREEN);
    }
    return;
  }
  if (stage <= 0) {
    FoodArt.roundedRect(g, R.of(c.sub(v(62, 38).mul(s)), v(124, 76).mul(s)), col, 14.0 * s);
  } else if (stage === 1) {
    FoodArt.roundedRect(g, R.of(c.sub(v(62, 38).mul(s)), v(84, 76).mul(s)), col, 14.0 * s);
    FoodArt.roundedRect(g, R.of(c.add(v(16, -38).mul(s)), v(46, 76).mul(s)), col.darkened(0.08), 18.0 * s);
  } else {
    FoodArt.roundedRect(g, R.of(c.sub(v(56, 26).mul(s)), v(112, 52).mul(s)), col.darkened(0.04), 22.0 * s);
    g.line(c.add(v(-46, -8).mul(s)), c.add(v(46, -8).mul(s)), col.lightened(0.2), 3.0 * s);
  }
  for (let k = 0; k < 5; k++) g.circle(c.add(v(-40 + k * 20, -14 + (k % 2) * 24).mul(s)), 3.0 * s, k % 2 === 0 ? GREEN : rgb(0.95, 0.4, 0.25));
}

function stew(g: Gfx, c: V, s: number, col: Color, noodles: boolean, inPot: boolean): void {
  let top = c.add(v(0, -6).mul(s));
  if (inPot) top = potBack(g, c, s);
  FoodArt.ellipse(g, top, 60.0 * s, 16.0 * s, col);
  // 소시지·햄·치즈
  for (let k = 0; k < 3; k++) {
    const p = top.add(v(-34 + k * 14, -2 + (k % 2) * 5).mul(s));
    FoodArt.ellipse(g, p, 7.0 * s, 4.5 * s, rgb(0.95, 0.55, 0.55));
    g.circle(p, 2.0 * s, rgb(0.85, 0.4, 0.4));
  }
  g.rect(new R(top.x + 12.0 * s, top.y - 8.0 * s, 18.0 * s, 10.0 * s), rgb(0.9, 0.5, 0.48));
  g.polygon([top.add(v(34, -10).mul(s)), top.add(v(50, -6).mul(s)), top.add(v(40, 4).mul(s))], rgb(1.0, 0.85, 0.3));
  if (noodles) {
    const ncol = rgb(1.0, 0.86, 0.5);
    for (let k = 0; k < 3; k++) {
      const pts: V[] = [];
      for (let j = 0; j < 7; j++) pts.push(top.add(v(-20.0 + j * 7.0, -4.0 + k * 3.0 + Math.sin(j * 1.5 + k) * 3.0).mul(s)));
      g.polyline(pts, ncol, 3.0 * s);
    }
  }
  for (let k = 0; k < 4; k++) g.circle(top.add(v(-48 + k * 30, 6).mul(s)), 2.5 * s, GREEN);
}

function dakbal(g: Gfx, c: V, s: number, col: Color): void {
  const spots = [v(-30, -16), v(8, -24), v(34, 0), v(-20, 20), v(14, 22)];
  for (let k = 0; k < spots.length; k++) {
    const p = c.add(spots[k].mul(s));
    const a = k * 1.3;
    g.line(p, p.add(v(18, 0).rotated(a).mul(s)), col, 9.0 * s);
    for (let t = 0; t < 3; t++) {
      const ta = a + PI + (-0.5 + t * 0.5);
      g.line(p, p.add(v(Math.cos(ta), Math.sin(ta)).mul(14.0 * s)), col, 6.0 * s);
    }
    g.circle(p, 7.0 * s, col.lightened(0.1));
  }
  for (let k = 0; k < 9; k++) {
    const a = k * 2.3;
    g.circle(c.add(v(Math.cos(a) * 42.0, Math.sin(a) * 26.0).mul(s)), 2.0 * s, SESAME);
  }
  g.circle(c.add(v(-4, 0).mul(s)), 4.0 * s, GREEN);
}

function golbaengi(g: Gfx, c: V, s: number, mixed: boolean): void {
  const sauce = rgb(0.86, 0.3, 0.2);
  if (mixed) {
    blob(g, c.add(v(-8, 4).mul(s)), 52.0 * s, 32.0 * s, 0.0, sauce, 2);
    for (let k = 0; k < 5; k++) FoodArt.rotRect(g, c.add(v(-34 + k * 16, -8 + (k % 2) * 16).mul(s)), v(22, 5).mul(s), k, rgb(0.45, 0.72, 0.35));
    for (let k = 0; k < 3; k++) {
      const p = c.add(v(-24 + k * 22, 2).mul(s));
      g.arc(p, 8.0 * s, 0.0, TAU * 1.2, rgb(0.55, 0.38, 0.22), 4.0 * s);
    }
    // 소면
    FoodArt.ellipse(g, c.add(v(50, 14).mul(s)), 22.0 * s, 16.0 * s, rgb(0.98, 0.97, 0.92));
    for (let k = 0; k < 3; k++) g.arc(c.add(v(50, 14).mul(s)), (6.0 + k * 5.0) * s, 0.0, TAU, rgb(0.9, 0.88, 0.82), 1.5 * s);
    return;
  }
  // 무치기 전: 재료가 따로
  FoodArt.ellipse(g, c.add(v(-34, -12).mul(s)), 26.0 * s, 16.0 * s, rgb(0.55, 0.38, 0.22));
  for (let k = 0; k < 3; k++) g.arc(c.add(v(-40 + k * 10, -14).mul(s)), 6.0 * s, 0.0, TAU, rgb(0.4, 0.26, 0.14), 2.5 * s);
  for (let k = 0; k < 4; k++) FoodArt.rotRect(g, c.add(v(18 + k * 9, -16).mul(s)), v(6, 28).mul(s), 0.2, rgb(0.45, 0.72, 0.35));
  FoodArt.ellipse(g, c.add(v(-6, 22).mul(s)), 22.0 * s, 13.0 * s, rgb(0.98, 0.97, 0.92));
  g.circle(c.add(v(40, 20).mul(s)), 16.0 * s, sauce);
}
