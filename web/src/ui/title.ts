// 타이틀(메인 화면) (2026-11-16 사용자가 준 그림 "이건 메인 화면으로"): 포장마차 다섯 사람 + 제목 + 그림 속 나무판 버튼
// 게임 시작 · 이어하기 · 설정 · 종료. 그림을 화면에 꽉 채우고, 그 버튼 자리(MENU, 원본 픽셀)에 투명한 누름 칸을 얹는다
// (올리면 빛 테두리, 누르면 살짝 눌림). 한국어가 아니면 나무판 글자 위에 같은 색 판 + 번역 글자를 덮는다.
//   게임 시작 = 처음부터 (기록이 있으면 지운다고 한 번 묻는다) · 이어하기 = 스테이지 지도 (기록 없으면 흐림)
//   설정 = 언어(한국어·English·日本語·中文) + 배경 음악·효과음 크기 + 소리 끄기 · 종료 = 저장하고 창 닫기
// 계정(로그인·로그아웃)은 왼쪽 위 작은 칸 (오른쪽 위는 그림의 제목 자리).

import { R, rgb, v } from "../engine/geom.ts";
import type { Gfx } from "../engine/gfx.ts";
import { Scene } from "../engine/game.ts";
import { Node2D } from "../engine/node.ts";
import { Sound } from "../engine/audio.ts";
import * as Ui from "../engine/ui.ts";
import * as D from "../core/defs.ts";
import { GameState } from "../state/game_state.ts";
import * as ArtAssets from "../art/art_assets.ts";
import { loginPlank, openLoginPanel } from "./login_panel.ts";
import { LANGS, getLang, setLang, tr } from "../i18n/i18n.ts";

/** 메인 화면 그림 원본 크기 (art_src/title_menu.png) */
const IMG_W = 1672;
const IMG_H = 941;

/** 그림 속 버튼 (원본 픽셀): hit = 누르는 나무판, label = 다른 언어일 때 덮는 글자 자리(아이콘 오른쪽), plank = 나무판 색 (2026-11-18 밝힌 뒤 색, tools/title_ui_art.mjs) */
const MENU: { id: string; text: string; hit: [number, number, number, number]; label: [number, number, number, number]; plank: string; ink: string }[] = [
  { id: "start", text: "게임 시작", hit: [1325, 381, 1632, 472], label: [1410, 396, 1610, 460], plank: "rgb(197, 99, 73)", ink: "#fcf4ea" },
  { id: "continue", text: "이어하기", hit: [1354, 486, 1619, 556], label: [1446, 494, 1606, 544], plank: "rgb(238, 212, 190)", ink: "#2e1d14" },
  { id: "settings", text: "설정", hit: [1367, 570, 1619, 644], label: [1456, 584, 1606, 632], plank: "rgb(238, 212, 190)", ink: "#2e1d14" },
  { id: "quit", text: "종료", hit: [1385, 657, 1619, 731], label: [1470, 670, 1606, 718], plank: "rgb(238, 212, 190)", ink: "#2e1d14" },
];

type Rect4 = [number, number, number, number];
/**
 * "새로 시작" 확인 창 = 사용자 그림 (2026-11-17 "게임 시작 눌렀을 때 UI 스타일 이렇게": 양피지 창 + 빨간 리본 + 초록·빨강·갈색 버튼,
 * tools/dialog_art.mjs → ui/dialog_newgame.webp). 본문 세 줄은 그림에서 지워 두고 게임이 쓴다 (기록이 그때그때 달라서).
 * 리본·버튼 글씨는 그림 그대로, 다른 언어면 같은 색 판으로 덮고 번역. 자리 = 그림 픽셀 [x0, y0, x1, y1]
 */
const NEWGAME_W = 1486;
const NEWGAME_H = 948;
const NEWGAME_SHOW = 1040; // 화면에서의 폭 (설계 px)
const NEWGAME_BODY: Rect4 = [180, 212, 1306, 372]; // 본문 두 줄 (첫 밑줄 위)
const NEWGAME_HINT: Rect4 = [330, 404, 1156, 466]; // 셋째 줄 (두 밑줄 사이)
const NEWGAME_PARTS: { id: "title" | "keep" | "fresh" | "cancel"; text: string; hit: Rect4 | null; label: Rect4; plank: string }[] = [
  { id: "title", text: "새로 시작", hit: null, label: [530, 32, 960, 150], plank: "rgb(180, 74, 40)" },
  { id: "keep", text: "이어하기", hit: [66, 528, 734, 708], label: [258, 568, 552, 654], plank: "rgb(122, 134, 76)" },
  { id: "fresh", text: "처음부터", hit: [752, 528, 1422, 708], label: [952, 568, 1236, 654], plank: "rgb(210, 98, 56)" },
  { id: "cancel", text: "취소", hit: [66, 748, 1416, 888], label: [664, 770, 820, 854], plank: "rgb(160, 110, 74)" },
];

/** 글자가 칸을 넘치면 넘치지 않을 때까지 글자 크기를 줄인다 (다른 언어는 문장이 길어서) */
function fitText(el: HTMLElement, size: number, min = 14): void {
  el.style.fontSize = `${size}px`;
  while (size > min && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) {
    size -= 1;
    el.style.fontSize = `${size}px`;
  }
}

const TITLE_CSS = `
.title-hot { position: absolute; pointer-events: auto; cursor: pointer; border-radius: 14px; background: transparent; border: 0; padding: 0;
  transition: box-shadow 0.12s, background 0.12s, transform 0.08s; outline: none; }
.title-hot:hover, .title-hot:focus-visible { background: rgba(255, 240, 200, 0.14); box-shadow: 0 0 0 5px rgba(255, 214, 120, 0.9), 0 0 34px rgba(255, 180, 70, 0.75); }
.title-hot:active { background: rgba(40, 20, 8, 0.18); transform: scale(0.98); }
.title-hot.off { cursor: default; background: rgba(28, 18, 12, 0.5); box-shadow: none; }
.title-hot.start { animation: title-glow 1.8s ease-in-out infinite; }
@keyframes title-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(255, 200, 90, 0); } 50% { box-shadow: 0 0 0 4px rgba(255, 210, 110, 0.55), 0 0 30px rgba(255, 170, 60, 0.5); } }
.title-label { position: absolute; pointer-events: none; display: flex; align-items: center; justify-content: center; border-radius: 10px;
  font-family: var(--lang-fonts, "Jua"), "Malgun Gothic", sans-serif; white-space: nowrap; overflow: hidden; }
.vol-range { -webkit-appearance: none; appearance: none; pointer-events: auto; flex: 1 1 auto; height: 56px; margin: 0; background: transparent; cursor: pointer; --fill: 100%; }
.vol-range::-webkit-slider-runnable-track { height: 24px; border-radius: 999px; border: 4px solid #3b2415;
  background: linear-gradient(90deg, #f5b252 0 var(--fill), #7a5640 var(--fill) 100%); }
.vol-range::-webkit-slider-thumb { -webkit-appearance: none; width: 52px; height: 52px; margin-top: -18px; border-radius: 50%;
  background: #fff4dc; border: 5px solid #3b2415; box-shadow: 0 5px 0 rgba(0, 0, 0, 0.35); }
.vol-range::-moz-range-track { height: 24px; border-radius: 999px; border: 4px solid #3b2415; background: #7a5640; }
.vol-range::-moz-range-progress { height: 24px; border-radius: 999px; background: #f5b252; }
.vol-range::-moz-range-thumb { width: 44px; height: 44px; border-radius: 50%; background: #fff4dc; border: 5px solid #3b2415; }
.dlg-art { position: relative; flex: 0 0 auto; pointer-events: auto; background: center / 100% 100% no-repeat;
  filter: drop-shadow(0 18px 22px rgba(0, 0, 0, 0.55)); animation: ui-pop 0.32s cubic-bezier(.2,.9,.3,1.2) both; }
.dlg-text { position: absolute; display: flex; align-items: center; justify-content: center; text-align: center; white-space: pre-line;
  word-break: keep-all; overflow-wrap: anywhere; line-height: 1.32; overflow: hidden; pointer-events: none;
  font-family: var(--lang-fonts, "Jua"), "Malgun Gothic", sans-serif; }
.dlg-cover { position: absolute; display: flex; align-items: center; justify-content: center; border-radius: 12px; pointer-events: none; white-space: nowrap; overflow: hidden;
  font-family: var(--lang-fonts, "Jua"), "Malgun Gothic", sans-serif; color: #fbecd2; -webkit-text-stroke: 7px #3b2415; paint-order: stroke fill; }
.dlg-hot { position: absolute; pointer-events: auto; cursor: pointer; border: 0; padding: 0; background: transparent; outline: none;
  transition: box-shadow 0.12s, background 0.12s, transform 0.08s; }
.dlg-hot:hover, .dlg-hot:focus-visible { background: rgba(255, 240, 200, 0.12); box-shadow: 0 0 0 4px rgba(255, 214, 120, 0.9), 0 0 26px rgba(255, 180, 70, 0.7); }
.dlg-hot:active { background: rgba(40, 20, 8, 0.16); transform: scale(0.98); }
@media (prefers-reduced-motion: reduce) { .title-hot.start, .dlg-art { animation: none; } }
`;
let cssAdded = false;
function addCss(): void {
  if (cssAdded || typeof document === "undefined") return;
  cssAdded = true;
  const s = document.createElement("style");
  s.textContent = TITLE_CSS;
  document.head.appendChild(s);
}

/** 그림을 화면에 꽉 채우는 배율·왼쪽 여백 (TitleBg 와 같은 계산) */
function fit(vw: number, vh: number): { k: number; ox: number } {
  const k = Math.max(vw / IMG_W, vh / IMG_H);
  return { k, ox: (vw - IMG_W * k) * 0.5 };
}

/** 시작 화면 그림: 화면을 꽉 채우게 키우고(남는 쪽은 잘림), 위에 맞춘다 */
export class TitleBg extends Node2D {
  size = v(1920, 1080);

  draw(g: Gfx): void {
    const img = ArtAssets.titleImage();
    if (img === null) {
      g.rect(new R(0, 0, this.size.x, this.size.y), rgb(0.1, 0.07, 0.06));
      return;
    }
    const k = Math.max(this.size.x / img.width, this.size.y / img.height);
    g.texture(img, new R((this.size.x - img.width * k) * 0.5, 0, img.width * k, img.height * k));
  }
}

/** 게임 이름 (종료 화면 등) */
export function gameLogo(size: number): HTMLDivElement {
  return Ui.logo("포장마차 타이쿤", size);
}

export class TitleScene extends Scene {
  /** 언어를 바꾸면 타이틀을 다시 만들고 설정 창을 다시 연다 */
  static reopenSettings = false;
  private popup: HTMLDivElement | null = null;

  ready(): void {
    addCss();
    // 메인 화면 = 나무판 버튼이 그려진 그림 하나 (2026-11-17 사용자: 가로 버튼 줄 두 번째 그림은 지움)
    const bg = new TitleBg();
    bg.size = v(this.vw, this.vh);
    this.add(bg);
    this.build();
    Sound.playBgm("title");
    if (TitleScene.reopenSettings) {
      TitleScene.reopenSettings = false;
      this.showSettings();
      return;
    }
    if (GameState.justLoggedIn !== "") {
      this.greet(GameState.justLoggedIn);
      GameState.justLoggedIn = "";
    }
    if (GameState.justCleared) {
      GameState.justCleared = false;
      this.showClear();
    }
  }

  private build(): void {
    const { k, ox } = fit(this.vw, this.vh);
    const ko = getLang() === "ko";
    for (const m of MENU) {
      const [x0, y0, x1, y1] = m.label;
      if (!ko) {
        // 그림 속 한국어 글자를 나무판 색으로 덮고 번역 글자
        const lab = Ui.div("title-label");
        Object.assign(lab.style, {
          left: `${ox + x0 * k}px`,
          top: `${y0 * k}px`,
          width: `${(x1 - x0) * k}px`,
          height: `${(y1 - y0) * k}px`,
          background: m.plank,
          boxShadow: `0 0 8px 6px ${m.plank}`,
          color: m.ink,
          fontSize: `${Math.round((y1 - y0) * k * (m.id === "start" ? 0.62 : 0.6))}px`,
        });
        lab.textContent = m.text;
        this.ui.appendChild(lab);
      }
      const [hx0, hy0, hx1, hy1] = m.hit;
      const b = document.createElement("button");
      b.className = `title-hot ${m.id}`;
      b.setAttribute("aria-label", m.text);
      Object.assign(b.style, { left: `${ox + hx0 * k}px`, top: `${hy0 * k}px`, width: `${(hx1 - hx0) * k}px`, height: `${(hy1 - hy0) * k}px` });
      if (m.id === "continue" && !GameState.hasProgress()) b.classList.add("off");
      Ui.onPress(b, () => this.onMenu(m.id));
      this.ui.appendChild(b);
    }
    this.ui.appendChild(this.accountBox());
  }

  private onMenu(id: string): void {
    if (this.popup !== null) return;
    switch (id) {
      case "start":
        if (GameState.hasProgress()) this.askNewGame();
        else this.onStart();
        return;
      case "continue":
        if (GameState.hasProgress()) this.onStart();
        else this.notice("이어 할 기록이 없어요. '게임 시작'을 눌러 주세요!");
        return;
      case "settings":
        this.showSettings();
        return;
      case "quit":
        this.askQuit();
    }
  }

  /**
   * 기록이 있는데 게임 시작: 처음부터 할지 한 번 묻는다. 창 = 사용자 그림 (NEWGAME_*): 그림 속 버튼 자리에 투명 누름 칸
   * (올리면 빛 테두리), 본문은 그림에서 지운 자리에 게임 글씨
   */
  private askNewGame(): void {
    this.closePopup();
    const pop = Ui.overlay(this.ui);
    pop.classList.add("center");
    this.popup = pop;
    const k = NEWGAME_SHOW / NEWGAME_W;
    const box = Ui.div("dlg-art");
    Object.assign(box.style, { width: `${NEWGAME_SHOW}px`, height: `${Math.round(NEWGAME_H * k)}px`, backgroundImage: `url("${ArtAssets.ROOT}/ui/dialog_newgame.webp")` });
    pop.appendChild(box);
    const at = (e: HTMLElement, [x0, y0, x1, y1]: Rect4) =>
      Object.assign(e.style, { left: `${x0 * k}px`, top: `${y0 * k}px`, width: `${(x1 - x0) * k}px`, height: `${(y1 - y0) * k}px` });
    // 본문: 화면에 붙은 뒤 글자 크기를 칸에 맞춰 줄이므로 번역도 바로 해서 넣는다 (data-notr = 자동 번역이 다시 건드리지 않게)
    const text = (t: string, r: Rect4, size: number, color: string): void => {
      const l = Ui.div("dlg-text");
      l.dataset.notr = "1";
      l.textContent = tr(t);
      l.style.color = color;
      at(l, r);
      box.appendChild(l);
      fitText(l, Math.round(size * k));
    };
    const ko = getLang() === "ko";
    for (const part of NEWGAME_PARTS) {
      if (!ko) {
        const c = Ui.div("dlg-cover");
        c.dataset.notr = "1";
        c.textContent = tr(part.text);
        at(c, part.label);
        Object.assign(c.style, { background: part.plank, boxShadow: `0 0 8px 6px ${part.plank}` });
        box.appendChild(c);
        fitText(c, Math.round((part.label[3] - part.label[1]) * k * (part.id === "title" ? 0.56 : 0.62)));
      }
      if (part.hit === null) continue;
      const hit = part.hit;
      const btn = document.createElement("button");
      btn.className = "dlg-hot";
      btn.setAttribute("aria-label", part.text);
      at(btn, hit);
      btn.style.borderRadius = `${Math.round(30 * k)}px`;
      Ui.onPress(btn, () => {
        if (part.id === "cancel") {
          this.closePopup();
          return;
        }
        if (part.id === "fresh") GameState.resetGame();
        this.closePopup();
        this.onStart();
      });
      box.appendChild(btn);
    }
    text(`처음부터 다시 시작할까요?
지금 기록(${D.levelName(GameState.level)} · ${D.formatWon(GameState.wallet)})은 지워져요.`, NEWGAME_BODY, 54, "#3a2618");
    text("이어서 하려면 '이어하기'를 눌러요.", NEWGAME_HINT, 44, "#6e5440");
  }

  // ---------------------------------------------------------------- 설정 (언어 · 소리)

  /** 설정 창: 언어 4개 + 배경 음악·효과음 크기 (+ 소리 끄기). 언어를 바꾸면 화면을 다시 만들어 바로 보여 준다 */
  private showSettings(): void {
    this.closePopup();
    this.popup = Ui.overlay(this.ui);
    this.popup.classList.add("center");
    const p = Ui.popPanel(Ui.PAPER, 40, 48);
    p.style.width = "1060px";
    this.popup.appendChild(p);
    p.appendChild(Ui.ribbon("설정", Ui.ACCENT, 48));
    const col = Ui.vbox(26);
    col.style.alignItems = "stretch";
    p.appendChild(col);

    const langs = Ui.hbox(14);
    langs.dataset.notr = "1"; // 언어 이름은 그 언어 그대로
    for (const l of LANGS) {
      const on = l.id === getLang();
      const b = Ui.button(l.name, on ? Ui.ACCENT : Ui.CARD, 32, 86);
      b.style.flex = "1 1 0";
      if (!on) b.style.color = Ui.INK.css();
      Ui.onPress(b, () => {
        if (on) return;
        setLang(l.id);
        TitleScene.reopenSettings = true;
        this.game.goto("title");
      });
      langs.appendChild(b);
    }
    col.appendChild(this.settingRow("언어", langs));
    col.appendChild(this.settingRow("배경 음악", this.slider(Sound.bgmVolume, (x) => Sound.setVolume("bgm", x))));
    col.appendChild(
      this.settingRow(
        "효과음",
        this.slider(
          Sound.sfxVolume,
          (x) => Sound.setVolume("sfx", x),
          () => Sound.playSfx("coin"),
        ),
      ),
    );
    const mute = Ui.hbox(18);
    mute.style.alignItems = "center";
    mute.appendChild(Ui.soundToggle(72));
    mute.appendChild(Ui.label("눌러서 소리 전체 켜기·끄기", 28, Ui.MUTED, "left"));
    col.appendChild(this.settingRow("소리", mute));

    col.appendChild(Ui.spacer(4));
    const close = Ui.button("닫기", Ui.SECONDARY, 38, 100);
    close.style.alignSelf = "center";
    close.style.width = "420px";
    Ui.onPress(close, () => this.closePopup());
    col.appendChild(close);
  }

  private settingRow(name: string, control: HTMLElement): HTMLDivElement {
    const row = Ui.hbox(24);
    row.style.alignItems = "center";
    const l = Ui.heading(name, 38, Ui.INK, null, "left");
    l.style.width = "230px";
    l.style.flex = "0 0 auto";
    control.style.flex = "1 1 auto";
    row.append(l, control);
    return row;
  }

  /** 0~100% 끌개 + 숫자. onInput = 끄는 동안 바로, onCommit = 놓았을 때 (효과음은 들려줌) */
  private slider(value: number, onInput: (x: number) => void, onCommit?: () => void): HTMLDivElement {
    const wrap = Ui.hbox(18);
    wrap.style.alignItems = "center";
    const r = document.createElement("input");
    r.type = "range";
    r.min = "0";
    r.max = "100";
    r.step = "5";
    r.value = String(Math.round(value * 100));
    r.className = "vol-range";
    const pct = Ui.heading("", 34, Ui.INK, null, "right");
    pct.style.minWidth = "120px";
    const show = (): void => {
      r.style.setProperty("--fill", `${r.value}%`);
      Ui.setText(pct, `${r.value}%`);
    };
    show();
    r.addEventListener("input", () => {
      show();
      onInput(Number(r.value) / 100);
    });
    r.addEventListener("change", () => onCommit?.());
    r.addEventListener("pointerdown", (e) => e.stopPropagation()); // 끄는 동안 게임 쪽 눌림 처리로 넘어가지 않게
    wrap.append(r, pct);
    return wrap;
  }

  /** 위쪽 가운데에 잠깐 뜨는 안내 */
  private notice(text: string): void {
    const t = Ui.chip(999);
    t.style.position = "absolute";
    t.style.left = "50%";
    t.style.top = "34px";
    t.style.transform = "translateX(-50%)";
    t.style.padding = "14px 40px 16px";
    t.style.transition = "opacity 0.5s";
    t.appendChild(Ui.heading(text, 32, Ui.CREAM, rgb(0.1, 0.05, 0.02)));
    this.ui.appendChild(t);
    Sound.playSfx("denied");
    setTimeout(() => (t.style.opacity = "0"), 2200);
    setTimeout(() => t.remove(), 2800);
  }

  // ---------------------------------------------------------------- 계정 (로그인 / 로그아웃)

  /**
   * 왼쪽 위 "👤 로그인" 나무판 (2026-11-16 사용자 그림). 누르면 로그인 창, 로그인했으면 판에 아이디가 보이고 누르면 계정 창(로그아웃·다른 계정).
   */
  private accountBox(): HTMLButtonElement {
    const b = loginPlank(330, () => (GameState.account !== "" ? this.askLogout() : this.showLogin()));
    b.style.left = "26px";
    b.style.top = "20px";
    return b;
  }

  /** 로그인 창 (그림): 아이디·비밀번호·자동 로그인·찾기·회원가입. 성공하면 화면을 다시 만들어 인사 */
  private showLogin(): void {
    this.closePopup();
    this.popup = openLoginPanel(
      this.ui,
      this.vw,
      this.vh,
      () => this.game.goto("title"),
      () => this.closePopup(),
    );
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
    const other = Ui.button("다른 아이디로 로그인", Ui.CARD, 30, 84);
    other.style.color = Ui.INK.css();
    Ui.onPress(other, () => this.showLogin());
    col.appendChild(other);
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
