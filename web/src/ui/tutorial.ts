// 처음 하는 사람 튜토리얼 (2026-11-16 사용자: "처음 할 때는 가게 재료 구매, 장비 업그레이드, 손님에게 음식 만들어 주는
// 튜토리얼 과정이 나오면서 UI로 설명"). 화면을 어둡게 덮고 눌러야 할 곳만 구멍을 뚫어 빛나는 테두리 + 손가락으로 가리키고,
// 포장마차 이모가 말풍선 창으로 설명한다. 덮개는 구멍 밖 입력을 막고, 구멍 안은 그대로 아래 화면(캔버스·버튼)으로 간다.
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
  /** 말 창 자리를 정함 (영업 화면은 손님·주문 말풍선을 가리지 않게 맨 위) */
  boxAt?: "top" | "bottom";
  /** 말 창을 좁게 해서 왼쪽/오른쪽 위에 (손님 주문 말풍선을 피함) */
  boxSide?: () => "left" | "right" | null;
}

/** HTML 요소의 설계 좌표 네모 (장면 UI 기준) */
export function elementRect(el: HTMLElement, scene: Scene): R {
  const k = scene.game.scale || 1;
  const base = scene.ui.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return new R((r.left - base.left) / k, (r.top - base.top) / k, r.width / k, r.height / k);
}

const GUIDE_SVG = `<svg viewBox="0 0 64 64"><path d="M14 26c-6 0-8-8-2-11 1-7 10-9 14-5 3-5 12-5 15 0 5-3 12 0 12 6 6 2 5 11-2 11z" fill="#fff" stroke="#3b2415" stroke-width="3" stroke-linejoin="round"/><rect x="16" y="24" width="32" height="7" rx="2" fill="#f3ead8" stroke="#3b2415" stroke-width="3"/><circle cx="32" cy="43" r="16" fill="#ffd9b8" stroke="#3b2415" stroke-width="3"/><circle cx="26" cy="41" r="2.4" fill="#3b2415"/><circle cx="38" cy="41" r="2.4" fill="#3b2415"/><path d="M26 49q6 5 12 0" fill="none" stroke="#3b2415" stroke-width="2.6" stroke-linecap="round"/><circle cx="21" cy="47" r="3" fill="#ff8a7a" opacity="0.6"/><circle cx="43" cy="47" r="3" fill="#ff8a7a" opacity="0.6"/></svg>`;
const HAND_SVG = `<svg viewBox="0 0 64 64"><path d="M26 6c3 0 5 2 5 5v18l3-1c3-1 6 1 6 4l3-1c3 0 5 2 5 5l2 0c3 0 5 3 5 6v8c0 8-6 14-14 14h-6c-5 0-9-3-11-7L9 39c-2-3 0-7 4-7 2 0 4 1 5 3l3 4V11c0-3 2-5 5-5z" fill="#fff" stroke="#3b2415" stroke-width="3.5" stroke-linejoin="round"/></svg>`;

export const TUTORIAL_CSS = `
@keyframes tut-ring { 0%, 100% { box-shadow: 0 0 0 4px rgba(255,216,90,0.95), 0 0 26px 8px rgba(255,200,60,0.75); } 50% { box-shadow: 0 0 0 9px rgba(255,216,90,0.55), 0 0 44px 16px rgba(255,200,60,0.45); } }
@keyframes tut-hand { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(0, -18px); } }
.tut { position: absolute; inset: 0; z-index: 60; pointer-events: none; }
.tut-block { position: absolute; pointer-events: auto; background: rgba(12,6,3,0.58); }
.tut-ring { position: absolute; border-radius: 22px; border: 5px solid #ffd85a; pointer-events: none; animation: tut-ring 1.1s ease-in-out infinite; }
.tut-hand { position: absolute; width: 96px; height: 96px; pointer-events: none; animation: tut-hand 0.8s ease-in-out infinite; filter: drop-shadow(0 6px 6px rgba(0,0,0,0.5)); }
.tut-hand.up { rotate: 180deg; }
.tut-box { position: absolute; left: 50%; transform: translateX(-50%); width: 1180px; pointer-events: auto; }
@media (prefers-reduced-motion: reduce) { .tut-ring, .tut-hand { animation: none; } }
`;

export class Tutorial {
  private root: HTMLDivElement;
  private blocks: HTMLDivElement[] = [];
  private ring: HTMLDivElement;
  private hand: HTMLDivElement;
  private box: HTMLDivElement;
  private textEl!: HTMLDivElement;
  private buttons!: HTMLDivElement;
  private i = -1;
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
    this.box = this.buildBox();
    this.root.append(this.ring, this.hand, this.box);
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

  private buildBox(): HTMLDivElement {
    const p = Ui.panel(Ui.PAPER, 30, 24);
    p.classList.add("tut-box");
    const row = Ui.hbox(22);
    row.style.alignItems = "center";
    p.appendChild(row);
    const face = Ui.icon(GUIDE_SVG, 120);
    face.style.flex = "0 0 auto";
    row.appendChild(face);
    const col = Ui.vbox(8);
    col.style.flex = "1 1 auto";
    row.appendChild(col);
    col.appendChild(Ui.heading("포장마차 이모", 30, Ui.ACCENT, null, "left"));
    this.textEl = Ui.label("", 32, Ui.INK, "left", true);
    col.appendChild(this.textEl);
    this.buttons = Ui.vbox(10);
    this.buttons.style.flex = "0 0 auto";
    row.appendChild(this.buttons);
    return p;
  }

  private go(i: number): void {
    this.i = i;
    if (i >= this.steps.length) {
      this.close();
      return;
    }
    const st = this.steps[i];
    Ui.setText(this.textEl, st.text);
    this.buttons.replaceChildren();
    if (st.next !== undefined) {
      const nb = Ui.button(st.next, Ui.ACCENT, 32, 92);
      nb.style.minWidth = "200px";
      Ui.lively(nb);
      Ui.onPress(nb, () => this.advance());
      this.buttons.appendChild(nb);
    }
    const skip = Ui.button("건너뛰기", Ui.SECONDARY, 24, 70);
    Ui.onPress(skip, () => this.skipAll());
    this.buttons.appendChild(skip);
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
      // 가리킬 곳 없음: 전체 덮개 + 가운데 말
      for (const b of this.blocks) show(b, false);
      show(top, !st.passive);
      place(top, 0, 0, vw, vh);
      top.style.clipPath = "";
      show(this.ring, false);
      show(this.hand, false);
      this.box.style.top = `${vh * 0.5 - 110}px`;
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
    const below = h.y < 200;
    this.hand.classList.toggle("up", below);
    this.hand.style.left = `${h.center().x - 48}px`;
    this.hand.style.top = below ? `${h.endY + 6}px` : `${h.y - 102}px`;
    // 말 창: 구멍과 겹치지 않는 쪽 (구멍이 아래 절반이면 위에, 아니면 아래에)
    const boxH = this.box.offsetHeight || 200;
    const atTop = h.center().y > vh * 0.5;
    const side = st.boxSide?.() ?? null;
    if (side !== null) {
      this.box.style.width = "760px";
      this.box.style.transform = "none";
      this.box.style.left = side === "left" ? "20px" : `${vw - 780}px`;
    } else {
      this.box.style.width = "";
      this.box.style.transform = "";
      this.box.style.left = "";
    }
    if (st.boxAt === "top") this.box.style.top = "6px";
    else if (st.boxAt === "bottom") this.box.style.top = `${vh - boxH - 10}px`;
    else this.box.style.top = atTop ? `${Math.max(24, Math.min(h.y - boxH - 120, 150))}px` : `${Math.min(vh - boxH - 24, Math.max(h.endY + 110, vh - boxH - 40))}px`;
  }
}
