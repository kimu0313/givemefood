// 임시 아트: 음식·그릇·아이콘을 도형으로 그린다.
// 실제 그림이 생기면 이 파일의 draw* 함수만 그림 그리기로 바꾸면 된다.

import { Color, PI, R, TAU, V, clamp, rgb, v } from "../engine/geom.ts";
import type { Gfx } from "../engine/gfx.ts";
import * as D from "../core/defs.ts";
import type { CookItem } from "../core/cook_item.ts";
import * as Ink from "./ink.ts";
import * as ArtAssets from "./art_assets.ts";
import * as FoodShapes from "./food_shapes.ts";
import * as DishArt from "./dish_art.ts";
import { tr } from "../i18n/i18n.ts";

export const WOOD = rgb(0.78, 0.62, 0.4);
export const SPARKLE = rgb(1.0, 0.92, 0.45);
export const BOWL = rgb(0.95, 0.94, 0.9);
export const BOWL_STRIPE = rgb(0.32, 0.48, 0.75);

export type Opts = Record<string, boolean | number>;

// ---------------------------------------------------------------- 기본 도형

/** 가운데 정렬 텍스트 ("\n" 줄바꿈 지원) */
/** 가운데 맞춘 글자 ("\n" 줄바꿈). weight = DISPLAY(900) 이면 굵은 제목 글꼴 */
export function text(g: Gfx, s: string, center: V, size: number, color: Color, width = 640.0, weight = 400): void {
  const lines = tr(s).split("\n"); // 줄 나누기 전에 통째로 번역 (사전에 줄바꿈째 든 글이 많음)
  const lh = size * 1.25;
  const y0 = center.y - lh * (lines.length - 1) * 0.5;
  for (let i = 0; i < lines.length; i++) {
    g.text(new V(center.x - width * 0.5, y0 + lh * i + size * 0.36), lines[i], "center", width, size, color, weight);
  }
}

export function textOutlined(g: Gfx, s: string, center: V, size: number, color: Color, outline: Color, outlineSize = 8, width = 640.0, weight = 400): void {
  const lines = tr(s).split("\n");
  const lh = size * 1.25;
  const y0 = center.y - lh * (lines.length - 1) * 0.5;
  for (let i = 0; i < lines.length; i++) {
    const pos = new V(center.x - width * 0.5, y0 + lh * i + size * 0.36);
    g.textOutline(pos, lines[i], "center", width, size, outlineSize, outline, weight);
    g.text(pos, lines[i], "center", width, size, color, weight);
  }
}

/** 게임 별: 진한 테두리 + 위가 밝은 금색 + 윤기 (on = 받은 별, 아니면 빈 별) */
export function gameStar(g: Gfx, c: V, r: number, on: boolean): void {
  const ctx = g.ctx;
  const path = (rr: number, ri: number, dy = 0) => {
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -PI / 2.0 + (PI * k) / 5.0;
      const q = k % 2 === 0 ? rr : ri;
      const x = c.x + Math.cos(a) * q;
      const y = c.y + dy + Math.sin(a) * q;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  ctx.save();
  ctx.lineJoin = "round";
  path(r, r * 0.5, r * 0.12);
  ctx.fillStyle = "rgba(40,20,8,0.35)";
  ctx.fill();
  path(r, r * 0.5);
  ctx.lineWidth = Math.max(2, r * 0.16);
  ctx.strokeStyle = on ? "#6b3a0c" : "#5a4f46";
  ctx.stroke();
  const gr = ctx.createLinearGradient(0, c.y - r, 0, c.y + r);
  if (on) {
    gr.addColorStop(0, "#fff3a0");
    gr.addColorStop(0.45, "#ffd23a");
    gr.addColorStop(1, "#f29a12");
  } else {
    gr.addColorStop(0, "#d9d2c8");
    gr.addColorStop(1, "#a59a8e");
  }
  ctx.fillStyle = gr;
  ctx.fill();
  if (on) {
    ctx.beginPath();
    ctx.ellipse(c.x - r * 0.18, c.y - r * 0.22, r * 0.2, r * 0.1, -0.5, 0, TAU);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fill();
  }
  ctx.restore();
}

export function roundedRect(g: Gfx, r: R, color: Color, radius: number, border: Color | null = null, borderW = 0): void {
  g.styleBox(r, color, Math.trunc(radius), border, borderW);
}

export const ellipsePoints = Ink.ellipsePoints;

export function ellipse(g: Gfx, c: V, rx: number, ry: number, color: Color): void {
  const pts = ellipsePoints(c, rx, ry, 28);
  pts.pop();
  g.polygon(pts, color);
}

export function rotRect(g: Gfx, c: V, size: V, angle: number, color: Color): void {
  const h = size.mul(0.5);
  g.polygon(
    [v(-h.x, -h.y), v(h.x, -h.y), v(h.x, h.y), v(-h.x, h.y)].map((p) => c.add(p.rotated(angle))),
    color,
  );
}

export function capsuleH(g: Gfx, a: V, b: V, r: number, color: Color): void {
  g.rect(new R(a.x, a.y - r, b.x - a.x, r * 2.0), color);
  g.circle(a, r, color);
  g.circle(b, r, color);
}

export function star(g: Gfx, c: V, rOut: number, rIn: number, color: Color): void {
  const pts: V[] = [];
  for (let k = 0; k < 10; k++) {
    const a = -PI / 2.0 + (PI * k) / 5.0;
    const r = k % 2 === 0 ? rOut : rIn;
    pts.push(c.add(v(Math.cos(a), Math.sin(a)).mul(r)));
  }
  g.polygon(pts, color);
}

export function sparkle(g: Gfx, c: V, s: number, color: Color = SPARKLE): void {
  const pts: V[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (PI * k) / 4.0;
    const r = k % 2 === 0 ? 14.0 * s : 4.0 * s;
    pts.push(c.add(v(Math.cos(a), Math.sin(a)).mul(r)));
  }
  g.polygon(pts, color);
}

const MAGIC_COLORS = [rgb(1.0, 0.85, 0.35), rgb(0.95, 0.6, 1.0), rgb(0.6, 0.9, 1.0), rgb(1.0, 1.0, 1.0)];

/** 마법의 가루 반짝이: c 둘레 반지름 r 에 별 모양이 돌아가며 깜빡인다 (t = 시계) */
export function magicSparkles(g: Gfx, c: V, r: number, t: number, n = 5): void {
  for (let k = 0; k < n; k++) {
    const a = t * 0.9 + (k * PI * 2.0) / n;
    const tw = 0.5 + 0.5 * Math.sin(t * 5.0 + k * 1.7);
    const p = c.add(v(Math.cos(a) * r, Math.sin(a) * r * 0.62 - 6.0));
    sparkle(g, p, 0.55 + 0.6 * tw, MAGIC_COLORS[k % MAGIC_COLORS.length].withA(0.55 + 0.45 * tw));
  }
}

export function checkMark(g: Gfx, c: V, s: number, color: Color): void {
  g.polyline([c.add(v(-12, 0).mul(s)), c.add(v(-3, 10).mul(s)), c.add(v(14, -10).mul(s))], color, 6.0 * s);
}

export function lockIcon(g: Gfx, c: V, s: number, color: Color): void {
  g.arc(c.add(v(0, -10).mul(s)), 14.0 * s, PI, TAU, color, 6.0 * s);
  roundedRect(g, R.of(c.add(v(-22, -10).mul(s)), v(44, 34).mul(s)), color, 6.0 * s);
}

export function angryMark(g: Gfx, c: V, s: number): void {
  const col = rgb(0.92, 0.15, 0.12);
  for (let k = 0; k < 4; k++) {
    const a = PI / 4.0 + (PI / 2.0) * k;
    const p = c.add(v(Math.cos(a), Math.sin(a)).mul(13.0 * s));
    g.arc(p, 9.0 * s, a + PI * 0.6, a + PI * 1.4, col, 5.0 * s);
  }
}

// ---------------------------------------------------------------- 색

export function itemColor(item: CookItem): Color {
  const def = D.MENUS[item.menuId];
  const raw = def.raw_color;
  const cooked = def.cooked_color;
  if (item.burnt) return D.BURNT_COLOR;
  if (item.isWaitStep()) return raw;
  const ps = item.stepTime("perfect_start");
  let c = raw.lerp(cooked, clamp(item.stepElapsed / Math.max(ps, 0.01), 0.0, 1.0));
  if (item.burns() && item.stepElapsed > ps) {
    const bt = item.burnTime();
    const k = clamp((item.stepElapsed - ps) / Math.max(bt - ps, 0.01), 0.0, 1.0);
    c = c.lerp(cooked.darkened(0.45), k * 0.7);
  } else if (item.isOvercooked()) {
    c = c.darkened(0.15); // 불음·졸음: 살짝 짙어짐 (타지는 않음)
  }
  return c;
}

export function qualityColor(menuId: string, quality: number): Color {
  const def = D.MENUS[menuId];
  const raw = def.raw_color;
  const cooked = def.cooked_color;
  if (quality === D.Q.RAW) return raw;
  if (quality === D.Q.COOKED) return cooked.lerp(raw, 0.3);
  if (quality === D.Q.BURNT) return D.BURNT_COLOR;
  return cooked;
}

// ---------------------------------------------------------------- 음식

/** 먹선 굵기 (크기 배수에 맞춰, 너무 가늘거나 굵지 않게) */
export function inkW(s: number): number {
  return clamp(4.0 * s, 1.5, 4.5);
}

let nowSec = 0;
/** 끓는 거품 같은 움직임에 쓰는 시계 (Godot Time.get_ticks_msec) */
export function setClock(t: number): void {
  nowSec = t;
}
export function clock(): number {
  return nowSec;
}

/** opts: pan / pot (조리 도구 같이 그리기), sliced (순대), boiling·noodles (라면) */
export function drawFood(g: Gfx, menuId: string, c: V, s: number, col: Color, opts: Opts = {}): void {
  const w = inkW(s);
  switch (menuId) {
    case "odeng": {
      // 꼬치에 접어 꽂은 어묵 (위아래로 지그재그)
      Ink.rrect(g, new R(c.x - 3.5 * s, c.y - 84.0 * s, 7.0 * s, 160.0 * s), WOOD, 3.0 * s, w * 0.7);
      for (let k = 0; k < 4; k++) {
        const y = (-50.0 + k * 24.0) * s;
        const off = (k % 2 === 0 ? 9.0 : -9.0) * s;
        const r = new R(c.x - 34.0 * s + off, c.y + y - 12.0 * s, 68.0 * s, 25.0 * s);
        const pts = Ink.roundedPoints(r, 10.0 * s, 3);
        g.polygon(pts, col);
        g.rect(new R(r.x + 6.0 * s, r.endY - 8.0 * s, r.w - 12.0 * s, 5.0 * s), col.darkened(0.18));
        g.line(r.pos.add(v(10, 6).mul(s)), v(r.endX - 12.0 * s, r.y + 6.0 * s), col.lightened(0.3), 3.0 * s);
        Ink.outline(g, pts, w);
      }
      break;
    }
    case "tteokbokki": {
      if (opts.pan) {
        Ink.rect(g, new R(c.x + 62.0 * s, c.y - 8.0 * s, 48.0 * s, 16.0 * s), rgb(0.18, 0.18, 0.2), w);
        Ink.circle(g, c, 70.0 * s, rgb(0.18, 0.18, 0.2), w);
        g.circle(c, 63.0 * s, rgb(0.3, 0.3, 0.33));
      }
      Ink.circle(g, c, 54.0 * s, col, w);
      ellipse(g, c.add(v(-20, -24).mul(s)), 22.0 * s, 9.0 * s, rgb(1, 1, 1, 0.22));
      const cake = rgb(0.99, 0.95, 0.9).lerp(col, 0.38);
      // 어묵 세모
      const tris: [V, number][] = [
        [v(-30, -2), 0.3],
        [v(22, 20), -0.8],
      ];
      for (const [tp0, a] of tris) {
        const tc = c.add(tp0.mul(s));
        const tp = [tc.add(v(-14, 9).rotated(a).mul(s)), tc.add(v(14, 9).rotated(a).mul(s)), tc.add(v(0, -14).rotated(a).mul(s))];
        Ink.poly(g, tp, rgb(0.98, 0.72, 0.38).lerp(col, 0.25), w * 0.75);
      }
      const spots = [v(-24, -14), v(8, -28), v(28, 4), v(-6, 14), v(-32, 22), v(10, 34), v(30, -22)];
      const angles = [0.4, -0.3, 1.2, 0.1, -0.9, 0.7, 2.0];
      for (let k = 0; k < spots.length; k++) {
        const pts = rotCapsule(c.add(spots[k].mul(s)), v(32, 13).mul(s), angles[k]);
        g.polygon(pts, cake);
        g.line(
          c.add(spots[k].mul(s)).add(v(-9, -2).rotated(angles[k]).mul(s)),
          c.add(spots[k].mul(s)).add(v(9, -2).rotated(angles[k]).mul(s)),
          rgb(1, 1, 1, 0.55),
          2.5 * s,
        );
        Ink.outline(g, pts, w * 0.75);
      }
      for (let k = 0; k < 3; k++) {
        const gp = c.add(v(-14 + k * 18, -2 + (k % 2) * 20).mul(s));
        Ink.circle(g, gp, 4.5 * s, rgb(0.45, 0.75, 0.32), w * 0.5);
        g.circle(gp, 2.0 * s, rgb(0.75, 0.92, 0.55));
      }
      for (let k = 0; k < 6; k++) {
        const a = k * 1.9;
        g.circle(c.add(v(Math.cos(a) * 36.0, Math.sin(a) * 30.0).mul(s)), 1.6 * s, rgb(0.98, 0.92, 0.75));
      }
      break;
    }
    case "sundae": {
      // 순대 + 내장(간·허파) 한 접시. sliced = 썬 모습 (도마 손질 뒤·그릇·아이콘)
      const burnt = col.isEqualApprox(D.BURNT_COLOR);
      if (opts.sliced) {
        lung(g, c.add(v(-48, 16).mul(s)), 0.62 * s, burnt);
        liver(g, c.add(v(48, 16).mul(s)), 0.62 * s, 0.25, burnt);
        const spots = [v(-34, -16), v(2, -22), v(38, -14), v(-14, 14), v(20, 16)];
        for (const p0 of spots) {
          const p = c.add(p0.mul(s));
          Ink.circle(g, p, 18.0 * s, col, w * 0.8);
          g.circle(p, 12.0 * s, col.lightened(0.32));
          // 당면·채소 알갱이
          g.line(p.add(v(-6, -3).mul(s)), p.add(v(4, -6).mul(s)), col.lightened(0.6), 2.0 * s);
          g.line(p.add(v(-3, 5).mul(s)), p.add(v(7, 2).mul(s)), col.lightened(0.6), 2.0 * s);
          g.circle(p.add(v(3, -1).mul(s)), 2.2 * s, col.darkened(0.35));
          g.circle(p.add(v(-5, 2).mul(s)), 1.8 * s, rgb(0.45, 0.6, 0.3));
        }
      } else {
        // 솥에서 막 꺼낸 순대 두 줄 + 간·허파 덩어리
        for (let k = 0; k < 2; k++) {
          const y = (k === 0 ? -16.0 : 18.0) * s;
          const dx = (k === 0 ? 0.0 : 6.0) * s;
          const pts = capsule(c.add(v(-60.0 * s + dx, y)), c.add(v(22.0 * s + dx, y)), 16.0 * s);
          g.polygon(pts, col.darkened(0.08 * k));
          g.line(c.add(v(-48.0 * s + dx, y - 7.0 * s)), c.add(v(12.0 * s + dx, y - 7.0 * s)), col.lightened(0.3), 3.0 * s);
          Ink.outline(g, pts, w * 0.8);
        }
        liver(g, c.add(v(56, -14).mul(s)), 0.8 * s, 0.4, burnt);
        lung(g, c.add(v(58, 22).mul(s)), 0.72 * s, burnt);
      }
      break;
    }
    case "ramen":
      ramen(g, c, s, col, opts);
      break;
    default:
      FoodShapes.draw(g, menuId, c, s, col, opts);
  }
}

/** 꼬치 어묵 하나 (어묵을 주름지게 접어 꽂고, 긴 나무 막대가 앞쪽 아래로 비스듬히 나옴) */
export function odengSkewer(g: Gfx, c: V, angle: number, s: number, col: Color): void {
  const w = inkW(s);
  const ax = v(1, 0).rotated(angle);
  const perp = v(-ax.y, ax.x);
  const half = 56.0 * s;
  // 막대: 어묵 끝 조금 + 앞쪽으로 길게
  const stickA = c.add(ax.mul(half + 8.0 * s));
  const stickB = c.sub(ax.mul(half + 74.0 * s));
  g.line(stickA, stickB, Ink.LINE, 8.0 * s + w);
  g.line(stickA, stickB, rgb(0.78, 0.5, 0.26), 8.0 * s);
  g.line(stickA.sub(perp.mul(2.0 * s)), stickB.sub(perp.mul(2.0 * s)), rgb(0.95, 0.72, 0.42), 2.0 * s);
  // 주름: 어묵을 4번 접은 둥근 덩어리가 막대 양쪽으로 번갈아
  for (let k = 0; k < 4; k++) {
    const t = -half + (k + 0.5) * half * 0.5;
    const off = (k % 2 === 0 ? 7.0 : -7.0) * s;
    const mc = c.add(ax.mul(t)).add(perp.mul(off));
    const lobe = Ink.roundedPoints(new R(-17.0 * s, -19.0 * s, 34.0 * s, 38.0 * s), 12.0 * s, 3);
    const pts = lobe.map((p) => mc.add(p.rotated(angle)));
    g.polygon(pts, k % 2 === 0 ? col : col.darkened(0.05));
    g.line(mc.add(v(-9, -11).mul(s).rotated(angle)), mc.add(v(8, -11).mul(s).rotated(angle)), col.lightened(0.32), 3.0 * s);
    g.line(mc.add(v(-11, 12).mul(s).rotated(angle)), mc.add(v(10, 12).mul(s).rotated(angle)), col.darkened(0.2), 3.0 * s);
    Ink.outline(g, pts, w * 0.8);
  }
}

/** 순대 내장: 간 (진한 밤색 덩어리, 단면이 매끈) */
export function liver(g: Gfx, c: V, s: number, angle: number, burnt = false): void {
  const col = burnt ? D.BURNT_COLOR : rgb(0.42, 0.17, 0.14);
  const pts: V[] = [];
  for (let k = 0; k < 12; k++) {
    const a = (TAU * k) / 12.0;
    const r = v(26.0 + 3.0 * Math.sin(a * 3.0), 15.0 + 2.0 * Math.cos(a * 2.0)).mul(s);
    pts.push(c.add(v(Math.cos(a) * r.x, Math.sin(a) * r.y).rotated(angle)));
  }
  g.polygon(pts, col);
  g.line(c.add(v(-14, -6).mul(s).rotated(angle)), c.add(v(10, -8).mul(s).rotated(angle)), col.lightened(0.35), 3.0 * s);
  Ink.outline(g, pts, inkW(s) * 0.8);
}

/** 순대 내장: 허파 (분홍빛 회색, 스펀지처럼 구멍) */
export function lung(g: Gfx, c: V, s: number, burnt = false): void {
  const col = burnt ? D.BURNT_COLOR.lightened(0.1) : rgb(0.86, 0.62, 0.62);
  const pts: V[] = [];
  for (let k = 0; k < 14; k++) {
    const a = (TAU * k) / 14.0;
    const r = (22.0 + 4.0 * Math.sin(a * 4.0 + 1.0)) * s;
    pts.push(c.add(v(Math.cos(a) * r, Math.sin(a) * r * 0.78)));
  }
  g.polygon(pts, col);
  for (let k = 0; k < 5; k++) {
    const a = k * 1.9;
    g.circle(c.add(v(Math.cos(a) * 11.0, Math.sin(a) * 7.0).mul(s)), 2.6 * s, col.darkened(0.25));
  }
  Ink.outline(g, pts, inkW(s) * 0.8);
}

/** 둥근 끝 막대 (떡볶이 떡) 점들 */
export function rotCapsule(c: V, size: V, angle: number): V[] {
  const r = size.y * 0.5;
  const half = size.x * 0.5 - r;
  const pts: V[] = [];
  for (let k = 0; k < 9; k++) {
    const a = -PI * 0.5 + (PI * k) / 8.0;
    pts.push(c.add(v(half, 0).add(v(Math.cos(a), Math.sin(a)).mul(r)).rotated(angle)));
  }
  for (let k = 0; k < 9; k++) {
    const a = PI * 0.5 + (PI * k) / 8.0;
    pts.push(c.add(v(-half, 0).add(v(Math.cos(a), Math.sin(a)).mul(r)).rotated(angle)));
  }
  return pts;
}

/** 가로 캡슐 (a → b, 반지름 r) 점들 */
export function capsule(a: V, b: V, r: number): V[] {
  return rotCapsule(a.add(b).mul(0.5), v(a.distanceTo(b) + r * 2.0, r * 2.0), b.sub(a).angle());
}

function ramen(g: Gfx, c: V, s: number, col: Color, opts: Opts): void {
  const pot = Boolean(opts.pot);
  const boiling = Boolean(opts.boiling);
  const noodles = opts.noodles === undefined ? true : Boolean(opts.noodles);
  let top = c.add(v(0, -12).mul(s));
  if (pot) {
    roundedRect(g, new R(c.x - 68.0 * s, c.y - 26.0 * s, 136.0 * s, 84.0 * s), rgb(0.66, 0.68, 0.72), 14.0 * s);
    g.rect(new R(c.x - 90.0 * s, c.y - 12.0 * s, 24.0 * s, 12.0 * s), rgb(0.3, 0.3, 0.32));
    g.rect(new R(c.x + 66.0 * s, c.y - 12.0 * s, 24.0 * s, 12.0 * s), rgb(0.3, 0.3, 0.32));
    top = c.add(v(0, -26).mul(s));
    ellipse(g, top, 68.0 * s, 19.0 * s, rgb(0.5, 0.52, 0.56));
  }
  const liquid = noodles ? rgb(0.88, 0.4, 0.16) : rgb(0.62, 0.78, 0.95);
  ellipse(g, top, 60.0 * s, 16.0 * s, liquid);
  if (noodles) {
    for (let k = 0; k < 4; k++) {
      const pts: V[] = [];
      for (let j = 0; j < 9; j++) {
        const x = -44.0 + j * 11.0;
        pts.push(top.add(v(x, -5.0 + k * 3.5 + Math.sin(j * 1.3 + k) * 4.0).mul(s)));
      }
      g.polyline(pts, col, 3.5 * s);
    }
    g.circle(top.add(v(22, -4).mul(s)), 7.0 * s, rgb(1.0, 0.95, 0.8));
    g.circle(top.add(v(22, -4).mul(s)), 3.5 * s, rgb(1.0, 0.75, 0.2));
  }
  if (boiling) {
    const t = clock();
    for (let k = 0; k < 6; k++) {
      const bx = Math.sin(k * 2.1 + t * 3.0) * 42.0;
      const r = (2.5 + 2.5 * Math.abs(Math.sin(t * 5.0 + k))) * s;
      g.circle(top.add(v(bx, Math.sin(k * 1.7 + t * 4.0) * 7.0).mul(s)), r, rgb(1, 1, 1, 0.8));
    }
  }
}

/** 완성 그릇: 메뉴마다 다른 그릇에 담아 그린다 (DishArt) */
export function drawBowl(g: Gfx, menuId: string, c: V, s: number, quality: number): void {
  DishArt.draw(g, menuId, c, s, quality);
}

/** 주문 말풍선·재료통에 쓰는 작은 아이콘 */
export function drawIcon(g: Gfx, menuId: string, c: V, s: number, alpha = 1.0): void {
  // 사용자 메뉴 그림 (UI 전용, ArtAssets.ICON_FILES): 도형 아이콘보다 조금 크게 (그림은 가로로 넓어서)
  const icon = ArtAssets.menuIcon(menuId);
  if (icon !== null) {
    ArtAssets.drawCentered(g, icon, c, 76.0 * s, alpha);
    return;
  }
  const tex = ArtAssets.food(menuId);
  if (tex !== null) {
    ArtAssets.drawCentered(g, tex, c, 64.0 * s, alpha);
    return;
  }
  const col = D.MENUS[menuId].cooked_color.withA(alpha);
  switch (menuId) {
    case "odeng":
    case "tteokbokki":
      drawFood(g, menuId, c, 0.42 * s, col);
      break;
    case "sundae":
      drawFood(g, menuId, c, 0.42 * s, col, { sliced: true });
      break;
    case "ramen":
      drawFood(g, menuId, c.add(v(0, 6).mul(s)), 0.48 * s, col, { noodles: true, pot: true });
      break;
    default: {
      const lay = FoodShapes.iconLayout(menuId);
      drawFood(g, menuId, c.add(lay.offset.mul(s)), lay.scale * s, col, lay.opts);
    }
  }
}
