// Godot CanvasItem 의 draw_* 와 같은 그리기 함수들을 Canvas 2D 위에 만든 것.
// 그림 코드(FoodArt, DishArt, AlleyArt …)는 Godot 판과 같은 순서·좌표로 그린다.

import { Color, R, TAU, V } from "./geom.ts";
import { getLang, langFonts, onLangChange, tr } from "../i18n/i18n.ts";

// 게임 글꼴 (2026-11-15 사용자 "글씨체도 너무 대충, 게임같지 않아"): 둥글고 통통한 "주아"(Jua) 를 모든 글자에,
// 게임 이름·큰 제목·숫자는 더 굵은 "베이글 팻 원"(Bagel Fat One). 둘 다 OFL 무료 글꼴, @fontsource 로 함께 묶어 내보낸다 (main.ts).
const FALLBACK = `"Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", "Noto Sans KR", "Noto Sans CJK KR", sans-serif`;
// HTML 은 CSS 변수 --lang-fonts (main.ts 가 언어마다 넣음: 일본어·중국어면 주아 다음에 그 나라 글꼴), 캔버스는 langFonts()
export const FONT_STACK = `var(--lang-fonts, "Jua"), ${FALLBACK}`;
export const DISPLAY_STACK = `"Bagel Fat One", var(--lang-fonts, "Jua"), ${FALLBACK}`;
let canvasStack = `${langFonts()}, ${FALLBACK}`;
let canvasDisplay = `"Bagel Fat One", ${langFonts()}, ${FALLBACK}`;
onLangChange(() => {
  canvasStack = `${langFonts()}, ${FALLBACK}`;
  canvasDisplay = `"Bagel Fat One", ${langFonts()}, ${FALLBACK}`;
});
/** 캔버스 글자에서 weight 로 이 값을 넘기면 굵은 제목 글꼴 (두 글꼴 모두 굵기가 하나뿐이라 weight 를 글꼴 고르기에 쓴다) */
export const DISPLAY = 900;

export function fontCss(size: number, weight = 400): string {
  const px = Math.max(1, Math.round(size));
  return weight >= DISPLAY ? `400 ${px}px ${canvasDisplay}` : `400 ${px}px ${canvasStack}`;
}

export type Img = HTMLImageElement | HTMLCanvasElement | ImageBitmap;

export class Gfx {
  ctx: CanvasRenderingContext2D;
  private base: DOMMatrix;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.base = ctx.getTransform();
  }

  /** 노드 하나를 그리기 시작할 때: 지금 변환을 기준으로 (draw_set_transform 은 이 기준에서 다시 시작) */
  begin(): void {
    this.base = this.ctx.getTransform();
  }

  /** Godot draw_set_transform(pos, rot, scale) */
  setTransform(pos: V, rot = 0, scale: V | number = 1): void {
    const s = typeof scale === "number" ? new V(scale, scale) : scale;
    this.ctx.setTransform(this.base);
    this.ctx.translate(pos.x, pos.y);
    if (rot !== 0) this.ctx.rotate(rot);
    if (s.x !== 1 || s.y !== 1) this.ctx.scale(s.x, s.y);
  }

  resetTransform(): void {
    this.ctx.setTransform(this.base);
  }

  private path(pts: readonly V[], close: boolean): void {
    const c = this.ctx;
    c.beginPath();
    if (pts.length === 0) return;
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
    if (close) c.closePath();
  }

  private stroke(color: Color, width: number): void {
    const c = this.ctx;
    c.strokeStyle = color.css();
    c.lineWidth = width <= 0 ? 1 : width;
    c.stroke();
  }

  /** draw_rect(rect, color, filled, width) */
  rect(r: R, color: Color, filled = true, width = -1): void {
    if (color.a <= 0) return;
    const c = this.ctx;
    if (filled) {
      c.fillStyle = color.css();
      c.fillRect(r.x, r.y, r.w, r.h);
      return;
    }
    c.beginPath();
    c.rect(r.x, r.y, r.w, r.h);
    c.lineJoin = "miter";
    this.stroke(color, width);
  }

  /** draw_circle (채운 원) */
  circle(center: V, radius: number, color: Color): void {
    if (color.a <= 0 || radius <= 0) return;
    const c = this.ctx;
    c.beginPath();
    c.arc(center.x, center.y, radius, 0, TAU);
    c.fillStyle = color.css();
    c.fill();
  }

  /** draw_arc (선) */
  arc(center: V, radius: number, a0: number, a1: number, color: Color, width = 1): void {
    if (color.a <= 0 || radius <= 0) return;
    const c = this.ctx;
    c.beginPath();
    if (Math.abs(a1 - a0) >= TAU - 1e-6) c.arc(center.x, center.y, radius, a0, a0 + TAU);
    else c.arc(center.x, center.y, radius, a0, a1, a1 < a0);
    c.lineCap = "butt";
    this.stroke(color, width);
  }

  /** draw_line */
  line(a: V, b: V, color: Color, width = 1): void {
    if (color.a <= 0) return;
    const c = this.ctx;
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.lineCap = "butt";
    this.stroke(color, width);
  }

  /** draw_polyline (열린 선) */
  polyline(pts: readonly V[], color: Color, width = 1): void {
    if (color.a <= 0 || pts.length < 2) return;
    this.path(pts, false);
    const c = this.ctx;
    c.lineCap = "butt";
    c.lineJoin = "round";
    this.stroke(color, width);
  }

  /** draw_colored_polygon */
  polygon(pts: readonly V[], color: Color): void {
    if (color.a <= 0 || pts.length < 3) return;
    this.path(pts, true);
    this.ctx.fillStyle = color.css();
    this.ctx.fill();
  }

  /** a 에서 b 와 겹치는 부분을 뺀 곳을 칠한다 (Godot Geometry2D.clip_polygons 로 하던 셀 그림자) */
  polygonMinus(a: readonly V[], b: readonly V[], color: Color): void {
    if (color.a <= 0 || a.length < 3) return;
    const c = this.ctx;
    c.save();
    this.path(a, true);
    c.clip();
    c.beginPath();
    c.rect(-1e5, -1e5, 2e5, 2e5);
    if (b.length > 0) {
      c.moveTo(b[0].x, b[0].y);
      for (let i = 1; i < b.length; i++) c.lineTo(b[i].x, b[i].y);
      c.closePath();
    }
    c.fillStyle = color.css();
    c.fill("evenodd");
    c.restore();
  }

  /** StyleBoxFlat 같은 둥근 사각형 (테두리는 안쪽으로) */
  styleBox(r: R, color: Color, radius: number, border: Color | null = null, borderW = 0): void {
    const c = this.ctx;
    const rad = Math.max(0, Math.min(radius, r.w * 0.5, r.h * 0.5));
    if (borderW > 0 && border !== null && border.a > 0) {
      const inner = new R(r.x + borderW, r.y + borderW, r.w - borderW * 2, r.h - borderW * 2);
      const irad = Math.max(0, Math.min(rad - borderW, inner.w * 0.5, inner.h * 0.5));
      if (color.a > 0 && inner.w > 0 && inner.h > 0) {
        c.beginPath();
        c.roundRect(inner.x, inner.y, inner.w, inner.h, irad);
        c.fillStyle = color.css();
        c.fill();
      }
      c.beginPath();
      c.roundRect(r.x, r.y, r.w, r.h, rad);
      if (inner.w > 0 && inner.h > 0) c.roundRect(inner.x, inner.y, inner.w, inner.h, irad);
      c.fillStyle = border.css();
      c.fill("evenodd");
      return;
    }
    if (color.a <= 0) return;
    c.beginPath();
    c.roundRect(r.x, r.y, r.w, r.h, rad);
    c.fillStyle = color.css();
    c.fill();
  }

  /**
   * draw_string: pos = 글자 기준선 왼쪽, width > 0 이면 그 폭 안에서 align (left/center/right)
   */
  text(pos: V, s: string, align: CanvasTextAlign, width: number, size: number, color: Color, weight = 400): void {
    if (color.a <= 0 || s.length === 0) return;
    s = tr(s); // 다른 언어면 번역 (i18n)
    const c = this.ctx;
    c.font = fontCss(size, weight);
    c.textBaseline = "alphabetic";
    c.textAlign = width > 0 ? align : "left";
    const x = width > 0 ? (align === "center" ? pos.x + width * 0.5 : align === "right" ? pos.x + width : pos.x) : pos.x;
    c.fillStyle = color.css();
    // 다른 언어는 한국어보다 길어지기 쉬워서 정해진 폭(width)에 맞춰 눌러 담는다
    if (width > 0 && getLang() !== "ko") c.fillText(s, x, pos.y, width);
    else c.fillText(s, x, pos.y);
  }

  /** draw_string_outline */
  textOutline(pos: V, s: string, align: CanvasTextAlign, width: number, size: number, outline: number, color: Color, weight = 400): void {
    if (color.a <= 0 || s.length === 0 || outline <= 0) return;
    s = tr(s);
    const c = this.ctx;
    c.font = fontCss(size, weight);
    c.textBaseline = "alphabetic";
    c.textAlign = width > 0 ? align : "left";
    const x = width > 0 ? (align === "center" ? pos.x + width * 0.5 : align === "right" ? pos.x + width : pos.x) : pos.x;
    c.lineJoin = "round";
    c.lineWidth = outline;
    c.strokeStyle = color.css();
    if (width > 0 && getLang() !== "ko") c.strokeText(s, x, pos.y, width);
    else c.strokeText(s, x, pos.y);
  }

  measure(s: string, size: number, weight = 400): number {
    this.ctx.font = fontCss(size, weight);
    return this.ctx.measureText(tr(s)).width;
  }

  /** draw_texture_rect */
  texture(img: Img, r: R, alpha = 1): void {
    const c = this.ctx;
    if (alpha < 1) {
      const a = c.globalAlpha;
      c.globalAlpha = a * alpha;
      c.drawImage(img, r.x, r.y, r.w, r.h);
      c.globalAlpha = a;
      return;
    }
    c.drawImage(img, r.x, r.y, r.w, r.h);
  }
}

/** 화면 없이 글자 폭만 재는 용도 (오프스크린 캔버스) */
let measureCtx: CanvasRenderingContext2D | null = null;
export function measureText(s: string, size: number, weight = 400): number {
  if (measureCtx === null) {
    if (typeof document === "undefined") return s.length * size * 0.9;
    measureCtx = document.createElement("canvas").getContext("2d");
  }
  measureCtx!.font = fontCss(size, weight);
  return measureCtx!.measureText(tr(s)).width;
}
