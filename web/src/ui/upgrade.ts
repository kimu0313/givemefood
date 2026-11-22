// 업그레이드: 항목별 카드 3개 (화구 추가 / 화력 강화 / 가게별 편의시설) — 가로로 나란히.
// 장비는 가게마다 따로 산다 (스테이지 지도에서 보고 있던 가게 기준). 나가면 지도로.
// 2026-11-15 게임 UI: 그 가게 거리 그림 위에 큰 제목 + 지갑 칩, 카드마다 아이콘 · 단계 점 · 지금 → 다음 · 동전 가격 버튼.
// 2026-11-22 사용자 예시 그림 ("글씨체는 냅두고 가게 업그레이드 눌렀을 때 뜨는 UI 이렇게", art_src/ui_upgrade_ref.png):
//   위 줄무늬 차양 + 제목 · 어두운 설명 띠 · 오른쪽 지갑 판, 손그림 카드 3장(아이콘 받침 · 제목 · 점 · 정보판 · 초록 가격 버튼),
//   아래 갈색 "지도로 돌아가기". 그림 조각은 tools/upgrade_ui_art.mjs → ui/upg_*.webp, 글씨는 모두 게임 글꼴로 씀.
//   자리 = 예시 그림 픽셀 × UPG_K (1677 폭 → 1920).

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

const UPG_K = 1920 / 1677;
const U = (n: number): string => `${Math.round(n * UPG_K)}px`;
const UPG_ART = (n: string): string => `url("assets/art/ui/upg_${n}.webp")`;
const UPG_CSS = `
.upg { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; pointer-events: none; }
.upg .art { position: absolute; background: center / 100% 100% no-repeat; }
.upg button.art { pointer-events: auto; border: 0; padding: 0; cursor: pointer; font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 14px;
  transition: transform 0.08s, filter 0.12s; filter: drop-shadow(0 6px 6px rgba(0,0,0,0.3)); }
.upg button.art:hover:not(:disabled) { filter: drop-shadow(0 6px 6px rgba(0,0,0,0.3)) brightness(1.07); }
.upg button.art:active:not(:disabled) { transform: translateY(4px); }
.upg button.art:disabled { cursor: default; filter: grayscale(0.85) brightness(0.9); }
.upg .sub { position: absolute; border-radius: 26px; background: rgba(28, 16, 10, 0.82); display: flex; align-items: center; padding: 0 26px; box-sizing: border-box; }
.upg .info { position: absolute; box-sizing: border-box; border-radius: 16px; border: 3px solid rgba(160, 130, 105, 0.55); background: rgba(225, 210, 194, 0.45);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 6px 14px; }
.upg .lvl { position: absolute; left: 0; right: 0; display: flex; justify-content: center; }
.upg .pips .pip { border: 4px solid #3b2415; background: #cfc6bb; box-shadow: none; }
.upg .pips .pip.on { background: radial-gradient(circle at 40% 35%, #ffe27a, #f2b31c 70%); }
`;
let upgCss = false;

class Dim extends Node2D {
  size = v(1920, 1080);
  draw(g: Gfx): void {
    g.rect(new R(0, 0, this.size.x, this.size.y), rgb(0.06, 0.03, 0.02, 0.62));
    // 아래 띠 (가게 그림의 재료통 자리 — 영업 중엔 게임 재료통이 덮지만 여기선 빈 통 · 지운 음식 자국이 보임) 는 어둡게 덮음
    // (2026-11-22 사용자 "업그레이드 UI 밑에 뭐 덜 잘린 거 같은데")
    const ctx = g.ctx;
    const top = this.size.y - 250;
    const grad = ctx.createLinearGradient(0, top, 0, this.size.y - 120);
    grad.addColorStop(0, "rgba(22, 12, 7, 0)");
    grad.addColorStop(1, "rgba(22, 12, 7, 0.94)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, this.size.x, this.size.y - top);
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

    if (!upgCss) {
      upgCss = true;
      const st = document.createElement("style");
      st.textContent = UPG_CSS;
      document.head.appendChild(st);
    }
    const root = Ui.div("upg");
    root.style.left = `${(this.vw - 1920) * 0.5}px`;
    this.ui.appendChild(root);
    const place = (el: HTMLElement, x: number, y: number, w: number, h: number): HTMLElement => {
      Object.assign(el.style, { left: U(x), top: U(y), width: U(w), height: U(h) });
      return el;
    };
    // 차양 + 제목 + 설명 띠
    const awning = place(Ui.div("art"), 0, 12, 1677, 164);
    awning.style.backgroundImage = UPG_ART("awning");
    root.appendChild(awning);
    const sub = place(Ui.div("sub"), 42, 124, 640, 44);
    sub.appendChild(Ui.label("장비는 이 가게에서만 써요. 새 가게가 열리면 다시 갖춰야 해요.", 27, rgb(1.0, 0.95, 0.88), "left"));
    root.appendChild(sub);
    const title = Ui.heading(`${shop.name} 손보기`, 72, Ui.CREAM, rgb(0.12, 0.05, 0.02), "left");
    Object.assign(title.style, { position: "absolute", left: U(60), top: U(44), whiteSpace: "nowrap" });
    root.appendChild(title);
    // 지갑 판
    const wallet = place(Ui.div("art"), 1323, 73, 305, 82);
    wallet.style.backgroundImage = UPG_ART("wallet");
    Object.assign(wallet.style, { display: "flex", alignItems: "center", gap: "12px", padding: "0 30px 6px 26px", boxSizing: "border-box" });
    wallet.appendChild(Ui.icon(Ui.ICON.coin, 58));
    this.walletLabel = Ui.heading("", 46, Ui.GOLD, rgb(0.1, 0.05, 0.02), "right");
    this.walletLabel.style.flex = "1 1 auto";
    wallet.appendChild(this.walletLabel);
    root.appendChild(wallet);
    // 카드 3장
    this.cards = Ui.div();
    root.appendChild(this.cards);
    // 지도로 돌아가기
    const back = place(document.createElement("button"), 579, 809, 517, 103) as HTMLButtonElement;
    back.className = "art";
    back.style.backgroundImage = UPG_ART("back");
    back.setAttribute("aria-label", "지도로 돌아가기");
    back.appendChild(Ui.icon(Ui.ICON.back, 50));
    back.appendChild(Ui.heading("지도로 돌아가기", 42, Ui.CREAM, rgb(0.15, 0.07, 0.03)));
    Ui.onPress(back, () => this.goBack());
    root.appendChild(back);
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

  /** 튜토리얼 "upgrade": 첫 장비(불 조절)를 사 보고 → 지도로 (돈이 모자라면 설명만) */
  private makeTutorial(): Tutorial | null {
    if (GameState.tutorial !== "upgrade") return null;
    const id = D.UPGRADE_ORDER[0];
    const nxt = GameState.nextUpgrade(id, this.shopId);
    const steps: TutStep[] = [];
    if (nxt !== null && GameState.wallet >= nxt.cost) {
      steps.push({
        text: `'${D.upgradeName(id, this.shopId)}'${D.josa(D.upgradeName(id, this.shopId), "을", "를")} 사 볼까요? ${nxt.desc}! 음식이 완벽한 시간이 더 길어져요.`,
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
    this.cards.replaceChildren(...D.UPGRADE_ORDER.map((id, i) => this.card(id, i)));
  }

  /** 카드 한 장 (예시 그림 카드 자리: 왼쪽부터 x 62 · 588 · 1114, y 185, 503×555) */
  private card(id: string, index: number): HTMLDivElement {
    const levels = D.UPGRADES[id].levels;
    const lv = GameState.upgradeLevel(id, this.shopId);
    const nxt = GameState.nextUpgrade(id, this.shopId);
    const cx = 62 + index * 526;
    const card = Ui.div("art");
    Object.assign(card.style, { left: U(cx), top: U(185), width: U(503), height: U(555), backgroundImage: UPG_ART("card") });
    const at = (el: HTMLElement, x: number, y: number, w: number, h: number): HTMLElement => {
      Object.assign(el.style, { position: "absolute", left: U(x), top: U(y), width: U(w), height: U(h) });
      card.appendChild(el);
      return el;
    };
    // 아이콘 받침 + 아이콘
    const disc = at(Ui.div("art"), 177, 28, 146, 135);
    disc.style.backgroundImage = UPG_ART("disc");
    Object.assign(disc.style, { display: "flex", alignItems: "center", justifyContent: "center" });
    disc.appendChild(Ui.icon(UPGRADE_ICON[id] ?? Ui.ICON.up, 104));
    // 이름 · 단계 점
    const name = Ui.heading(D.upgradeName(id, this.shopId), 50, Ui.INK, null);
    at(name, 0, 168, 503, 56).style.whiteSpace = "nowrap";
    const lvl = Ui.div("lvl");
    lvl.appendChild(Ui.pips(lv, levels.length, 30));
    lvl.style.top = U(230);
    card.appendChild(lvl);
    // 정보판: 지금 → 다음
    const info = at(Ui.div("info"), 32, 268, 440, 140);
    info.appendChild(Ui.label("지금: " + this.currentText(id), 29, rgb(0.23, 0.14, 0.08), "center", true));
    if (nxt !== null) {
      info.appendChild(Ui.label("▼", 22, rgb(0.82, 0.25, 0.12)));
      info.appendChild(Ui.heading(nxt.desc, 33, rgb(0.84, 0.25, 0.12), null, "center", true));
    } else {
      info.appendChild(Ui.heading("최대 단계!", 36, rgb(0.85, 0.55, 0.05), null));
    }
    // 가격 버튼
    const btn = at(document.createElement("button"), 29, 423, 450, 108) as HTMLButtonElement;
    btn.className = "art";
    btn.style.backgroundImage = UPG_ART("buy");
    if (nxt === null) {
      btn.appendChild(Ui.heading("다 갖췄어요", 42, Ui.CREAM, rgb(0.1, 0.2, 0.08)));
      btn.disabled = true;
    } else {
      const cost = nxt.cost;
      btn.appendChild(Ui.icon(Ui.ICON.coin, 60));
      btn.appendChild(Ui.heading(D.formatWon(cost), 50, Ui.CREAM, rgb(0.1, 0.2, 0.08)));
      btn.disabled = GameState.wallet < cost;
      Ui.onPress(btn, () => {
        if (GameState.buyUpgrade(id, this.shopId)) {
          Sound.playSfx("upgrade");
          this.refresh();
          this.tut?.onEvent("bought");
        }
      });
    }
    this.buyBtns[id] = btn;
    return card;
  }

  private currentText(id: string): string {
    const sid = this.shopId;
    switch (id) {
      case "burners": {
        const shop = D.shopDef(sid);
        if (shop.burner_upgrade_desc) {
          const pct = D.roundHalfAway(D.perfectBonusFor(shop, "", GameState.burnerValue(sid)) * 100.0);
          return pct > 0 ? shop.burner_upgrade_desc.replace("%d", String(pct)) : "기본 완벽 구간";
        }
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
