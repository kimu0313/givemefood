// 업그레이드: 항목별 카드 3개 (화구 추가 / 화력 강화 / 가게별 편의시설) — 가로로 나란히.
// 장비는 가게마다 따로 산다 (스테이지 지도에서 보고 있던 가게 기준). 나가면 지도로.
// 2026-11-15 게임 UI: 그 가게 거리 그림 위에 큰 제목 + 지갑 칩, 카드마다 아이콘 · 단계 점 · 지금 → 다음 · 동전 가격 버튼.

import { R, rgb, v } from "../engine/geom.ts";
import type { Gfx } from "../engine/gfx.ts";
import { Scene } from "../engine/game.ts";
import { Node2D } from "../engine/node.ts";
import { Sound } from "../engine/audio.ts";
import * as Ui from "../engine/ui.ts";
import * as D from "../core/defs.ts";
import { GameState } from "../state/game_state.ts";
import { StreetArt } from "../art/street_art.ts";
import { Tutorial, elementRect, type TutStep } from "./tutorial.ts";

/** 업그레이드 항목 아이콘 (먹선 테두리 그림) */
const UPGRADE_ICON: Record<string, string> = {
  // 화구·판 키우기: 김 나는 큰 냄비
  burners: `<svg viewBox="0 0 64 64"><path d="M22 14c-3 4 3 6 0 10M32 10c-3 4 3 6 0 10M42 14c-3 4 3 6 0 10" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity="0.9"/><rect x="4" y="30" width="10" height="7" rx="3" fill="#8a8f99" stroke="#3b2415" stroke-width="3"/><rect x="50" y="30" width="10" height="7" rx="3" fill="#8a8f99" stroke="#3b2415" stroke-width="3"/><path d="M10 28h44v18a10 10 0 0 1-10 10H20a10 10 0 0 1-10-10z" fill="#c9ced8" stroke="#3b2415" stroke-width="3.5" stroke-linejoin="round"/><path d="M12 30h40" stroke="#e8462a" stroke-width="5" stroke-linecap="round"/><path d="M16 38v10" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.7"/></svg>`,
  // 화력: 불꽃
  heat: `<svg viewBox="0 0 64 64"><path d="M32 4c4 12 18 16 18 34a18 18 0 0 1-36 0c0-9 5-14 8-18 1 6 4 9 7 9-2-10 1-18 3-25z" fill="#ff7a2a" stroke="#3b2415" stroke-width="3.5" stroke-linejoin="round"/><path d="M32 30c3 6 10 9 10 17a10 10 0 0 1-20 0c0-5 3-8 5-10 0 4 2 6 4 6-1-5 0-9 1-13z" fill="#ffd23a"/></svg>`,
  // 손님 편의(난로·책장 등 = 인내심): 하트
  stove: `<svg viewBox="0 0 64 64"><path d="M32 56S6 40 6 22a13 13 0 0 1 26-5 13 13 0 0 1 26 5c0 18-26 34-26 34z" fill="#ff5d73" stroke="#3b2415" stroke-width="3.5" stroke-linejoin="round"/><ellipse cx="19" cy="20" rx="6" ry="3.5" fill="#fff" opacity="0.7" transform="rotate(-35 19 20)"/></svg>`,
};

class Dim extends Node2D {
  size = v(1920, 1080);
  draw(g: Gfx): void {
    g.rect(new R(0, 0, this.size.x, this.size.y), rgb(0.06, 0.03, 0.02, 0.62));
  }
}

export class UpgradeScene extends Scene {
  private walletLabel!: HTMLDivElement;
  private shopId = "";
  private cards!: HTMLDivElement;
  private backBtn!: HTMLElement;
  private buyBtns: Record<string, HTMLElement> = {};
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
    art.shopId = this.shopId;
    for (const m of shop.menus) art.menuNames.push(D.menuName(m));
    this.add(art);
    const dim = new Dim();
    dim.size = vs;
    this.add(dim);

    const m = Ui.screenMargin(this.ui, 64, 46, 80);
    const col = Ui.vbox(26);
    m.appendChild(col);

    const header = Ui.hbox(20);
    header.style.alignItems = "center";
    col.appendChild(header);
    const titles = Ui.vbox(2);
    titles.style.flex = "1 1 auto";
    titles.appendChild(Ui.heading(`${shop.name} 손보기`, 68, Ui.CREAM, rgb(0.12, 0.05, 0.02), "left"));
    titles.appendChild(Ui.label("장비는 이 가게에서만 써요. 새 가게가 열리면 다시 갖춰야 해요.", 28, rgb(1.0, 0.86, 0.66), "left"));
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

    this.cards = Ui.hbox(34);
    col.appendChild(this.cards);
    col.appendChild(Ui.spacer(0, true));

    const bottom = Ui.hbox(24);
    bottom.style.justifyContent = "center";
    col.appendChild(bottom);
    const back = Ui.button("", Ui.SECONDARY, 40, 108);
    Ui.withIcon(back, Ui.ICON.back, "지도로 돌아가기");
    back.style.width = "560px";
    Ui.onPress(back, () => this.goBack());
    bottom.appendChild(back);
    this.backBtn = back;
    this.refresh();
    Sound.playBgm("map");
    this.tut = this.makeTutorial();
  }

  process(_dt: number): void {
    this.tut?.update();
  }

  onBack(): void {
    if (this.tut?.active()) return;
    this.goBack();
  }

  private goBack(): void {
    this.tut?.onEvent("back");
    this.game.goto("map");
  }

  /** 튜토리얼 "upgrade": 첫 장비(떡볶이 판 키우기)를 사 보고 → 지도로 (돈이 모자라면 설명만) */
  private makeTutorial(): Tutorial | null {
    if (GameState.tutorial !== "upgrade") return null;
    const id = D.UPGRADE_ORDER[0];
    const nxt = GameState.nextUpgrade(id, this.shopId);
    const steps: TutStep[] = [];
    if (nxt !== null && GameState.wallet >= nxt.cost) {
      steps.push({
        text: `'${D.upgradeName(id, this.shopId)}'를 사 볼까요? ${nxt.desc}! 한 번에 더 많이 만들 수 있어요.`,
        target: () => elementRect(this.buyBtns[id], this),
        wait: "bought",
      });
    }
    const broke = steps.length === 0; // 돈이 없어 아직 못 삼 (처음 시작은 0원)
    steps.push({
      text: broke
        ? "장비를 키우면 더 많이, 더 빨리 만들 수 있어요. 지금은 돈이 없으니 영업해서 번 돈으로 사요. 장비는 가게마다 따로예요. 이제 첫 영업을 하러 가요!"
        : "장비는 가게마다 따로 사요. 돈을 모아서 화력과 손님 편의시설도 키워 보세요. 이제 첫 영업을 하러 가요!",
      target: () => elementRect(this.backBtn, this),
      wait: "back",
      done: () => GameState.setTutorial("stage"),
    });
    return new Tutorial(this, steps);
  }

  private refresh(): void {
    Ui.setText(this.walletLabel, D.formatWon(GameState.wallet));
    this.cards.replaceChildren(...D.UPGRADE_ORDER.map((id) => this.card(id)));
  }

  private card(id: string): HTMLDivElement {
    const levels = D.UPGRADES[id].levels;
    const lv = GameState.upgradeLevel(id, this.shopId);
    const nxt = GameState.nextUpgrade(id, this.shopId);

    const card = Ui.panel(Ui.PAPER, 32, 30);
    card.style.flex = "1 1 0";
    card.style.minHeight = "590px";
    const vb = Ui.vbox(12);
    vb.style.flex = "1 1 auto";
    vb.style.alignItems = "stretch";
    card.appendChild(vb);
    // 아이콘 (동그란 받침 위)
    const iconBox = Ui.div("up-icon");
    iconBox.appendChild(Ui.icon(UPGRADE_ICON[id] ?? Ui.ICON.up, 92));
    vb.appendChild(iconBox);
    vb.appendChild(Ui.heading(D.upgradeName(id, this.shopId), 44, Ui.INK, null));
    vb.appendChild(Ui.pips(lv, levels.length, 26));
    const info = Ui.inset(14);
    info.classList.add("vbox");
    info.style.gap = "6px";
    info.appendChild(Ui.label("지금: " + this.currentText(id), 28, Ui.MUTED, "center", true));
    if (nxt !== null) {
      info.appendChild(Ui.label("▼", 22, Ui.ACCENT));
      info.appendChild(Ui.heading(nxt.desc, 31, Ui.ACCENT, null, "center", true));
    } else {
      info.appendChild(Ui.heading("최대 단계!", 34, rgb(0.85, 0.55, 0.05), null));
    }
    vb.appendChild(info);
    vb.appendChild(Ui.spacer(0, true));

    let btn: Ui.Button;
    if (nxt === null) {
      btn = Ui.button("다 갖췄어요", Ui.SECONDARY, 38, 112);
      btn.disabled = true;
    } else {
      const cost = nxt.cost;
      btn = Ui.button("", Ui.GOOD, 42, 112);
      Ui.withIcon(btn, Ui.ICON.coin, D.formatWon(cost));
      btn.disabled = GameState.wallet < cost;
      Ui.onPress(btn, () => {
        if (GameState.buyUpgrade(id, this.shopId)) {
          Sound.playSfx("upgrade");
          this.refresh();
          this.tut?.onEvent("bought");
        }
      });
    }
    vb.appendChild(btn);
    this.buyBtns[id] = btn;
    return card;
  }

  private currentText(id: string): string {
    const sid = this.shopId;
    switch (id) {
      case "burners": {
        const shop = D.shopDef(sid);
        if (shop.burner_upgrade_desc) return shop.burner_upgrade_desc.replace("%d", String(D.panPortions(GameState.burnerValue(sid))));
        const bonus = D.roundHalfAway(D.burnerPerfectBonus(GameState.burnerValue(sid)) * 100.0);
        return bonus > 0 ? `화구 ${GameState.burnerCount(sid)}칸 · 완벽 구간 +${bonus}%` : `화구 ${GameState.burnerCount(sid)}칸`;
      }
      case "heat": {
        const pct = D.roundHalfAway((1.0 - GameState.heatScale(sid)) * 100.0);
        return pct === 0 ? "기본 화력" : `조리 시간 -${pct}%`;
      }
      case "stove": {
        const pct = D.roundHalfAway((GameState.patienceMult(sid) - 1.0) * 100.0);
        return pct === 0 ? D.shopDef(sid).comfort_none : `손님 인내심 +${pct}%`;
      }
    }
    return "";
  }
}
