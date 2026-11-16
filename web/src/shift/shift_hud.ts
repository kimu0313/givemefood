// 영업 화면 상단 정보 상자(무한 영업만 버틴 시간 / 오늘 매출·할당량 / 레벨·일시정지), 안내 토스트,
// 시작 안내/일시정지 창, 천막 내리기 연출. 글자·상자는 HTML, 그림(아이콘·셔터·메뉴 그림)은 작은 캔버스.

import { Color, R, WHITE, clamp, rgb, v } from "../engine/geom.ts";
import type { Gfx } from "../engine/gfx.ts";
import { CanvasWidget } from "../engine/game.ts";
import { Node2D, type Tween } from "../engine/node.ts";
import { Signal } from "../core/signal.ts";
import * as D from "../core/defs.ts";
import type { ShiftSession } from "../core/shift_session.ts";
import * as Ui from "../engine/ui.ts";
import { Sound } from "../engine/audio.ts";
import * as FoodArt from "../art/food_art.ts";
import * as DishArt from "../art/dish_art.ts";
import { TARP_CREAM, TARP_RED } from "../art/street_art.ts";

/** 새 메뉴 안내에 붙는 메뉴 그림 (그 메뉴 그릇에 담긴 모습) */
export function menuPic(menu: string, w: number, h: number): CanvasWidget {
  return new CanvasWidget(w, h, (g, t) => {
    FoodArt.setClock(t);
    DishArt.draw(g, menu, v(w * 0.5, h * 0.58), Math.min(w / 190.0, h / 135.0), D.Q.PERFECT);
  });
}

/** 메뉴 아이콘 줄 (동그란 접시 위 음식 그림). fresh = 새로 나오는 메뉴 (금색 테두리 + 반짝) */
export function menuIcons(menus: string[], fresh: string[] = [], cell = 70): CanvasWidget {
  const w = menus.length * cell;
  const h = cell;
  const wd = new CanvasWidget(w, h, (g, t) => {
    menus.forEach((m, i) => {
      const c = v(cell * (i + 0.5), h * 0.5);
      const r = cell * 0.42;
      const isNew = fresh.includes(m);
      g.circle(c.add(v(0, 3)), r + 3.0, rgb(0.23, 0.14, 0.08, 0.35));
      g.circle(c, r + 3.0, isNew ? rgb(0.55, 0.3, 0.04) : rgb(0.23, 0.14, 0.08));
      g.circle(c, r, isNew ? rgb(1.0, 0.86, 0.4) : rgb(1.0, 0.97, 0.9));
      FoodArt.drawIcon(g, m, c.add(v(0, 2)), (cell / 70.0) * 0.62);
      if (isNew) FoodArt.sparkle(g, c.add(v(r * 0.75, -r * 0.75)), 0.75 + 0.2 * Math.sin(t * 5.0));
    });
  });
  wd.animated = fresh.length > 0;
  return wd;
}

export interface IntroEntry {
  head: string;
  body: string;
  menu?: string;
}

export class ShiftHud extends Node2D {
  readonly startPressed = new Signal();
  readonly signPressed = new Signal(); // "준비 중" 팻말을 누름 → 가게 문 열기
  readonly backPressed = new Signal(); // 시작 안내의 "나중에" (미식가 이벤트: 기회를 쓰지 않고 지도로)
  readonly pausePressed = new Signal();
  readonly resumePressed = new Signal();
  readonly quitPressed = new Signal();

  private root!: HTMLDivElement;
  private dayLabel!: HTMLDivElement;
  private subLabel!: HTMLDivElement;
  private leftBox!: HTMLDivElement;
  private timeTitle!: HTMLDivElement;
  private timeLabel!: HTMLDivElement;
  private moneyTitle!: HTMLDivElement;
  private moneyLabel!: HTMLDivElement;
  private goal!: { el: HTMLDivElement; set: (k: number, c?: Color) => void };
  private toastEl!: HTMLDivElement;
  private toastState = { a: 0 };
  private toastTween: Tween | null = null;
  private intro: HTMLDivElement | null = null;
  private pause: HTMLDivElement | null = null;
  private shutter!: CanvasWidget;
  private shutterState = { drop: 0 };
  private shutterCaption = "";

  constructor() {
    super();
    this.processAlways = true;
  }

  build(parent: HTMLElement, viewW: number, viewH: number): void {
    this.root = Ui.div();
    this.root.style.position = "absolute";
    this.root.style.inset = "0";
    parent.appendChild(this.root);
    this.buildTopBar(viewW);
    this.toastEl = Ui.heading("", 36, WHITE, rgb(0.12, 0.06, 0.03));
    this.toastEl.classList.remove("disp");
    Ui.place(this.toastEl, 0, 114, viewW, 54);
    this.toastEl.style.opacity = "0";
    this.root.appendChild(this.toastEl);
    this.shutter = new CanvasWidget(viewW, viewH, (g) => this.drawShutter(g, viewW, viewH));
    const se = this.shutter.el;
    se.style.position = "absolute";
    se.style.left = "0";
    se.style.top = "0";
    se.style.zIndex = "20";
    this.root.appendChild(se);
  }

  // ---------------------------------------------------------------- 팻말 (준비 중 → 영업 중)

  private sign: HTMLDivElement | null = null;
  private signText!: HTMLDivElement;
  private signSub!: HTMLDivElement;

  /**
   * 가게 앞에 걸린 나무 팻말 (2026-11-16 사용자 "팻말을 영업 개시로 바꿔야 손님 오게").
   * 처음엔 가운데 위에 크게 "준비 중" + "눌러서 가게 문 열기" (흔들흔들). 누르면 뒤집히며 "영업 중" → 왼쪽 위 구석으로 작게.
   */
  buildSign(w: number): void {
    const sg = Ui.div("shop-sign");
    sg.style.left = `${w * 0.5 - 220}px`;
    const strings = Ui.div("shop-sign-strings");
    const board = Ui.div("shop-sign-board");
    this.signText = Ui.heading("준비 중", 66, rgb(1.0, 0.86, 0.72), rgb(0.35, 0.08, 0.04));
    this.signSub = Ui.label("눌러서 가게 문 열기", 28, rgb(1.0, 0.93, 0.8));
    this.signSub.classList.add("shop-sign-sub");
    board.append(this.signText, this.signSub);
    sg.append(strings, board);
    sg.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!sg.classList.contains("open")) this.signPressed.emit();
    });
    this.root.appendChild(sg);
    this.sign = sg;
  }

  /** 팻말 자리 (튜토리얼이 가리킴) */
  signElement(): HTMLDivElement | null {
    return this.sign;
  }

  /** 팻말을 뒤집어 "영업 중"으로 → 잠깐 뒤 왼쪽 위 구석으로 */
  flipSign(): void {
    const sg = this.sign;
    if (sg === null || sg.classList.contains("open")) return;
    sg.classList.add("flipping");
    setTimeout(() => {
      Ui.setText(this.signText, "영업 중");
      Ui.setText(this.signSub, "어서 오세요!");
      sg.classList.add("open");
      sg.classList.remove("flipping");
    }, 180);
    setTimeout(() => sg.classList.add("corner"), 1100);
  }

  /** 정보 칩 하나 (어두운 나무 판) */
  private box(x: number, y: number, w: number, h: number): HTMLDivElement {
    const b = Ui.chip(24);
    Ui.place(b, x, y, w, h);
    this.root.appendChild(b);
    return b;
  }

  private icon(parent: HTMLElement, svg: string, x: number, y: number, size: number): void {
    const ic = Ui.icon(svg, size);
    ic.style.position = "absolute";
    ic.style.left = `${x}px`;
    ic.style.top = `${y}px`;
    parent.appendChild(ic);
  }

  private placeLabel(parent: HTMLElement, l: HTMLDivElement, x: number, y: number, w: number, h: number): HTMLDivElement {
    Ui.place(l, x, y, w, h);
    l.style.overflow = "hidden";
    parent.appendChild(l);
    return l;
  }

  private buildTopBar(w: number): void {
    const dark = rgb(0.1, 0.05, 0.02);
    // 왼쪽: 무한 영업의 버틴 시간 (스토리는 남은 손님 수를 일부러 안 보여 주므로 상자를 숨긴다)
    this.leftBox = this.box(18, 10, 320, 86);
    this.icon(this.leftBox, Ui.ICON.clock, 10, 12, 56);
    this.timeTitle = this.placeLabel(this.leftBox, Ui.label("버틴 시간", 21, Ui.CREAM.withA(0.75), "left"), 78, 4, 230, 28);
    this.timeLabel = this.placeLabel(this.leftBox, Ui.heading("", 38, Ui.CREAM, dark, "left"), 78, 26, 230, 52);

    // 가운데: 오늘 매출 + 할당량 게이지
    const mid = this.box(w * 0.5 - 270.0, 10, 540, 86);
    this.icon(mid, Ui.ICON.coin, 8, 10, 62);
    this.moneyTitle = this.placeLabel(mid, Ui.label("오늘 매출", 21, Ui.CREAM.withA(0.75), "left"), 82, 4, 440, 28);
    this.moneyLabel = this.placeLabel(mid, Ui.heading("0원", 38, Ui.GOLD, dark, "left"), 82, 26, 240, 52);
    this.goal = Ui.gauge(206, 24);
    Ui.place(this.goal.el, 314, 44, 206, 24);
    mid.appendChild(this.goal.el);

    // 오른쪽: 가게·레벨 + 일시정지
    const right = this.box(w - 18.0 - 86.0 - 14.0 - 300.0, 10, 300, 86);
    this.subLabel = this.placeLabel(right, Ui.label("", 21, Ui.CREAM.withA(0.75)), 8, 4, 276, 28);
    this.dayLabel = this.placeLabel(right, Ui.heading("", 34, Ui.CREAM, dark), 8, 28, 276, 48);

    const pause = Ui.button("", Ui.SECONDARY, 30, 86);
    Ui.withIcon(pause, Ui.ICON.pause, "", 44);
    pause.setAttribute("aria-label", "일시정지");
    pause.title = "일시정지";
    pause.style.padding = "0";
    pause.style.borderRadius = "24px";
    Ui.place(pause, w - 18.0 - 86.0, 8, 86, 80);
    Ui.onPress(pause, () => this.pausePressed.emit());
    this.root.appendChild(pause);
  }

  updateStats(s: ShiftSession): void {
    Ui.setText(this.subLabel, s.shop.name);
    if (s.event) {
      // 미식가 이벤트: 왼쪽 = 코스 몇 번째, 가운데 막대 = 미식가 만족도
      const g = s.gourmet;
      const rounds = (s.eventDef ?? D.EVENTS[0]).rounds;
      Ui.setText(this.dayLabel, "미식가 방문");
      this.leftBox.style.display = "";
      Ui.setText(this.timeTitle, "코스");
      Ui.setText(this.timeLabel, `${g === null ? 1 : Math.min(g.round + 1, rounds)} / ${rounds}`);
      const sat = g === null ? 1.0 : g.satisfaction();
      const stars = D.gourmetGrade(sat);
      Ui.setText(this.moneyTitle, `미식가 만족도 ${D.roundHalfAway(sat * 100)}% · ${"★".repeat(stars)}${"☆".repeat(D.MAX_STARS - stars)}`);
      Ui.setColor(this.moneyTitle, Ui.CREAM.withA(0.85));
      this.goal.el.style.display = "";
      this.goal.set(sat, sat >= 0.75 ? rgb(0.45, 0.88, 0.4) : sat >= 0.55 ? Ui.GOLD : rgb(0.95, 0.4, 0.3));
      Ui.setText(this.moneyLabel, D.formatWon(s.revenue()));
      return;
    }
    if (s.endless) {
      Ui.setText(this.dayLabel, `무한 영업 · 기회 ${s.lives}`);
      this.leftBox.style.display = "";
      Ui.setText(this.timeTitle, "버틴 시간");
      Ui.setText(this.timeLabel, D.formatTime(s.elapsed));
      Ui.setText(this.moneyTitle, "오늘 매출");
      this.goal.el.style.display = "none";
    } else {
      Ui.setText(this.dayLabel, D.levelName(s.level));
      this.leftBox.style.display = "none";
      const ratio = clamp(s.revenue() / Math.max(1, s.target), 0.0, 1.0);
      if (ratio >= 1.0) {
        Ui.setText(this.moneyTitle, `할당량 ${D.formatWon(s.target)} 달성!`);
        Ui.setColor(this.moneyTitle, rgb(0.55, 1.0, 0.6));
      } else {
        Ui.setText(this.moneyTitle, `오늘 매출 · 할당량 ${D.formatWon(s.target)}`);
        Ui.setColor(this.moneyTitle, Ui.CREAM.withA(0.75));
      }
      this.goal.set(ratio, ratio >= 1.0 ? rgb(0.45, 0.88, 0.4) : Ui.GOLD);
    }
    Ui.setText(this.moneyLabel, D.formatWon(s.revenue()));
  }

  toast(text: string, color: Color = WHITE): void {
    Ui.setText(this.toastEl, text);
    Ui.setColor(this.toastEl, color);
    this.toastTween?.kill();
    this.toastState.a = 1.0;
    const tw = this.createTween();
    tw.interval(1.3);
    tw.prop(this.toastState, "a", 0.0, 0.4);
    this.toastTween = tw;
  }

  process(_dt: number): void {
    this.toastEl.style.opacity = String(this.toastState.a);
  }

  /** entries: [{head, body, menu (있으면 왼쪽에 메뉴 그림)}, ...] — 리본 제목 + 할당량 띠 + 설명 칸들(2줄로 나란히) + 영업 시작 */
  showIntro(title: string, subtitle: string, entries: IntroEntry[], buttonText: string, color: Color = Ui.ACCENT, backText = ""): void {
    this.intro = Ui.overlay(this.root, 0.66);
    this.intro.style.zIndex = "10";
    const m = Ui.screenMargin(this.intro, 60, 30, 60);
    const center = Ui.center();
    m.appendChild(center);
    const p = Ui.popPanel(Ui.PAPER, 40, 34);
    p.style.width = "1360px";
    center.appendChild(p);
    p.appendChild(Ui.ribbon(title, color, 50));
    const col = Ui.vbox(14);
    p.appendChild(col);
    const sub = Ui.label(subtitle, 32, Ui.INK, "center", true);
    col.appendChild(sub);
    const grid = Ui.div();
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "1fr 1fr";
    grid.style.gap = "12px";
    if (entries.length > 0) col.appendChild(grid);
    for (const e of entries) {
      const card = Ui.inset(14);
      card.classList.add("hbox");
      card.style.gap = "18px";
      card.style.alignItems = "center";
      // 메뉴 그림이 있거나 설명이 긴 칸은 한 줄 전체
      if (e.menu !== undefined || e.body.length > 70 || entries.length === 1) card.style.gridColumn = "1 / span 2";
      grid.appendChild(card);
      if (e.menu !== undefined) {
        const pic = menuPic(e.menu, 170, 116);
        pic.el.style.flex = "0 0 auto";
        card.appendChild(pic.el);
      }
      const text = Ui.vbox(4);
      text.style.flex = "1 1 auto";
      text.append(Ui.heading(e.head, 30, color, null, "left", true), Ui.label(e.body, 26, Ui.INK, "left", true));
      card.appendChild(text);
    }
    col.appendChild(Ui.spacer(2));
    const b = Ui.button("", color, 48, 120);
    Ui.withIcon(b, Ui.ICON.play, buttonText);
    Ui.lively(b);
    b.style.width = "620px";
    Ui.onPress(b, () => this.startPressed.emit());
    if (backText === "") {
      b.style.alignSelf = "center";
      col.appendChild(b);
      return;
    }
    const row = Ui.hbox(20);
    row.style.justifyContent = "center";
    col.appendChild(row);
    const back = Ui.button(backText, Ui.SECONDARY, 40, 120);
    back.style.width = "300px";
    Ui.onPress(back, () => this.backPressed.emit());
    row.append(back, b);
  }

  hideIntro(): void {
    this.intro?.remove();
    this.intro = null;
  }

  showPause(): void {
    if (this.pause !== null) return;
    this.pause = Ui.overlay(this.root, 0.72);
    this.pause.style.zIndex = "10";
    this.pause.classList.add("center");
    const p = Ui.popPanel(Ui.PAPER, 40, 44);
    p.style.width = "720px";
    this.pause.appendChild(p);
    p.appendChild(Ui.ribbon("잠깐 쉬는 중", Ui.AD, 48));
    const col = Ui.vbox(18);
    p.appendChild(col);
    col.appendChild(Ui.label("타이틀로 나가면 오늘 영업 기록은 사라져요.", 30, Ui.MUTED, "center", true));
    col.appendChild(Ui.spacer(4));
    const resume = Ui.button("", Ui.ACCENT, 44, 120);
    Ui.withIcon(resume, Ui.ICON.play, "계속 영업하기");
    Ui.onPress(resume, () => this.resumePressed.emit());
    col.appendChild(resume);
    const quit = Ui.button("타이틀로", Ui.SECONDARY, 38, 104);
    Ui.onPress(quit, () => this.quitPressed.emit());
    col.appendChild(quit);
  }

  hidePause(): void {
    this.pause?.remove();
    this.pause = null;
  }

  isPauseShown(): boolean {
    return this.pause !== null;
  }

  /** 영업 종료 때 내려오는 줄무늬 천막 */
  private drawShutter(g: Gfx, w: number, hgt: number): void {
    const drop = this.shutterState.drop;
    const h = hgt * drop;
    if (h <= 0.0) return;
    const stripe = 90.0;
    const n = Math.ceil(w / stripe);
    for (let i = 0; i < n; i++) {
      const col = i % 2 === 0 ? TARP_RED : TARP_CREAM;
      g.circle(v(i * stripe + stripe * 0.5, h), stripe * 0.5, col);
      g.rect(new R(i * stripe, 0, stripe, h), col);
    }
    if (drop > 0.85) {
      const a = clamp((drop - 0.85) / 0.15, 0.0, 1.0);
      FoodArt.textOutlined(g, this.shutterCaption, v(w * 0.5, hgt * 0.45), 84, rgb(1, 1, 1, a), rgb(0.3, 0.08, 0.05, a), 14, w);
    }
  }

  playClosing(caption: string, onDone: () => void): void {
    Sound.playSfx("shutter");
    this.shutterCaption = caption;
    this.shutter.el.style.pointerEvents = "auto";
    this.shutter.animated = true;
    const tw = this.createTween();
    tw.prop(this.shutterState, "drop", 1.0, 1.1).setTrans("bounce").setEase("out");
    tw.interval(1.0);
    tw.call(onDone);
  }
}
