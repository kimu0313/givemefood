// 타이틀(시작 화면): 사용자가 준 분식집 네 친구 일러스트를 화면 가득 (어둡게 덮지 않음) + 가운데 아래에 게임 이름과
// 영업하러 가기(스테이지 지도), 위쪽 구석에 진행 상황(왼쪽)과 계정 로그인·로그아웃(오른쪽). 로딩 화면(index.html #loading)도 같은 그림.
// 단골 도감은 게임 안(스테이지 지도)으로 옮김 (2026-11-16).

import { R, rgb, v } from "../engine/geom.ts";
import type { Gfx } from "../engine/gfx.ts";
import { Scene } from "../engine/game.ts";
import { Node2D } from "../engine/node.ts";
import { Sound } from "../engine/audio.ts";
import * as Ui from "../engine/ui.ts";
import * as D from "../core/defs.ts";
import { GameState } from "../state/game_state.ts";
import * as ArtAssets from "../art/art_assets.ts";
import { NAME_MAX, nameError } from "../state/game_state.ts";

/** 시작 화면 그림: 화면을 꽉 채우게 키우고(남는 쪽은 잘림), 얼굴·간판이 있는 위쪽에 맞춘다 */
export class TitleBg extends Node2D {
  size = v(1920, 1080);

  draw(g: Gfx): void {
    const img = ArtAssets.titleImage();
    if (img === null) {
      g.rect(new R(0, 0, this.size.x, this.size.y), rgb(0.1, 0.07, 0.06));
      return;
    }
    const iw = img.width;
    const ih = img.height;
    const k = Math.max(this.size.x / iw, this.size.y / ih);
    g.texture(img, new R((this.size.x - iw * k) * 0.5, 0, iw * k, ih * k));
  }
}

/** 게임 이름 (로딩 화면과 같은 모양·크기) */
export function gameLogo(size: number): HTMLDivElement {
  return Ui.logo("포장마차 타이쿤", size);
}

export class TitleScene extends Scene {
  private popup: HTMLDivElement | null = null;

  ready(): void {
    const bg = new TitleBg();
    bg.size = v(this.vw, this.vh);
    this.add(bg);
    this.build();
    Sound.playBgm("title");
    if (GameState.justLoggedIn !== "") {
      this.greet(GameState.justLoggedIn);
      GameState.justLoggedIn = "";
    }
    if (GameState.justCleared) {
      GameState.justCleared = false;
      this.showClear();
    }
  }

  /** 그림은 어둡게 덮지 않는다 (2026-11-13 사용자 "그라데이션 빼줘, 일러스트가 잘 안 보여").
   *  가운데 아래: 게임 이름 + 영업하러 가기 + 그 밑에 게임 종료 (2026-11-15 사용자 "영업하러 가기 밑에 게임 종료 버튼").
   *  위쪽 구석: 왼쪽 = 가게·스테이지·지갑, 오른쪽 = 계정 (2026-11-16 사용자 "오른쪽 위에 로그인 로그아웃 ui") */
  private build(): void {
    const mid = Ui.vbox(0);
    mid.style.position = "absolute";
    mid.style.left = "0";
    mid.style.right = "0";
    mid.style.bottom = "30px";
    mid.style.alignItems = "center";
    this.ui.appendChild(mid);
    mid.appendChild(gameLogo(128));
    const sub = Ui.label("오늘 밤도 영업합니다", 36, Ui.CREAM);
    sub.classList.add("title-sub");
    mid.appendChild(sub);
    mid.appendChild(Ui.spacer(20));
    const start = Ui.button("", Ui.ACCENT, 52, 126);
    Ui.withIcon(start, Ui.ICON.play, "영업하러 가기");
    Ui.lively(start);
    start.style.width = "580px";
    Ui.onPress(start, () => this.onStart());
    mid.appendChild(start);
    const quit = Ui.button("", Ui.SECONDARY, 32, 86);
    Ui.withIcon(quit, Ui.ICON.exit, "게임 종료");
    quit.style.width = "340px";
    quit.style.marginTop = "4px";
    Ui.onPress(quit, () => this.askQuit());
    mid.appendChild(quit);

    const col = Ui.chip(28);
    col.classList.add("vbox");
    col.style.gap = "6px";
    col.style.padding = "14px 26px 16px";
    col.style.position = "absolute";
    col.style.left = "36px";
    col.style.top = "30px";
    col.style.maxWidth = "560px";
    this.ui.appendChild(col);

    const shop = GameState.frontierShop();
    const stageNo = D.shopIndex(shop.id) + 1;
    let shopLine = `${stageNo}번째 가게 · ${shop.name}\n${D.levelName(GameState.level)}`;
    const buy = GameState.nextBuyableShop();
    if (buy !== "") {
      const cost = D.shopOpenCost(buy);
      const bname = D.shopDef(buy).name;
      if (GameState.wallet >= cost) shopLine = `새 가게 ${bname}${D.josa(bname, "을", "를")} 열 수 있어요!\n지도에서 '가게 열기' · ${D.formatWon(cost)}`;
      else shopLine = `다음 가게: ${bname}\n${D.formatWon(cost)} 모으면 열 수 있어요`;
    }
    if (GameState.storyCleared) shopLine = `모든 가게 완주! 모은 별 ★ ${GameState.totalStars()}개`;
    col.appendChild(Ui.label(shopLine, 29, rgb(1.0, 0.84, 0.6), "left", true));
    // 아직 도전 안 한 미식가 이벤트가 열려 있으면 알려 준다
    if (D.EVENTS.some((e) => GameState.eventOpen(e.shop))) col.appendChild(Ui.label("미식가가 찾아왔어요! 지도에서 도전", 27, rgb(0.86, 0.72, 1.0), "left"));
    const money = Ui.hbox(10);
    money.style.alignItems = "center";
    money.append(Ui.icon(Ui.ICON.coin, 40), Ui.heading(D.formatWon(GameState.wallet), 34, Ui.GOLD, rgb(0.16, 0.08, 0.03), "left"));
    col.appendChild(money);

    this.ui.appendChild(this.accountBox());
  }

  // ---------------------------------------------------------------- 계정 (로그인 / 로그아웃)

  /** 오른쪽 위 계정 칸: 사람 아이콘 + 이름(게스트) + 로그인 / 로그아웃 버튼 */
  private accountBox(): HTMLDivElement {
    const box = Ui.chip(28);
    box.classList.add("hbox");
    box.style.gap = "14px";
    box.style.alignItems = "center";
    box.style.padding = "12px 14px 12px 18px";
    box.style.position = "absolute";
    box.style.right = "36px";
    box.style.top = "30px";
    box.appendChild(Ui.icon(Ui.ICON.user, 64));
    const who = Ui.vbox(0);
    who.style.minWidth = "150px";
    who.style.maxWidth = "300px";
    box.appendChild(who);
    const logged = GameState.account !== "";
    who.appendChild(Ui.label(logged ? "로그인 중" : "로그인 안 함", 22, rgb(1.0, 0.8, 0.45), "left"));
    const name = Ui.heading(logged ? GameState.account : "게스트", 34, Ui.CREAM, rgb(0.1, 0.05, 0.02), "left");
    name.style.whiteSpace = "nowrap";
    name.style.overflow = "hidden";
    name.style.textOverflow = "ellipsis";
    who.appendChild(name);
    const b = Ui.button(logged ? "로그아웃" : "로그인", logged ? Ui.SECONDARY : Ui.GOOD, 30, 84);
    b.style.marginBottom = "6px";
    b.style.minWidth = "170px";
    Ui.onPress(b, () => (logged ? this.askLogout() : this.showLogin()));
    box.appendChild(b);
    return box;
  }

  /** 로그인 창: 이름 칸 + 이 기기에 있는 계정 빠른 선택. 처음 보는 이름이면 새 계정 (게스트 기록은 새 계정으로 옮김) */
  private showLogin(): void {
    this.closePopup();
    this.popup = Ui.overlay(this.ui);
    this.popup.classList.add("center");
    const p = Ui.popPanel(Ui.PAPER, 40, 44);
    p.style.width = "900px";
    this.popup.appendChild(p);
    p.appendChild(Ui.ribbon("로그인", Ui.GOOD, 48));
    const col = Ui.vbox(16);
    p.appendChild(col);
    col.appendChild(Ui.label("이름을 적으면 그 이름으로 기록이 저장돼요.", 32, Ui.INK, "center", true));

    const field = Ui.textField(`이름 (${NAME_MAX}글자까지)`, NAME_MAX + 4, () => submit(field.value), () => this.closePopup());
    col.appendChild(field);
    const hint = Ui.label("", 27, Ui.MUTED, "center", true);
    col.appendChild(hint);
    const err = Ui.label(" ", 28, Ui.BAD, "center");
    err.style.visibility = "hidden";
    col.appendChild(err);
    const submit = (raw: string): void => {
      const res = GameState.login(raw);
      if (!res.ok) {
        Ui.setText(err, res.error);
        err.style.visibility = "visible";
        field.focus();
        return;
      }
      this.game.goto("title");
    };
    // 적는 이름에 따라: 저장된 계정 불러오기 / 새 계정 (+ 지금 기록 옮김)
    const updateHint = (): void => {
      err.style.visibility = "hidden";
      const raw = field.value;
      const found = GameState.findAccount(raw);
      if (found !== "") Ui.setText(hint, `저장된 '${found}' 계정의 기록을 불러와요.`);
      else if (nameError(raw) !== "") Ui.setText(hint, "처음 적는 이름이면 새 계정이 만들어져요.");
      else if (GameState.hasProgress()) Ui.setText(hint, `새 계정을 만들고, 지금까지의 기록(${D.levelName(GameState.level)} · ${D.formatWon(GameState.wallet)})을 옮겨요.`);
      else Ui.setText(hint, "새 계정을 만들어요.");
    };
    field.addEventListener("input", updateHint);
    updateHint();

    if (GameState.accounts.length > 0) {
      col.appendChild(Ui.label("이 기기의 계정", 26, Ui.MUTED));
      const list = Ui.hbox(12);
      list.style.flexWrap = "wrap";
      list.style.justifyContent = "center";
      col.appendChild(list);
      for (const n of GameState.accounts.slice(-6)) {
        const nb = Ui.button("", Ui.CARD, 28, 76);
        Ui.withIcon(nb, Ui.ICON.user, n);
        nb.style.color = Ui.INK.css();
        nb.style.marginBottom = "4px";
        Ui.onPress(nb, () => submit(n));
        list.appendChild(nb);
      }
    }
    col.appendChild(Ui.spacer(2));
    const row = Ui.hbox(20);
    col.appendChild(row);
    const close = Ui.button("닫기", Ui.SECONDARY, 36, 104);
    close.style.flex = "1 1 0";
    Ui.onPress(close, () => this.closePopup());
    row.appendChild(close);
    const ok = Ui.button("로그인", Ui.GOOD, 38, 104);
    ok.style.flex = "1 1 0";
    Ui.onPress(ok, () => submit(field.value));
    row.appendChild(ok);
    col.appendChild(Ui.label("기록은 이 기기(브라우저)에 저장돼요.", 24, Ui.MUTED));
    setTimeout(() => field.focus(), 0);
  }

  /** 로그아웃 확인 */
  private askLogout(): void {
    this.closePopup();
    this.popup = Ui.overlay(this.ui);
    this.popup.classList.add("center");
    const p = Ui.popPanel(Ui.PAPER, 40, 44);
    p.style.width = "800px";
    this.popup.appendChild(p);
    p.appendChild(Ui.ribbon("로그아웃", Ui.SECONDARY, 48));
    const col = Ui.vbox(18);
    p.appendChild(col);
    const nm = GameState.account;
    col.appendChild(Ui.label(`'${nm}' 계정에서 로그아웃할까요?\n기록은 저장돼요. 다시 로그인하면 이어서 할 수 있어요.`, 32, Ui.INK, "center", true));
    col.appendChild(Ui.spacer(4));
    const row = Ui.hbox(20);
    col.appendChild(row);
    const stay = Ui.button("취소", Ui.SECONDARY, 38, 108);
    stay.style.flex = "1 1 0";
    Ui.onPress(stay, () => this.closePopup());
    row.appendChild(stay);
    const out = Ui.button("로그아웃", Ui.ACCENT, 38, 108);
    out.style.flex = "1 1 0";
    Ui.onPress(out, () => {
      GameState.logout();
      this.game.goto("title");
    });
    row.appendChild(out);
  }

  /** 로그인 직후 위쪽 가운데 인사 (잠깐 보였다 사라짐) */
  private greet(name: string): void {
    const t = Ui.chip(999);
    t.style.position = "absolute";
    t.style.left = "50%";
    t.style.top = "34px";
    t.style.transform = "translateX(-50%)";
    t.style.padding = "14px 40px 16px";
    t.style.transition = "opacity 0.5s";
    t.appendChild(Ui.heading(`${name}님, 어서 오세요!`, 36, Ui.GOLD, rgb(0.1, 0.05, 0.02)));
    this.ui.appendChild(t);
    setTimeout(() => (t.style.opacity = "0"), 2200);
    setTimeout(() => t.remove(), 2800);
  }

  // ---------------------------------------------------------------- 게임 종료

  /** 잘못 눌러 꺼지지 않게 한 번 묻는다 */
  private askQuit(): void {
    this.closePopup();
    this.popup = Ui.overlay(this.ui);
    this.popup.classList.add("center");
    const p = Ui.popPanel(Ui.PAPER, 40, 44);
    p.style.width = "720px";
    this.popup.appendChild(p);
    p.appendChild(Ui.ribbon("게임 종료", Ui.SECONDARY, 48));
    const col = Ui.vbox(18);
    p.appendChild(col);
    col.appendChild(Ui.label("오늘 영업은 여기까지 할까요?\n기록과 지갑은 그대로 저장돼요.", 32, Ui.INK, "center", true));
    col.appendChild(Ui.spacer(4));
    const row = Ui.hbox(20);
    col.appendChild(row);
    const stay = Ui.button("계속하기", Ui.SECONDARY, 38, 108);
    stay.style.flex = "1 1 0";
    Ui.onPress(stay, () => this.closePopup());
    row.appendChild(stay);
    const quit = Ui.button("끝내기", Ui.ACCENT, 38, 108);
    quit.style.flex = "1 1 0";
    Ui.onPress(quit, () => this.quitGame());
    row.appendChild(quit);
  }

  /**
   * 저장하고 창을 닫는다. 게임 창(play.cmd)이나 주소를 직접 연 탭은 닫히지만, 브라우저가 막으면
   * (다른 페이지에서 넘어온 탭 등) 화면을 덮고 "창을 닫아 주세요" 안내 + 다시 하기.
   */
  private quitGame(): void {
    GameState.saveGame();
    window.close();
    setTimeout(() => {
      if (window.closed) return;
      this.closePopup();
      this.popup = Ui.overlay(this.ui, 0.92);
      this.popup.classList.add("center");
      const col = Ui.vbox(18);
      col.style.alignItems = "center";
      this.popup.appendChild(col);
      col.appendChild(gameLogo(96));
      col.appendChild(Ui.heading("오늘 영업 끝! 수고했어요", 48, Ui.CREAM, rgb(0.12, 0.05, 0.02)));
      col.appendChild(Ui.label("기록은 저장됐어요. 이제 이 창(탭)을 닫으면 돼요.", 32, rgb(1.0, 0.86, 0.66)));
      col.appendChild(Ui.spacer(10));
      const again = Ui.button("", Ui.ACCENT, 40, 104);
      Ui.withIcon(again, Ui.ICON.play, "다시 하기");
      again.style.width = "400px";
      Ui.onPress(again, () => this.game.goto("title"));
      col.appendChild(again);
    }, 250);
  }

  /** 안드로이드 뒤로 가기: 팝업 닫기 */
  onBack(): void {
    if (this.popup !== null) this.closePopup();
  }

  /** 스테이지 지도로 (가장 최근에 열린 가게) */
  private onStart(): void {
    GameState.mapShop = GameState.frontierShopId();
    this.game.goto("map");
  }

  private closePopup(): void {
    this.popup?.remove();
    this.popup = null;
  }

  private showClear(): void {
    this.closePopup();
    this.popup = Ui.overlay(this.ui);
    this.popup.classList.add("center");
    const p = Ui.popPanel(Ui.PAPER, 40, 44);
    p.style.width = "980px";
    this.popup.appendChild(p);
    p.appendChild(Ui.ribbon("축하해요!", rgb(0.85, 0.28, 0.5), 50));
    const col = Ui.vbox(20);
    p.appendChild(col);
    col.appendChild(Ui.heading(`스테이지 ${D.TOTAL_LEVELS}까지 완주!`, 66, Ui.GOLD, Ui.INK));
    col.appendChild(Ui.label("비 오는 골목 포장마차에서 시작해 내 이름을 건 실내 포차까지.\n이제 지도 길 끝의 무한 영업에 도전해 보세요.", 32, Ui.INK, "center", true));
    const ok = Ui.button("좋아요", Ui.ACCENT, 42, 112);
    Ui.onPress(ok, () => this.closePopup());
    col.appendChild(ok);
  }
}
