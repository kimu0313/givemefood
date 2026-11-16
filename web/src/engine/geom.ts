// 2D 벡터·사각형·색 (Godot 의 Vector2 / Rect2 / Color 와 같은 계산 규칙)

export const PI = Math.PI;
export const TAU = Math.PI * 2;

export class V {
  readonly x: number;
  readonly y: number;
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  add(o: V): V {
    return new V(this.x + o.x, this.y + o.y);
  }
  sub(o: V): V {
    return new V(this.x - o.x, this.y - o.y);
  }
  /** 숫자 하나 또는 성분별 곱 */
  mul(k: number | V): V {
    return typeof k === "number" ? new V(this.x * k, this.y * k) : new V(this.x * k.x, this.y * k.y);
  }
  div(k: number): V {
    return new V(this.x / k, this.y / k);
  }
  neg(): V {
    return new V(-this.x, -this.y);
  }
  rotated(a: number): V {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return new V(this.x * c - this.y * s, this.x * s + this.y * c);
  }
  length(): number {
    return Math.hypot(this.x, this.y);
  }
  lengthSquared(): number {
    return this.x * this.x + this.y * this.y;
  }
  dot(o: V): number {
    return this.x * o.x + this.y * o.y;
  }
  normalized(): V {
    const l = this.length();
    return l > 0 ? new V(this.x / l, this.y / l) : new V();
  }
  distanceTo(o: V): number {
    return Math.hypot(this.x - o.x, this.y - o.y);
  }
  angle(): number {
    return Math.atan2(this.y, this.x);
  }
  lerp(o: V, t: number): V {
    return new V(this.x + (o.x - this.x) * t, this.y + (o.y - this.y) * t);
  }
}

export function v(x = 0, y = 0): V {
  return new V(x, y);
}

export const ZERO = new V(0, 0);

export class R {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  constructor(x: number, y: number, w: number, h: number) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }
  static of(pos: V, size: V): R {
    return new R(pos.x, pos.y, size.x, size.y);
  }
  get pos(): V {
    return new V(this.x, this.y);
  }
  get size(): V {
    return new V(this.w, this.h);
  }
  get end(): V {
    return new V(this.x + this.w, this.y + this.h);
  }
  get endX(): number {
    return this.x + this.w;
  }
  get endY(): number {
    return this.y + this.h;
  }
  center(): V {
    return new V(this.x + this.w * 0.5, this.y + this.h * 0.5);
  }
  grow(by: number): R {
    return new R(this.x - by, this.y - by, this.w + by * 2, this.h + by * 2);
  }
  moved(d: V): R {
    return new R(this.x + d.x, this.y + d.y, this.w, this.h);
  }
  withX(x: number): R {
    return new R(x, this.y, this.w, this.h);
  }
  hasPoint(p: V): boolean {
    return p.x >= this.x && p.y >= this.y && p.x < this.x + this.w && p.y < this.y + this.h;
  }
}

export function rect(x: number, y: number, w: number, h: number): R {
  return new R(x, y, w, h);
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export class Color {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
  private _css: string | null = null;
  constructor(r: number, g: number, b: number, a = 1) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }
  lightened(k: number): Color {
    return new Color(this.r + (1 - this.r) * k, this.g + (1 - this.g) * k, this.b + (1 - this.b) * k, this.a);
  }
  darkened(k: number): Color {
    return new Color(this.r * (1 - k), this.g * (1 - k), this.b * (1 - k), this.a);
  }
  lerp(o: Color, t: number): Color {
    return new Color(
      this.r + (o.r - this.r) * t,
      this.g + (o.g - this.g) * t,
      this.b + (o.b - this.b) * t,
      this.a + (o.a - this.a) * t,
    );
  }
  /** Godot Color(c, a): 알파만 바꾼 색 */
  withA(a: number): Color {
    return new Color(this.r, this.g, this.b, a);
  }
  /** Godot Color * float: 네 성분(알파 포함) 모두 곱함 */
  mul(k: number): Color {
    return new Color(this.r * k, this.g * k, this.b * k, this.a * k);
  }
  isEqualApprox(o: Color): boolean {
    const e = 1e-5;
    return Math.abs(this.r - o.r) < e && Math.abs(this.g - o.g) < e && Math.abs(this.b - o.b) < e && Math.abs(this.a - o.a) < e;
  }
  css(): string {
    if (this._css === null) {
      const r = Math.round(clamp01(this.r) * 255);
      const g = Math.round(clamp01(this.g) * 255);
      const b = Math.round(clamp01(this.b) * 255);
      this._css = `rgba(${r},${g},${b},${clamp01(this.a)})`;
    }
    return this._css;
  }
}

export function rgb(r: number, g: number, b: number, a = 1): Color {
  return new Color(r, g, b, a);
}

export const WHITE = new Color(1, 1, 1, 1);
export const BLACK = new Color(0, 0, 0, 1);
export const CLEAR = new Color(0, 0, 0, 0);

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Godot fmod (C fmod: 부호는 나눠지는 수를 따름) */
export function fmod(a: number, b: number): number {
  return a % b;
}

/** Godot fposmod (항상 0 이상) */
export function fposmod(a: number, b: number): number {
  const r = a % b;
  return r < 0 ? r + b : r;
}

export function snapped(x: number, step: number): number {
  return Math.round(x / step) * step;
}

/** 정수 나눗셈 (GDScript int / int: 0 쪽으로 버림) */
export function idiv(a: number, b: number): number {
  return Math.trunc(a / b);
}
