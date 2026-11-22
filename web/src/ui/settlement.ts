// 정산: 매출·팁·별점·다음 레벨에 열리는 것, 리워드 광고(매출 2배 / 할당량 미달 시 통과 1회)
// 버튼: 깼으면 다음 스테이지 / 지도로 (가게 마지막 스테이지면 다음으로 → 지도에서 새 가게 사기), 못 깼으면 광고로 통과 / 다시 도전 / 지도로
// 2026-11-22 사용자 예시 그림 ("스테이지 끝나면 나오는 화면 UI 이걸로", art_src/ui_settlement_ref.png 1679×937): 왼쪽 손그림 영수증 종이 + 주황 리본,
//   오른쪽 반짝 선 달린 제목 · 손그림 금색 별 · 나무 칩 안내 · 파랑/갈색/주황 손그림 버튼. 조각은 tools/settlement_ui_art.mjs → ui/st_*.webp,
//   글씨는 모두 게임 글꼴로 씀. 자리 = 예시 그림 px × ST_K (1679 폭 → 1920). 버튼은 왼끝·가운데·오른끝 3조각이라 폭이 달라도 됨.

import { type Color, R, rgb, v } from "../engine/geom.ts";
import { tr } from "../i18n/i18n.ts";
import type { Gfx } from "../engine/gfx.ts";
import { Scene } from "../engine/game.ts";
import { Node2D } from "../engine/node.ts";
import { Sound } from "../engine/audio.ts";
import { showRewarded } from "../engine/ads.ts";
import * as Ui from "../engine/ui.ts";
import * as D from "../core/defs.ts";
import type { ShiftResult } from "../core/shift_session.ts";
import { GameState } from "../state/game_state.ts";
import { RainFx } from "../art/rain_fx.ts";
import { starRow } from "./star_row.ts";
import { menuPic } from "../shift/shift_hud.ts";
import { TARP_CREAM, TARP_RED } from "../art/street_art.ts";
import { gourmetPortrait } from "./portrait.ts";
import { CanvasWidget } from "../engine/game.ts";
import * as ArtAssets from "../art/art_assets.ts";
import * as FoodArt from "../art/food_art.ts";

const ST_K = 1920 / 1679;
const SU = (n: number): string => `${Math.round(n * ST_K)}px`;
const ST_ART = (n: string): string => `url("assets/art/ui/st_${n}.webp")`;
/** 버튼 3조각 크기 (잘라 낸 그림 px): 높이, 왼끝 폭, 오른끝 폭 */
const ST_BTN: Record<"blue" | "orange" | "brown", { h: number; l: number; r: number }> = {
  blue: { h: 110, l: 82, r: 82 },
  orange: { h: 114, l: 80, r: 84 },
  brown: { h: 112, l: 60, r: 60 },
};
const ST_CSS = `
.st { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; pointer-events: none; }
.st .st-card { position: absolute; background: center / 100% 100% no-repeat; }
.st .st-rc { position: absolute; display: flex; flex-direction: column; justify-content: space-evenly; }
.st .st-side { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 14px; }
.st .st-mid { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; overflow: hidden; width: 100%; }
.st .st-btns { flex: 0 0 auto; width: 100%; display: flex; flex-direction: column; gap: 12px; }
.st .st-row { display: flex; gap: 14px; width: 100%; }
.st-btn { pointer-events: auto; position: relative; border: 0; padding: 0 60px 8px; box-sizing: border-box; cursor: pointer; display: flex; align-items: center; justify-content: center;
  gap: 16px; background-color: transparent; background-repeat: no-repeat; font-family: inherit; color: #fff8ea; font-size: 46px;
  -webkit-text-stroke: 10px #2b1a10; paint-order: stroke fill; transition: transform 0.08s, filter 0.12s; filter: drop-shadow(0 5px 5px rgba(0,0,0,0.35)); }
.st-btn .ic { flex: 0 0 auto; width: 1.15em; height: 1.15em; display: flex; }
.st-btn:hover:not(:disabled) { filter: drop-shadow(0 5px 5px rgba(0,0,0,0.35)) brightness(1.07); }
.st-btn:active:not(:disabled) { transform: translateY(5px); }
.st-btn:disabled { cursor: default; filter: grayscale(0.85) brightness(0.9); }
.st-btn.lively { animation: ui-breathe 1.6s ease-in-out infinite; }
.st-btn.lively:active { animation: none; }
.st-btn.purple { filter: hue-rotate(245deg) saturate(0.9) drop-shadow(0 5px 5px rgba(0,0,0,0.35)); }
.st-note { box-sizing: border-box; max-width: 100%; padding: 10px 34px 13px; border-radius: 22px; border: 5px solid #2e1a10;
  background: linear-gradient(180deg, #8f5c3b 0%, #76472c 55%, #61391f 100%);
  box-shadow: inset 0 0 0 3px rgba(255,214,170,0.2), inset 0 4px 0 rgba(255,230,200,0.22), 0 6px 0 rgba(30,15,8,0.45); }
.st-note > div { text-shadow: 0 2px 0 rgba(0,0,0,0.45); white-space: pre-line; }
.st-dash { height: 0; border-bottom: 5px dashed rgba(110,75,50,0.7); margin: 2px 0; }
.st-pill { box-sizing: border-box; border-radius: 40px; border: 3px solid #c9a587; background: rgba(214,180,150,0.22); padding: 8px 20px 10px; }
@media (prefers-reduced-motion: reduce) { .st-btn.lively { animation: none; } }
`;
let stCss = false;
function ensureStCss(): void {
  if (stCss || typeof document === "undefined") return;
  stCss = true;
  const st = document.createElement("style");
  st.textContent = ST_CSS;
  document.head.appendChild(st);
}

/** 손그림 버튼 (3조각 배경). kind = 파랑(광고) · 주황(다음/다시) · 갈색(지도로) */
function stButton(kind: "blue" | "orange" | "brown", text: string, size = 50): Ui.Button {
  const b = document.createElement("button") as Ui.Button;
  b.className = `st-btn ${kind}`;
  b.textContent = text;
  b.setColor = () => undefined;
  const m = ST_BTN[kind];
  const H = Math.round(m.h * ST_K);
  const lw = (m.l * H) / m.h;
  const rw = (m.r * H) / m.h;
  Object.assign(b.style, {
    height: `${H}px`,
    minWidth: `${Math.ceil(lw + rw + 20)}px`,
    fontSize: `${size}px`,
    backgroundImage: `${ST_ART(kind + "_l")}, ${ST_ART(kind + "_r")}, ${ST_ART(kind + "_m")}`,
    backgroundPosition: `left top, right top, ${Math.floor(lw - 1)}px top`,
    backgroundSize: `auto 100%, auto 100%, calc(100% - ${Math.floor(lw + rw - 2)}px) 100%`,
  });
  return b;
}

const STAR_IMG: HTMLImageElement | null = (() => {
  if (typeof Image === "undefined") return null;
  const im = new Image();
  im.src = "assets/art/ui/st_star.webp";
  return im;
})();

/** 가운데 칸(안내 칩 · 메뉴 그림)이 넘치면: 칩 글자를 줄이고, 그래도 넘치면 메뉴 그림을 뺀다 (가게 마지막 스테이지는 칩이 3개) */
function fitMid(mid: HTMLElement): void {
  const fit = (): void => {
    if (!mid.isConnected) return;
    const over = (): boolean => mid.scrollHeight > mid.clientHeight + 1;
    let size = 31;
    while (over() && size > 23) {
      size -= 2;
      mid.style.gap = `${Math.max(6, size - 19)}px`;
      for (const n of Array.from(mid.querySelectorAll<HTMLElement>(".st-note"))) {
        n.style.padding = `${Math.round(size * 0.25)}px 28px ${Math.round(size * 0.33)}px`;
        const t = n.firstElementChild as HTMLElement | null;
        if (t !== null) t.style.fontSize = `${size}px`;
      }
    }
    if (over()) for (const c of Array.from(mid.querySelectorAll<HTMLElement>("canvas"))) c.parentElement === mid ? c.remove() : c.parentElement?.remove();
  };
  requestAnimationFrame(() => requestAnimationFrame(fit));
}

/** 손그림 금색 별 줄 (예시 그림처럼 한 줄로 같은 크기). 받은 별은 하나씩 톡 튀어나오고, 못 받은 별은 회색 */
function artStars(stars: number, w = 600, h = 132, cell = 117, pop = true): CanvasWidget {
  const wd = new CanvasWidget(w, h, (g, t) => {
    const img = STAR_IMG !== null && STAR_IMG.complete && STAR_IMG.naturalWidth > 0 ? STAR_IMG : null;
    const ctx = g.ctx;
    for (let i = 0; i < D.MAX_STARS; i++) {
      const on = i < stars;
      let k = 1.0;
      let shown = on;
      if (pop && on) {
        const tt = t - 0.35 - i * 0.25;
        if (tt < 0) shown = false;
        else if (tt < 0.3) k = 1.0 + Math.sin((tt / 0.3) * Math.PI) * 0.45;
      }
      const cx = w * 0.5 + (i - (D.MAX_STARS - 1) * 0.5) * cell;
      const cy = h * 0.5;
      if (img === null) {
        FoodArt.gameStar(g, v(cx, cy), cell * 0.4 * k, shown);
        continue;
      }
      const sw = cell * 0.97 * k;
      const sh = (sw * img.height) / img.width;
      ctx.save();
      if (!shown) {
        ctx.filter = "grayscale(1) brightness(0.62)";
        ctx.globalAlpha = 0.9;
      }
      ctx.drawImage(img, cx - sw * 0.5, cy - sh * 0.5, sw, sh);
      ctx.restore();
    }
  });
  if (pop) wd.animated = true;
  wd.el.style.alignSelf = "center";
  return wd;
}


/** 정산 배경: 영업 끝에 내려온 줄무늬 천막이 그대로 닫혀 있고, 가운데가 등불처럼 따뜻하게 밝다 */
class ClosedTarp extends Node2D {
  size = v(1920, 1080);
  draw(g: Gfx): void {
    const w = this.size.x;
    const h = this.size.y;
    const ctx = g.ctx;
    // 2026-11-22 사용자 그림 (영업 끝에 내려온 줄무늬 천막과 같은 그림) — 글씨가 잘 보이게 살짝 어둡게 + 가운데 등불 빛
    const img = ArtAssets.tarpImage();
    if (img !== null) {
      ArtAssets.drawCover(ctx, img, 0, 0, w, h);
      ctx.fillStyle = "rgba(24, 10, 5, 0.32)";
      ctx.fillRect(0, 0, w, h);
      const vg = ctx.createRadialGradient(w * 0.5, h * 0.45, h * 0.15, w * 0.5, h * 0.5, w * 0.62);
      vg.addColorStop(0, "rgba(255,190,90,0.10)");
      vg.addColorStop(0.6, "rgba(20,8,4,0.32)");
      vg.addColorStop(1, "rgba(10,4,2,0.7)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
      return;
    }
    const stripe = 90.0;
    for (let i = 0; i * stripe < w; i++) g.rect(new R(i * stripe, 0, stripe, h), (i % 2 === 0 ? TARP_RED : TARP_CREAM).darkened(0.42));
    // 주름 그림자
    for (let i = 0; i * stripe < w; i++) {
      const gr = ctx.createLinearGradient(i * stripe, 0, (i + 1) * stripe, 0);
      gr.addColorStop(0, "rgba(0,0,0,0.18)");
      gr.addColorStop(0.35, "rgba(255,255,255,0.05)");
      gr.addColorStop(1, "rgba(0,0,0,0.22)");
      ctx.fillStyle = gr;
      ctx.fillRect(i * stripe, 0, stripe, h);
    }
    const vg = ctx.createRadialGradient(w * 0.5, h * 0.45, h * 0.15, w * 0.5, h * 0.5, w * 0.62);
    vg.addColorStop(0, "rgba(255,190,90,0.12)");
    vg.addColorStop(0.6, "rgba(20,8,4,0.45)");
    vg.addColorStop(1, "rgba(10,4,2,0.82)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }
}

/** 영수증 한 줄: 이름 · 점선 · 금액 (이름 글자 크기 = size, 금액은 size + 2) */
function receiptRow(left: string, right: string, size: number, color: Color, rightColor: Color): HTMLDivElement {
  const h = Ui.hbox(12);
  h.style.alignItems = "baseline";
  const l = Ui.label(left, size, color, "left");
  const dots = Ui.div("dots");
  dots.style.flex = "1 1 auto";
  h.append(l, dots, Ui.heading(right, size + 2, rightColor, null, "right"));
  return h;
}

export class SettlementScene extends Scene {
  private r!: ShiftResult;
  private doubled = false;
  private totalLabel!: HTMLDivElement;
  private doubleBtn: Ui.Button | null = null;
  private buttons!: HTMLDivElement;

  ready(): void {
    this.clearColor = rgb(0.06, 0.06, 0.11);
    if (GameState.lastResult === null) {
      this.game.goto("title");
      return;
    }
    this.r = GameState.lastResult;
    const tarp = new ClosedTarp();
    tarp.size = v(this.vw, this.vh);
    this.add(tarp);
    const rain = new RainFx();
    rain.area = new R(0, 0, this.vw, this.vh);
    this.add(rain);
    this.build();
    Sound.playBgm("settlement");
    if (this.r.passed && !this.r.endless) Sound.playSfx("fanfare");
  }

  private endless(): boolean {
    return this.r.endless;
  }

  private passed(): boolean {
    return this.r.passed;
  }

  /** 영수증 종이 (그림) + 리본 제목 → 줄을 넣을 세로 상자. 자리는 잘라 낸 그림 px (st_card 758×600, 예시 그림 (41, 168)) */
  private receiptCard(root: HTMLElement, title: string): HTMLDivElement {
    const card = Ui.div("st-card panel pop");
    Object.assign(card.style, { left: SU(41), top: SU(168), width: SU(758), height: SU(600), backgroundImage: ST_ART("card"), padding: "0", border: "0", boxShadow: "none" });
    card.style.background = `${ST_ART("card")} center / 100% 100% no-repeat`;
    root.appendChild(card);
    const t = Ui.heading(title, 50, Ui.CREAM, Ui.INK);
    Object.assign(t.style, { position: "absolute", left: SU(221), top: SU(16), width: SU(344), height: SU(74), display: "flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap" });
    card.appendChild(t);
    const rc = Ui.div("st-rc");
    Object.assign(rc.style, { left: SU(46), top: SU(112), width: SU(670), height: SU(466) });
    card.appendChild(rc);
    return rc;
  }

  /** 오른쪽 세로 줄: 위(제목·별) · 가운데(안내 칩·메뉴 그림, 남는 자리) · 아래(버튼) */
  private sideColumn(root: HTMLElement): { top: HTMLDivElement; mid: HTMLDivElement } {
    const side = Ui.div("st-side");
    Object.assign(side.style, { left: SU(812), top: SU(92), width: SU(828), height: SU(780) });
    root.appendChild(side);
    const top = Ui.div();
    Object.assign(top.style, { display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" });
    side.appendChild(top);
    const mid = Ui.div("st-mid");
    side.appendChild(mid);
    this.buttons = Ui.div("st-btns");
    side.appendChild(this.buttons);
    return { top, mid };
  }

  /** "할당량 달성!" 같은 큰 제목 + 양옆 반짝 선 (예시 그림) */
  private titleWithBursts(el: HTMLElement): HTMLElement {
    const row = Ui.hbox(10);
    row.style.alignItems = "center";
    const burst = (n: string, w: number, h: number): HTMLDivElement => {
      const b = Ui.div();
      Object.assign(b.style, { width: SU(w), height: SU(h), background: `${ST_ART(n)} center / 100% 100% no-repeat`, flex: "0 0 auto" });
      return b;
    };
    row.append(burst("burst_l", 84, 97), el, burst("burst_r", 90, 96));
    return row;
  }

  /** 가로 화면: 왼쪽 영수증(금액), 오른쪽 결과·별점·버튼 */
  private build(): void {
    const r = this.r;
    ensureStCss();
    const root = Ui.div("st");
    root.style.left = `${(this.vw - 1920) * 0.5}px`;
    this.ui.appendChild(root);
    if (r.event) {
      this.buildEvent(root);
      return;
    }
    const shop = D.shopDef(r.shop ?? "pocha");
    const rc = this.receiptCard(root, this.endless() ? "무한 영업 결과" : `${D.levelName(r.level)} 정산`);
    rc.appendChild(Ui.label(`— ${shop.name} 영수증 —`, 30, Ui.MUTED));
    rc.appendChild(receiptRow("판매", D.formatWon(r.sales), 38, Ui.INK, Ui.INK));
    rc.appendChild(receiptRow("팁", "+" + D.formatWon(r.tips), 38, Ui.INK, Ui.GOOD));
    if (r.waste > 0) rc.appendChild(receiptRow("폐기 손실", "-" + D.formatWon(r.waste), 38, Ui.INK, Ui.BAD));
    rc.appendChild(Ui.div("st-dash"));
    const totalRow = Ui.hbox(12);
    totalRow.style.alignItems = "center";
    const tl = Ui.heading("오늘 매출", 50, Ui.INK, null, "left");
    tl.style.flex = "1 1 auto";
    this.totalLabel = Ui.heading("", 60, Ui.ACCENT, null, "right");
    totalRow.append(tl, Ui.icon(Ui.ICON.coin, 60), this.totalLabel);
    rc.appendChild(totalRow);
    this.refreshTotal();
    if (this.endless()) rc.appendChild(receiptRow("버틴 시간", D.formatTime(r.elapsed), 34, Ui.MUTED, Ui.MUTED));
    else rc.appendChild(receiptRow("할당량", D.formatWon(r.target), 34, Ui.MUTED, Ui.MUTED));
    if (r.rating_start !== undefined && r.rating_end !== undefined) {
      const d = r.rating_end - r.rating_start;
      const names: Record<string, string> = { good: "맛있어요", cheap: "가성비 최고", pricey: "비싸요", slow: "너무 늦어요", bad: "별로예요" };
      const tags = Object.entries(r.review_tags ?? {})
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${names[k] ?? k} ${n}`);
      rc.appendChild(
        receiptRow(`가게 평점 ★${r.rating_start.toFixed(1)} → ★${r.rating_end.toFixed(1)}`, `${d >= 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(1)}`, 32, Ui.INK, d >= 0 ? Ui.GOOD : Ui.BAD),
      );
      if (tags.length > 0) rc.appendChild(Ui.label(`손님 평: ${tags.join(" · ")}`, 28, Ui.MUTED, "center", true));
    }
    const wasted = r.wasted ?? 0;
    const stat = Ui.div("st-pill");
    stat.appendChild(Ui.label(`완벽 서빙 ${D.roundHalfAway(r.perfect_ratio * 100.0)}% · 만족 ${r.happy}명 · 화난 손님 ${r.angry}명${wasted > 0 ? ` · 버린 음식 ${wasted}그릇` : ""}`, 28, Ui.INK, "center", true));
    rc.appendChild(stat);

    const { top, mid } = this.sideColumn(root);
    if (this.endless()) {
      const best = GameState.bestEndlessFor(shop.id);
      const isBest = r.revenue >= best && best > 0;
      top.appendChild(Ui.heading(isBest ? "최고 기록 갱신!" : `최고 기록 ${D.formatWon(best)}`, isBest ? 84 : 58, isBest ? Ui.GOLD : Ui.CREAM, rgb(0.12, 0.05, 0.02)));
    } else if (this.passed()) {
      top.appendChild(this.titleWithBursts(Ui.logo("할당량 달성!", 96)));
    } else {
      top.appendChild(Ui.heading("할당량 미달…", 86, rgb(1.0, 0.62, 0.55), rgb(0.3, 0.05, 0.03)));
    }
    top.appendChild(artStars(r.stars).el);

    // 재료가 바닥난 메뉴 알림 (다음 영업 전에 장보기)
    if (r.stock_left !== undefined) {
      const empty = Object.keys(r.stock_left).filter((m) => r.stock_left![m] <= 2 && D.menuUnlockLevel(m) <= Math.max(r.level, GameState.level));
      if (empty.length > 0) mid.appendChild(this.note(`재료가 거의 없어요: ${empty.map((m) => `${D.menuName(m)} ${r.stock_left![m]}인분`).join(", ")}\n지도의 '장보기'에서 채워 두세요`, Ui.CREAM));
    }
    // 외상(지갑 마이너스)은 오늘 번 돈에서 갚는다
    if (GameState.wallet < 0) {
      const left = -(GameState.wallet + Math.max(0, r.revenue));
      mid.appendChild(this.note(left > 0 ? `외상이 아직 ${D.formatWon(left)} 남았어요` : `재료 외상 ${D.formatWon(-GameState.wallet)}을 오늘 번 돈으로 갚았어요`, rgb(1.0, 0.86, 0.7)));
    }
    const regulars = r.regulars ?? [];
    if (regulars.length > 0) {
      const names: string[] = [];
      for (const id of regulars) {
        const n = D.regularDef(id)?.name ?? "";
        if (n !== "" && !names.includes(n)) names.push(n);
      }
      mid.appendChild(this.note("다녀간 단골: " + names.join(", "), rgb(1.0, 0.88, 0.66)));
    }

    if (!this.endless() && this.passed() && r.level < D.TOTAL_LEVELS) {
      const nextLv = r.level + 1;
      const nextShop = D.shopForLevel(nextLv);
      if (nextShop.id !== shop.id) {
        if (GameState.shopOpened(nextShop.id)) {
          mid.appendChild(this.note(`${shop.name} 마지막 스테이지 클리어!`, rgb(1.0, 0.88, 0.55)));
        } else {
          mid.appendChild(
            this.note(`${shop.name} 마지막 스테이지 클리어!\n무한 영업으로 돈을 모아 새 가게를 열어요\n다음 가게: ${nextShop.name} · ${D.formatWon(D.shopOpenCost(nextShop.id))}`, rgb(1.0, 0.88, 0.55)),
          );
        }
        // 가게 사이 길에 미식가 이벤트가 열림 (한 번만)
        if (D.eventFor(shop.id) !== null && !GameState.eventPlayed(shop.id)) {
          mid.appendChild(this.note("가게 사이 길에 까다로운 미식가가 찾아왔어요!\n지도에서 딱 한 번 도전할 수 있어요", rgb(0.9, 0.78, 1.0)));
        }
      } else {
        const unlocks: string[] = [];
        for (const mid2 of D.menusUnlockedOn(nextLv)) unlocks.push(D.menuName(mid2));
        for (const cid of D.customersUnlockedOn(nextLv)) unlocks.push(D.CUSTOMERS[cid].name);
        if (unlocks.length > 0) mid.appendChild(this.note(`${D.levelName(nextLv)} 새로 등장: ${unlocks.join(", ")}`, Ui.CREAM));
        this.addMenuPics(mid, D.menusUnlockedOn(nextLv));
      }
    }
    this.buildButtons();
    fitMid(mid);
  }

  /** 미식가 이벤트 정산: 왼쪽 영수증(요리 값), 오른쪽 미식가 얼굴·별·한줄평 → "다음 이야기" (신문 → 손님이 몰림 → 매출 상승) */
  private buildEvent(root: HTMLElement): void {
    const r = this.r;
    const gr = r.gourmet ?? { grade: 0, satisfaction: 0, reward: 0, perfect: 0, cooked: 0, bad: 0, missed: 0, total: 0 };
    const shop = D.shopDef(r.shop ?? "pocha");
    const rc = this.receiptCard(root, "미식가의 평가");
    rc.appendChild(Ui.label(`— ${shop.name} · 미식가 방문 —`, 30, Ui.MUTED));
    rc.appendChild(receiptRow("요리 값", D.formatWon(r.sales), 38, Ui.INK, Ui.INK));
    rc.appendChild(receiptRow("팁", "+" + D.formatWon(r.tips), 38, Ui.INK, Ui.GOOD));
    if (r.waste > 0) rc.appendChild(receiptRow("폐기 손실", "-" + D.formatWon(r.waste), 38, Ui.INK, Ui.BAD));
    rc.appendChild(Ui.div("st-dash"));
    const totalRow = Ui.hbox(12);
    totalRow.style.alignItems = "center";
    const tl = Ui.heading("받는 돈", 50, Ui.INK, null, "left");
    tl.style.flex = "1 1 auto";
    this.totalLabel = Ui.heading(D.formatWon(Math.max(0, r.revenue)), 60, Ui.ACCENT, null, "right");
    totalRow.append(tl, Ui.icon(Ui.ICON.coin, 60), this.totalLabel);
    rc.appendChild(totalRow);
    const stat = Ui.div("st-pill");
    stat.appendChild(
      Ui.label(`요리 ${gr.total}개 · 완벽 ${gr.perfect} · 익음 ${gr.cooked} · 탐·덜 익음 ${gr.bad} · 놓침 ${gr.missed}\n만족도 ${D.roundHalfAway(gr.satisfaction * 100)}%`, 28, Ui.INK, "center", true),
    );
    rc.appendChild(stat);

    const { top, mid } = this.sideColumn(root);
    const face = gourmetPortrait(shop.id, 190);
    top.appendChild(face.el);
    top.appendChild(Ui.heading(D.GOURMET_VERDICTS[gr.grade] || "다음 기회는 없네…", gr.grade >= 4 ? 78 : 62, gr.grade >= 4 ? Ui.GOLD : Ui.CREAM, rgb(0.12, 0.05, 0.02)));
    top.appendChild(artStars(gr.grade, 600, 124, 110).el);
    mid.appendChild(this.note(`"${D.gourmetReview(D.eventFor(shop.id)?.critic ?? "", gr.grade)}"\n— ${D.criticName(D.eventFor(shop.id)?.critic ?? "")}`, rgb(1.0, 0.88, 0.7)));
    if (gr.grade <= 0) {
      Ui.lively(this.addButton("지도로", "orange", "map"));
      return;
    }
    const next = stButton("orange", "");
    next.classList.add("purple");
    Ui.withIcon(next, Ui.ICON.play, "다음 이야기");
    Ui.lively(next);
    Ui.onPress(next, () => this.fameStory(0));
    this.buttons.appendChild(next);
  }

  // ---------------------------------------------------------------- 미식가 이야기 (유명세)

  private story: HTMLDivElement | null = null;

  /** 미식가 리뷰 이야기: 0 = 신문에 실림, 1 = 손님이 몰림, 2 = 매출이 오름 → 지도로 */
  private fameStory(step: number): void {
    const r = this.r;
    const gr = r.gourmet!;
    const shop = D.shopDef(r.shop);
    this.story?.remove();
    const ov = Ui.overlay(this.ui, 0.8);
    ov.classList.add("center");
    ov.style.zIndex = "30"; // 뒤 영수증의 리본(z-index)보다 위
    this.story = ov;
    const p = Ui.popPanel(step === 0 ? rgb(0.97, 0.94, 0.86) : Ui.PAPER, 30, 34);
    p.style.width = "1180px";
    ov.appendChild(p);
    const col = Ui.vbox(16);
    p.appendChild(col);
    const caption = (t: string) => col.appendChild(Ui.label(t, 32, Ui.MUTED, "center", true));
    const nextBtn = (text: string, fn: () => void) => {
      const b = Ui.button("", Ui.EVENT, 40, 108);
      Ui.withIcon(b, Ui.ICON.play, text);
      Ui.lively(b);
      b.style.alignSelf = "center";
      b.style.minWidth = "420px";
      Ui.onPress(b, fn);
      col.appendChild(b);
    };
    if (step === 0) {
      // 신문: 맛집 일보
      p.prepend(Ui.ribbon("며칠 뒤…", Ui.EVENT, 44));
      caption(`${D.criticName(D.eventFor(shop.id)?.critic ?? "")}의 리뷰가 신문에 실렸어요!`);
      const paper = Ui.div();
      paper.style.background = "#fbf6e8";
      paper.style.border = "4px solid #3b2415";
      paper.style.borderRadius = "10px";
      paper.style.padding = "18px 28px 22px";
      paper.style.boxShadow = "6px 8px 0 rgba(40,20,8,0.25)";
      paper.style.rotate = "-1.2deg";
      col.appendChild(paper);
      const mast = Ui.hbox(12);
      mast.style.alignItems = "baseline";
      mast.style.borderBottom = "4px double #3b2415";
      mast.style.paddingBottom = "6px";
      const name = Ui.heading("맛집 일보", 54, Ui.INK, null, "left");
      name.style.flex = "1 1 auto";
      mast.append(name, Ui.label("오늘의 맛집", 24, Ui.MUTED, "right"));
      paper.appendChild(mast);
      const row = Ui.hbox(22);
      row.style.alignItems = "center";
      row.style.marginTop = "12px";
      paper.appendChild(row);
      row.appendChild(gourmetPortrait(shop.id, 170).el);
      const text = Ui.vbox(8);
      text.style.flex = "1 1 auto";
      row.appendChild(text);
      text.appendChild(Ui.heading(D.FAME_HEADLINES[gr.grade].replace("%s", shop.name), 40, Ui.INK, null, "left", true));
      text.appendChild(starRow(gr.grade, 360, 70, 30).el);
      text.appendChild(Ui.label(`"${D.gourmetReview(D.eventFor(shop.id)?.critic ?? "", gr.grade)}"  — ${D.criticName(D.eventFor(shop.id)?.critic ?? "")}`, 27, Ui.INK, "left", true));
      nextBtn("다음", () => this.fameStory(1));
      return;
    }
    if (step === 1) {
      // 소문이 퍼져 가게 앞에 손님들이 줄을 섬
      p.prepend(Ui.ribbon(gr.grade <= D.BAD_GRADE ? "나쁜 소문이 퍼졌어요…" : "소문이 퍼졌어요!", gr.grade <= D.BAD_GRADE ? Ui.BAD : Ui.EVENT, 44));
      // 사용자 그림이 있는 가게는 별 수에 맞는 가게 앞 그림 (5 = 끝없는 줄 … 1 = 자물쇠 잠긴 포장마차), 없으면 직접 그린 줄
      const art = ArtAssets.fameImagePath(shop.id, gr.grade);
      col.appendChild(art !== null ? this.famePicture(art) : this.crowdPicture(gr.grade));
      col.appendChild(Ui.heading(D.FAME_CROWD[gr.grade], 36, Ui.INK, null, "center", true));
      nextBtn("다음", () => this.fameStory(2));
      return;
    }
    const before = GameState.liveRating(shop.id);
    const after = Math.min(5, Math.max(1, before + (D.FAME_RATING[gr.grade] ?? 0)));
    if (gr.grade <= D.BAD_GRADE) {
      // 혹평 (2026-11-20 사용자 "별 1·2개는 악담, 별 1개는 당분간 문 닫는다고"): 손님이 끊기고 평점이 떨어짐, 별 1개 = 당분간 휴업
      const closed = gr.grade <= 1;
      p.prepend(Ui.ribbon(closed ? "당분간 휴업…" : "손님이 줄었어요…", Ui.BAD, 44));
      caption(closed ? `혹평 때문에 ${shop.name}에 손님이 한 명도 오지 않았어요` : `나쁜 소문 때문에 ${shop.name}에 손님이 뚝 줄었어요`);
      if (closed) {
        const sign = Ui.div();
        Object.assign(sign.style, { alignSelf: "center", padding: "18px 46px 22px", background: "#f4ead2", border: "6px solid #3b2415", borderRadius: "12px", rotate: "-3deg", boxShadow: "6px 8px 0 rgba(40,20,8,0.3)" });
        sign.appendChild(Ui.heading("당분간 휴업합니다", 64, Ui.BAD, null));
        sign.appendChild(Ui.label("— 사장 올림 —", 28, Ui.MUTED, "center"));
        col.appendChild(sign);
      }
      // 적자 (손님이 끊긴 동안 재료·가겟세는 그대로 나감)
      const loss = Ui.hbox(14);
      loss.style.justifyContent = "center";
      loss.style.alignItems = "center";
      loss.append(Ui.icon(Ui.ICON.coin, 76), Ui.heading(`적자 −${D.formatWon(-gr.reward)}`, 76, Ui.BAD, rgb(0.25, 0.05, 0.03)));
      col.appendChild(loss);
      col.appendChild(Ui.label(closed ? "문을 닫은 동안에도 가겟세와 상한 재료값은 나갔어요…" : "손님이 줄어도 가겟세와 재료값은 그대로 나갔어요…", 27, Ui.MUTED, "center", true));
      col.appendChild(Ui.heading(`가게 평점 ★${before.toFixed(1)} → ★${after.toFixed(1)}`, 40, Ui.BAD, null));
      col.appendChild(Ui.label(closed ? "가게 문을 잠시 닫고 마음을 다잡았어요. 다음엔 꼭 좋은 평가를 받아요!" : "평점이 떨어지면 손님이 덜 기다려 줘요. 다음엔 실력으로 보여 줘요!", 27, Ui.MUTED, "center", true));
      nextBtn("다시 힘내요", () => this.finish(false, "map"));
      return;
    }
    if (gr.reward <= 0) {
      // 별 3개: 평범한 평가 — 유명세 매출은 없고 평점만 조금 (2026-11-21 사용자 "별 3개에는 없음")
      p.prepend(Ui.ribbon("조금 알려졌어요", Ui.EVENT, 44));
      caption(`${shop.name}의 이름이 조금 알려졌어요`);
      col.appendChild(Ui.heading("유명세 매출 없음", 60, Ui.MUTED, null));
      col.appendChild(Ui.heading(`가게 평점 ★${before.toFixed(1)} → ★${after.toFixed(1)}`, 40, Ui.GOOD, null));
      col.appendChild(Ui.label("별 4개 이상을 받아야 손님이 몰려와 매출이 올라요. 다음엔 더 완벽하게!", 27, Ui.MUTED, "center", true));
      nextBtn("좋아요!", () => this.finish(false, "map"));
      return;
    }
    // 매출이 오름 + 가게 평점이 오름
    p.prepend(Ui.ribbon("매출이 올랐어요!", Ui.GOOD, 44));
    caption(`${shop.name}에 몰려든 손님 덕분에`);
    const money = Ui.hbox(14);
    money.style.justifyContent = "center";
    money.style.alignItems = "center";
    money.append(Ui.icon(Ui.ICON.coin, 84), Ui.heading(`매출 +${D.formatWon(gr.reward)}`, 84, Ui.GOLD, rgb(0.3, 0.15, 0.02)));
    col.appendChild(money);
    col.appendChild(Ui.heading(`가게 평점 ★${before.toFixed(1)} → ★${after.toFixed(1)}`, 40, Ui.GOOD, null));
    col.appendChild(Ui.label("유명해진 가게는 손님이 더 너그럽게 기다려 줘요.", 27, Ui.MUTED, "center", true));
    nextBtn("좋아요!", () => this.finish(false, "map"));
  }

  /** 가게 앞 그림 (사용자 일러스트, 16:9) */
  private famePicture(src: string): HTMLElement {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    Object.assign(img.style, { width: "1000px", height: "563px", objectFit: "cover", alignSelf: "center", borderRadius: "18px", border: "4px solid #3b2415", boxShadow: "0 10px 18px rgba(40,20,8,0.35)" });
    return img;
  }

  /** 가게 앞에 줄 선 손님들 (별이 많을수록 길게). 혹평(별 1·2)이면 텅 빈 가게 앞 — 별 1 = 셔터 "당분간 휴업", 별 2 = 손님 하나가 돌아섬 */
  private crowdPicture(grade: number): HTMLElement {
    const w = 1080;
    const h = 300;
    const bad = grade <= D.BAD_GRADE;
    const closed = grade <= 1;
    const n = bad ? (closed ? 0 : 1) : 3 + grade * 2;
    const widget = new CanvasWidget(w, h, (g) => {
      const ctx = g.ctx;
      // 가게 앞 거리 + 간판
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, bad ? "#7d7f92" : "#ffe6bf");
      sky.addColorStop(1, bad ? "#55576a" : "#f7c98f");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#c98d5a";
      ctx.fillRect(0, h - 70, w, 70);
      ctx.fillStyle = "#8a4b2a";
      ctx.fillRect(20, 30, 230, h - 100);
      ctx.fillStyle = bad ? "#b9b2a4" : "#ffd85a";
      ctx.fillRect(40, 50, 190, 46);
      ctx.fillStyle = "#3b2415";
      ctx.font = "28px Jua, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(tr(closed ? "당분간 휴업" : bad ? "오늘은 한산…" : "오늘도 만석!"), 135, 82);
      if (closed) {
        // 내려진 셔터
        ctx.fillStyle = "#8f8f96";
        ctx.fillRect(60, 120, 150, h - 190);
        ctx.strokeStyle = "#5c5c64";
        ctx.lineWidth = 3;
        for (let y = 128; y < h - 70; y += 14) {
          ctx.beginPath();
          ctx.moveTo(60, y);
          ctx.lineTo(210, y);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = bad ? "#6a5f4f" : "#ffeec4";
        ctx.fillRect(60, 120, 150, h - 190);
      }
      if (bad) {
        // 바람에 굴러가는 빈 거리 (낙엽 몇 장)
        ctx.fillStyle = "rgba(120,80,40,0.7)";
        for (const [lx, ly] of [[420, h - 52], [610, h - 40], [840, h - 58]]) {
          ctx.beginPath();
          ctx.ellipse(lx, ly, 12, 5, 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // 줄 선 손님들 (뒤에서 앞으로) = 손님 캐릭터 그림 (2026-11-17 도형 손님 없앰), 아랫몸은 앞 바닥에 가려짐
      const crowd = ArtAssets.guestSpritePool("normal");
      for (let k = n - 1; k >= 0; k--) {
        const x = n === 1 ? 760 : 300 + k * ((w - 360) / Math.max(1, n - 1));
        const name = crowd[k % Math.max(1, crowd.length)];
        const img = name !== undefined ? ArtAssets.customerSprite(name) : null;
        if (img === null) continue;
        ctx.save();
        ctx.translate(x, h - 150 + (k % 2) * 8);
        ctx.scale(bad ? -0.5 : 0.5, 0.5); // 혹평이면 가게 반대쪽을 보며 떠남
        g.texture(img, ArtAssets.customerSpriteRect(name, ArtAssets.SPRITE_SIZE, v(0, 0)));
        ctx.restore();
      }
      ctx.fillStyle = "#c98d5a";
      ctx.fillRect(0, h - 70, w, 70);
    });
    widget.el.style.alignSelf = "center";
    widget.el.style.borderRadius = "18px";
    widget.el.style.border = "4px solid #3b2415";
    return widget.el;
  }

  /** 오른쪽 안내 한 줄 (예시 그림의 나무 칩 위 글자) */
  private note(text: string, color: Color): HTMLDivElement {
    const c = Ui.div("st-note");
    c.appendChild(Ui.label(text, 31, color, "center", true));
    return c;
  }

  /** 다음 스테이지에 새로 나오는 메뉴 그림 (그릇에 담긴 모습) */
  private addMenuPics(parent: HTMLElement, menus: string[]): void {
    if (menus.length === 0) return;
    const row = Ui.hbox(16);
    row.style.justifyContent = "center";
    parent.appendChild(row);
    for (const mid of menus) row.appendChild(menuPic(mid, 190, 130).el);
  }

  private buildButtons(): void {
    const r = this.r;
    if (r.revenue > 0 && (this.passed() || this.endless())) {
      const db = stButton("blue", "", 48);
      Ui.withIcon(db, Ui.ICON.ad, "광고 보고 매출 2배 받기");
      Ui.onPress(db, () => this.onDouble());
      this.buttons.appendChild(db);
      this.doubleBtn = db;
    }
    if (this.endless()) {
      this.addButton("지도로", "orange", "map");
      return;
    }
    const lv = r.level;
    if (this.passed()) {
      const sameShop = lv < D.TOTAL_LEVELS && D.shopIndexForLevel(lv + 1) === D.shopIndexForLevel(lv);
      if (sameShop) {
        const row = Ui.div("st-row");
        this.buttons.appendChild(row);
        this.addButton("지도로", "brown", "map", row).style.width = SU(252);
        const nx = this.addButton("", "orange", "next", row);
        Ui.withIcon(nx, Ui.ICON.play, "다음 스테이지");
        Ui.lively(nx);
        nx.style.flex = "1 1 auto";
      } else {
        Ui.lively(this.addButton("다음으로", "orange", "map"));
      }
      return;
    }
    const passBtn = stButton("blue", "", 44);
    Ui.withIcon(passBtn, Ui.ICON.ad, "광고 보고 이번 스테이지 통과 (1회)");
    Ui.onPress(passBtn, () => {
      passBtn.disabled = true;
      showRewarded("pass_level", () => this.finish(true, "map"));
    });
    this.buttons.appendChild(passBtn);
    const row2 = Ui.div("st-row");
    this.buttons.appendChild(row2);
    this.addButton("지도로", "brown", "map", row2).style.width = SU(252);
    const again = this.addButton("다시 도전", "orange", "retry", row2);
    Ui.lively(again);
    again.style.flex = "1 1 auto";
  }

  private addButton(text: string, kind: "blue" | "orange" | "brown", route: string, parent: HTMLElement | null = null): Ui.Button {
    const b = stButton(kind, text);
    Ui.onPress(b, () => this.finish(false, route));
    (parent ?? this.buttons).appendChild(b);
    return b;
  }

  private refreshTotal(): void {
    const total = this.r.revenue;
    if (this.doubled) {
      Ui.setText(this.totalLabel, `${D.formatWon(total * 2)} (×2)`);
      Ui.setColor(this.totalLabel, Ui.AD);
    } else {
      Ui.setText(this.totalLabel, D.formatWon(total));
    }
  }

  private onDouble(): void {
    const db = this.doubleBtn!;
    db.disabled = true;
    showRewarded("double_revenue", () => {
      this.doubled = true;
      db.textContent = "매출 2배 적용됨";
      this.refreshTotal();
    });
  }

  /** route: next = 다음 레벨 바로 시작, retry = 같은 레벨 다시, map = 스테이지 지도 */
  private finish(adPass: boolean, route: string): void {
    const wasEndless = this.endless();
    const lv = this.r.level ?? 1;
    GameState.settle(this.doubled, adPass);
    if (GameState.justCleared) {
      this.game.goto("title");
    } else if (GameState.justOpened !== "") {
      this.game.goto("stage_open");
    } else if (!wasEndless && route === "next" && GameState.levelOpen(lv + 1)) {
      GameState.chooseLevel(lv + 1);
      this.game.goto("shift");
    } else if (!wasEndless && route === "retry") {
      GameState.chooseLevel(lv);
      this.game.goto("shift");
    } else {
      this.game.goto("map");
    }
  }
}
