// 장보기: 가게 메뉴마다 재료를 인분 단위로 산다 (2026-11-16 사용자 "가게 재료도 사고").
// 메뉴 카드 4장 (그릇 그림 · 1인분 값 · 남은 재료 게이지 · +5인분 / 가득 채우기), 아래에 "다음 스테이지에 필요한 만큼 채우기".
// 아직 안 열린 메뉴는 잠김. 지갑보다 비싸면 버튼이 꺼짐 (외상은 스테이지 창의 "모자란 재료 사기"에서만).

import { R, rgb, v } from "../engine/geom.ts";
import type { Gfx } from "../engine/gfx.ts";
import { Scene } from "../engine/game.ts";
import { Node2D } from "../engine/node.ts";
import { Sound } from "../engine/audio.ts";
import * as Ui from "../engine/ui.ts";
import * as D from "../core/defs.ts";
import { GameState } from "../state/game_state.ts";
import { StreetArt } from "../art/street_art.ts";
import { menuPic } from "../shift/shift_hud.ts";
import { Tutorial, elementRect, type TutStep } from "./tutorial.ts";

class Dim extends Node2D {
  size = v(1920, 1080);
  draw(g: Gfx): void {
    g.rect(new R(0, 0, this.size.x, this.size.y), rgb(0.06, 0.03, 0.02, 0.62));
  }
}

export class SupplyScene extends Scene {
  private walletLabel!: HTMLDivElement;
  private shopId = "";
  private cards!: HTMLDivElement;
  private fillBtn!: Ui.Button;
  private backBtn!: Ui.Button;
  /** 튜토리얼이 가리킬 버튼: 메뉴 → +5인분 */
  readonly buyButtons: Record<string, HTMLElement> = {};
  private tut: Tutorial | null = null;

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
    for (const m of shop.menus) art.menuNames.push(D.menuName(m));
    this.add(art);
    const dim = new Dim();
    dim.size = vs;
    this.add(dim);

    const m = Ui.screenMargin(this.ui, 60, 40, 44);
    const col = Ui.vbox(22);
    m.appendChild(col);

    const header = Ui.hbox(20);
    header.style.alignItems = "center";
    col.appendChild(header);
    const titles = Ui.vbox(2);
    titles.style.flex = "1 1 auto";
    titles.appendChild(Ui.heading(`${shop.name} 장보기`, 68, Ui.CREAM, rgb(0.12, 0.05, 0.02), "left"));
    titles.appendChild(Ui.label(`재료는 가게마다 따로 쌓아 둬요 (메뉴마다 ${D.STOCK_MAX}인분까지). 남은 재료는 다음 날에도 써요.`, 28, rgb(1.0, 0.86, 0.66), "left"));
    header.appendChild(titles);
    const wallet = Ui.chip(999);
    wallet.classList.add("hbox");
    wallet.style.alignItems = "center";
    wallet.style.gap = "10px";
    wallet.style.padding = "8px 30px 8px 14px";
    wallet.appendChild(Ui.icon(Ui.ICON.coin, 56));
    this.walletLabel = Ui.heading("", 42, Ui.GOLD, rgb(0.1, 0.05, 0.02), "right");
    wallet.appendChild(this.walletLabel);
    header.appendChild(wallet);

    this.cards = Ui.hbox(16);
    col.appendChild(this.cards);
    col.appendChild(Ui.spacer(0, true));

    const bottom = Ui.hbox(24);
    bottom.style.justifyContent = "center";
    col.appendChild(bottom);
    const back = Ui.button("", Ui.SECONDARY, 40, 108);
    Ui.withIcon(back, Ui.ICON.back, "지도로 돌아가기");
    back.style.width = "480px";
    Ui.onPress(back, () => this.goBack());
    bottom.appendChild(back);
    this.backBtn = back;
    this.fillBtn = Ui.button("", Ui.ACCENT, 38, 108);
    this.fillBtn.style.minWidth = "760px";
    Ui.onPress(this.fillBtn, () => this.fillForNext());
    bottom.appendChild(this.fillBtn);
    this.refresh();
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
        text: `${D.menuName(first)} 재료를 사 볼까요? 한 번 누를 때마다 ${D.STOCK_PACK}인분씩 들어와요. ${need}인분이 될 때까지 눌러 보세요!`,
        target: () => elementRect(this.buyButtons[first], this),
        wait: "enough",
      });
    }
    steps.push({
      text: "좋아요, 재료 준비 끝! 재료가 떨어진 메뉴는 품절이라 손님이 주문하지 않아요. 남은 재료는 다음 날에도 쓸 수 있어요. 이제 지도로 돌아가요.",
      target: () => elementRect(this.backBtn, this),
      wait: "back",
      done: () => GameState.setTutorial("upgrade"),
    });
    return new Tutorial(this, steps);
  }

  process(_dt: number): void {
    this.tut?.update();
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
    return this.backBtn;
  }

  shop(): string {
    return this.shopId;
  }

  /** 이 가게에서 다음에 할 스테이지 (도전 중인 스테이지, 다 깼으면 마지막 스테이지) */
  private nextLevel(): number {
    const shop = D.shopDef(this.shopId);
    return Math.min(Math.max(GameState.level, shop.first_level), shop.last_level);
  }

  private refresh(): void {
    Ui.setText(this.walletLabel, D.formatWon(GameState.wallet));
    Ui.setColor(this.walletLabel, GameState.wallet < 0 ? Ui.BAD : Ui.GOLD);
    this.cards.replaceChildren(...D.shopDef(this.shopId).menus.map((mid) => this.card(mid)), this.powderCard());
    const lv = this.nextLevel();
    const cost = GameState.shortageCost(lv);
    if (cost <= 0) {
      Ui.setText(this.fillBtn, `${D.levelName(lv)}에 필요한 재료는 충분해요`);
      this.fillBtn.disabled = true;
    } else {
      Ui.withIcon(this.fillBtn, Ui.ICON.coin, `${D.levelName(lv)}에 필요한 만큼 채우기 · ${D.formatWon(cost)}`);
      this.fillBtn.disabled = GameState.wallet < cost;
    }
  }

  private fillForNext(): void {
    const lv = this.nextLevel();
    if (GameState.wallet < GameState.shortageCost(lv)) return;
    if (GameState.buyShortage(lv) > 0) Sound.playSfx("coin");
    this.refresh();
    this.checkEnough();
  }

  private card(mid: string): HTMLDivElement {
    const unlocked = D.menuUnlockLevel(mid) <= Math.max(GameState.level, D.shopDef(this.shopId).first_level) || GameState.storyCleared;
    const have = GameState.stockOf(this.shopId, mid);
    const unit = D.ingredientCost(mid);

    const card = Ui.panel(Ui.PAPER, 30, 18);
    card.style.flex = "1 1 0";
    card.style.minWidth = "0";
    card.style.minHeight = "600px";
    const vb = Ui.vbox(10);
    vb.style.flex = "1 1 auto";
    vb.style.alignItems = "stretch";
    card.appendChild(vb);
    const pic = menuPic(mid, 250, 130);
    pic.el.style.alignSelf = "center";
    vb.appendChild(pic.el);
    vb.appendChild(Ui.heading(D.menuName(mid), 40, Ui.INK, null));
    if (!unlocked) {
      const lock = Ui.icon(Ui.ICON.lock, 84);
      lock.style.alignSelf = "center";
      vb.appendChild(lock);
      vb.appendChild(Ui.label(`${D.levelName(D.menuUnlockLevel(mid))}에 열려요`, 28, Ui.MUTED, "center", true));
      card.style.opacity = "0.75";
      return card;
    }
    vb.appendChild(Ui.label(`1인분 재료 ${D.formatWon(unit)}
팔면 ${D.formatWon(D.menuPrice(mid))}`, 23, Ui.MUTED, "center", true));
    const info = Ui.inset(12);
    info.classList.add("vbox");
    info.style.gap = "8px";
    const low = have < (D.stockNeed(this.nextLevel())[mid] ?? 0);
    info.appendChild(Ui.heading(`남은 재료 ${have}인분`, 28, have <= 0 ? Ui.BAD : low ? rgb(0.85, 0.5, 0.05) : Ui.INK, null));
    const gauge = Ui.gauge(240, 22);
    gauge.el.style.alignSelf = "center";
    gauge.set(have / D.STOCK_MAX, have <= 0 ? Ui.BAD : low ? Ui.GOLD : Ui.GOOD);
    info.appendChild(gauge.el);
    vb.appendChild(info);
    vb.appendChild(Ui.spacer(0, true));

    const room = GameState.stockRoom(this.shopId, mid);
    const packN = Math.min(D.STOCK_PACK, room);
    const buy = Ui.button("", Ui.GOOD, 27, 96);
    if (packN <= 0) {
      buy.textContent = "창고가 가득 찼어요";
      buy.disabled = true;
    } else {
      Ui.withIcon(buy, Ui.ICON.coin, `+${packN}인분 · ${D.formatWon(packN * unit)}`);
      buy.disabled = GameState.wallet < packN * unit;
      Ui.onPress(buy, () => this.buy(mid, packN));
    }
    vb.appendChild(buy);
    this.buyButtons[mid] = buy;
    const fullN = room;
    const full = Ui.button(fullN > 0 ? `가득 (+${fullN}) · ${D.formatWon(fullN * unit)}` : "가득 찼어요", Ui.SECONDARY, 22, 80);
    full.disabled = fullN <= 0 || GameState.wallet < fullN * unit;
    Ui.onPress(full, () => this.buy(mid, fullN));
    vb.appendChild(full);
    return card;
  }

  /** 마법의 가루 카드 (모든 가게에서 같이 쓰는 특별 재료) */
  private powderCard(): HTMLDivElement {
    const card = Ui.panel(rgb(0.97, 0.92, 1.0), 30, 18);
    card.style.flex = "1 1 0";
    card.style.minWidth = "0";
    card.style.minHeight = "600px";
    card.style.borderColor = "#4a2470";
    const vb = Ui.vbox(10);
    vb.style.flex = "1 1 auto";
    vb.style.alignItems = "stretch";
    card.appendChild(vb);
    const ic = Ui.icon(Ui.ICON.magic, 130);
    ic.style.alignSelf = "center";
    vb.appendChild(ic);
    vb.appendChild(Ui.heading("마법의 가루", 40, rgb(0.42, 0.18, 0.62), null));
    const info = Ui.inset(10);
    info.appendChild(
      Ui.label(`재료를 올릴 때 뿌려요 (가루 통 탭 → 재료통 탭)\n✨ ${D.MAGIC_SPEED}배 빨리 익고\n✨ 끝까지 완벽 (안 타요)\n✨ 손님이 값을 ${D.MAGIC_PRICE_MULT}배로!`, 23, Ui.INK, "center", true),
    );
    vb.appendChild(info);
    vb.appendChild(Ui.heading(`가진 가루 ${GameState.powder}개`, 30, rgb(0.42, 0.18, 0.62), null));
    vb.appendChild(Ui.spacer(0, true));
    const full = GameState.powder >= D.POWDER_MAX;
    const buy = Ui.button("", Ui.EVENT, 27, 96);
    if (full) {
      buy.textContent = `최대 ${D.POWDER_MAX}개예요`;
      buy.disabled = true;
    } else {
      Ui.withIcon(buy, Ui.ICON.coin, `1개 · ${D.formatWon(D.POWDER_PRICE)}`);
      buy.disabled = GameState.wallet < D.POWDER_PRICE;
      Ui.onPress(buy, () => {
        if (!GameState.buyPowder()) return;
        Sound.playSfx("magic");
        this.refresh();
      });
    }
    vb.appendChild(buy);
    return card;
  }

  private buy(mid: string, n: number): void {
    if (!GameState.buyStock(this.shopId, mid, n)) return;
    Sound.playSfx("coin");
    this.refresh();
    this.checkEnough();
  }

  /** 튜토리얼: 첫 메뉴 재료가 하루치만큼 모이면 다음 단계로 */
  private checkEnough(): void {
    const first = D.shopDef(this.shopId).menus[0];
    const need = D.stockNeed(D.shopDef(this.shopId).first_level)[first] ?? 10;
    if (GameState.stockOf(this.shopId, first) >= need) this.tut?.onEvent("enough");
  }
}
