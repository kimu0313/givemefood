// 장보기 = 재료 가게 (2026-11-20 사용자 예시 그림 "이런 형태로 마켓 있고 주인장 있고 구매하는 거였으면"):
// 가게마다 따로 있지 않고 하나 (같은 날 사용자 "모든 가게 재료를 거기서 다 살 수 있게"): 왼쪽 가게 탭 5개로 가게를 고름
// (안 연 가게는 잠김, 다음 스테이지 재료가 모자란 가게엔 "!"). 지도 위쪽 막대의 "장보기" 버튼 하나로 들어옴.
// 왼쪽 나무 진열장 2줄 × 3칸 (메뉴 재료 4칸 · 마법의 가루 · 다음 스테이지 재료 세트), 칸마다 재료 그림 + 선반 위 가격표(누르면 +5인분)
// + 선반 앞 이름표 + 왼쪽 위 남은 재료 · 오른쪽 위 "가득". 오른쪽엔 주인장(포장마차 이모 그림)이 계산대 뒤에 서서 말풍선으로 말하고,
// 계산대 화면에 지갑. 아래 나무판엔 다음 스테이지 재료 준비 막대. 오른쪽 위 X = 지도로.
// 아직 안 열린 메뉴는 잠김. 지갑보다 비싸면 가격표가 꺼짐 (외상은 스테이지 창의 "모자란 재료 사기"에서만).
// (예전 장보기 = 종이 카드 4장 + 마법의 가루 카드 + 아래 버튼 줄)

import { R, rgb, v } from "../engine/geom.ts";
import type { Gfx } from "../engine/gfx.ts";
import { Scene } from "../engine/game.ts";
import { Node2D } from "../engine/node.ts";
import { Sound } from "../engine/audio.ts";
import * as Ui from "../engine/ui.ts";
import * as D from "../core/defs.ts";
import { GameState } from "../state/game_state.ts";
import { StreetArt } from "../art/street_art.ts";
import { ROOT } from "../art/art_assets.ts";
import { Tutorial, elementRect, type TutStep } from "./tutorial.ts";

const OWNER_SRC = "assets/art/ui/imo.webp"; // 주인장 = 포장마차 이모 (520×803)
const CLOSE_SVG = `<svg viewBox="0 0 48 48"><path d="M13 13l22 22M35 13L13 35" stroke="#3b2415" stroke-width="13" stroke-linecap="round"/><path d="M13 13l22 22M35 13L13 35" stroke="#fff6e4" stroke-width="6" stroke-linecap="round"/></svg>`;
const BASKET_SVG = `<svg viewBox="0 0 120 80"><path d="M30 30 Q60 -6 90 30" fill="none" stroke="#3b2415" stroke-width="9"/><path d="M30 30 Q60 -6 90 30" fill="none" stroke="#c98c4a" stroke-width="4"/><path d="M8 30h104l-12 44H20z" fill="#c98c4a" stroke="#3b2415" stroke-width="5" stroke-linejoin="round"/><path d="M14 44h92M18 58h84M38 30l-4 44M60 30v44M82 30l4 44" stroke="#8d5a26" stroke-width="3.5"/><rect x="4" y="24" width="112" height="12" rx="6" fill="#e0a865" stroke="#3b2415" stroke-width="5"/></svg>`;

const CSS = `
.mk { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; pointer-events: none; color: #3b2415; }
.mk button { pointer-events: auto; font-family: inherit; cursor: pointer; }
.mk-wood { background: repeating-linear-gradient(180deg, rgba(255,255,255,0.05) 0 3px, rgba(0,0,0,0.05) 3px 9px), linear-gradient(180deg, #9a5629, #7b3f1b 60%, #63300f); }
.mk-shelf { position: absolute; left: 212px; top: 150px; width: 1070px; height: 732px; box-sizing: border-box; border: 6px solid #3b2415; border-radius: 16px;
  padding: 22px 26px 0; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, 1fr); column-gap: 22px;
  box-shadow: inset 0 4px 0 rgba(255,214,160,0.25), 0 14px 0 rgba(30,14,6,0.6), 0 26px 40px rgba(0,0,0,0.55); }
.mk-beam { position: absolute; left: 188px; top: 122px; width: 1118px; height: 50px; box-sizing: border-box; border: 6px solid #3b2415; border-radius: 12px;
  box-shadow: inset 0 4px 0 rgba(255,220,170,0.3), 0 8px 0 rgba(30,14,6,0.5); z-index: 2; }
.mk-cell { position: relative; display: flex; flex-direction: column; min-width: 0; pointer-events: auto; }
.mk-back { position: relative; flex: 1 1 auto; border: 5px solid #3b2415; border-bottom: none; border-radius: 12px 12px 0 0; overflow: hidden;
  background: radial-gradient(ellipse at 50% 42%, #d8604a 0%, #a8382a 58%, #6e1f17 100%); /* 2026-11-20 사용자 "장보기 UI 빨간색으로" (예전 청록) */
  box-shadow: inset 0 14px 22px rgba(0,0,0,0.38), inset 0 -10px 16px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; padding-bottom: 58px; }
.mk-back.magic { background: radial-gradient(ellipse at 50% 42%, #9a78cc 0%, #6c4c9c 58%, #43296a 100%); }
.mk-back.set { background: radial-gradient(ellipse at 50% 42%, #c9a26a 0%, #9c7442 58%, #6a4826 100%); }
.mk-pic { max-width: 76%; max-height: 82%; object-fit: contain; filter: drop-shadow(0 10px 8px rgba(0,0,0,0.4)); pointer-events: none; }
.mk-magic { width: 150px; height: 150px; filter: drop-shadow(0 10px 8px rgba(0,0,0,0.4)); animation: mk-float 2.6s ease-in-out infinite; }
.mk-magic svg, .mk-basket svg { width: 100%; height: 100%; }
.mk-basket { position: relative; width: 250px; height: 170px; margin-top: 46px; }
.mk-basket .bk { position: absolute; left: 0; bottom: 0; width: 250px; height: 124px; }
.mk-basket img { position: absolute; width: 96px; height: 76px; object-fit: contain; filter: drop-shadow(0 4px 3px rgba(0,0,0,0.35)); }
.mk-plank { position: relative; height: 62px; margin: 0 -16px 24px; box-sizing: border-box; border: 5px solid #3b2415; border-radius: 9px;
  display: flex; align-items: center; justify-content: center; box-shadow: inset 0 4px 0 rgba(255,220,170,0.28), 0 8px 0 rgba(30,14,6,0.5); }
.mk-name { padding: 2px 18px 4px; border-radius: 9px; background: #f3e2c2; border: 4px solid #3b2415; font-size: 27px; line-height: 1.15; white-space: nowrap;
  box-shadow: 0 4px 0 rgba(30,14,6,0.35); max-width: 300px; overflow: hidden; text-overflow: ellipsis; }
.mk-price { position: absolute; left: 50%; bottom: 74px; transform: translateX(-50%); z-index: 3; display: flex; align-items: center; gap: 8px;
  padding: 6px 22px 8px 14px; border-radius: 14px; border: 5px solid #3b2415; background: linear-gradient(180deg, #fff8e8, #f1dcb4);
  box-shadow: 0 6px 0 #8a5a2e, 0 10px 14px rgba(0,0,0,0.35); white-space: nowrap; transition: transform 0.08s, filter 0.12s; }
.mk-price:hover { filter: brightness(1.06); transform: translateX(-50%) translateY(-3px); }
.mk-price:active { transform: translateX(-50%) translateY(3px); box-shadow: 0 2px 0 #8a5a2e, 0 4px 8px rgba(0,0,0,0.35); }
.mk-price .ic { width: 44px; height: 44px; }
.mk-price .num { font-size: 40px; line-height: 1; color: #3b2415; }
.mk-price .unit { font-size: 23px; color: #7a5638; margin-left: 2px; }
.mk-price.free { background: linear-gradient(180deg, #e9ffd8, #b9e79a); box-shadow: 0 6px 0 #3f7a2a, 0 10px 14px rgba(0,0,0,0.35); }
.mk-price:disabled { cursor: default; filter: grayscale(0.85) brightness(0.86); transform: translateX(-50%); pointer-events: none; }
.mk-price.note { font-size: 26px; padding: 10px 20px; }
.mk-stock { position: absolute; left: 10px; top: 10px; padding: 4px 12px 6px; border-radius: 12px; background: rgba(30,16,8,0.78); border: 3px solid #3b2415;
  color: #fff3dc; font-size: 22px; line-height: 1.1; z-index: 2; }
.mk-stock .bar { margin-top: 4px; height: 9px; border-radius: 5px; background: rgba(255,255,255,0.18); overflow: hidden; }
.mk-stock .bar i { display: block; height: 100%; border-radius: 5px; }
.mk-full { position: absolute; right: 10px; top: 10px; z-index: 2; padding: 4px 14px 6px; border-radius: 12px; border: 3px solid #3b2415; white-space: pre-line;
  background: linear-gradient(180deg, #8fd36c, #4f9c34); color: #fff; font-size: 21px; line-height: 1.15; box-shadow: 0 4px 0 #2c5a1c; text-align: center; }
.mk-full:disabled { cursor: default; filter: grayscale(0.9) brightness(0.8); }
.mk-full:active { transform: translateY(3px); box-shadow: 0 1px 0 #2c5a1c; }
.mk-lock { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding-bottom: 50px;
  background: rgba(16,10,6,0.62); color: #f3e2c2; font-size: 26px; z-index: 2; }
.mk-sign { position: absolute; left: 747px; transform: translateX(-50%); top: 30px; min-width: 400px; padding: 0 40px; height: 84px; box-sizing: border-box; white-space: nowrap; border: 6px solid #3b2415; border-radius: 14px;
  display: flex; align-items: center; justify-content: center; color: #fbecd2; font-size: 46px; z-index: 3;
  -webkit-text-stroke: 8px #3b2415; paint-order: stroke fill; box-shadow: inset 0 4px 0 rgba(255,220,170,0.3), 0 8px 0 rgba(30,14,6,0.5); }
.mk-sign::before, .mk-sign::after { content: ""; position: absolute; top: -34px; width: 8px; height: 34px; background: #3b2415; }
.mk-sign::before { left: 60px; } .mk-sign::after { right: 60px; }
.mk-wallet { position: absolute; left: 40px; top: 26px; display: flex; align-items: center; gap: 10px; padding: 6px 28px 6px 12px; border-radius: 999px;
  background: rgba(40,22,12,0.9); border: 5px solid #3b2415; box-shadow: 0 6px 0 rgba(0,0,0,0.4); z-index: 3; }
.mk-close { position: absolute; right: 30px; top: 22px; width: 96px; height: 96px; border-radius: 50%; border: 6px solid #3b2415; padding: 14px;
  background: radial-gradient(circle at 40% 32%, #ffdca0, #e8a24e 70%, #c97a2c); box-shadow: 0 7px 0 #6b3a14, 0 12px 18px rgba(0,0,0,0.45); z-index: 5; }
.mk-close:active { transform: translateY(4px); box-shadow: 0 3px 0 #6b3a14; }
.mk-owner { position: absolute; left: 1336px; top: 262px; height: 800px; pointer-events: auto; cursor: pointer; transform-origin: 50% 100%;
  animation: mk-breathe 3.4s ease-in-out infinite; filter: drop-shadow(0 12px 18px rgba(0,0,0,0.45)); }
.mk-counter { position: absolute; left: 1262px; top: 896px; width: 680px; height: 200px; box-sizing: border-box; border: 6px solid #3b2415; border-radius: 14px 0 0 0;
  box-shadow: inset 0 6px 0 rgba(255,220,170,0.3), 0 -6px 16px rgba(0,0,0,0.35); }
.mk-counter::before { content: ""; position: absolute; left: 0; right: 0; top: 30px; height: 6px; background: #3b2415; opacity: 0.6; }
.mk-register { position: absolute; left: 1580px; top: 770px; width: 300px; height: 150px; box-sizing: border-box; border: 6px solid #3b2415; border-radius: 18px 18px 8px 8px;
  background: linear-gradient(180deg, #e0735a, #b8432f 60%, #8a2c1f); box-shadow: inset 0 5px 0 rgba(255,255,255,0.3), 0 8px 0 rgba(30,14,6,0.5); z-index: 2;
  display: flex; flex-direction: column; align-items: center; padding-top: 14px; gap: 6px; }
.mk-register .scr { width: 240px; height: 60px; border-radius: 10px; border: 5px solid #3b2415; background: linear-gradient(180deg, #1f2a22, #2d3b30);
  display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: inset 0 4px 8px rgba(0,0,0,0.6); }
.mk-register .scr .ic { width: 34px; height: 34px; }
.mk-register .lbl2 { font-size: 22px; color: #e9f6ea; }
.mk-say { position: absolute; left: 1286px; top: 122px; width: 520px; min-height: 96px; box-sizing: border-box; padding: 16px 26px 18px; border-radius: 28px;
  border: 5px solid #3b2415; background: #fff7e6; font-size: 29px; line-height: 1.32; text-align: center; white-space: pre-line; word-break: keep-all;
  box-shadow: 0 8px 0 rgba(30,14,6,0.35); z-index: 4; display: flex; align-items: center; justify-content: center; }
.mk-say::after { content: ""; position: absolute; left: 300px; bottom: -22px; width: 34px; height: 34px; background: #fff7e6;
  border-right: 5px solid #3b2415; border-bottom: 5px solid #3b2415; transform: rotate(45deg) skew(8deg, 8deg); }
.mk-say.pop { animation: mk-pop 0.28s cubic-bezier(.2,.9,.3,1.3); }
.mk-ready { position: absolute; left: 212px; top: 922px; width: 1030px; height: 126px; box-sizing: border-box; border: 6px solid #3b2415; border-radius: 16px;
  display: flex; align-items: center; gap: 26px; padding: 0 30px; box-shadow: inset 0 4px 0 rgba(255,220,170,0.28), 0 10px 0 rgba(30,14,6,0.55); }
.mk-ready .t { font-size: 30px; color: #fbecd2; -webkit-text-stroke: 6px #3b2415; paint-order: stroke fill; white-space: nowrap; }
.mk-ready .track { position: relative; flex: 1 1 auto; height: 34px; border-radius: 18px; border: 5px solid #3b2415; background: #4a2a14; overflow: hidden; }
.mk-ready .track i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 14px; background: linear-gradient(180deg, #a6e27c, #5aa83c); }
.mk-ready .track b { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 22px; color: #fff; font-weight: 400;
  -webkit-text-stroke: 4px #3b2415; paint-order: stroke fill; }
.mk-tabs { position: absolute; left: 16px; top: 150px; width: 182px; display: flex; flex-direction: column; gap: 14px; z-index: 2; }
.mk-tab { position: relative; height: 132px; box-sizing: border-box; border: 5px solid #3b2415; border-radius: 18px; padding: 6px 6px 8px;
  background: linear-gradient(180deg, #fbefd6, #e8cc9c); color: #3b2415; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px; font-size: 25px; line-height: 1.12; text-align: center; white-space: pre-line; word-break: keep-all;
  box-shadow: 0 6px 0 rgba(30,14,6,0.5); transition: transform 0.1s, filter 0.12s; }
.mk-tab:hover { filter: brightness(1.05); }
.mk-tab.on { background: radial-gradient(ellipse at 50% 40%, #d8604a, #9a3125); color: #fff3dc; transform: translateX(10px);
  -webkit-text-stroke: 5px #3b2415; paint-order: stroke fill; box-shadow: 0 6px 0 rgba(30,14,6,0.5), 0 0 0 4px #ffd36a; }
.mk-tab.locked { filter: grayscale(0.85) brightness(0.62); cursor: default; }
.mk-tab .n { width: 42px; height: 42px; flex: none; border-radius: 50%; border: 4px solid #3b2415; box-sizing: border-box; color: #fff; font-size: 24px;
  line-height: 34px; -webkit-text-stroke: 4px #3b2415; paint-order: stroke fill; }
.mk-tab .ic { width: 38px; height: 38px; }
.mk-tab .dot { position: absolute; right: -10px; top: -10px; width: 36px; height: 36px; border-radius: 50%; background: #e0412c; border: 4px solid #3b2415;
  color: #fff; font-size: 24px; line-height: 28px; -webkit-text-stroke: 0; }
.mk-cell.hot .mk-back { box-shadow: inset 0 14px 22px rgba(0,0,0,0.38), 0 0 0 6px #ffd36a, 0 0 26px 6px rgba(255,200,90,0.75); animation: mk-hot 1.1s ease-in-out infinite; }
/* 탭이 없을 때(영업 중) 진열장을 왼쪽으로 */
.mk.notabs .mk-shelf { left: 46px; width: 1236px; }
.mk.notabs .mk-beam { left: 22px; width: 1284px; }
.mk.notabs .mk-ready { left: 46px; width: 1196px; }
.mk.notabs .mk-sign { left: 664px; }
@keyframes mk-hot { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.18); } }
@keyframes mk-pop { from { transform: scale(0.82); } to { transform: scale(1); } }
@keyframes mk-breathe { 0%, 100% { transform: scale(1, 1); } 50% { transform: scale(1.006, 1.012); } }
@keyframes mk-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@media (prefers-reduced-motion: reduce) { .mk-owner, .mk-magic, .mk-say.pop, .mk-cell.hot .mk-back { animation: none; } }
`;
let cssAdded = false;
function addCss(): void {
  if (cssAdded || typeof document === "undefined") return;
  cssAdded = true;
  const s = document.createElement("style");
  s.textContent = CSS;
  document.head.appendChild(s);
}

/** 주인장이 가끔 하는 말 (주인장을 누르면 차례로) */
const TIPS = [
  `재료는 메뉴마다 ${D.STOCK_MAX}인분까지 쌓아 둘 수 있어요.`,
  "판매 가격은 영업 중에 위쪽 '가격표'에서 바꿔요.",
  "남은 재료는 다음 날에도 써요. 상하지 않으니 걱정 마요!",
  "재료가 떨어진 메뉴는 품절이라 손님이 안 시켜요.",
];

class Dim extends Node2D {
  size = v(1920, 1080);
  draw(g: Gfx): void {
    g.rect(new R(0, 0, this.size.x, this.size.y), rgb(0.05, 0.03, 0.02, 0.7));
  }
}

function el(tag: string, cls: string, parent?: HTMLElement): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  parent?.appendChild(e);
  return e;
}


/**
 * 재료 가게 화면이 돈·재료를 다루는 방법. 장보기(지도에서 들어옴)와 영업 중 품절 재료통(ShiftView)이 같은 화면을 쓰고
 * (2026-11-20 사용자 "인게임 가게에서 품절 재료 눌렀을 때 장보기랑 같은 화면 나오게"), 여기만 다르다.
 */
export interface MarketHooks {
  /** 영업 중 (가게 탭 없음 · 재료 세트 대신 "모두 가득" · 아래 판은 쓸 수 있는 돈 안내) */
  inShift: boolean;
  /** 지금 가진 재료 (영업 중엔 그 영업의 재료) */
  have(sid: string, mid: string): number;
  /** 더 담을 수 있는 양 */
  room(sid: string, mid: string): number;
  /** n인분 값 (튜토리얼 공짜 떡볶이 반영) */
  cost(sid: string, mid: string, n: number): number;
  /** 쓸 수 있는 돈 (영업 중 = 지갑 + 오늘 번 돈) */
  budget(): number;
  /** 사기 (성공하면 true) */
  buy(sid: string, mid: string, n: number): boolean;
  /** 가진 마법의 가루 */
  powder(): number;
  buyPowder(): boolean;
  /** 아래 판 안내 글 (영업 중) */
  note?(): string;
}

/** 지도에서 들어오는 장보기: 지갑으로만 */
export const STORE_HOOKS: MarketHooks = {
  inShift: false,
  have: (sid, mid) => GameState.stockOf(sid, mid),
  room: (sid, mid) => GameState.stockRoom(sid, mid),
  cost: (sid, mid, n) => GameState.stockCost(sid, mid, n),
  budget: () => GameState.wallet,
  buy: (sid, mid, n) => GameState.buyStock(sid, mid, n),
  powder: () => GameState.powder,
  buyPowder: () => GameState.buyPowder(),
};

export interface MarketOptions {
  shopId: string;
  hooks: MarketHooks;
  /** 왼쪽 가게 탭 (장보기만) */
  tabs: boolean;
  /** 눈에 띄게 할 메뉴 (영업 중 품절 재료) */
  highlight?: string;
  closeLabel: string;
  onClose: () => void;
  /** 처음 인사 */
  greeting: string;
  /** 무엇을 샀을 때 (튜토리얼 확인 등) */
  onBought?: () => void;
}

/** 재료 가게 화면 (진열장 · 가게 탭 · 주인장 · 계산대 · 아래 판). root 를 부모에 붙여 씀 */
export class Market {
  readonly root: HTMLDivElement;
  shopId: string;
  private o: MarketOptions;
  private walletLabel!: HTMLDivElement;
  private registerLabel!: HTMLDivElement;
  private shelf!: HTMLDivElement;
  private tabs!: HTMLDivElement;
  private readyBar!: HTMLDivElement;
  private say!: HTMLDivElement;
  private owner!: HTMLImageElement;
  readonly backBtn: HTMLButtonElement;
  private tipIndex = 0;
  /** 튜토리얼이 가리킬 버튼: 메뉴 → 가격표(+5인분) */
  readonly buyButtons: Record<string, HTMLElement> = {};

  constructor(o: MarketOptions) {
    addCss();
    this.o = o;
    this.shopId = o.shopId;
    const root = Ui.div("mk" + (o.tabs ? "" : " notabs"));
    this.root = root;
    // 지갑 (왼쪽 위) · 가게 간판 · 닫기
    const wallet = Ui.div("mk-wallet");
    wallet.appendChild(Ui.icon(Ui.ICON.coin, 52));
    this.walletLabel = Ui.heading("", 40, Ui.GOLD, rgb(0.1, 0.05, 0.02), "right");
    wallet.appendChild(this.walletLabel);
    root.appendChild(wallet);
    const sign = el("div", "mk-sign mk-wood disp", root);
    sign.textContent = o.tabs ? "재료 가게" : `${D.shopDef(o.shopId).name} 재료`;
    this.backBtn = el("button", "mk-close", root) as HTMLButtonElement;
    this.backBtn.innerHTML = CLOSE_SVG;
    this.backBtn.setAttribute("aria-label", o.closeLabel);
    Ui.onPress(this.backBtn, () => o.onClose());
    // 가게 탭 + 진열장
    this.tabs = el("div", "mk-tabs", root) as HTMLDivElement;
    if (!o.tabs) this.tabs.style.display = "none";
    el("div", "mk-beam mk-wood", root);
    this.shelf = el("div", "mk-shelf mk-wood", root) as HTMLDivElement;
    // 주인장 + 계산대 + 말풍선
    const owner = el("img", "mk-owner", root) as HTMLImageElement;
    this.owner = owner;
    owner.src = OWNER_SRC;
    owner.alt = "";
    owner.addEventListener("click", (e) => {
      e.stopPropagation();
      this.talk(TIPS[this.tipIndex++ % TIPS.length]);
    });
    el("div", "mk-counter mk-wood", root);
    const reg = el("div", "mk-register", root);
    const scr = el("div", "scr", reg);
    scr.appendChild(Ui.icon(Ui.ICON.coin, 34));
    this.registerLabel = Ui.heading("", 34, rgb(0.62, 1.0, 0.6), null, "right");
    scr.appendChild(this.registerLabel);
    const rl = el("div", "lbl2", reg);
    rl.textContent = o.hooks.inShift ? "쓸 수 있는 돈" : "계산대";
    this.say = el("div", "mk-say", root) as HTMLDivElement;
    // 아래: 다음 스테이지 재료 준비 (영업 중엔 쓸 수 있는 돈 안내)
    this.readyBar = el("div", "mk-ready mk-wood", root) as HTMLDivElement;
    this.refresh();
    this.talk(o.greeting);
  }

  /** 튜토리얼 동안엔 계산대 뒤 이모·말풍선을 숨김 (안내 이모가 말함) */
  setOwnerHidden(hide: boolean): void {
    const vis = hide ? "hidden" : "visible";
    if (this.say.style.visibility !== vis) {
      this.say.style.visibility = vis;
      this.owner.style.visibility = vis;
    }
  }

  /** 주인장 말풍선 */
  talk(text: string): void {
    this.say.textContent = text;
    this.say.classList.remove("pop");
    void this.say.offsetWidth; // 애니메이션 다시
    this.say.classList.add("pop");
  }

  /** 이 가게에서 다음에 할 스테이지 (도전 중인 스테이지, 다 깼으면 마지막 스테이지) */
  private nextLevel(): number {
    return nextLevelOf(this.shopId);
  }

  refresh(): void {
    const h = this.o.hooks;
    Ui.setText(this.walletLabel, D.formatWon(GameState.wallet));
    Ui.setColor(this.walletLabel, GameState.wallet < 0 ? Ui.BAD : Ui.GOLD);
    Ui.setText(this.registerLabel, D.formatWon(h.budget()));
    if (this.o.tabs) this.tabs.replaceChildren(...D.SHOPS.map((sh, i) => this.tab(sh, i)));
    this.shelf.replaceChildren(...D.shopDef(this.shopId).menus.map((mid) => this.cell(mid)), this.powderCell(), h.inShift ? this.fillAllCell() : this.setCell());
    this.refreshReady();
  }

  /** 왼쪽 가게 탭: 번호(가게 색) + 이름 두 줄. 안 연 가게는 잠김, 다음 스테이지 재료가 모자라면 "!" */
  private tab(sh: D.ShopDef, i: number): HTMLElement {
    const b = document.createElement("button");
    const open = GameState.shopOpened(sh.id);
    b.className = "mk-tab" + (sh.id === this.shopId ? " on" : "") + (open ? "" : " locked");
    if (open) {
      const n = el("div", "n disp", b);
      n.textContent = String(i + 1);
      n.style.background = sh.color.css();
    } else b.appendChild(Ui.icon(Ui.ICON.lock, 38));
    const t = el("div", "", b);
    t.textContent = sh.name.replace(" ", "\n");
    if (open && Object.keys(GameState.stockShortage(nextLevelOf(sh.id))).length > 0) {
      const dot = el("div", "dot disp", b);
      dot.textContent = "!";
    }
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!open) {
        this.talk(`${sh.name}${D.josa(sh.name, "은", "는")} 아직 안 열었잖아요~ 가게를 열면 그때 재료를 줄게요!`);
        return;
      }
      if (sh.id === this.shopId) return;
      Sound.playSfx("click");
      this.shopId = sh.id;
      this.refresh();
      this.talk(`${sh.name} 재료는 여기 있어요!`);
    });
    return b;
  }

  /** 아래 나무판: 다음 스테이지에 필요한 재료가 얼마나 준비됐는지 (영업 중엔 쓸 수 있는 돈 안내) */
  private refreshReady(): void {
    this.readyBar.replaceChildren();
    if (this.o.hooks.inShift) {
      const t = el("div", "t disp", this.readyBar);
      t.style.whiteSpace = "normal";
      t.style.fontSize = "27px";
      t.textContent = this.o.hooks.note?.() ?? "";
      return;
    }
    const lv = this.nextLevel();
    const need = D.stockNeed(lv);
    let total = 0;
    let have = 0;
    for (const [m, n] of Object.entries(need)) {
      total += n;
      have += Math.min(n, this.o.hooks.have(this.shopId, m));
    }
    const ratio = total > 0 ? have / total : 1;
    const t = el("div", "t disp", this.readyBar);
    t.textContent = `${D.levelName(lv)} 재료 준비`;
    const track = el("div", "track", this.readyBar);
    const fill = el("i", "", track);
    fill.style.width = `${Math.round(ratio * 100)}%`;
    if (ratio < 1) fill.style.background = "linear-gradient(180deg, #ffd66a, #e59a1c)";
    const b = el("b", "", track);
    b.textContent = ratio >= 1 ? "준비 끝!" : `${have} / ${total}인분`;
  }

  private priceTag(cost: number, unit: string, free = false): HTMLButtonElement {
    const b = document.createElement("button");
    b.className = "mk-price" + (free ? " free" : "");
    b.appendChild(Ui.icon(Ui.ICON.coin, 44));
    const n = el("span", "num disp", b);
    n.textContent = free ? "무료" : cost.toLocaleString("ko-KR");
    const u = el("span", "unit", b);
    u.textContent = unit;
    return b;
  }

  private noteTag(text: string): HTMLButtonElement {
    const b = document.createElement("button");
    b.className = "mk-price note";
    b.textContent = text;
    b.disabled = true;
    return b;
  }

  /** 진열장 한 칸 (뒤판 + 선반 + 이름표) */
  private shelfCell(name: string, backCls = ""): { cell: HTMLDivElement; back: HTMLDivElement } {
    const cell = Ui.div("mk-cell");
    const back = el("div", "mk-back" + (backCls ? ` ${backCls}` : ""), cell) as HTMLDivElement;
    const plank = el("div", "mk-plank mk-wood", cell);
    const nm = el("div", "mk-name", plank);
    nm.textContent = name;
    return { cell, back };
  }

  private stockBadge(back: HTMLElement, text: string, ratio: number, color: string): void {
    const s = el("div", "mk-stock", back);
    const t = el("div", "", s);
    t.textContent = text;
    const bar = el("div", "bar", s);
    const i = el("i", "", bar);
    i.style.width = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
    i.style.background = color;
  }

  private short(): string {
    return this.o.hooks.inShift ? "어머, 지갑이랑 오늘 번 돈을 합쳐도 모자라네~" : "어머, 돈이 조금 모자라네~ 영업해서 벌어 와요!";
  }

  private cell(mid: string): HTMLDivElement {
    const h = this.o.hooks;
    const unlocked = h.inShift || D.menuUnlockLevel(mid) <= Math.max(GameState.level, D.shopDef(this.shopId).first_level) || GameState.storyCleared;
    const { cell, back } = this.shelfCell(`${D.menuName(mid)} 재료`);
    if (mid === this.o.highlight) cell.classList.add("hot");
    const pic = el("img", "mk-pic", back) as HTMLImageElement;
    pic.src = `${ROOT}/icons/${mid}.png`;
    pic.alt = "";
    if (!unlocked) {
      const lock = el("div", "mk-lock", back);
      lock.appendChild(Ui.icon(Ui.ICON.lock, 70));
      const t = el("div", "", lock);
      t.textContent = `${D.levelName(D.menuUnlockLevel(mid))}에 열려요`;
      cell.appendChild(this.noteTag("아직 못 팔아요"));
      return cell;
    }
    const have = h.have(this.shopId, mid);
    const low = have < (D.stockNeed(this.nextLevel())[mid] ?? 0);
    this.stockBadge(back, have <= 0 ? "품절!" : `남은 ${have}인분`, have / D.STOCK_MAX, have <= 0 ? "#e0553a" : low ? "#f2b33a" : "#7ccf5a");
    const room = h.room(this.shopId, mid);
    const packN = Math.min(D.STOCK_PACK, room);
    let buy: HTMLButtonElement;
    if (packN <= 0) {
      buy = this.noteTag("창고가 가득 찼어요");
    } else {
      const price = h.cost(this.shopId, mid, packN); // 튜토리얼 떡볶이는 공짜
      buy = this.priceTag(price, `· ${packN}인분`, price === 0);
      buy.disabled = h.budget() < price;
      buy.addEventListener("click", (e) => {
        e.stopPropagation();
        Sound.playSfx("click");
        this.buy(mid, packN);
      });
      // 꺼진 가격표도 누르면 주인장이 말해 주게 (꺼진 가격표는 누름이 칸으로 감)
      cell.addEventListener("click", () => {
        if (buy.disabled) this.talk(this.short());
      });
    }
    cell.appendChild(buy);
    this.buyButtons[mid] = buy;
    if (room > 0) {
      const fullCost = h.cost(this.shopId, mid, room); // 튜토리얼 공짜분은 빼고
      const full = el("button", "mk-full", back) as HTMLButtonElement;
      full.textContent = `가득 +${room}\n${fullCost > 0 ? fullCost.toLocaleString("ko-KR") : "무료"}`;
      full.disabled = h.budget() < fullCost;
      Ui.onPress(full, () => this.buy(mid, room));
    }
    return cell;
  }

  /** 마법의 가루 칸 (모든 가게에서 같이 쓰는 특별 재료 — 효과는 절대 설명하지 않음) */
  private powderCell(): HTMLDivElement {
    const h = this.o.hooks;
    const { cell, back } = this.shelfCell("마법의 가루", "magic");
    const ic = el("div", "mk-magic", back);
    ic.innerHTML = Ui.ICON.magic;
    const have = h.powder();
    this.stockBadge(back, `가진 가루 ${have}개`, have / D.POWDER_MAX, "#c79bff");
    if (have >= D.POWDER_MAX) {
      cell.appendChild(this.noteTag(`최대 ${D.POWDER_MAX}개예요`));
      return cell;
    }
    const buy = this.priceTag(D.POWDER_PRICE, "· 1개");
    buy.disabled = GameState.wallet < D.POWDER_PRICE; // 가루는 지갑으로만 (외상 없음)
    buy.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!h.buyPowder()) return;
      Sound.playSfx("magic");
      this.refresh();
      this.talk("그 가루는… 어디서 왔는지 나도 몰라요. 후후, 뿌려 보면 알겠죠?");
      this.o.onBought?.();
    });
    cell.appendChild(buy);
    cell.addEventListener("click", () => {
      if (buy.disabled) this.talk("반짝반짝 수상한 가루… 돈이 좀 더 있어야 해요~");
    });
    return cell;
  }

  /** 바구니 그림 (재료 세트 · 모두 가득) */
  private basket(back: HTMLElement, menus: string[]): void {
    const basket = el("div", "mk-basket", back);
    menus.slice(0, 4).forEach((m, i) => {
      const im = el("img", "", basket) as HTMLImageElement;
      im.src = `${ROOT}/icons/${m}.png`;
      im.alt = "";
      // 바구니 위로 삐죽 나온 재료 (바구니 테두리 = 위에서 약 84px)
      im.style.left = `${[6, 76, 146, 40][i]}px`;
      im.style.top = `${[22, 6, 20, 34][i]}px`;
      im.style.zIndex = `${[1, 0, 1, 2][i]}`;
    });
    const bk = el("div", "bk", basket);
    bk.style.zIndex = "3";
    bk.innerHTML = BASKET_SVG;
  }

  /** 재료 세트 칸: 다음 스테이지에 모자란 재료를 한 번에 */
  private setCell(): HTMLDivElement {
    const lv = this.nextLevel();
    const { cell, back } = this.shelfCell(`${D.levelName(lv)} 재료 세트`, "set");
    this.basket(back, D.shopDef(this.shopId).menus.filter((m) => D.menuUnlockLevel(m) <= lv));
    const short = GameState.stockShortage(lv);
    const missing = Object.values(short).reduce((a, b) => a + b, 0);
    this.stockBadge(back, missing > 0 ? `모자란 재료 ${missing}인분` : "다 준비됐어요", missing > 0 ? 0.3 : 1, missing > 0 ? "#f2b33a" : "#7ccf5a");
    if (missing === 0) {
      cell.appendChild(this.noteTag("재료 충분해요"));
      return cell;
    }
    const cost = GameState.shortageCost(lv);
    const buy = this.priceTag(cost, "· 한 번에", cost === 0);
    buy.disabled = GameState.wallet < cost;
    buy.addEventListener("click", (e) => {
      e.stopPropagation();
      if (GameState.wallet < GameState.shortageCost(lv)) return;
      Sound.playSfx("click");
      if (GameState.buyShortage(lv) > 0) Sound.playSfx("coin");
      this.refresh();
      this.talk(`${D.levelName(lv)}에 쓸 재료, 한 바구니 꽉 담았어요!`);
      this.o.onBought?.();
    });
    cell.appendChild(buy);
    return cell;
  }

  /** 영업 중 6번째 칸: 오늘 파는 메뉴 재료를 모두 가득 */
  private fillAllCell(): HTMLDivElement {
    const h = this.o.hooks;
    const { cell, back } = this.shelfCell("재료 모두 가득", "set");
    const menus = D.shopDef(this.shopId).menus.filter((m) => h.room(this.shopId, m) > 0 || h.have(this.shopId, m) > 0);
    this.basket(back, menus);
    const want = menus.map((m) => [m, h.room(this.shopId, m)] as const).filter(([, n]) => n > 0);
    const total = want.reduce((a, [, n]) => a + n, 0);
    this.stockBadge(back, total > 0 ? `더 담을 수 있는 재료 ${total}인분` : "모두 가득", total > 0 ? 0.3 : 1, total > 0 ? "#f2b33a" : "#7ccf5a");
    if (total === 0) {
      cell.appendChild(this.noteTag("모두 가득 찼어요"));
      return cell;
    }
    const cost = want.reduce((a, [m, n]) => a + h.cost(this.shopId, m, n), 0);
    const buy = this.priceTag(cost, "· 한 번에", cost === 0);
    buy.disabled = h.budget() < cost;
    buy.addEventListener("click", (e) => {
      e.stopPropagation();
      if (h.budget() < cost) return;
      Sound.playSfx("click");
      let any = false;
      for (const [m, n] of want) any = h.buy(this.shopId, m, n) || any;
      if (any) Sound.playSfx("coin");
      this.refresh();
      this.talk("오늘 쓸 재료, 창고 꽉꽉 채웠어요!");
      this.o.onBought?.();
    });
    cell.addEventListener("click", () => {
      if (buy.disabled) this.talk(this.short());
    });
    cell.appendChild(buy);
    return cell;
  }

  private buy(mid: string, n: number): void {
    if (this.o.hooks.budget() < this.o.hooks.cost(this.shopId, mid, n)) {
      this.talk(this.short());
      return;
    }
    if (!this.o.hooks.buy(this.shopId, mid, n)) return;
    Sound.playSfx("coin");
    this.refresh();
    const lines = ["고마워요~ 싱싱한 걸로 담았어요!", `${D.menuName(mid)} 재료 ${n}인분, 여기 있어요!`, "좋은 거 골랐네요, 사장님!"];
    this.talk(lines[(this.tipIndex++ + n) % lines.length]);
    this.o.onBought?.();
  }
}

/** 그 가게에서 다음에 할 스테이지 (도전 중인 스테이지, 다 깼으면 마지막 스테이지) */
function nextLevelOf(sid: string): number {
  const shop = D.shopDef(sid);
  return Math.min(Math.max(GameState.level, shop.first_level), shop.last_level);
}

export class SupplyScene extends Scene {
  private shopId = "";
  private market!: Market;
  private tut: Tutorial | null = null;

  /** 튜토리얼·테스트가 가리키는 버튼: 메뉴 → 가격표(+5인분) */
  get buyButtons(): Record<string, HTMLElement> {
    return this.market.buyButtons;
  }

  ready(): void {
    this.clearColor = rgb(0.13, 0.09, 0.08);
    this.shopId = GameState.currentMapShop();
    const shop = D.shopDef(this.shopId);
    const vs = v(this.vw, this.vh);
    const art = new StreetArt();
    art.size = vs;
    art.awningY = 0.0;
    art.awningH = 60.0;
    art.counterY = vs.y;
    art.theme = shop.theme;
    art.shopId = this.shopId;
    for (const m of shop.menus) art.menuNames.push(D.menuName(m));
    this.add(art);
    const dim = new Dim();
    dim.size = vs;
    this.add(dim);
    this.market = new Market({
      shopId: this.shopId,
      hooks: STORE_HOOKS,
      tabs: true,
      closeLabel: "지도로 돌아가기",
      onClose: () => this.goBack(),
      greeting: GameState.tutorial === "buy" ? "어서 와요, 사장님! 첫 재료는 공짜로 담아 줄게요~" : "어서 와요, 사장님! 오늘은 뭘 담아 줄까?",
      onBought: () => this.checkEnough(),
    });
    this.market.root.style.left = `${(this.vw - 1920) * 0.5}px`;
    this.ui.appendChild(this.market.root);
    Sound.playBgm("map");
    this.tut = this.makeTutorial();
  }

  /** 튜토리얼 "buy": 떡볶이 재료 10인분 사기 → 지도로 */
  private makeTutorial(): Tutorial | null {
    if (GameState.tutorial !== "buy") return null;
    const first = D.shopDef(this.shopId).menus[0];
    const need = D.stockNeed(D.shopDef(this.shopId).first_level)[first] ?? 10;
    const steps: TutStep[] = [];
    if (GameState.stockOf(this.shopId, first) < need) {
      steps.push({
        text: `첫 재료는 이모가 공짜로 줄게요! ${D.menuName(first)} 재료를 눌러 봐요. 한 번 누를 때마다 ${D.STOCK_PACK}인분씩 들어와요. ${need}인분이 될 때까지 눌러 보세요!`,
        target: () => elementRect(this.market.buyButtons[first], this),
        wait: "enough",
      });
    }
    steps.push({
      text: "좋아요, 재료 준비 끝! 재료가 떨어진 메뉴는 품절이라 손님이 주문하지 않아요. 남은 재료는 다음 날에도 쓸 수 있어요. 이제 지도로 돌아가요.",
      target: () => elementRect(this.market.backBtn, this),
      wait: "back",
      done: () => GameState.setTutorial("upgrade"),
    });
    return new Tutorial(this, steps);
  }

  process(_dt: number): void {
    this.tut?.update();
    // 튜토리얼 동안엔 주인장(이모)이 계산대에서 나와 튜토리얼 안내 이모로 말함 → 계산대 뒤 이모·말풍선은 숨김 (이모가 둘로 안 보이게)
    this.market.setOwnerHidden(this.tut?.active() ?? false);
  }

  onBack(): void {
    if (this.tut?.active()) return;
    this.goBack();
  }

  goBack(): void {
    this.tut?.onEvent("back");
    this.game.goto("map");
  }

  backButton(): HTMLElement {
    return this.market.backBtn;
  }

  shop(): string {
    return this.shopId;
  }

  /** 튜토리얼: 첫 메뉴 재료가 하루치만큼 모이면 다음 단계로 */
  private checkEnough(): void {
    const first = D.shopDef(this.shopId).menus[0];
    const need = D.stockNeed(D.shopDef(this.shopId).first_level)[first] ?? 10;
    if (GameState.stockOf(this.shopId, first) >= need) this.tut?.onEvent("enough");
  }
}
