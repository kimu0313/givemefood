// 정산: 매출·팁·별점·다음 레벨에 열리는 것, 리워드 광고(매출 2배 / 할당량 미달 시 통과 1회)
// 버튼: 깼으면 다음 스테이지 / 지도로 (가게 마지막 스테이지면 다음으로 → 지도에서 새 가게 사기), 못 깼으면 광고로 통과 / 다시 도전 / 지도로

import { type Color, R, rgb, v } from "../engine/geom.ts";
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

  /** 미식가 이벤트 정산: 왼쪽 영수증(요리 값 + 미식가 보상), 오른쪽 미식가 얼굴·별·한줄평 */
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
    rc.appendChild(receiptRow(`미식가 보상 (별 ${gr.grade}개)`, "+" + D.formatWon(gr.reward), 34, Ui.INK, Ui.EVENT));
    rc.appendChild(Ui.divider());
    const totalRow = Ui.hbox(12);
    totalRow.style.alignItems = "center";
    const tl = Ui.heading("받는 돈", 40, Ui.INK, null, "left");
    tl.style.flex = "1 1 auto";
    this.totalLabel = Ui.heading(D.formatWon(Math.max(0, r.revenue) + gr.reward), 50, Ui.ACCENT, null, "right");
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
    const face = gourmetPortrait(210);
    side.appendChild(face.el);
    side.appendChild(Ui.heading(D.GOURMET_VERDICTS[gr.grade] || "다음 기회는 없네…", gr.grade >= 4 ? 80 : 64, gr.grade >= 4 ? Ui.GOLD : Ui.CREAM, rgb(0.12, 0.05, 0.02)));
    side.appendChild(starRow(gr.grade, 520, 110, 46, true).el);
    side.appendChild(this.note(`"${D.GOURMET_REVIEWS[gr.grade]}"\n— ${D.CUSTOMERS.gourmet.name}`, rgb(1.0, 0.86, 0.66)));
    side.appendChild(Ui.spacer(6));
    this.buttons = Ui.vbox(14);
    this.buttons.style.alignSelf = "stretch";
    side.appendChild(this.buttons);
    Ui.lively(this.addButton("지도로", Ui.ACCENT, "map"));
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
