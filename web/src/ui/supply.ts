// 장보기 = 재료 가게. 2026-11-22 사용자 예시 그림으로 다시 ("재료가게 UI 이걸로 써. 오른쪽 이모는 튜토리얼에 넣었던 이모로"):
// art_src/ui_supply_ref.png → tools/supply_ui_art.mjs 가 자른 조각 (ui/mk_*.webp, 위치는 art/supply_ui_meta.ts, 예시 그림 px 1677×938).
//   바탕 mk_bg = 줄무늬 차양 · 나무벽 · 큰 진열장(선반 두 칸) · 왼쪽 가게 탭 다섯 칸(베이지, 글씨 지움) · 오른쪽 그릇 선반 · 아래 나무판 + 막대.
//   그림 속 이모는 지우고 튜토리얼 이모(ui/imo.webp)를 그 자리에 세움 → 그 앞에 mk_front (금전등록기 + 카운터 + 행주).
//   글씨는 모두 게임 글꼴로 그 자리에 씀 (다른 언어도): 간판 "재료 가게", 지갑, 탭 이름, 말풍선, 계산대 화면 · 이름판, 아래 막대.
// 가게마다 따로 있지 않고 하나 (2026-11-20 사용자 "모든 가게 재료를 거기서 다 살 수 있게"): 왼쪽 가게 탭으로 가게를 고름
// (안 연 가게는 자물쇠, 다음 스테이지 재료가 모자란 가게엔 빨간 "!"). 고른 탭 = 빨간 탭 그림 (mk_tab_on).
// 진열장: 윗칸 · 아랫칸에 세 칸씩 (메뉴 재료 4 · 마법의 가루 · 다음 스테이지 재료 세트 / 영업 중엔 "재료 모두 가득"):
//   칸 위 이름표, 선반 위에 재료 그림, 선반 앞 가격표(누르면 +5인분), 왼쪽 위 남은 재료 · 오른쪽 위 "가득".
// 아래 나무판 = 다음 스테이지 재료 준비 막대 (영업 중엔 쓸 수 있는 돈 안내). 오른쪽 위 X = 지도로 (영업 중엔 영업으로).

import { rgb } from "../engine/geom.ts";
import { Scene } from "../engine/game.ts";
import { Sound } from "../engine/audio.ts";
import * as Ui from "../engine/ui.ts";
import * as D from "../core/defs.ts";
import { GameState } from "../state/game_state.ts";
import { POWDER_FILE, ROOT } from "../art/art_assets.ts";
import { SUPPLY_UI_META as META } from "../art/supply_ui_meta.ts";
import { Tutorial, elementRect, type TutStep } from "./tutorial.ts";

// 예시 그림 px → 화면(1920×1080) px: 높이를 꽉 채우고 가운데 (양옆 약 5px 씩 잘림)
const K = 1080 / 938;
const OX = (1920 - 1677 * K) / 2;
const L = (n: number): string => `${(n * K).toFixed(1)}px`;
const X = (x: number): string => `${(OX + x * K).toFixed(1)}px`;
const ART = (name: string): string => `${ROOT}/ui/mk_${name}.webp`;
const OWNER_SRC = `${ROOT}/ui/imo.webp`; // 주인장 = 튜토리얼 이모 (520×803)
/** 이모를 세우는 곳 (예시 그림 px: 왼쪽 위 + 폭) — 그림 속 이모의 얼굴 자리 · 크기에 맞춤 */
const OWNER = { x: 1143, y: 211, w: 478 };
/** 가게 탭 다섯 칸 (베이지 탭 위 y, x 19~179, 높이 106). 빨간 탭 그림 가운데 = 원본 193.5 */
const TAB_TOPS = [143, 267, 391, 513, 636];
const TAB_X0 = 19;
const TAB_X1 = 179;
const TAB_H = 106;
const RED_TAB_CY = 193.5;
/** 진열장 세 칸의 가운데 x, 칸 폭 / 두 줄: 칸 위, 재료가 서는 선반 윗면 y, 선반 앞면 */
const COLS = [381, 668, 955];
const CELL_W = 274;
const ROWS = [
  { top: 150, base: 420, front: [430, 472] },
  { top: 478, base: 726, front: [738, 794] },
];

const CLOSE_RECT = [1572, 14, 1662, 102];
const SIGN_RECT = [540, 38, 846, 114];
const SCREEN_RECT = [1306, 657, 1490, 696];
const PLATE_RECT = [1342, 760, 1450, 792];
const BUBBLE_TEXT = [1140, 112, 1574, 204];
const READY_LABEL = [186, 852, 434, 900];
const TRACK = [447, 862, 1040, 892];


const WAL = META.wallet_l[3];
const CSS = `
.mk { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; overflow: hidden; pointer-events: auto; color: #3b2415; }
.mk button { pointer-events: auto; font-family: inherit; cursor: pointer; }
.mk > img, .mk-abs { position: absolute; }
.mk-bg { left: ${X(0)}; top: 0; width: ${L(1677)}; height: ${L(938)}; pointer-events: none; user-select: none; }
.mk-txt { position: absolute; display: flex; align-items: center; justify-content: center; text-align: center; overflow: hidden; pointer-events: none; line-height: 1.12; }
.mk-sign { color: #3a2214; white-space: nowrap; text-shadow: 0 2px 0 rgba(255, 228, 180, 0.45); z-index: 2; }
.mk-wallet { position: absolute; left: ${X(META.wallet_l[0])}; top: ${L(META.wallet_l[1])}; height: ${L(WAL)}; min-width: ${L(META.wallet_r[0] + META.wallet_r[2] - META.wallet_l[0])};
  box-sizing: border-box; padding: 0 ${L(META.wallet_r[2] + 4)} ${L(4)} ${L(META.wallet_l[2] + 6)}; display: flex; align-items: center; z-index: 2; pointer-events: none;
  background-image: url(${ART("wallet_l")}), url(${ART("wallet_r")}), url(${ART("wallet_m")}); background-repeat: no-repeat;
  background-position: left top, right top, ${L(META.wallet_l[2] - 1)} top; background-size: auto 100%, auto 100%, calc(100% - ${L(META.wallet_l[2] + META.wallet_r[2] - 2)}) 100%; }
.mk-close { position: absolute; left: ${X(CLOSE_RECT[0])}; top: ${L(CLOSE_RECT[1])}; width: ${L(CLOSE_RECT[2] - CLOSE_RECT[0])}; height: ${L(CLOSE_RECT[3] - CLOSE_RECT[1])};
  border-radius: 50%; border: 0; padding: 0; background: transparent; z-index: 8; transition: background 0.1s, box-shadow 0.12s, transform 0.08s; outline: none; }
.mk-close:hover, .mk-close:focus-visible { box-shadow: 0 0 0 5px rgba(255, 214, 120, 0.85), 0 0 26px rgba(255, 180, 70, 0.7); }
.mk-close:active { background: rgba(40, 20, 8, 0.25); transform: scale(0.95); }
.mk-tabs { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
.mk-tab { position: absolute; left: ${X(TAB_X0)}; width: ${L(TAB_X1 - TAB_X0)}; height: ${L(TAB_H)}; border: 0; background: transparent; padding: ${L(6)} ${L(8)} ${L(8)};
  box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: ${L(3)}; color: #2b1a10;
  font-size: ${L(21)}; line-height: 1.08; text-align: center; white-space: pre-line; word-break: keep-all; border-radius: 14px; transition: filter 0.12s, transform 0.1s; z-index: 2; }
.mk-tab:hover { filter: brightness(1.06); }
.mk-tab:active { transform: translateY(2px); }
.mk-tab .nm { width: ${L(94)}; height: ${L(54)}; display: flex; align-items: center; justify-content: center; overflow: hidden; white-space: normal; word-break: keep-all; }
.mk-tab .n { width: ${L(28)}; height: ${L(28)}; flex: none; border-radius: 50%; border: ${L(3)} solid #2b1a10; box-sizing: border-box; color: #fff; font-size: ${L(18)};
  display: flex; align-items: center; justify-content: center; -webkit-text-stroke: 4px #2b1a10; paint-order: stroke fill; }
.mk-tab .lk { width: ${L(META.lock[2])}; height: ${L(META.lock[3])}; flex: none; margin-top: ${L(-4)}; }
.mk-tab.on { color: #fff6e6; -webkit-text-stroke: 5px #3b1a10; paint-order: stroke fill; }
.mk-tab.locked { cursor: default; }
.mk-tab.locked .nm { opacity: 0.85; }
.mk-tab.off { filter: saturate(0.55) brightness(0.82); }
.mk-tabon { position: absolute; left: ${X(META.tab_on[0])}; width: ${L(META.tab_on[2])}; height: ${L(META.tab_on[3])}; pointer-events: none; z-index: 1; }
.mk-dot { position: absolute; width: ${L(30)}; height: ${L(30)}; border-radius: 50%; background: radial-gradient(circle at 38% 32%, #ff8a6e, #e0412c 55%, #a8231a);
  border: ${L(3)} solid #3b1a10; box-sizing: border-box; color: #fff; font-size: ${L(19)}; display: flex; align-items: center; justify-content: center;
  -webkit-text-stroke: 4px #3b1a10; paint-order: stroke fill; z-index: 2; pointer-events: none; }
.mk-shelf { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
.mk-cell { position: absolute; width: ${L(CELL_W)}; pointer-events: auto; }
.mk-name { position: absolute; left: 50%; transform: translateX(-50%); top: ${L(4)}; max-width: ${L(CELL_W - 16)}; padding: ${L(2)} ${L(14)} ${L(4)};
  border-radius: 10px; background: linear-gradient(180deg, #fbeed4, #ecd5ac); border: 4px solid #3b2415; font-size: ${L(21)}; line-height: 1.15; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; box-shadow: 0 4px 0 rgba(20, 10, 4, 0.45); z-index: 2; box-sizing: border-box; }
.mk-pic { position: absolute; left: ${L(18)}; right: ${L(18)}; display: flex; align-items: flex-end; justify-content: center; }
.mk-pic img { max-width: 100%; max-height: 100%; object-fit: contain; filter: drop-shadow(0 8px 6px rgba(0,0,0,0.5)); pointer-events: none; }
.mk-pic.dim img, .mk-pic.dim .mk-magic { filter: grayscale(1) brightness(0.45); }
.mk-cell.hot .mk-pic { animation: mk-hot 1.1s ease-in-out infinite; }
.mk-cell.hot .mk-pic::before { content: ""; position: absolute; inset: -6% -4% -2%; border-radius: 40%; background: radial-gradient(ellipse at 50% 60%, rgba(255, 214, 110, 0.55), rgba(255, 190, 70, 0) 70%); }
.mk-pic img.mk-magic { height: 94%; width: auto; max-width: 100%; object-fit: contain; animation: mk-float 2.6s ease-in-out infinite; }
.mk-basket { position: relative; width: ${L(236)}; height: ${L(172)}; filter: drop-shadow(0 8px 6px rgba(0,0,0,0.5)); }
.mk-pic .mk-basket img { position: absolute; max-height: none; filter: none; }
.mk-pic .mk-basket .bb, .mk-pic .mk-basket .bf { left: 0; bottom: 0; width: 100%; height: auto; }
.mk-pic .mk-basket .bf { z-index: 5; }
.mk-pic .mk-basket .ing { width: 36%; height: 48%; object-fit: contain; filter: drop-shadow(0 3px 3px rgba(0,0,0,0.35)); }
.mk-price { position: absolute; left: 50%; transform: translate(-50%, -50%); z-index: 3; display: flex; align-items: center; gap: 8px;
  padding: 4px 20px 6px 12px; border-radius: 14px; border: 5px solid #3b2415; background: linear-gradient(180deg, #fff8e8, #f1dcb4);
  box-shadow: 0 6px 0 #8a5a2e, 0 10px 14px rgba(0,0,0,0.4); white-space: nowrap; transition: transform 0.08s, filter 0.12s; }
.mk-price:hover { filter: brightness(1.06); transform: translate(-50%, calc(-50% - 3px)); }
.mk-price:active { transform: translate(-50%, calc(-50% + 3px)); box-shadow: 0 2px 0 #8a5a2e, 0 4px 8px rgba(0,0,0,0.35); }
.mk-price .ic { width: 40px; height: 40px; }
.mk-price .num { font-size: 38px; line-height: 1; color: #3b2415; }
.mk-price .unit { font-size: 22px; color: #7a5638; margin-left: 2px; }
.mk-price.free { background: linear-gradient(180deg, #e9ffd8, #b9e79a); box-shadow: 0 6px 0 #3f7a2a, 0 10px 14px rgba(0,0,0,0.35); }
.mk-price:disabled { cursor: default; filter: grayscale(0.85) brightness(0.86); transform: translate(-50%, -50%); pointer-events: none; }
.mk-price.note { font-size: 24px; padding: 8px 18px; }
.mk-stock { position: absolute; left: ${L(4)}; padding: 4px 12px 6px; border-radius: 12px; background: rgba(30,16,8,0.82); border: 3px solid #3b2415;
  color: #fff3dc; font-size: 21px; line-height: 1.1; z-index: 2; pointer-events: none; }
.mk-stock .bar { margin-top: 4px; height: 8px; border-radius: 5px; background: rgba(255,255,255,0.18); overflow: hidden; }
.mk-stock .bar i { display: block; height: 100%; border-radius: 5px; }
.mk-full { position: absolute; right: ${L(4)}; z-index: 2; padding: 4px 12px 6px; border-radius: 12px; border: 3px solid #3b2415; white-space: pre-line;
  background: linear-gradient(180deg, #8fd36c, #4f9c34); color: #fff; font-size: 20px; line-height: 1.15; box-shadow: 0 4px 0 #2c5a1c; text-align: center; }
.mk-full:disabled { cursor: default; filter: grayscale(0.9) brightness(0.8); }
.mk-full:active { transform: translateY(3px); box-shadow: 0 1px 0 #2c5a1c; }
.mk-lock { position: absolute; inset: 8% 0 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  color: #f3e2c2; font-size: 24px; text-align: center; -webkit-text-stroke: 5px #2b1a10; paint-order: stroke fill; z-index: 2; pointer-events: none; }
.mk-owner { position: absolute; left: ${X(OWNER.x)}; top: ${L(OWNER.y)}; width: ${L(OWNER.w)}; pointer-events: auto; cursor: pointer; transform-origin: 50% 100%;
  animation: mk-breathe 3.4s ease-in-out infinite; z-index: 3; }
.mk-front { left: ${X(META.front[0])}; top: ${L(META.front[1])}; width: ${L(META.front[2])}; height: ${L(META.front[3])}; pointer-events: none; z-index: 4; }
.mk-screen { gap: 8px; z-index: 5; }
.mk-screen .ic { width: ${L(26)}; height: ${L(26)}; flex: none; }
.mk-plate { color: #2b1a10; font-size: ${L(24)}; white-space: nowrap; z-index: 5; }
.mk-say { position: absolute; left: ${X(META.bubble[0])}; top: ${L(META.bubble[1])}; width: ${L(META.bubble[2])}; height: ${L(META.bubble[3])}; z-index: 6; pointer-events: none; transform-origin: 62% 100%; }
.mk-say img { position: absolute; inset: 0; width: 100%; height: 100%; }
.mk-say .t { position: absolute; left: ${L(BUBBLE_TEXT[0] - META.bubble[0])}; top: ${L(BUBBLE_TEXT[1] - META.bubble[1])}; width: ${L(BUBBLE_TEXT[2] - BUBBLE_TEXT[0])};
  height: ${L(BUBBLE_TEXT[3] - BUBBLE_TEXT[1])}; display: flex; align-items: center; justify-content: center; text-align: center; color: #2b1a10;
  line-height: 1.3; white-space: pre-line; word-break: keep-all; overflow: hidden; }
.mk-say.pop { animation: mk-pop 0.28s cubic-bezier(.2,.9,.3,1.3); }
.mk-ready { color: #fff3dc; -webkit-text-stroke: 6px #3b2415; paint-order: stroke fill; white-space: nowrap; z-index: 2; }
.mk-fill { position: absolute; top: ${L(TRACK[1])}; height: ${L(TRACK[3] - TRACK[1])}; left: ${X(TRACK[0])}; box-sizing: border-box; border: 3px solid #2b1a10;
  border-radius: 999px; background: linear-gradient(180deg, #ffe08a, #f4b23a 55%, #e0901c); box-shadow: inset 0 3px 0 rgba(255,255,255,0.45); z-index: 2; pointer-events: none; }
.mk-fill.done { background: linear-gradient(180deg, #c4f09a, #6cbf45 55%, #4a9a2e); }
.mk-track { color: #fff; -webkit-text-stroke: 5px #2b1a10; paint-order: stroke fill; z-index: 3; white-space: pre-line; word-break: keep-all; }
@keyframes mk-hot { 0%, 100% { filter: drop-shadow(0 0 0 rgba(255, 210, 90, 0)); } 50% { filter: drop-shadow(0 0 16px rgba(255, 210, 90, 0.95)) brightness(1.12); } }
@keyframes mk-pop { from { transform: scale(0.85); } to { transform: scale(1); } }
@keyframes mk-breathe { 0%, 100% { transform: scale(1, 1); } 50% { transform: scale(1.006, 1.012); } }
@keyframes mk-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@media (prefers-reduced-motion: reduce) { .mk-owner, .mk-magic, .mk-say.pop, .mk-cell.hot .mk-pic { animation: none; } }
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

function el(tag: string, cls: string, parent?: HTMLElement): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  parent?.appendChild(e);
  return e;
}

/** 예시 그림 px 네모 [x0, y0, x1, y1] 에 놓기 */
function place(e: HTMLElement, r: number[]): HTMLElement {
  e.style.left = X(r[0]);
  e.style.top = L(r[1]);
  e.style.width = L(r[2] - r[0]);
  e.style.height = L(r[3] - r[1]);
  return e;
}

function img(src: string, cls: string, parent: HTMLElement): HTMLImageElement {
  const im = el("img", cls, parent) as HTMLImageElement;
  im.src = src;
  im.alt = "";
  im.draggable = false;
  return im;
}

/** 칸을 넘치면 넘치지 않을 때까지 글자를 줄인다 — 번역은 붙인 뒤에 바뀌므로 두 번 그린 뒤에 잰다 */
function fit(e: HTMLElement, size: number, min: number): void {
  e.style.fontSize = `${size}px`;
  const run = (): void => {
    if (!e.isConnected) return;
    let s = size;
    e.style.fontSize = `${s}px`;
    while (s > min && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1)) {
      s -= 1;
      e.style.fontSize = `${s}px`;
    }
  };
  if (typeof requestAnimationFrame !== "undefined") requestAnimationFrame(() => requestAnimationFrame(run));
}

/**
 * 재료 가게 화면이 돈·재료를 다루는 방법. 장보기(지도에서 들어옴)와 영업 중 품절 재료통(ShiftView)이 같은 화면을 쓰고
 * (2026-11-20 사용자 "인게임 가게에서 품절 재료 눌렀을 때 장보기랑 같은 화면 나오게"), 여기만 다르다.
 */
export interface MarketHooks {
  /** 영업 중 (그 가게 탭만 · 재료 세트 대신 "모두 가득" · 아래 판은 쓸 수 있는 돈 안내) */
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
  /** 가게 탭으로 다른 가게도 고를 수 있음 (장보기). false = 영업 중: 그 가게만 (다른 탭은 흐리게) */
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

/** 재료 가게 화면 (사용자 그림 바탕 + 가게 탭 · 진열장 · 주인장 · 계산대 · 아래 판). root 를 부모에 붙여 씀 */
export class Market {
  readonly root: HTMLDivElement;
  shopId: string;
  private o: MarketOptions;
  private walletLabel: HTMLDivElement;
  private screenLabel: HTMLDivElement;
  private shelf: HTMLDivElement;
  private tabs: HTMLDivElement;
  private readyLabel: HTMLDivElement;
  private readyFill: HTMLDivElement;
  private readyText: HTMLDivElement;
  private say: HTMLDivElement;
  private sayText: HTMLDivElement;
  private owner: HTMLImageElement;
  readonly backBtn: HTMLButtonElement;
  private tipIndex = 0;
  /** 튜토리얼이 가리킬 버튼: 메뉴 → 가격표(+5인분) */
  readonly buyButtons: Record<string, HTMLElement> = {};

  constructor(o: MarketOptions) {
    addCss();
    this.o = o;
    this.shopId = o.shopId;
    const root = Ui.div("mk");
    this.root = root;
    img(ART("bg"), "mk-bg", root);
    // 왼쪽 위 지갑 (동전 + 금액, 칩은 금액 길이만큼 늘어남)
    const wallet = el("div", "mk-wallet", root);
    this.walletLabel = Ui.heading("", 40, Ui.GOLD, rgb(0.17, 0.09, 0.04), "left");
    wallet.appendChild(this.walletLabel);
    // 간판 · 가게 탭 · 진열장
    const sign = place(el("div", "mk-txt mk-sign disp", root), SIGN_RECT);
    sign.textContent = "재료 가게";
    fit(sign, 66, 30);
    this.tabs = el("div", "mk-tabs", root) as HTMLDivElement;
    this.shelf = el("div", "mk-shelf", root) as HTMLDivElement;
    // 주인장(튜토리얼 이모) → 그 앞에 계산대 · 카운터
    const owner = img(OWNER_SRC, "mk-owner", root);
    this.owner = owner;
    owner.addEventListener("click", (e) => {
      e.stopPropagation();
      this.talk(TIPS[this.tipIndex++ % TIPS.length]);
    });
    img(ART("front"), "mk-front", root);
    const screen = place(el("div", "mk-txt mk-screen", root), SCREEN_RECT);
    screen.appendChild(Ui.icon(Ui.ICON.coin, 30));
    this.screenLabel = Ui.heading("", 32, rgb(0.62, 1.0, 0.55), rgb(0.06, 0.12, 0.07), "left");
    screen.appendChild(this.screenLabel);
    const plate = place(el("div", "mk-txt mk-plate", root), PLATE_RECT);
    plate.textContent = o.hooks.inShift ? "쓸 수 있는 돈" : "계산대";
    fit(plate, 27, 14);
    // 말풍선
    this.say = el("div", "mk-say", root) as HTMLDivElement;
    img(ART("bubble"), "", this.say);
    this.sayText = el("div", "t", this.say) as HTMLDivElement;
    // 아래 나무판: 다음 스테이지 재료 준비 (영업 중엔 쓸 수 있는 돈)
    this.readyLabel = place(el("div", "mk-txt mk-ready", root), READY_LABEL) as HTMLDivElement;
    this.readyFill = el("div", "mk-fill", root) as HTMLDivElement;
    this.readyText = el("div", "mk-txt mk-track", root) as HTMLDivElement;
    // 닫기 (그림의 X 위 투명 버튼)
    this.backBtn = el("button", "mk-close", root) as HTMLButtonElement;
    this.backBtn.setAttribute("aria-label", o.closeLabel);
    Ui.onPress(this.backBtn, () => o.onClose());
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
    this.sayText.textContent = text;
    fit(this.sayText, Math.round(25 * K), 15);
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
    Ui.setText(this.screenLabel, D.formatWon(h.budget()));
    this.tabs.replaceChildren(...D.SHOPS.flatMap((sh, i) => this.tab(sh, i)));
    const cells = [...D.shopDef(this.shopId).menus.map((mid) => this.cell(mid)), this.powderCell(), h.inShift ? this.fillAllCell() : this.setCell()];
    cells.forEach((c, i) => {
      const row = ROWS[Math.floor(i / 3)];
      const cx = COLS[i % 3];
      c.style.left = X(cx - CELL_W / 2);
      c.style.top = L(row.top);
      c.style.height = L(row.front[1] - row.top);
    });
    this.shelf.replaceChildren(...cells);
    this.refreshReady();
  }

  /** 왼쪽 가게 탭 (그림의 베이지 칸 위에 번호 · 이름. 고른 가게 = 빨간 탭 그림, 안 연 가게 = 자물쇠, 재료가 모자라면 빨간 "!") */
  private tab(sh: D.ShopDef, i: number): HTMLElement[] {
    const out: HTMLElement[] = [];
    const top = TAB_TOPS[i];
    const open = GameState.shopOpened(sh.id);
    const on = sh.id === this.shopId;
    const fixed = !this.o.tabs; // 영업 중: 그 가게 재료만
    if (on) {
      const red = img(ART("tab_on"), "mk-tabon", this.tabs);
      red.style.top = L(top + TAB_H / 2 - (RED_TAB_CY - META.tab_on[1]));
      out.push(red);
    }
    const b = document.createElement("button");
    b.className = "mk-tab" + (on ? " on" : "") + (open ? "" : " locked") + (fixed && !on && open ? " off" : "");
    b.style.top = L(top);
    if (open) {
      const n = el("div", "n disp", b);
      n.textContent = String(i + 1);
      n.style.background = sh.color.css();
    } else img(ART("lock"), "lk", b);
    const t = el("div", "nm", b);
    t.textContent = sh.name; // 칸 폭이 좁아 띄어쓰기에서 두 줄로 (번역도 이름 그대로 찾게)
    fit(t, Math.round(21 * K), 13);
    out.push(b);
    if (open && Object.keys(GameState.stockShortage(nextLevelOf(sh.id))).length > 0 && !fixed) {
      const dot = el("div", "mk-dot disp", undefined);
      dot.textContent = "!";
      dot.style.left = X(TAB_X1 - 26);
      dot.style.top = L(top - 12);
      out.push(dot);
    }
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!open) {
        this.talk(`${sh.name}${D.josa(sh.name, "은", "는")} 아직 안 열었잖아요~ 가게를 열면 그때 재료를 줄게요!`);
        return;
      }
      if (on) return;
      if (fixed) {
        this.talk(`영업 중이라 지금은 ${D.shopDef(this.shopId).name} 재료만 팔아요~`);
        return;
      }
      Sound.playSfx("click");
      this.shopId = sh.id;
      this.refresh();
      this.talk(`${sh.name} 재료는 여기 있어요!`);
    });
    return out;
  }

  /** 아래 나무판: 다음 스테이지에 필요한 재료가 얼마나 준비됐는지 (영업 중엔 쓸 수 있는 돈 안내) */
  private refreshReady(): void {
    const fillMax = TRACK[2] - TRACK[0];
    if (this.o.hooks.inShift) {
      this.readyLabel.textContent = "쓸 수 있는 돈";
      fit(this.readyLabel, Math.round(27 * K), 16);
      this.readyFill.style.display = "none";
      place(this.readyText, [TRACK[0] + 6, 842, TRACK[2] - 4, 912]);
      this.readyText.textContent = this.o.hooks.note?.() ?? "";
      fit(this.readyText, 26, 15);
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
    this.readyLabel.textContent = `${D.levelName(lv)} 재료 준비`;
    fit(this.readyLabel, Math.round(27 * K), 16);
    this.readyFill.style.display = ratio > 0 ? "" : "none";
    this.readyFill.style.width = L(Math.max(34, fillMax * ratio));
    this.readyFill.classList.toggle("done", ratio >= 1);
    place(this.readyText, [TRACK[0], TRACK[1] - 4, TRACK[2], TRACK[3] + 4]);
    this.readyText.textContent = ratio >= 1 ? "준비 끝!" : `${have} / ${total}인분`;
    fit(this.readyText, Math.round(24 * K), 15);
  }

  private priceTag(cost: number, unit: string, free = false): HTMLButtonElement {
    const b = document.createElement("button");
    b.className = "mk-price" + (free ? " free" : "");
    b.appendChild(Ui.icon(Ui.ICON.coin, 40));
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

  /** 진열장 한 칸: 위 이름표 + 선반 위 그림 자리 + 선반 앞 가격표 자리 (줄 위치는 refresh 가 정함) */
  private shelfCell(name: string, row: number): { cell: HTMLDivElement; pic: HTMLDivElement; tagY: string; badgeY: string } {
    const r = ROWS[row];
    const cell = Ui.div("mk-cell");
    const nm = el("div", "mk-name", cell);
    nm.textContent = name;
    const pic = el("div", "mk-pic", cell) as HTMLDivElement;
    pic.style.top = L(50);
    pic.style.height = L(r.base - r.top - 50);
    return { cell, pic, tagY: L((r.front[0] + r.front[1]) / 2 - r.top + 2), badgeY: L(48) };
  }

  /** 줄 번호: 메뉴 4 + 가루 + 세트 = 위 세 칸, 아래 세 칸 */
  private rowOf(index: number): number {
    return Math.floor(index / 3);
  }

  private addTag(cell: HTMLElement, tag: HTMLElement, y: string): void {
    tag.style.top = y;
    cell.appendChild(tag);
  }

  private stockBadge(cell: HTMLElement, y: string, text: string, ratio: number, color: string): void {
    const s = el("div", "mk-stock", cell);
    s.style.top = y;
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
    const index = D.shopDef(this.shopId).menus.indexOf(mid);
    const unlocked = h.inShift || D.menuUnlockLevel(mid) <= Math.max(GameState.level, D.shopDef(this.shopId).first_level) || GameState.storyCleared;
    const { cell, pic, tagY, badgeY } = this.shelfCell(`${D.menuName(mid)} 재료`, this.rowOf(index));
    if (mid === this.o.highlight) cell.classList.add("hot");
    img(`${ROOT}/icons/${mid}.png`, "", pic);
    if (!unlocked) {
      pic.classList.add("dim");
      const lock = el("div", "mk-lock", pic);
      lock.appendChild(Ui.icon(Ui.ICON.lock, 64));
      const t = el("div", "", lock);
      t.textContent = `${D.levelName(D.menuUnlockLevel(mid))}에 열려요`;
      this.addTag(cell, this.noteTag("아직 못 팔아요"), tagY);
      return cell;
    }
    const have = h.have(this.shopId, mid);
    const low = have < (D.stockNeed(this.nextLevel())[mid] ?? 0);
    this.stockBadge(cell, badgeY, have <= 0 ? "품절!" : `남은 ${have}인분`, have / D.STOCK_MAX, have <= 0 ? "#e0553a" : low ? "#f2b33a" : "#7ccf5a");
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
    this.addTag(cell, buy, tagY);
    this.buyButtons[mid] = buy;
    if (room > 0) {
      const fullCost = h.cost(this.shopId, mid, room); // 튜토리얼 공짜분은 빼고
      const full = el("button", "mk-full", cell) as HTMLButtonElement;
      full.style.top = badgeY;
      full.textContent = `가득 +${room}\n${fullCost > 0 ? fullCost.toLocaleString("ko-KR") : "무료"}`;
      full.disabled = h.budget() < fullCost;
      Ui.onPress(full, () => this.buy(mid, room));
    }
    return cell;
  }

  /** 마법의 가루 칸 (모든 가게에서 같이 쓰는 특별 재료 — 효과는 절대 설명하지 않음) */
  private powderCell(): HTMLDivElement {
    const h = this.o.hooks;
    const { cell, pic, tagY, badgeY } = this.shelfCell("마법의 가루", 1);
    img(`${ROOT}/${POWDER_FILE}`, "mk-magic", pic); // 2026-11-22 사용자 그림 (보라 가루 유리병)
    const have = h.powder();
    this.stockBadge(cell, badgeY, `가진 가루 ${have}개`, have / D.POWDER_MAX, "#c79bff");
    if (have >= D.POWDER_MAX) {
      this.addTag(cell, this.noteTag(`최대 ${D.POWDER_MAX}개예요`), tagY);
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
    this.addTag(cell, buy, tagY);
    cell.addEventListener("click", () => {
      if (buy.disabled) this.talk("반짝반짝 수상한 가루… 돈이 좀 더 있어야 해요~");
    });
    return cell;
  }

  /** 바구니 그림 (재료 세트 · 모두 가득) */
  private basket(pic: HTMLElement, menus: string[]): void {
    // 2026-11-22 사용자 그림 (타원 바구니): 뒤 그림 → 재료 → 앞 테두리 그림 순서로 겹쳐 재료가 바구니 안에 담김 (tools/basket_art.mjs)
    const basket = el("div", "mk-basket", pic);
    img(`${ROOT}/ui/basket_back.webp`, "bb", basket);
    menus.slice(0, 4).forEach((m, i) => {
      const im = img(`${ROOT}/icons/${m}.png`, "ing", basket);
      im.style.left = `${[9, 33, 55, 24][i]}%`;
      im.style.top = `${[22, 14, 21, 31][i]}%`;
      im.style.zIndex = `${[1, 0, 1, 2][i]}`;
    });
    img(`${ROOT}/ui/basket_front.webp`, "bf", basket);
  }

  /** 재료 세트 칸: 다음 스테이지에 모자란 재료를 한 번에 */
  private setCell(): HTMLDivElement {
    const lv = this.nextLevel();
    const { cell, pic, tagY, badgeY } = this.shelfCell(`${D.levelName(lv)} 재료 세트`, 1);
    this.basket(pic, D.shopDef(this.shopId).menus.filter((m) => D.menuUnlockLevel(m) <= lv));
    const short = GameState.stockShortage(lv);
    const missing = Object.values(short).reduce((a, b) => a + b, 0);
    this.stockBadge(cell, badgeY, missing > 0 ? `모자란 재료 ${missing}인분` : "다 준비됐어요", missing > 0 ? 0.3 : 1, missing > 0 ? "#f2b33a" : "#7ccf5a");
    if (missing === 0) {
      this.addTag(cell, this.noteTag("재료 충분해요"), tagY);
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
    this.addTag(cell, buy, tagY);
    return cell;
  }

  /** 영업 중 6번째 칸: 오늘 파는 메뉴 재료를 모두 가득 */
  private fillAllCell(): HTMLDivElement {
    const h = this.o.hooks;
    const { cell, pic, tagY, badgeY } = this.shelfCell("재료 모두 가득", 1);
    const menus = D.shopDef(this.shopId).menus.filter((m) => h.room(this.shopId, m) > 0 || h.have(this.shopId, m) > 0);
    this.basket(pic, menus);
    const want = menus.map((m) => [m, h.room(this.shopId, m)] as const).filter(([, n]) => n > 0);
    const total = want.reduce((a, [, n]) => a + n, 0);
    this.stockBadge(cell, badgeY, total > 0 ? `더 담을 수 있는 재료 ${total}인분` : "모두 가득", total > 0 ? 0.3 : 1, total > 0 ? "#f2b33a" : "#7ccf5a");
    if (total === 0) {
      this.addTag(cell, this.noteTag("모두 가득 찼어요"), tagY);
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
    this.addTag(cell, buy, tagY);
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
