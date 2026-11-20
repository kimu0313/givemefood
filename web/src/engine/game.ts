// 게임 틀: 캔버스 하나 + 그 위 HTML 화면(UI), 화면 크기 맞추기, 매 프레임 진행, 장면 바꾸기, 입력.
// 게임 화면 비율은 16:9 고정 (1280×720 과 같은 비율, 2026-11-12 사용자 요청). 설계 좌표는 1920×1080 이고
// 창 크기에 맞춰 통째로 키우거나 줄이며, 비율이 다른 화면은 위아래나 양옆에 어두운 띠가 생긴다.

import { Color, V, rgb } from "./geom.ts";
import { Gfx } from "./gfx.ts";
import { RootNode } from "./node.ts";

export const BASE_W = 1920;
export const BASE_H = 1080;
export const CLEAR_COLOR = rgb(0.05, 0.06, 0.1);

export interface PointerInfo {
  type: "down" | "move" | "up";
  pos: V;
  /** move: 이전 위치에서 움직인 양 (설계 좌표) */
  rel: V;
  /** move/up: 최근 움직임 속도 (설계 좌표/초) */
  vel: V;
  id: number;
}

/** 장면 하나 (타이틀, 지도, 영업, 정산 …). 캔버스 그림 = 이 노드 아래 자식들, HTML = ui */
export abstract class Scene extends RootNode {
  game!: Game;
  ui!: HTMLDivElement;
  /** 설계 좌표의 화면 크기 (이 장면이 시작될 때 정해짐) */
  vw = BASE_W;
  vh = BASE_H;
  clearColor: Color = CLEAR_COLOR;

  abstract ready(): void;
  onPointer(_e: PointerInfo): void {}
  onWheel(_dy: number, _dx: number): void {}
  onKey(_key: string): void {}
  /** 안드로이드 뒤로 가기 / Esc */
  onBack(): void {}
  /** 창이 가려지거나 앱이 백그라운드로 */
  onFocusLost(): void {}
  dispose(): void {}
}

export type SceneFactory = () => Scene;

/** 캔버스로 그리는 작은 HTML 조각 (메뉴 그림, 별점, 셔터 …) */
export class CanvasWidget {
  readonly el: HTMLCanvasElement;
  w: number;
  h: number;
  animated: boolean;
  drawFn: (g: Gfx, t: number) => void;
  private t = 0;
  dirty = true;

  constructor(w: number, h: number, drawFn: (g: Gfx, t: number) => void, animated = false) {
    this.el = document.createElement("canvas");
    this.el.style.width = `${w}px`;
    this.el.style.height = `${h}px`;
    this.el.style.display = "block";
    this.el.style.pointerEvents = "none";
    this.w = w;
    this.h = h;
    this.drawFn = drawFn;
    this.animated = animated;
    game?.widgets.add(this);
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.el.style.width = `${w}px`;
    this.el.style.height = `${h}px`;
    this.dirty = true;
  }

  redraw(dt: number, pxScale: number): void {
    this.t += dt;
    if (!this.dirty && !this.animated) return;
    if (!this.el.isConnected) return;
    const bw = Math.max(1, Math.round(this.w * pxScale));
    const bh = Math.max(1, Math.round(this.h * pxScale));
    if (this.el.width !== bw || this.el.height !== bh) {
      this.el.width = bw;
      this.el.height = bh;
    }
    const ctx = this.el.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, bw, bh);
    ctx.setTransform(bw / this.w, 0, 0, bh / this.h, 0, 0);
    const g = new Gfx(ctx);
    this.drawFn(g, this.t);
    this.dirty = false;
  }
}

export let game: Game | null = null;

/**
 * 모바일 기기인지 (2026-11-21 사용자 "세로 강제 회전은 모바일에서만"): 휴대폰·태블릿 브라우저만 참.
 * 터치 화면 노트북처럼 마우스가 주 입력인 PC 는 거짓 (pointer: fine / hover 됨) — 그래서 maxTouchPoints 만으로는 판단하지 않음.
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  if (nav.userAgentData?.mobile === true) return true;
  const ua = nav.userAgent ?? "";
  if (/Android|iPhone|iPod|iPad|Mobile|Mobi|Silk|Kindle|Opera Mini|IEMobile/i.test(ua)) return true;
  if (/Macintosh/.test(ua) && (nav.maxTouchPoints ?? 0) > 1) return true; // iPadOS (데스크톱 UA)
  // 주 입력이 손가락이고 마우스 올리기가 없는 기기
  return typeof matchMedia === "function" && matchMedia("(pointer: coarse) and (hover: none)").matches;
}

export class Game {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly uiRoot: HTMLDivElement;
  readonly scenes = new Map<string, SceneFactory>();
  scene: Scene | null = null;
  paused = false;
  widgets = new Set<CanvasWidget>();
  /** 화면 좌표 → 설계 좌표 */
  scale = 1;
  offX = 0;
  offY = 0;
  dpr = 1;
  timeScale = 1;
  /** 캡처·테스트용: 한 프레임 시간을 고정 */
  fixedDt = 0;
  private last = 0;
  private pointers = new Map<number, { pos: V; t: number; vel: V }>();
  /**
   * 모바일 세로 강제 가로 (2026-11-21 사용자 "세로로 접속하면 회전 잠금과 상관없이 transform: rotate(90deg) 로 화면 전체를
   * 가로로 꽉 차게, 터치 좌표도 맞게"): 터치 기기에서 창이 세로(높이 > 너비)면 게임 상자(#app)와 로딩 화면을 90° 돌려
   * 가로 화면처럼 씀. 회전 잠금은 상관없음 (기기 방향 대신 창 비율로 판단). ?rotate=1 = 데스크톱에서도 세로 창이면 회전 (시험용)
   */
  rotated = false;
  private host: HTMLElement;
  private screenW = 0; // 회전할 때 화면(창) 가로 — 터치 좌표 바꿀 때 씀

  constructor(parent: HTMLElement) {
    game = this;
    this.host = parent;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "stage";
    parent.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;
    this.uiRoot = document.createElement("div");
    this.uiRoot.className = "ui-root";
    parent.appendChild(this.uiRoot);
    window.addEventListener("resize", () => this.layout());
    window.addEventListener("orientationchange", () => setTimeout(() => this.layout(), 120));
    window.visualViewport?.addEventListener("resize", () => this.layout());
    this.bindInput();
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.scene?.onFocusLost();
    });
    window.addEventListener("blur", () => this.scene?.onFocusLost());
    this.applyRotation(); // 첫 장면 전 로딩 화면도 바로 돌려 둠
  }

  register(name: string, f: SceneFactory): void {
    this.scenes.set(name, f);
  }

  /** 지금 창 크기로 정한 설계 가로 길이 */
  /** 설계 가로 길이: 16:9 고정 (2026-11-12 사용자 "1280x720 비율로") — 다른 비율의 화면은 남는 쪽에 띠 */
  designWidth(): number {
    return BASE_W;
  }

  goto(name: string): void {
    const f = this.scenes.get(name);
    if (!f) throw new Error("no scene " + name);
    // 이벤트 처리 중에 장면을 바꿔도 안전하게 다음 틱에
    queueMicrotask(() => this.setScene(f()));
  }

  setScene(s: Scene): void {
    if (this.scene !== null) {
      this.scene.dispose();
      this.scene.queueFree();
      this.scene.ui.remove();
    }
    this.paused = false;
    this.pointers.clear();
    for (const w of [...this.widgets]) if (!w.el.isConnected) this.widgets.delete(w);
    s.game = this;
    s.vw = this.designWidth();
    s.vh = BASE_H;
    s.ui = document.createElement("div");
    s.ui.className = "scene-ui";
    this.uiRoot.appendChild(s.ui);
    this.scene = s;
    this.layout();
    s.ready();
  }

  /** 지금 세로 화면을 돌려 써야 하는지: 터치 기기(또는 ?rotate=1) + 창이 세로 */
  private wantRotate(): boolean {
    const portrait = window.innerHeight > window.innerWidth;
    if (!portrait) return false;
    const force = new URLSearchParams(location.search).get("rotate") === "1";
    return force || isMobileDevice();
  }

  /** 게임 상자를 돌리거나 되돌림 (돌리면 상자 크기 = 창 높이 × 창 너비, 시계 방향 90°) */
  private applyRotation(): void {
    const rot = this.wantRotate();
    const sw = window.innerWidth;
    const sh = window.innerHeight;
    this.rotated = rot;
    this.screenW = sw;
    document.documentElement.classList.toggle("rot", rot);
    const boxes = [this.host, document.getElementById("loading")].filter((e): e is HTMLElement => e !== null);
    for (const b of boxes) {
      const st = b.style;
      if (rot) {
        st.inset = "auto";
        st.left = `${sw}px`;
        st.top = "0px";
        st.width = `${sh}px`;
        st.height = `${sw}px`;
        st.transformOrigin = "0 0";
        st.transform = "rotate(90deg)";
        st.setProperty("--h", `min(${sw}px, ${(sh * 9) / 16}px)`); // 로딩 화면 16:9 틀 (돌린 상자 기준)
      } else {
        for (const k of ["inset", "left", "top", "width", "height", "transform-origin", "transform", "--h"]) st.removeProperty(k);
      }
    }
  }

  /** 화면(창) 좌표 → 게임 상자 안 좌표 (돌렸으면 되돌려서) */
  private toLocal(clientX: number, clientY: number): [number, number] {
    if (!this.rotated) return [clientX, clientY];
    // 상자는 (창 너비, 0) 에서 시계 방향 90°: 상자 x = 화면 아래쪽, 상자 y = 화면 왼쪽
    return [clientY, this.screenW - clientX];
  }

  layout(): void {
    const s = this.scene;
    const vw = s ? s.vw : BASE_W;
    this.applyRotation();
    const ww = this.rotated ? window.innerHeight : window.innerWidth;
    const wh = this.rotated ? window.innerWidth : window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.scale = Math.min(ww / vw, wh / BASE_H);
    this.offX = (ww - vw * this.scale) * 0.5;
    this.offY = (wh - BASE_H * this.scale) * 0.5;
    this.canvas.width = Math.round(ww * this.dpr);
    this.canvas.height = Math.round(wh * this.dpr);
    this.canvas.style.width = `${ww}px`;
    this.canvas.style.height = `${wh}px`;
    const r = this.uiRoot.style;
    r.left = `${this.offX}px`;
    r.top = `${this.offY}px`;
    r.width = `${vw}px`;
    r.height = `${BASE_H}px`;
    r.transform = `scale(${this.scale})`;
    for (const w of this.widgets) w.dirty = true;
  }

  start(): void {
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = this.fixedDt > 0 ? this.fixedDt : Math.min(0.1, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      this.frame(dt * this.timeScale);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /** 한 프레임: 진행 + 그리기 (캡처 도구가 직접 부르기도 함) */
  frame(dt: number): void {
    const s = this.scene;
    if (s !== null) s.tick(dt, this.paused);
    this.render();
    const px = this.scale * this.dpr;
    for (const w of [...this.widgets]) {
      if (!w.el.isConnected && !w.dirty) continue;
      w.redraw(dt, px);
    }
  }

  render(): void {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = CLEAR_COLOR.css();
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const s = this.scene;
    if (s === null) return;
    const k = this.scale * this.dpr;
    ctx.setTransform(k, 0, 0, k, this.offX * this.dpr, this.offY * this.dpr);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, s.vw, s.vh);
    ctx.clip();
    ctx.fillStyle = s.clearColor.css();
    ctx.fillRect(0, 0, s.vw, s.vh);
    const g = new Gfx(ctx);
    s.render(g);
    ctx.restore();
  }

  /** 설계 좌표 → 화면(창) 좌표 (테스트용, toDesign 의 반대) */
  toScreen(x: number, y: number): V {
    const lx = x * this.scale + this.offX;
    const ly = y * this.scale + this.offY;
    return this.rotated ? new V(this.screenW - ly, lx) : new V(lx, ly);
  }

  /** 화면(창) 좌표 → 설계 좌표 (세로 강제 가로면 회전도 되돌림) */
  toDesign(clientX: number, clientY: number): V {
    const [x, y] = this.toLocal(clientX, clientY);
    return new V((x - this.offX) / this.scale, (y - this.offY) / this.scale);
  }

  private bindInput(): void {
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => {
      c.setPointerCapture(e.pointerId);
      const p = this.toDesign(e.clientX, e.clientY);
      this.pointers.set(e.pointerId, { pos: p, t: performance.now(), vel: new V() });
      this.scene?.onPointer({ type: "down", pos: p, rel: new V(), vel: new V(), id: e.pointerId });
      e.preventDefault();
    });
    c.addEventListener("pointermove", (e) => {
      const p = this.toDesign(e.clientX, e.clientY);
      const prev = this.pointers.get(e.pointerId);
      const now = performance.now();
      let rel = new V();
      let vel = new V();
      if (prev) {
        rel = p.sub(prev.pos);
        const dt = Math.max(1, now - prev.t) / 1000;
        vel = prev.vel.lerp(rel.div(dt), 0.6);
        this.pointers.set(e.pointerId, { pos: p, t: now, vel });
      }
      this.scene?.onPointer({ type: "move", pos: p, rel, vel, id: e.pointerId });
    });
    const up = (e: PointerEvent) => {
      const p = this.toDesign(e.clientX, e.clientY);
      const prev = this.pointers.get(e.pointerId);
      let vel = prev ? prev.vel : new V();
      if (prev && performance.now() - prev.t > 80) vel = new V(); // 멈췄다 뗀 손가락
      this.pointers.delete(e.pointerId);
      this.scene?.onPointer({ type: "up", pos: p, rel: new V(), vel, id: e.pointerId });
    };
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up);
    c.addEventListener(
      "wheel",
      (e) => {
        this.scene?.onWheel(e.deltaY, e.deltaX);
        e.preventDefault();
      },
      { passive: false },
    );
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" || e.key === "Backspace" || e.key === "BrowserBack") this.scene?.onBack();
      else this.scene?.onKey(e.key);
    });
    // 안드로이드 뒤로 가기 (Capacitor 등에서 popstate 로 들어옴)
    window.addEventListener("popstate", () => this.scene?.onBack());
  }
}
