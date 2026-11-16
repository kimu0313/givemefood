// 만화 그림체용 도형 (사용자가 보낸 참고 일러스트: 굵은 먹선 + 평평한 셀 채색 + 차분한 겨울 저녁 색).
// 채우고 → 그림자 면(셀) → 외곽선 순서로 그린다.

import { Color, R, TAU, V, rgb } from "../engine/geom.ts";
import type { Gfx } from "../engine/gfx.ts";

export const LINE = rgb(0.13, 0.11, 0.15); // 먹선
export const W = 4.0; // 기본 선 굵기

export function ellipsePoints(c: V, rx: number, ry: number, n = 28, a0 = 0.0, a1 = TAU): V[] {
  const pts: V[] = [];
  for (let k = 0; k <= n; k++) {
    const a = a0 + ((a1 - a0) * k) / n;
    pts.push(new V(c.x + Math.cos(a) * rx, c.y + Math.sin(a) * ry));
  }
  return pts;
}

export function circle(g: Gfx, c: V, r: number, fill: Color, w = W, line: Color = LINE): void {
  g.circle(c, r, fill);
  if (w > 0) g.arc(c, r, 0, TAU, line, w);
}

export function poly(g: Gfx, pts: V[], fill: Color, w = W, line: Color = LINE): void {
  if (pts.length < 3) return;
  g.polygon(pts, fill);
  if (w > 0) outline(g, pts, w, line);
}

export function outline(g: Gfx, pts: V[], w = W, line: Color = LINE): void {
  if (pts.length < 2) return;
  g.polyline([...pts, pts[0]], line, w);
}

export function ellipse(g: Gfx, c: V, rx: number, ry: number, fill: Color, w = W, line: Color = LINE): void {
  poly(g, ellipsePoints(c, rx, ry, 28), fill, w, line);
}

export function rect(g: Gfx, r: R, fill: Color, w = W, line: Color = LINE): void {
  g.rect(r, fill);
  if (w > 0) g.rect(r, line, false, w);
}

export function rrect(g: Gfx, r: R, fill: Color, radius: number, w = W): void {
  g.styleBox(r, fill, radius, LINE, Math.max(1, Math.round(w)));
}

/** 셀 그림자: 도형을 offset 만큼 민 것과 겹치지 않는 부분(초승달 모양)을 col 로 칠한다 */
export function shade(g: Gfx, pts: V[], offset: V, col: Color): void {
  g.polygonMinus(pts, moved(pts, offset), col);
}

/** 둥근 사각형 점들 (모서리 반지름 r) */
export function roundedPoints(r: R, radius: number, steps = 4): V[] {
  const pts: V[] = [];
  const rr = Math.min(radius, Math.min(r.w, r.h) * 0.5);
  const corners: [V, number][] = [
    [new V(r.endX - rr, r.y + rr), -Math.PI * 0.5],
    [new V(r.endX - rr, r.endY - rr), 0.0],
    [new V(r.x + rr, r.endY - rr), Math.PI * 0.5],
    [new V(r.x + rr, r.y + rr), Math.PI],
  ];
  for (const [c, a0] of corners) {
    for (let k = 0; k <= steps; k++) {
      const a = a0 + (Math.PI * 0.5 * k) / steps;
      pts.push(new V(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr));
    }
  }
  return pts;
}

/** 점들을 옮긴 사본 */
export function moved(pts: V[], offset: V): V[] {
  return pts.map((p) => p.add(offset));
}
