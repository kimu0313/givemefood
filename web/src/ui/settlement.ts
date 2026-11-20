// 정산: 매출·팁·별점·다음 레벨에 열리는 것, 리워드 광고(매출 2배 / 할당량 미달 시 통과 1회)
// 버튼: 깼으면 다음 스테이지 / 지도로 (가게 마지막 스테이지면 다음으로 → 지도에서 새 가게 사기), 못 깼으면 광고로 통과 / 다시 도전 / 지도로

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


/** 정산 배경: 영업 끝에 내려온 줄무늬 천막이 그대로 닫혀 있고, 가운데가 등불처럼 따뜻하게 밝다 */
class ClosedTarp extends Node2D {
  size = v(1920, 1080);
  draw(g: Gfx): void {
    const w = this.size.x;
    const h = this.size.y;
    const stripe = 90.0;
    for (let i = 0; i * stripe < w; i++) g.rect(new R(i * stripe, 0, stripe, h), (i % 2 === 0 ? TARP_RED : TARP_CREAM).darkened(0.42));
    const ctx = g.ctx;
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

/** 영수증 한 줄: 이름 · 점선 · 금액 */
function receiptRow(left: string, right: string, size: number, color: Color, rightColor: Color): HTMLDivElement {
  const h = Ui.hbox(12);
  h.style.alignItems = "baseline";
  const l = Ui.label(left, size, color, "left");
  const dots = Ui.div("dots");
  dots.style.flex = "1 1 auto";
  h.append(l, dots, Ui.heading(right, size, rightColor, null, "right"));
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

  /** 가로 화면: 왼쪽 영수증(금액), 오른쪽 결과·별점·버튼 */
  private build(): void {
    const r = this.r;
    if (r.event) {
      this.buildEvent();
      return;
    }
    const m = Ui.screenMargin(this.ui, 84, 50, 80);
    const cols = Ui.hbox(56);
    cols.style.alignItems = "center";
    m.appendChild(cols);

    const receipt = Ui.popPanel(Ui.PAPER, 22, 40);
    receipt.style.width = "800px";
    receipt.style.flex = "0 0 auto";
    cols.appendChild(receipt);
    const shop = D.shopDef(r.shop ?? "pocha");
    const title = this.endless() ? "무한 영업 결과" : `${D.levelName(r.level)} 정산`;
    receipt.appendChild(Ui.ribbon(title, this.endless() ? Ui.AD : Ui.ACCENT, 46));
    const rc = Ui.vbox(12);
    receipt.appendChild(rc);
    rc.appendChild(Ui.label(`— ${shop.name} 영수증 —`, 27, Ui.MUTED));
    rc.appendChild(receiptRow("판매", D.formatWon(r.sales), 34, Ui.INK, Ui.INK));
    rc.appendChild(receiptRow("팁", "+" + D.formatWon(r.tips), 34, Ui.INK, Ui.GOOD));
    if (r.waste > 0) rc.appendChild(receiptRow("폐기 손실", "-" + D.formatWon(r.waste), 34, Ui.INK, Ui.BAD));
    rc.appendChild(Ui.divider());
    const totalRow = Ui.hbox(12);
    totalRow.style.alignItems = "center";
    const tl = Ui.heading("오늘 매출", 40, Ui.INK, null, "left");
    tl.style.flex = "1 1 auto";
    this.totalLabel = Ui.heading("", 50, Ui.ACCENT, null, "right");
    totalRow.append(tl, Ui.icon(Ui.ICON.coin, 52), this.totalLabel);
    rc.appendChild(totalRow);
    this.refreshTotal();
    if (this.endless()) rc.appendChild(receiptRow("버틴 시간", D.formatTime(r.elapsed), 30, Ui.MUTED, Ui.MUTED));
    else rc.appendChild(receiptRow("할당량", D.formatWon(r.target), 30, Ui.MUTED, Ui.MUTED));
    const stat = Ui.inset(12);
    if (r.rating_start !== undefined && r.rating_end !== undefined) {
      const d = r.rating_end - r.rating_start;
      const names: Record<string, string> = { good: "맛있어요", cheap: "가성비 최고", pricey: "비싸요", slow: "너무 늦어요", bad: "별로예요" };
      const tags = Object.entries(r.review_tags ?? {})
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${names[k] ?? k} ${n}`);
      rc.appendChild(
        receiptRow(`가게 평점 ★${r.rating_start.toFixed(1)} → ★${r.rating_end.toFixed(1)}`, `${d >= 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(1)}`, 28, Ui.INK, d >= 0 ? Ui.GOOD : Ui.BAD),
      );
      if (tags.length > 0) rc.appendChild(Ui.label(`손님 평: ${tags.join(" · ")}`, 24, Ui.MUTED, "center", true));
    }
    const wasted = r.wasted ?? 0;
    stat.appendChild(Ui.label(`완벽 서빙 ${D.roundHalfAway(r.perfect_ratio * 100.0)}% · 만족 ${r.happy}명 · 화난 손님 ${r.angry}명${wasted > 0 ? ` · 버린 음식 ${wasted}그릇` : ""}`, 27, Ui.INK, "center", true));
    rc.appendChild(stat);

    const side = Ui.vbox(14);
    side.style.flex = "1 1 auto";
    side.style.alignItems = "center";
    cols.appendChild(side);
    if (this.endless()) {
      const best = GameState.bestEndlessFor(shop.id);
      const isBest = r.revenue >= best && best > 0;
      side.appendChild(Ui.heading(isBest ? "최고 기록 갱신!" : `최고 기록 ${D.formatWon(best)}`, isBest ? 80 : 56, isBest ? Ui.GOLD : Ui.CREAM, rgb(0.12, 0.05, 0.02)));
    } else if (this.passed()) {
      side.appendChild(Ui.logo("할당량 달성!", 92));
    } else {
      side.appendChild(Ui.heading("할당량 미달…", 84, rgb(1.0, 0.62, 0.55), rgb(0.3, 0.05, 0.03)));
    }
    side.appendChild(starRow(r.stars, 560, 120, 50, true).el);

    // 재료가 바닥난 메뉴 알림 (다음 영업 전에 장보기)
    if (r.stock_left !== undefined) {
      const empty = Object.keys(r.stock_left).filter((m) => r.stock_left![m] <= 2 && D.menuUnlockLevel(m) <= Math.max(r.level, GameState.level));
      if (empty.length > 0) side.appendChild(this.note(`재료가 거의 없어요: ${empty.map((m) => `${D.menuName(m)} ${r.stock_left![m]}인분`).join(", ")}\n지도의 '장보기'에서 채워 두세요`, rgb(1.0, 0.7, 0.55)));
    }
    // 외상(지갑 마이너스)은 오늘 번 돈에서 갚는다
    if (GameState.wallet < 0) {
      const left = -(GameState.wallet + Math.max(0, r.revenue));
      side.appendChild(this.note(left > 0 ? `외상이 아직 ${D.formatWon(left)} 남았어요` : `재료 외상 ${D.formatWon(-GameState.wallet)}을 오늘 번 돈으로 갚았어요`, rgb(1.0, 0.8, 0.6)));
    }
    const regulars = r.regulars ?? [];
    if (regulars.length > 0) {
      const names: string[] = [];
      for (const id of regulars) {
        const n = D.regularDef(id)?.name ?? "";
        if (n !== "" && !names.includes(n)) names.push(n);
      }
      side.appendChild(this.note("다녀간 단골: " + names.join(", "), rgb(1.0, 0.82, 0.6)));
    }

    if (!this.endless() && this.passed() && r.level < D.TOTAL_LEVELS) {
      const nextLv = r.level + 1;
      const nextShop = D.shopForLevel(nextLv);
      if (nextShop.id !== shop.id) {
        if (GameState.shopOpened(nextShop.id)) {
          side.appendChild(this.note(`${shop.name} 마지막 스테이지 클리어!`, rgb(1.0, 0.85, 0.5)));
        } else {
          side.appendChild(
            this.note(`${shop.name} 마지막 스테이지 클리어!\n무한 영업으로 돈을 모아 새 가게를 열어요\n다음 가게: ${nextShop.name} · ${D.formatWon(D.shopOpenCost(nextShop.id))}`, rgb(1.0, 0.85, 0.5)),
          );
        }
        // 가게 사이 길에 미식가 이벤트가 열림 (한 번만)
        if (D.eventFor(shop.id) !== null && !GameState.eventPlayed(shop.id)) {
          side.appendChild(this.note("가게 사이 길에 까다로운 미식가가 찾아왔어요!\n지도에서 딱 한 번 도전할 수 있어요", rgb(0.86, 0.72, 1.0)));
        }
      } else {
        const unlocks: string[] = [];
        for (const mid of D.menusUnlockedOn(nextLv)) unlocks.push(D.menuName(mid));
        for (const cid of D.customersUnlockedOn(nextLv)) unlocks.push(D.CUSTOMERS[cid].name);
        if (unlocks.length > 0) side.appendChild(this.note(`${D.levelName(nextLv)} 새로 등장: ${unlocks.join(", ")}`, Ui.CREAM));
        this.addMenuPics(side, D.menusUnlockedOn(nextLv));
      }
    }

    side.appendChild(Ui.spacer(10));
    this.buttons = Ui.vbox(14);
    this.buttons.style.alignSelf = "stretch";
    side.appendChild(this.buttons);
    this.buildButtons();
  }

  /** 미식가 이벤트 정산: 왼쪽 영수증(요리 값), 오른쪽 미식가 얼굴·별·한줄평 → "다음 이야기" (신문 → 손님이 몰림 → 매출 상승) */
  private buildEvent(): void {
    const r = this.r;
    const gr = r.gourmet ?? { grade: 0, satisfaction: 0, reward: 0, perfect: 0, cooked: 0, bad: 0, missed: 0, total: 0 };
    const m = Ui.screenMargin(this.ui, 84, 50, 80);
    const cols = Ui.hbox(56);
    cols.style.alignItems = "center";
    m.appendChild(cols);

    const receipt = Ui.popPanel(Ui.PAPER, 22, 40);
    receipt.style.width = "800px";
    receipt.style.flex = "0 0 auto";
    cols.appendChild(receipt);
    const shop = D.shopDef(r.shop ?? "pocha");
    receipt.appendChild(Ui.ribbon("미식가의 평가", Ui.EVENT, 46));
    const rc = Ui.vbox(12);
    receipt.appendChild(rc);
    rc.appendChild(Ui.label(`— ${shop.name} · 미식가 방문 —`, 27, Ui.MUTED));
    rc.appendChild(receiptRow("요리 값", D.formatWon(r.sales), 34, Ui.INK, Ui.INK));
    rc.appendChild(receiptRow("팁", "+" + D.formatWon(r.tips), 34, Ui.INK, Ui.GOOD));
    if (r.waste > 0) rc.appendChild(receiptRow("폐기 손실", "-" + D.formatWon(r.waste), 34, Ui.INK, Ui.BAD));
    rc.appendChild(Ui.divider());
    const totalRow = Ui.hbox(12);
    totalRow.style.alignItems = "center";
    const tl = Ui.heading("받는 돈", 40, Ui.INK, null, "left");
    tl.style.flex = "1 1 auto";
    this.totalLabel = Ui.heading(D.formatWon(Math.max(0, r.revenue)), 50, Ui.ACCENT, null, "right");
    totalRow.append(tl, Ui.icon(Ui.ICON.coin, 52), this.totalLabel);
    rc.appendChild(totalRow);
    const stat = Ui.inset(12);
    stat.appendChild(
      Ui.label(`요리 ${gr.total}개 · 완벽 ${gr.perfect} · 익음 ${gr.cooked} · 탐·덜 익음 ${gr.bad} · 놓침 ${gr.missed}\n만족도 ${D.roundHalfAway(gr.satisfaction * 100)}%`, 27, Ui.INK, "center", true),
    );
    rc.appendChild(stat);

    const side = Ui.vbox(14);
    side.style.flex = "1 1 auto";
    side.style.alignItems = "center";
    cols.appendChild(side);
    const face = gourmetPortrait(shop.id, 210);
    side.appendChild(face.el);
    side.appendChild(Ui.heading(D.GOURMET_VERDICTS[gr.grade] || "다음 기회는 없네…", gr.grade >= 4 ? 80 : 64, gr.grade >= 4 ? Ui.GOLD : Ui.CREAM, rgb(0.12, 0.05, 0.02)));
    side.appendChild(starRow(gr.grade, 520, 110, 46, true).el);
    side.appendChild(this.note(`"${D.gourmetReview(D.eventFor(shop.id)?.critic ?? "", gr.grade)}"\n— ${D.criticName(D.eventFor(shop.id)?.critic ?? "")}`, rgb(1.0, 0.86, 0.66)));
    side.appendChild(Ui.spacer(6));
    this.buttons = Ui.vbox(14);
    this.buttons.style.alignSelf = "stretch";
    side.appendChild(this.buttons);
    if (gr.grade <= 0) {
      Ui.lively(this.addButton("지도로", Ui.ACCENT, "map"));
      return;
    }
    const next = Ui.button("", Ui.EVENT, 42, 116);
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
      col.appendChild(this.crowdPicture(gr.grade));
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
      col.appendChild(Ui.heading("유명세 매출 없음", 56, Ui.MUTED, null));
      col.appendChild(Ui.heading(`가게 평점 ★${before.toFixed(1)} → ★${after.toFixed(1)}`, 40, Ui.BAD, null));
      col.appendChild(Ui.label(closed ? "가게 문을 잠시 닫고 마음을 다잡았어요. 다음엔 꼭 좋은 평가를 받아요!" : "평점이 떨어지면 손님이 덜 기다려 줘요. 다음엔 실력으로 보여 줘요!", 27, Ui.MUTED, "center", true));
      nextBtn("다시 힘내요", () => this.finish(false, "map"));
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

  /** 오른쪽 안내 한 줄 (어두운 칩 위 글자) */
  private note(text: string, color: Color): HTMLDivElement {
    const c = Ui.chip(22);
    c.style.padding = "8px 26px 10px";
    c.appendChild(Ui.label(text, 29, color, "center", true));
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
      const db = Ui.button("", Ui.AD, 40, 112);
      Ui.withIcon(db, Ui.ICON.ad, "광고 보고 매출 2배 받기");
      Ui.onPress(db, () => this.onDouble());
      this.buttons.appendChild(db);
      this.doubleBtn = db;
    }
    if (this.endless()) {
      this.addButton("지도로", Ui.ACCENT, "map");
      return;
    }
    const lv = r.level;
    if (this.passed()) {
      const sameShop = lv < D.TOTAL_LEVELS && D.shopIndexForLevel(lv + 1) === D.shopIndexForLevel(lv);
      if (sameShop) {
        const row = Ui.hbox(20);
        this.buttons.appendChild(row);
        this.addButton("지도로", Ui.SECONDARY, "map", row).style.minWidth = "260px";
        const nx = this.addButton("", Ui.ACCENT, "next", row);
        Ui.withIcon(nx, Ui.ICON.play, "다음 스테이지");
        Ui.lively(nx);
        nx.style.flex = "1 1 auto";
      } else {
        Ui.lively(this.addButton("다음으로", Ui.ACCENT, "map"));
      }
      return;
    }
    const passBtn = Ui.button("", Ui.AD, 38, 112);
    Ui.withIcon(passBtn, Ui.ICON.ad, "광고 보고 이번 스테이지 통과 (1회)");
    Ui.onPress(passBtn, () => {
      passBtn.disabled = true;
      showRewarded("pass_level", () => this.finish(true, "map"));
    });
    this.buttons.appendChild(passBtn);
    const row2 = Ui.hbox(20);
    this.buttons.appendChild(row2);
    this.addButton("지도로", Ui.SECONDARY, "map", row2).style.minWidth = "260px";
    const again = this.addButton("다시 도전", Ui.ACCENT, "retry", row2);
    Ui.lively(again);
    again.style.flex = "1 1 auto";
  }

  private addButton(text: string, color: Color, route: string, parent: HTMLElement | null = null): Ui.Button {
    const b = Ui.button(text, color, 42, 116);
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
