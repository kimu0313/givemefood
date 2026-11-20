// 처음 하는 사람 튜토리얼 (2026-11-16 사용자: "처음 할 때는 가게 재료 구매, 장비 업그레이드, 손님에게 음식 만들어 주는
// 튜토리얼 과정이 나오면서 UI로 설명"). 화면을 어둡게 덮고 눌러야 할 곳만 구멍을 뚫어 빛나는 테두리 + 손가락으로 가리키고,
// 포장마차 이모가 설명한다. 덮개는 구멍 밖 입력을 막고, 구멍 안은 그대로 아래 화면(캔버스·버튼)으로 간다.
// 이모 (2026-11-17 사용자 "네모 프로필에 넣지 말고 그대로 나와서 말풍선으로 말하는 것처럼"): 오려 낸 상반신 그림이 화면 아래 구석에
// 서 있고 (오른쪽 구석이면 좌우를 뒤집어 화면 안쪽을 봄), 얼굴 옆 말풍선(꼬리가 볼 쪽)에 설명 + 다음·건너뛰기 버튼.
// 자리는 단계마다 가리키는 곳·손가락과 겹치지 않는 첫 배치를 고른다 (반대쪽 구석 → 머리 위 말풍선 → 맨 위).
// 말풍선 모양 (2026-11-18 사용자 그림 "이모 대사 UI", art_src/ui_tutorial_bubble.png → tools/tutorial_bubble.mjs):
// 종이 판은 9조각(border-image)으로 대사 길이에 맞춰 늘이고, 이름표·좋아요·건너뛰기 버튼은 그림 조각 위에 글자를 씀
// (글자는 게임이 써서 다른 언어로도 바뀜). 꼬리는 자리가 바뀌어서 그림과 같은 색 SVG.
//
// 단계 목록은 장면마다 만든다 (지도·장보기·업그레이드·영업). 큰 단계는 GameState.tutorial 에 저장돼서 새로 고쳐도 이어진다:
//   start(지도: 인사 → 장보기) → buy(장보기: 떡볶이 10인분 → 돌아가기) → upgrade(지도: 업그레이드 → 판 키우기 → 돌아가기)
//   → stage(지도: 스테이지 1 → 영업 시작) → cook(영업: 재료통 → 판 → 그릇 → 마무리) → "" (끝)
// "건너뛰기"는 언제든 튜토리얼 전체를 끝낸다.

import { R } from "../engine/geom.ts";
import type { Scene } from "../engine/game.ts";
import * as Ui from "../engine/ui.ts";
import { GameState } from "../state/game_state.ts";

export interface TutStep {
  text: string;
  /** 가리킬 곳 (설계 좌표). 없으면 화면 전체를 덮고 말만 한다 */
  target?: () => R | null;
  /** 있으면 "다음" 버튼 (글자)으로 넘어감. 없으면 wait 이벤트를 기다림 */
  next?: string;
  /** 이 이름의 이벤트(onEvent)가 오면 다음 단계로 */
  wait?: string;
  /** 단계를 마칠 때 */
  done?: () => void;
  /** 덮개 없이 (입력을 막지 않음) 테두리와 말만 — 영업 중 기다리는 단계 */
  passive?: boolean;
  /** 이모가 설 구석 (영업 화면: 손님이 없는 쪽). 없으면 가리키는 곳 반대쪽 */
  boxSide?: () => "left" | "right" | null;
}

/** HTML 요소의 설계 좌표 네모 (장면 UI 기준) */
export function elementRect(el: HTMLElement, scene: Scene): R {
  const k = scene.game.scale || 1;
  const base = scene.ui.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return new R((r.left - base.left) / k, (r.top - base.top) / k, r.width / k, r.height / k);
}

/** 이모 그림 (art_src/tutorial_imo.png 를 오려 낸 상반신, 520×803) */
const IMO_SRC = "assets/art/ui/imo.webp";
const IMO_ASPECT = 520 / 803;
/** 그림 안 볼 옆 (말풍선 꼬리 끝이 갈 곳, 그림 비율) — 오른쪽 구석이면 좌우 뒤집힘 */
const IMO_CHEEK = { x: 0.72, y: 0.34 };
const SAY_W = 860; // 말풍선 폭
/** 말풍선 그림 조각을 화면에 그리는 배율 (그림 px × ART_S = 화면 px) */
const ART_S = 0.6;
const PAPER = "#fed9b2"; // 말풍선 종이 색 (그림에서 잰 평균)
const INK_ART = "#24150d"; // 그림 먹선 색
// 말풍선 꼬리 (먹선 + 종이 색 속). 옆 꼬리: x 100 = 말풍선 테두리 자리, 그 오른쪽(100~116)은 종이 색으로 테두리를 덮음, 끝은 왼쪽 아래 (2, 74)
const TAIL_SIDE = `<svg viewBox="0 0 116 80"><path d="M116 2 L100 2 L98 6 Q58 40 2 74 Q56 62 98 54 L100 58 L116 58 Z" fill="${PAPER}"/><path d="M98 6 Q58 40 2 74 Q56 62 98 54" fill="none" stroke="${INK_ART}" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
// 아래 꼬리: y 16 = 테두리 자리, 그 위(0~16)는 종이 색, 끝은 왼쪽 아래 (6, 112)
const TAIL_DOWN = `<svg viewBox="0 0 80 116"><path d="M6 0 L6 16 L10 18 Q34 68 6 112 Q54 78 66 18 L70 16 L70 0 Z" fill="${PAPER}"/><path d="M10 18 Q34 68 6 112 Q54 78 66 18" fill="none" stroke="${INK_ART}" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
const TAIL_S = 1.2; // 꼬리 크기 배율
const BORDER_IN = 4; // 말풍선 그림 테두리 먹선 가운데가 바깥 끝에서 안쪽으로 (화면 px)

/** 말풍선 종이 판 그림 (9조각: 그림 px 위·오른쪽·아래·왼쪽 → 화면 px) */
const PANEL_SRC = "assets/art/ui/tut_panel.webp";
const PANEL_SLICE = [80, 90, 80, 90];
const PANEL_DST = PANEL_SLICE.map((q) => q * ART_S);
let panelImg: HTMLImageElement | null = null;

/**
 * 종이 판을 캔버스에 9조각으로 늘여 그림. CSS border-image 는 화면을 줄인 배율(소수 px)에서 조각 사이에 실선 틈이 보여서,
 * 조각을 서로 조금씩 겹쳐 그린다
 */
function paintPanel(cv: HTMLCanvasElement, img: HTMLImageElement, w: number, h: number, k: number): void {
  cv.width = Math.max(1, Math.round(w * k));
  cv.height = Math.max(1, Math.round(h * k));
  const g = cv.getContext("2d");
  if (g === null) return;
  g.setTransform(cv.width / w, 0, 0, cv.height / h, 0, 0);
  g.imageSmoothingQuality = "high";
  const [st, sr, sb, sl] = PANEL_SLICE;
  const [dt, dr, db, dl] = PANEL_DST;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const sx = [0, sl, iw - sr, iw];
  const sy = [0, st, ih - sb, ih];
  const dx = [0, dl, w - dr, w];
  const dy = [0, dt, h - db, h];
  const o = 1.0; // 겹침 (화면 px)
  // 가운데 → 변 → 모서리 순서 (모서리가 맨 위)
  const order = [[1, 1], [0, 1], [2, 1], [1, 0], [1, 2], [0, 0], [2, 0], [0, 2], [2, 2]];
  for (const [i, j] of order) {
    const x0 = dx[i] - (i > 0 ? o : 0);
    const x1 = dx[i + 1] + (i < 2 ? o : 0);
    const y0 = dy[j] - (j > 0 ? o : 0);
    const y1 = dy[j + 1] + (j < 2 ? o : 0);
    if (x1 <= x0 || y1 <= y0) continue;
    g.drawImage(img, sx[i], sy[j], sx[i + 1] - sx[i], sy[j + 1] - sy[j], x0, y0, x1 - x0, y1 - y0);
  }
}

/** 말풍선 그림 버튼 (글자는 게임이 씀) */
function tutButton(text: string, kind: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = `tut-btn ${kind}`;
  b.textContent = text;
  return b;
}

/** 두 네모가 겹치는 넓이 */
function overlapArea(a: R, b: R): number {
  return Math.max(0, Math.min(a.endX, b.endX) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.endY, b.endY) - Math.max(a.y, b.y));
}

/** 말풍선 배치: faceUp = 볼 옆 위 (꼬리가 말풍선 아래쪽에서 볼로) · faceDown = 볼 옆 아래 (꼬리가 위쪽에서) · high = 머리 위 · top = 맨 위 */
type GuideMode = "faceUp" | "faceDown" | "high" | "top";
interface GuideLayout {
  side: "left" | "right";
  fig: R;
  say: R;
  /** below = 옆 꼬리가 말풍선 아래쪽 · above = 옆 꼬리가 위쪽 (위아래 뒤집음) · down = 아래 꼬리 */
  tail: "below" | "above" | "down" | "none";
}
const HAND_SVG =`<svg viewBox="0 0 64 64"><path d="M26 6c3 0 5 2 5 5v18l3-1c3-1 6 1 6 4l3-1c3 0 5 2 5 5l2 0c3 0 5 3 5 6v8c0 8-6 14-14 14h-6c-5 0-9-3-11-7L9 39c-2-3 0-7 4-7 2 0 4 1 5 3l3 4V11c0-3 2-5 5-5z" fill="#fff" stroke="#3b2415" stroke-width="3.5" stroke-linejoin="round"/></svg>`;

export const TUTORIAL_CSS = `
@keyframes tut-ring { 0%, 100% { box-shadow: 0 0 0 4px rgba(255,216,90,0.95), 0 0 26px 8px rgba(255,200,60,0.75); } 50% { box-shadow: 0 0 0 9px rgba(255,216,90,0.55), 0 0 44px 16px rgba(255,200,60,0.45); } }
@keyframes tut-hand { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(0, -18px); } }
.tut { position: absolute; inset: 0; z-index: 60; pointer-events: none; }
.tut-block { position: absolute; pointer-events: auto; background: rgba(12,6,3,0.58); }
.tut-ring { position: absolute; border-radius: 22px; border: 5px solid #ffd85a; pointer-events: none; animation: tut-ring 1.1s ease-in-out infinite; }
.tut-hand { position: absolute; width: 96px; height: 96px; pointer-events: none; animation: tut-hand 0.8s ease-in-out infinite; filter: drop-shadow(0 6px 6px rgba(0,0,0,0.5)); }
.tut-hand.down { rotate: 180deg; }
@keyframes tut-imo-in { from { translate: 0 60%; } to { translate: 0 0; } }
@keyframes tut-say-in { 0% { scale: 0.7; opacity: 0; } 70% { scale: 1.03; opacity: 1; } 100% { scale: 1; } }
.tut-imo { position: absolute; pointer-events: none; filter: drop-shadow(0 0 3px rgba(40,20,8,0.9)) drop-shadow(0 10px 18px rgba(0,0,0,0.55));
  animation: tut-imo-in 0.42s cubic-bezier(.2,.9,.3,1.15) both; }
.tut-imo img { display: block; width: 100%; height: 100%; -webkit-user-drag: none; }
.tut-imo.flip img { transform: scaleX(-1); }
.tut-say { position: absolute; box-sizing: border-box; pointer-events: auto; padding: 48px 54px 30px 54px;
  filter: drop-shadow(0 10px 16px rgba(0,0,0,0.4)); }
.tut-bg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: -1; pointer-events: none; }
.tut-say.pop { animation: tut-say-in 0.28s cubic-bezier(.2,.9,.3,1.2) both; }
.tut-name { position: absolute; left: ${Math.round(58 * ART_S)}px; top: ${Math.round(-53 * ART_S)}px; width: ${Math.round(422 * ART_S)}px; height: ${Math.round(113 * ART_S)}px;
  box-sizing: border-box; padding: 0 22px 4px; display: flex; align-items: center; justify-content: center;
  background: url(assets/art/ui/tut_tag.webp) center / 100% 100% no-repeat; color: #fff0d0; font-size: 31px; white-space: nowrap;
  -webkit-text-stroke: 7px #4a2414; paint-order: stroke fill; }
.tut-btns { display: flex; justify-content: flex-end; align-items: center; gap: 12px; margin-top: 16px; }
.tut-btn { pointer-events: auto; box-sizing: border-box; font-family: inherit; cursor: pointer; white-space: nowrap; border: 0;
  background: center / 100% 100% no-repeat; transition: filter 0.12s, transform 0.08s; }
.tut-btn:hover { filter: brightness(1.07); }
.tut-btn:active { transform: translateY(3px); }
.tut-ok { min-width: ${Math.round(371 * ART_S)}px; height: ${Math.round(151 * ART_S)}px; padding: 0 34px 16px;
  background-image: url(assets/art/ui/tut_ok.webp);
  color: #fff0d0; font-size: 36px; -webkit-text-stroke: 7px #4a2414; paint-order: stroke fill; }
.tut-skip { min-width: ${Math.round(258 * ART_S)}px; height: ${Math.round(140 * ART_S)}px; padding: 0 26px 16px;
  background-image: url(assets/art/ui/tut_skip.webp);
  color: #2c1a10; font-size: 26px; }
.tut-tail { position: absolute; pointer-events: none; }
.tut-tail svg { display: block; width: 100%; height: 100%; overflow: visible; transform: scale(var(--sx, 1), var(--sy, 1)); }
@media (prefers-reduced-motion: reduce) { .tut-ring, .tut-hand, .tut-imo, .tut-say.pop { animation: none; } }
`;

export class Tutorial {
  private root: HTMLDivElement;
  private blocks: HTMLDivElement[] = [];
  private ring: HTMLDivElement;
  private hand: HTMLDivElement;
  private box: HTMLDivElement;
  private imo: HTMLDivElement;
  private tail: HTMLDivElement;
  private bg!: HTMLCanvasElement;
  private bgSize = "";
  private textEl!: HTMLDivElement;
  private buttons!: HTMLDivElement;
  private i = -1;
  /** 이 단계에서 고른 이모 자리 (단계가 바뀌면 다시 고름) */
  private guideChoice: { side: "left" | "right"; mode: GuideMode } | null = null;
  private finished = false;
  private scene: Scene;
  private steps: TutStep[];
  private onFinish: () => void;

  constructor(scene: Scene, steps: TutStep[], onFinish: () => void = () => {}) {
    this.scene = scene;
    this.steps = steps;
    this.onFinish = onFinish;
    this.root = Ui.div("tut");
    for (let k = 0; k < 4; k++) {
      const b = Ui.div("tut-block");
      // 덮개를 눌러도 아무 일 없게 (아래로 안 감)
      b.addEventListener("pointerdown", (e) => e.stopPropagation());
      this.blocks.push(b);
      this.root.appendChild(b);
    }
    this.ring = Ui.div("tut-ring");
    this.hand = Ui.div("tut-hand");
    this.hand.innerHTML = HAND_SVG;
    this.imo = Ui.div("tut-imo");
    const img = new Image();
    img.alt = "";
    img.onerror = () => (this.imo.style.visibility = "hidden");
    img.src = IMO_SRC;
    this.imo.appendChild(img);
    this.tail = Ui.div("tut-tail");
    this.box = this.buildBox();
    this.root.append(this.ring, this.hand, this.imo, this.box, this.tail);
    scene.ui.appendChild(this.root);
    this.go(0);
  }

  active(): boolean {
    return !this.finished;
  }

  /** 지금 단계가 이 이벤트를 기다리면 다음으로 */
  onEvent(name: string): void {
    if (this.finished) return;
    const st = this.steps[this.i];
    if (st?.wait === name) this.advance();
  }

  /** 지금 기다리는 이벤트 이름 */
  waiting(): string {
    return this.finished ? "" : (this.steps[this.i]?.wait ?? "");
  }

  /** 매 프레임: 가리킬 곳이 움직이면 (지도 밀기·애니메이션) 구멍을 따라 옮긴다 */
  update(): void {
    if (this.finished) return;
    this.layout();
  }

  skipAll(): void {
    GameState.setTutorial("");
    this.close();
  }

  close(): void {
    if (this.finished) return;
    this.finished = true;
    this.root.remove();
    this.onFinish();
  }

  /** 말풍선: 이름표 + 설명 + 아래 오른쪽에 다음·건너뛰기 */
  private buildBox(): HTMLDivElement {
    const p = Ui.div("tut-say");
    this.bg = document.createElement("canvas");
    this.bg.className = "tut-bg";
    p.appendChild(this.bg);
    if (panelImg === null) {
      panelImg = new Image();
      panelImg.src = PANEL_SRC;
    }
    if (!panelImg.complete) panelImg.addEventListener("load", () => {
      this.bgSize = "";
      if (!this.finished) this.layout();
    }, { once: true });
    const name = Ui.div("tut-name");
    name.textContent = "포장마차 이모";
    p.appendChild(name);
    this.textEl = Ui.label("", 32, Ui.INK, "left", true);
    p.appendChild(this.textEl);
    this.buttons = Ui.div("tut-btns");
    p.appendChild(this.buttons);
    return p;
  }

  private go(i: number): void {
    this.i = i;
    this.guideChoice = null;
    if (i >= this.steps.length) {
      this.close();
      return;
    }
    const st = this.steps[i];
    Ui.setText(this.textEl, st.text);
    this.buttons.replaceChildren();
    if (st.next !== undefined) {
      const nb = tutButton(st.next, "tut-ok");
      Ui.lively(nb);
      Ui.onPress(nb, () => this.advance());
      this.buttons.appendChild(nb);
    }
    const skip = tutButton("건너뛰기", "tut-skip");
    Ui.onPress(skip, () => this.skipAll());
    this.buttons.appendChild(skip);
    // 말이 바뀔 때마다 말풍선이 톡 튀어나옴
    this.box.classList.remove("pop");
    void this.box.offsetWidth;
    this.box.classList.add("pop");
    this.layout();
  }

  private advance(): void {
    const st = this.steps[this.i];
    st?.done?.();
    if (!this.finished) this.go(this.i + 1);
  }

  private layout(): void {
    const st = this.steps[this.i];
    if (st === undefined) return;
    const vw = this.scene.vw;
    const vh = this.scene.vh;
    const t = st.target?.() ?? null;
    const [top, bottom, left, right] = this.blocks;
    const show = (e: HTMLElement, on: boolean) => (e.style.display = on ? "" : "none");
    const place = (e: HTMLElement, x: number, y: number, w: number, h: number) => Ui.place(e, x, y, Math.max(0, w), Math.max(0, h));
    if (t === null) {
      // 가리킬 곳 없음: 전체 덮개 + 이모가 크게 나와서 말만
      for (const b of this.blocks) show(b, false);
      show(top, !st.passive);
      place(top, 0, 0, vw, vh);
      top.style.clipPath = "";
      show(this.ring, false);
      show(this.hand, false);
      this.placeGuide(st, []);
      return;
    }
    const pad = 12;
    const h = new R(t.x - pad, t.y - pad, t.w + pad * 2, t.h + pad * 2);
    // 덮개 한 장에 구멍을 뚫는다 (clip-path evenodd — 조각을 이어 붙이면 화면을 줄였다 키울 때 이음매 선이 보임).
    // 잘린 부분은 누를 수도 없어서 구멍 안 입력은 아래 화면으로 간다
    for (const b of this.blocks) show(b, false);
    show(top, !st.passive);
    place(top, 0, 0, vw, vh);
    top.style.clipPath = `polygon(evenodd, 0 0, ${vw}px 0, ${vw}px ${vh}px, 0 ${vh}px, 0 0, ${h.x}px ${h.y}px, ${h.x}px ${h.endY}px, ${h.endX}px ${h.endY}px, ${h.endX}px ${h.y}px, ${h.x}px ${h.y}px)`;
    void bottom;
    void left;
    void right;
    show(this.ring, true);
    place(this.ring, h.x, h.y, h.w, h.h);
    // 손가락: 구멍 위에서 아래를 가리킴 (구멍이 화면 위쪽이면 아래에서 위로)
    show(this.hand, true);
    // 손 그림(HAND_SVG)은 손가락이 위를 향함 (끝 = x 26 / 64). 구멍 아래에 둘 땐 그대로 위로 가리키고,
    // 구멍 위에 둘 땐 180° 돌려 아래로 가리킴 (2026-11-18 사용자 "화살표가 가리키는 방향이 안 맞아" — 전에는 반대로 돌아 있었음).
    // 손가락 끝이 구멍 가운데에 오게 x 를 맞춤 (돌리면 끝이 64 − 26 = 38 자리)
    const below = h.y < 200;
    this.hand.classList.toggle("down", !below);
    const tipX = ((below ? 26 : 38) / 64) * 96;
    const handR = new R(h.center().x - tipX, below ? h.endY + 4 : h.y - 100, 96, 96);
    this.hand.style.left = `${handR.x}px`;
    this.hand.style.top = `${handR.y}px`;
    this.placeGuide(st, [h, handR]);
  }

  /**
   * 이모 + 말풍선 + 꼬리 놓기: 피할 곳(avoid[0] 가리키는 곳, avoid[1] 손가락)과 겹치지 않는 첫 배치.
   * 다 겹치면 덜 가리는 배치 (가리키는 곳을 가리는 게 손가락보다 훨씬 나쁨)
   */
  private placeGuide(st: TutStep, avoid: R[]): void {
    const vw = this.scene.vw;
    const big = avoid.length === 0;
    const sw = Math.min(SAY_W, vw - 440);
    this.box.style.width = `${sw}px`;
    const sh = this.box.offsetHeight || 240;
    // 종이 판 (크기·배율이 바뀔 때만 다시 그림)
    const k = (this.scene.game.scale || 1) * (window.devicePixelRatio || 1);
    const key = `${sw}x${sh}@${k.toFixed(3)}`;
    if (key !== this.bgSize && panelImg !== null && panelImg.complete && panelImg.naturalWidth > 0) {
      paintPanel(this.bg, panelImg, sw, sh, k);
      this.bgSize = key;
    }
    const target = avoid[0] ?? null;
    const score = (L: GuideLayout): number => {
      let s = 0;
      avoid.forEach((a, i) => (s += (overlapArea(a, L.fig) + overlapArea(a, L.say)) * (i === 0 ? 8 : 1)));
      return s;
    };
    // 한 단계 안에서는 고른 자리를 그대로 (2026-11-18 사용자 "이모가 왼쪽으로 갔다 오른쪽으로 갔다 해"):
    // 가리키는 곳이 움직이면 (흔들리는 "준비 중" 팻말은 화면 가운데를 오가서) 매 프레임 다시 고르면 왼쪽·오른쪽을 왔다 갔다 함.
    // 지금 자리가 여전히 아무것도 안 가리고, 단계가 원하는 쪽(boxSide)도 그대로면 유지
    const want = st.boxSide?.() ?? null;
    const kept = this.guideChoice;
    if (kept !== null && (want === null || want === kept.side)) {
      const L = this.guideLayout(kept.side, kept.mode, sw, sh, big);
      if (score(L) === 0) {
        this.applyGuide(L);
        return;
      }
    }
    const pref: "left" | "right" = want ?? (target === null || target.center().x > vw * 0.5 ? "left" : "right");
    const other: "left" | "right" = pref === "left" ? "right" : "left";
    let best: GuideLayout | null = null;
    let bestMode: GuideMode = "faceUp";
    let bestScore = Infinity;
    const modes: GuideMode[] = ["faceUp", "faceDown", "high", "top"];
    for (const mode of modes) {
      for (const side of [pref, other]) {
        const L = this.guideLayout(side, mode, sw, sh, big);
        const sc = score(L);
        if (sc < bestScore) {
          best = L;
          bestMode = mode;
          bestScore = sc;
        }
        if (sc === 0) break;
      }
      if (bestScore === 0) break;
    }
    this.guideChoice = { side: best!.side, mode: bestMode };
    this.applyGuide(best!);
  }

  /** 고른 배치대로 이모·말풍선·꼬리 놓기 */
  private applyGuide(ok: GuideLayout): void {
    Ui.place(this.imo, ok.fig.x, ok.fig.y, ok.fig.w, ok.fig.h);
    this.imo.classList.toggle("flip", ok.side === "right");
    this.box.style.left = `${ok.say.x}px`;
    this.box.style.top = `${ok.say.y}px`;
    const tl = this.tail;
    tl.style.display = ok.tail === "none" ? "none" : "";
    if (ok.tail === "none") return;
    const flip = ok.side === "right";
    const kind = ok.tail === "down" ? "down" : "side";
    if (tl.dataset.kind !== kind) {
      tl.innerHTML = kind === "side" ? TAIL_SIDE : TAIL_DOWN;
      tl.dataset.kind = kind;
    }
    tl.style.setProperty("--sx", flip ? "-1" : "1");
    tl.style.setProperty("--sy", ok.tail === "above" ? "-1" : "1");
    if (kind === "side") {
      // 꼬리 x 100 (테두리 자리)이 말풍선 왼쪽 테두리에 (뒤집으면 오른쪽, 뒤집힌 그림에서는 x 16). 아래쪽 꼬리는 아래에서 110 위, 위쪽 꼬리는 위아래 거울
      const x = flip ? ok.say.endX - BORDER_IN - 16 * TAIL_S : ok.say.x + BORDER_IN - 100 * TAIL_S;
      const y = ok.tail === "below" ? ok.say.endY - 110 : ok.say.y + 110 - 80 * TAIL_S;
      Ui.place(tl, x, y, 116 * TAIL_S, 80 * TAIL_S);
    } else {
      const w = 80 * TAIL_S;
      const x = flip ? ok.say.endX - 70 - w : ok.say.x + 70;
      Ui.place(tl, x, ok.say.endY - BORDER_IN - 16 * TAIL_S, w, 116 * TAIL_S);
    }
  }

  /** 배치 하나: 이모는 그 쪽 아래 구석 (그림 아래가 잘린 상반신이라 화면 아래에 붙임), 말풍선은 mode 자리 */
  private guideLayout(side: "left" | "right", mode: GuideMode, sw: number, sh: number, big: boolean): GuideLayout {
    const vw = this.scene.vw;
    const vh = this.scene.vh;
    const fh = Math.round(Math.min(vh * (big ? 0.54 : 0.46), big ? 590 : 500));
    const fw = Math.round(fh * IMO_ASPECT);
    const fx = side === "left" ? 6 : vw - fw - 6;
    const fy = vh - fh;
    const fig = new R(fx, fy, fw, fh);
    const cheekX = side === "left" ? fx + fw * IMO_CHEEK.x : fx + fw * (1 - IMO_CHEEK.x);
    const cheekY = fy + fh * IMO_CHEEK.y;
    let x: number;
    let y: number;
    let tail: GuideLayout["tail"];
    if (mode === "faceUp" || mode === "faceDown") {
      // 꼬리 끝 (2, 74) 이 볼 옆에: 꼬리 끝은 말풍선 테두리에서 98 바깥, 아래쪽 꼬리면 말풍선 아래에서 110 위 (위쪽이면 거울)
      x = side === "left" ? cheekX - BORDER_IN + 98 * TAIL_S : cheekX + BORDER_IN - 98 * TAIL_S - sw;
      y = mode === "faceUp" ? cheekY - 74 * TAIL_S + 110 - sh : cheekY - 110 + 74 * TAIL_S;
      tail = mode === "faceUp" ? "below" : "above";
    } else if (mode === "high") {
      x = side === "left" ? fx + fw * 0.42 - 70 : fx + fw * 0.58 + 70 - sw;
      y = fy - sh + 10;
      tail = "down";
    } else {
      x = side === "left" ? fx + fw * 0.3 : fx + fw * 0.7 - sw;
      y = 20;
      tail = "none";
    }
    x = Math.max(16, Math.min(vw - sw - 16, x));
    y = Math.max(30, Math.min(vh - sh - 10, y));
    return { side, fig, say: new R(x, y, sw, sh), tail };
  }
}
