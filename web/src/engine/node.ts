// Godot Node2D 를 흉내 낸 작은 장면 나무: 위치·크기·회전·투명도·자식, process(매 프레임)·draw(그리기), 트윈.
// 브라우저 없이(node 테스트)도 불러올 수 있게 DOM 을 직접 쓰지 않는다.

import { V, v } from "./geom.ts";
import type { Gfx } from "./gfx.ts";

/** 2x3 아핀 변환 (a c e / b d f) */
export class Xf {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
  constructor(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.f = f;
  }
  mul(o: Xf): Xf {
    return new Xf(
      this.a * o.a + this.c * o.b,
      this.b * o.a + this.d * o.b,
      this.a * o.c + this.c * o.d,
      this.b * o.c + this.d * o.d,
      this.a * o.e + this.c * o.f + this.e,
      this.b * o.e + this.d * o.f + this.f,
    );
  }
  apply(p: V): V {
    return new V(this.a * p.x + this.c * p.y + this.e, this.b * p.x + this.d * p.y + this.f);
  }
  inverse(): Xf {
    const det = this.a * this.d - this.b * this.c || 1e-12;
    const a = this.d / det;
    const b = -this.b / det;
    const c = -this.c / det;
    const d = this.a / det;
    return new Xf(a, b, c, d, -(a * this.e + c * this.f), -(b * this.e + d * this.f));
  }
  static of(pos: V, rot: number, scale: V): Xf {
    const cs = Math.cos(rot);
    const sn = Math.sin(rot);
    return new Xf(cs * scale.x, sn * scale.x, -sn * scale.y, cs * scale.y, pos.x, pos.y);
  }
}

export class Node2D {
  position: V = v();
  scale: V = v(1, 1);
  rotation = 0;
  /** modulate.a */
  alpha = 1;
  visible = true;
  z = 0;
  /** true 면 일시정지 중에도 process (Godot PROCESS_MODE_ALWAYS) */
  processAlways = false;
  children: Node2D[] = [];
  parent: Node2D | null = null;
  freed = false;
  tweens: Tween[] = [];

  add<T extends Node2D>(child: T): T {
    if (child.parent) child.parent.remove(child);
    child.parent = this;
    this.children.push(child);
    child.enterTree();
    return child;
  }

  remove(child: Node2D): void {
    const i = this.children.indexOf(child);
    if (i >= 0) this.children.splice(i, 1);
    child.parent = null;
  }

  /** 형제 중 맨 뒤(= 맨 앞에 그려짐)로 */
  moveToFront(): void {
    const p = this.parent;
    if (p === null) return;
    const i = p.children.indexOf(this);
    if (i >= 0 && i !== p.children.length - 1) {
      p.children.splice(i, 1);
      p.children.push(this);
    }
  }

  queueFree(): void {
    if (this.freed) return;
    this.freed = true;
    for (const t of this.tweens) t.kill();
    this.tweens = [];
    for (const c of [...this.children]) c.queueFree();
    if (this.parent) this.parent.remove(this);
  }

  isInsideTree(): boolean {
    return this.parent !== null || this instanceof RootNode;
  }

  /** 나무에 들어왔을 때 (Godot _enter_tree / _ready 한 번) */
  enterTree(): void {}

  /** 매 프레임 (Godot _process) */
  process(_dt: number): void {}

  /** 그리기 (Godot _draw) — 이 노드 좌표계 */
  draw(_g: Gfx): void {}

  localXf(): Xf {
    return Xf.of(this.position, this.rotation, this.scale);
  }

  globalXf(): Xf {
    let xf = this.localXf();
    let p = this.parent;
    while (p !== null) {
      xf = p.localXf().mul(xf);
      p = p.parent;
    }
    return xf;
  }

  toGlobal(local: V): V {
    return this.globalXf().apply(local);
  }

  toLocal(global: V): V {
    return this.globalXf().inverse().apply(global);
  }

  createTween(): Tween {
    const t = new Tween(this);
    this.tweens.push(t);
    return t;
  }

  /** 트리 전체 진행 (일시정지 중이면 processAlways 인 노드와 그 자식만) */
  tick(dt: number, paused: boolean, inherited = false): void {
    if (this.freed) return;
    const always = inherited || this.processAlways;
    if (!paused || always) {
      this.process(dt);
      if (this.tweens.length > 0) {
        for (const t of [...this.tweens]) t.step(dt);
        this.tweens = this.tweens.filter((t) => !t.dead);
      }
    }
    for (const c of [...this.children]) c.tick(dt, paused, always);
  }

  render(g: Gfx): void {
    if (!this.visible || this.freed || this.alpha <= 0) return;
    const ctx = g.ctx;
    ctx.save();
    const s = this.scale;
    ctx.translate(this.position.x, this.position.y);
    if (this.rotation !== 0) ctx.rotate(this.rotation);
    if (s.x !== 1 || s.y !== 1) ctx.scale(s.x, s.y);
    if (this.alpha < 1) ctx.globalAlpha *= this.alpha;
    g.begin();
    this.draw(g);
    g.resetTransform();
    if (this.children.length > 0) {
      const kids = this.children.some((c) => c.z !== 0) ? [...this.children].sort((a, b) => a.z - b.z) : this.children;
      for (const c of kids) c.render(g);
    }
    ctx.restore();
  }
}

export class RootNode extends Node2D {}

// ---------------------------------------------------------------- 트윈 (Godot Tween 과 같은 쓰임새)

export type Trans = "linear" | "sine" | "quad" | "cubic" | "back" | "bounce" | "expo";
export type Ease = "in" | "out" | "in_out";

function easeIn(trans: Trans, t: number): number {
  switch (trans) {
    case "sine":
      return 1 - Math.cos((t * Math.PI) / 2);
    case "quad":
      return t * t;
    case "cubic":
      return t * t * t;
    case "expo":
      return t === 0 ? 0 : Math.pow(2, 10 * (t - 1));
    case "back": {
      const s = 1.70158;
      return t * t * ((s + 1) * t - s);
    }
    case "bounce":
      return 1 - bounceOut(1 - t);
    default:
      return t;
  }
}

function bounceOut(t: number): number {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) {
    t -= 1.5 / 2.75;
    return 7.5625 * t * t + 0.75;
  }
  if (t < 2.5 / 2.75) {
    t -= 2.25 / 2.75;
    return 7.5625 * t * t + 0.9375;
  }
  t -= 2.625 / 2.75;
  return 7.5625 * t * t + 0.984375;
}

export function easeValue(trans: Trans, ease: Ease, t: number): number {
  if (trans === "linear") return t;
  if (ease === "in") return easeIn(trans, t);
  if (ease === "out") return 1 - easeIn(trans, 1 - t);
  return t < 0.5 ? easeIn(trans, t * 2) * 0.5 : 1 - easeIn(trans, (1 - t) * 2) * 0.5;
}

interface Tweener {
  dur: number;
  delay: number;
  t: number;
  started: boolean;
  trans: Trans;
  ease: Ease;
  start(): void;
  apply(k: number): void;
}

type Animatable = Record<string, unknown>;

/** 트윈이 바꿀 수 있는 값: 숫자 또는 V. "position:x" 처럼 V 의 한 성분만 */
function getPath(obj: Animatable, path: string): number | V {
  const [key, sub] = path.split(":");
  if (key === "modulate") return (obj as unknown as Node2D).alpha;
  const val = obj[key] as number | V;
  if (sub === "x") return (val as V).x;
  if (sub === "y") return (val as V).y;
  return val;
}

function setPath(obj: Animatable, path: string, value: number | V): void {
  const [key, sub] = path.split(":");
  if (key === "modulate") {
    (obj as unknown as Node2D).alpha = value as number;
    return;
  }
  if (sub === "x" || sub === "y") {
    const cur = obj[key] as V;
    obj[key] = sub === "x" ? new V(value as number, cur.y) : new V(cur.x, value as number);
    return;
  }
  obj[key] = value;
}

export class PropTweener implements Tweener {
  dur: number;
  delay = 0;
  t = 0;
  started = false;
  trans: Trans;
  ease: Ease;
  private from: number | V = 0;
  private obj: Animatable;
  private path: string;
  private to: number | V;
  constructor(obj: Animatable, path: string, to: number | V, dur: number, defTrans: Trans, defEase: Ease) {
    this.obj = obj;
    this.path = path;
    this.to = to;
    this.dur = dur;
    this.trans = defTrans;
    this.ease = defEase;
  }
  start(): void {
    this.from = getPath(this.obj, this.path);
  }
  apply(k: number): void {
    const e = easeValue(this.trans, this.ease, k);
    if (typeof this.to === "number") setPath(this.obj, this.path, (this.from as number) + (this.to - (this.from as number)) * e);
    else setPath(this.obj, this.path, (this.from as V).lerp(this.to, e));
  }
  setTrans(t: Trans): this {
    this.trans = t;
    return this;
  }
  setEase(e: Ease): this {
    this.ease = e;
    return this;
  }
  setDelay(d: number): this {
    this.delay = d;
    return this;
  }
}

class MethodTweener implements Tweener {
  dur: number;
  delay = 0;
  t = 0;
  started = false;
  trans: Trans;
  ease: Ease;
  private fn: (x: number) => void;
  private from: number;
  private to: number;
  constructor(fn: (x: number) => void, from: number, to: number, dur: number, defTrans: Trans, defEase: Ease) {
    this.fn = fn;
    this.from = from;
    this.to = to;
    this.dur = dur;
    this.trans = defTrans;
    this.ease = defEase;
  }
  start(): void {}
  apply(k: number): void {
    this.fn(this.from + (this.to - this.from) * easeValue(this.trans, this.ease, k));
  }
}

class CallTweener implements Tweener {
  dur = 0;
  delay = 0;
  t = 0;
  started = false;
  trans: Trans = "linear";
  ease: Ease = "in_out";
  private fn: () => void;
  constructor(fn: () => void) {
    this.fn = fn;
  }
  start(): void {}
  apply(k: number): void {
    if (k >= 1) this.fn();
  }
}

class IntervalTweener implements Tweener {
  delay = 0;
  t = 0;
  started = false;
  trans: Trans = "linear";
  ease: Ease = "in_out";
  dur: number;
  constructor(dur: number) {
    this.dur = dur;
  }
  start(): void {}
  apply(_k: number): void {}
}

export class Tween {
  private groups: Tweener[][] = [];
  private index = 0;
  private nextParallel = false;
  private loops = 1; // 0 = 무한
  private loopsDone = 0;
  private defTrans: Trans = "linear";
  private defEase: Ease = "in_out";
  dead = false;
  readonly owner: Node2D;

  constructor(owner: Node2D) {
    this.owner = owner;
  }

  private push(tw: Tweener): void {
    if (this.nextParallel && this.groups.length > 0) this.groups[this.groups.length - 1].push(tw);
    else this.groups.push([tw]);
    this.nextParallel = false;
  }

  parallel(): this {
    this.nextParallel = true;
    return this;
  }

  setTrans(t: Trans): this {
    this.defTrans = t;
    return this;
  }

  setEase(e: Ease): this {
    this.defEase = e;
    return this;
  }

  setLoops(n = 0): this {
    this.loops = n;
    return this;
  }

  prop(obj: object, path: string, to: number | V, dur: number): PropTweener {
    const tw = new PropTweener(obj as Animatable, path, to, dur, this.defTrans, this.defEase);
    this.push(tw);
    return tw;
  }

  method(fn: (x: number) => void, from: number, to: number, dur: number): this {
    this.push(new MethodTweener(fn, from, to, dur, this.defTrans, this.defEase));
    return this;
  }

  call(fn: () => void): this {
    this.push(new CallTweener(fn));
    return this;
  }

  interval(dur: number): this {
    this.push(new IntervalTweener(dur));
    return this;
  }

  kill(): void {
    this.dead = true;
  }

  isRunning(): boolean {
    return !this.dead;
  }

  step(dt: number): void {
    let left = dt;
    let guard = 0;
    while (!this.dead && left >= 0 && guard++ < 64) {
      if (this.index >= this.groups.length) {
        this.loopsDone += 1;
        if (this.loops === 0 || this.loopsDone < this.loops) {
          this.index = 0;
          for (const g of this.groups) for (const tw of g) {
            tw.t = 0;
            tw.started = false;
          }
          if (this.groups.length === 0) {
            this.dead = true;
            return;
          }
          continue;
        }
        this.dead = true;
        return;
      }
      const group = this.groups[this.index];
      let groupDone = true;
      let used = 0;
      for (const tw of group) {
        const total = tw.delay + tw.dur;
        const before = tw.t;
        tw.t = Math.min(total, tw.t + left);
        used = Math.max(used, tw.t - before);
        if (tw.t >= tw.delay) {
          if (!tw.started) {
            tw.started = true;
            tw.start();
          }
          tw.apply(tw.dur > 0 ? Math.min(1, (tw.t - tw.delay) / tw.dur) : 1);
        }
        if (tw.t < total) groupDone = false;
        if (this.dead) return;
      }
      if (!groupDone) return;
      left -= used;
      this.index += 1;
      if (left <= 0 && this.index < this.groups.length) {
        // 길이 0 짜리(콜백) 는 이번 프레임에 바로
        const g = this.groups[this.index];
        if (!g.every((tw) => tw.dur + tw.delay <= 0)) return;
      }
    }
  }
}
