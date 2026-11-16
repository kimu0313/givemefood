// UI 공통 색·위젯 만들기 (Godot Ui 와 같은 이름·크기). 화면 글자·버튼·패널은 HTML 로 만든다.
// 2026-11-15 게임 UI 다시 만듦 (사용자 "UI 들이 너무 대충이고 글씨체도 너무 대충, 게임같지 않아"):
//   글꼴 = 주아(본문·버튼) + 베이글 팻 원(게임 이름·큰 제목·숫자), 진한 먹선 테두리를 두른 통통한 3D 버튼(아래 두께 + 윤기,
//   누르면 내려앉음), 두꺼운 테두리 크림색 종이 창, 창 위에 걸친 리본 제목, 어두운 나무 정보 칩, 금색 게이지, 작은 SVG 아이콘.

import { Color, WHITE, rgb } from "./geom.ts";
import { DISPLAY_STACK, FONT_STACK } from "./gfx.ts";

export const INK = rgb(0.23, 0.14, 0.08);
export const CREAM = rgb(0.99, 0.95, 0.86);
export const PAPER = rgb(0.99, 0.96, 0.88);
export const CARD = rgb(0.95, 0.89, 0.77);
export const ACCENT = rgb(0.93, 0.37, 0.17);
export const SECONDARY = rgb(0.6, 0.44, 0.32);
export const GOOD = rgb(0.29, 0.68, 0.27);
export const BAD = rgb(0.85, 0.24, 0.18);
export const GOLD = rgb(1.0, 0.78, 0.2);
export const MUTED = rgb(0.52, 0.43, 0.35);
export const AD = rgb(0.24, 0.55, 0.93);
export const EVENT = rgb(0.56, 0.3, 0.82); // 미식가 이벤트 (보라)
export const DISABLED = rgb(0.62, 0.58, 0.54);

export type Align = "left" | "center" | "right";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

export function div(cls = ""): HTMLDivElement {
  return el("div", cls);
}

/** 글자 ("\n" 줄바꿈). wrap = 폭이 모자라면 줄바꿈 */
export function label(text: string, size = 40, color: Color = INK, align: Align = "center", wrap = false): HTMLDivElement {
  const l = div("lbl");
  l.textContent = text;
  const s = l.style;
  s.fontSize = `${size}px`;
  s.color = color.css();
  s.textAlign = align;
  s.whiteSpace = wrap ? "pre-line" : "pre";
  return l;
}

/**
 * 큰 제목 글자 (굵은 제목 글꼴 + 먹선 테두리 + 아래로 두께 그림자). outline = null 이면 테두리 없이 (종이 위 제목).
 */
export function heading(text: string, size = 64, color: Color = CREAM, outline: Color | null = INK, align: Align = "center", wrap = false): HTMLDivElement {
  const l = label(text, size, color, align, wrap);
  l.classList.add("disp");
  if (outline !== null) {
    const w = Math.max(4, Math.round(size * 0.16));
    l.style.setProperty("-webkit-text-stroke", `${w}px ${outline.css()}`);
    l.style.setProperty("paint-order", "stroke fill");
    l.style.textShadow = `0 ${Math.round(size * 0.07)}px 0 ${outline.css()}`;
  }
  return l;
}

export function setText(l: HTMLElement, text: string): void {
  if (l.textContent !== text) l.textContent = text;
}

export function setColor(l: HTMLElement, c: Color): void {
  const css = c.css();
  if (l.style.color !== css) l.style.color = css;
}

/** 글자 테두리 (Godot outline_size) */
export function outlined<T extends HTMLElement>(l: T, outline: Color = rgb(0, 0, 0, 0.7), size = 12): T {
  l.style.setProperty("-webkit-text-stroke", `${size}px ${outline.css()}`);
  l.style.setProperty("paint-order", "stroke fill");
  return l;
}

export interface Button extends HTMLButtonElement {
  setColor(c: Color): void;
}

/** 통통한 3D 버튼: 색마다 밝은 윗면 · 진한 아래 두께 · 먹선 테두리 (CSS 변수로) */
export function button(text: string, color: Color = ACCENT, size = 44, minH = 124): Button {
  const b = el("button", "btn") as Button;
  b.textContent = text;
  b.style.fontSize = `${size}px`;
  b.style.minHeight = `${Math.round(minH * 0.86)}px`;
  b.style.setProperty("--ts", `${Math.max(5, Math.round(size * 0.16))}px`);
  b.setColor = (c: Color) => {
    const s = b.style;
    s.setProperty("--top", c.lightened(0.3).css());
    s.setProperty("--bg", c.css());
    s.setProperty("--bot", c.darkened(0.12).css());
    s.setProperty("--lip", c.darkened(0.38).css());
    s.setProperty("--edge", c.darkened(0.68).css());
  };
  b.setColor(color);
  return b;
}

/** 버튼 글자 앞에 작은 아이콘 (SVG 문자열) */
export function withIcon(b: HTMLElement, svg: string, text: string, iconSize = 0): HTMLElement {
  b.replaceChildren();
  const ic = div("ic");
  ic.innerHTML = svg;
  if (iconSize > 0) {
    ic.style.width = `${iconSize}px`;
    ic.style.height = `${iconSize}px`;
  }
  const t = document.createElement("span");
  t.textContent = text;
  b.append(ic, t);
  return b;
}

/** 가볍게 숨 쉬듯 커졌다 작아지는 버튼 (지금 누를 버튼) + 윤기 빛이 지나감 */
export function lively(b: HTMLElement): HTMLElement {
  b.classList.add("lively");
  return b;
}

export function onPress(b: HTMLElement, fn: () => void): void {
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    if ((b as HTMLButtonElement).disabled) return;
    fn();
  });
}

/** 크림색 종이 창 (두꺼운 먹선 테두리 + 안쪽 흰 테 + 아래 두께) */
export function panel(color: Color = PAPER, radius = 36, pad = 44): HTMLDivElement {
  const p = div("panel");
  p.style.background = `linear-gradient(180deg, ${color.lightened(0.35).css()} 0%, ${color.css()} 38%, ${color.darkened(0.05).css()} 100%)`;
  p.style.borderRadius = `${radius}px`;
  p.style.padding = `${pad}px`;
  p.style.setProperty("--pad", `${pad}px`);
  return p;
}

/** 팝업 창: 튀어나오며 열림 */
export function popPanel(color: Color = PAPER, radius = 36, pad = 44): HTMLDivElement {
  const p = panel(color, radius, pad);
  p.classList.add("pop");
  return p;
}

/**
 * 창 위에 걸치는 리본 제목 (가운데, 양 끝이 제비꼬리로 접힘). 창(panel)의 첫 자식으로 넣으면 창 테두리 위로 올라간다.
 */
export function ribbon(text: string, color: Color = ACCENT, size = 46): HTMLDivElement {
  const w = div("ribbon");
  const s = w.style;
  s.setProperty("--rt", color.lightened(0.28).css());
  s.setProperty("--rb", color.css());
  s.setProperty("--rd", color.darkened(0.35).css());
  s.setProperty("--re", color.darkened(0.7).css());
  s.setProperty("--rh", `${Math.round(size * 1.9)}px`);
  const body = div("rb-body disp");
  body.textContent = text;
  body.style.fontSize = `${size}px`;
  body.style.setProperty("-webkit-text-stroke", `${Math.max(5, Math.round(size * 0.17))}px ${color.darkened(0.7).css()}`);
  w.appendChild(body);
  return w;
}

/** 어두운 나무 정보 칩 (지도·영업 화면 위쪽 정보) */
export function chip(radius = 999): HTMLDivElement {
  const c = div("chip");
  c.style.borderRadius = `${radius}px`;
  return c;
}

/** 금색 게이지 (0~1). 돌려준 함수로 채움 비율·색을 바꾼다 */
export function gauge(w: number, h: number): { el: HTMLDivElement; set: (k: number, c?: Color) => void } {
  const track = div("gauge");
  track.style.width = `${w}px`;
  track.style.height = `${h}px`;
  const fill = div("g-fill");
  track.appendChild(fill);
  return {
    el: track,
    set: (k: number, c?: Color) => {
      fill.style.width = `${Math.max(0, Math.min(1, k)) * 100}%`;
      if (c !== undefined) fill.style.setProperty("--gc", c.css());
    },
  };
}

/** 알약 모양 꼬리표 (새 메뉴 · 새 손님 같은 알림): 색 바탕 + 흰 글자 */
export function tag(text: string, color: Color = GOOD, size = 28): HTMLDivElement {
  const t = div("tag");
  t.textContent = text;
  t.style.fontSize = `${size}px`;
  t.style.background = `linear-gradient(180deg, ${color.lightened(0.25).css()}, ${color.css()})`;
  t.style.borderColor = color.darkened(0.6).css();
  t.style.setProperty("-webkit-text-stroke", `${Math.max(4, Math.round(size * 0.18))}px ${color.darkened(0.6).css()}`);
  return t;
}

/** 작은 아이콘 (SVG) 상자 */
export function icon(svg: string, size: number): HTMLDivElement {
  const d = div("ic");
  d.innerHTML = svg;
  d.style.width = `${size}px`;
  d.style.height = `${size}px`;
  return d;
}

/**
 * 글자 입력 칸 (크림색 종이 + 먹선). 칸 안의 키는 게임으로 안 넘긴다 (Backspace 가 '뒤로 가기'가 되지 않게).
 * onEnter: 한글 조합 중에 Enter 를 누르면 조합이 끝난 뒤에 부른다.
 */
export function textField(placeholder: string, maxLen: number, onEnter: () => void, onEscape: () => void): HTMLInputElement {
  const f = el("input", "field") as HTMLInputElement;
  f.type = "text";
  f.placeholder = placeholder;
  f.maxLength = maxLen;
  f.autocomplete = "off";
  f.spellcheck = false;
  let pending = false;
  f.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape") onEscape();
    else if (e.key === "Enter") {
      if (e.isComposing) pending = true;
      else onEnter();
    }
  });
  f.addEventListener("compositionend", () => {
    if (!pending) return;
    pending = false;
    setTimeout(onEnter, 0);
  });
  return f;
}

// 아이콘 (먹선 테두리 + 통통한 모양, 크기는 상자에 맞춰 늘어남)
export const ICON = {
  user: `<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" fill="#ffe0a8" stroke="#3b2415" stroke-width="3.5"/><path d="M10.5 39.5a14 12 0 0 1 27 0A20 20 0 0 1 10.5 39.5z" fill="#fff" stroke="#3b2415" stroke-width="3.5" stroke-linejoin="round"/><circle cx="24" cy="19.5" r="8" fill="#fff" stroke="#3b2415" stroke-width="3.5"/></svg>`,
  coin: `<svg viewBox="0 0 48 48"><circle cx="24" cy="26" r="20" fill="#9a5a0c"/><circle cx="24" cy="23" r="20" fill="#ffcf3a" stroke="#6b3a06" stroke-width="3.5"/><circle cx="24" cy="23" r="13.5" fill="none" stroke="#e59a14" stroke-width="3"/><path d="M16 17l3.5 12 4.5-9 4.5 9 3.5-12M14.5 22.5h19" fill="none" stroke="#a8620a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="16" cy="13" rx="5" ry="2.6" fill="#fff6c8" transform="rotate(-30 16 13)"/></svg>`,
  star: `<svg viewBox="0 0 48 48"><path d="M24 4l6 13 14 1.6-10.5 9.6 3 14L24 35l-12.5 7.2 3-14L4 18.6 18 17z" fill="#ffd23a" stroke="#6b3a0c" stroke-width="3.5" stroke-linejoin="round"/><path d="M24 10l-3.6 8.6" stroke="#fff6c0" stroke-width="3" stroke-linecap="round"/></svg>`,
  back: `<svg viewBox="0 0 48 48"><path d="M30 8L12 24l18 16" fill="none" stroke="#3b2415" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 8L12 24l18 16" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  pause: `<svg viewBox="0 0 48 48"><rect x="9" y="7" width="12" height="34" rx="4" fill="#fff" stroke="#3b2415" stroke-width="4"/><rect x="27" y="7" width="12" height="34" rx="4" fill="#fff" stroke="#3b2415" stroke-width="4"/></svg>`,
  play: `<svg viewBox="0 0 48 48"><path d="M13 7l28 17-28 17z" fill="#fff" stroke="#3b2415" stroke-width="4.5" stroke-linejoin="round"/></svg>`,
  clock: `<svg viewBox="0 0 48 48"><circle cx="24" cy="25" r="19" fill="#fff6e4" stroke="#3b2415" stroke-width="4"/><path d="M24 14v11l7 5" fill="none" stroke="#e0552a" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  lock: `<svg viewBox="0 0 48 48"><path d="M15 22v-6a9 9 0 0 1 18 0v6" fill="none" stroke="#3b2415" stroke-width="9"/><path d="M15 22v-6a9 9 0 0 1 18 0v6" fill="none" stroke="#d9d0c4" stroke-width="4"/><rect x="9" y="21" width="30" height="22" rx="5" fill="#f2b33a" stroke="#3b2415" stroke-width="4"/><circle cx="24" cy="31" r="3.5" fill="#3b2415"/></svg>`,
  book: `<svg viewBox="0 0 48 48"><path d="M8 9h13a5 5 0 0 1 5 5v27a4 4 0 0 0-4-4H8z" fill="#fff6e4" stroke="#3b2415" stroke-width="4" stroke-linejoin="round"/><path d="M40 9H27a5 5 0 0 0-5 5v27a4 4 0 0 1 4-4h14z" fill="#ffe0a8" stroke="#3b2415" stroke-width="4" stroke-linejoin="round"/></svg>`,
  up: `<svg viewBox="0 0 48 48"><path d="M24 6L7 24h10v17h14V24h10z" fill="#fff" stroke="#3b2415" stroke-width="4.5" stroke-linejoin="round"/></svg>`,
  exit: `<svg viewBox="0 0 48 48"><path d="M8 6h20v36H8z" fill="#ffe0a8" stroke="#3b2415" stroke-width="4" stroke-linejoin="round"/><circle cx="22" cy="25" r="2.6" fill="#3b2415"/><path d="M28 24h14M36 17l7 7-7 7" fill="none" stroke="#3b2415" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M28 24h14M36 17l7 7-7 7" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  ad: `<svg viewBox="0 0 48 48"><rect x="5" y="10" width="38" height="28" rx="7" fill="#fff" stroke="#123a6a" stroke-width="4"/><path d="M20 17l11 7-11 7z" fill="#3d8be0"/></svg>`,
};

/** 게임 이름 글자: 굵은 제목 글꼴, 크림 → 노랑 → 주황 그라데이션 + 두꺼운 팥색 테두리 + 아래 두께 (로딩 화면 index.html 도 같은 모양) */
export function logo(text: string, size: number): HTMLDivElement {
  const box = div("logo disp");
  box.style.fontSize = `${size}px`;
  box.style.setProperty("--lw", `${Math.round(size * 0.2)}px`);
  box.style.setProperty("--ld", `${Math.round(size * 0.09)}px`);
  const back = div("logo-back");
  back.textContent = text;
  const front = div("logo-front");
  front.textContent = text;
  box.append(back, front);
  return box;
}

/** 레벨 점 (받은 단계는 금색, 남은 단계는 빈 점) */
export function pips(n: number, total: number, size = 22): HTMLDivElement {
  const row = div("pips");
  for (let i = 0; i < total; i++) {
    const p = div(i < n ? "pip on" : "pip");
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    row.appendChild(p);
  }
  return row;
}

/** 테두리 있는 상자 (Ui.flat 의 border) */
export function flatBox(color: Color, radius: number, border: Color | null = null, borderW = 0): HTMLDivElement {
  const p = div("box");
  p.style.background = color.css();
  p.style.borderRadius = `${radius}px`;
  // 테두리는 안쪽 그림자로 (Godot StyleBoxFlat 처럼 자식 좌표가 테두리에 밀리지 않게)
  if (border && borderW > 0) p.style.boxShadow = `inset 0 0 0 ${borderW}px ${border.css()}`;
  return p;
}

/** 종이 창 안의 작은 칸 (설명 묶음) */
export function inset(pad = 18): HTMLDivElement {
  const d = div("inset");
  d.style.padding = `${pad}px ${pad + 6}px`;
  return d;
}

export function vbox(sep = 18): HTMLDivElement {
  const v = div("vbox");
  v.style.gap = `${sep}px`;
  return v;
}

export function hbox(sep = 18): HTMLDivElement {
  const h = div("hbox");
  h.style.gap = `${sep}px`;
  return h;
}

/** 왼쪽 라벨 + 오른쪽 값 한 줄 */
export function row(left: string, right: string, size = 36, color: Color = INK, rightColor: Color = INK): HTMLDivElement {
  const h = hbox(10);
  h.style.alignItems = "baseline";
  const l = label(left, size, color, "left");
  l.style.flex = "1 1 auto";
  h.append(l, label(right, size, rightColor, "right"));
  return h;
}

export function spacer(h = 0, expand = false): HTMLDivElement {
  const c = div("spacer");
  c.style.minHeight = `${h}px`;
  if (expand) c.style.flex = "1 1 0";
  return c;
}

/** 점선 구분선 (영수증처럼) */
export function divider(color: Color = rgb(0.23, 0.14, 0.08, 0.35)): HTMLDivElement {
  const r = div("divider");
  r.style.setProperty("--dc", color.css());
  return r;
}

/** 화면 전체를 채우는 여백 상자 (안의 첫 자식이 남은 공간을 채움) */
export function screenMargin(parent: HTMLElement, top = 120, bottom = 80, side = 60): HTMLDivElement {
  const m = div("margin");
  m.style.padding = `${top}px ${side}px ${bottom}px ${side}px`;
  parent.appendChild(m);
  return m;
}

/** 반투명 전체 화면 덮개 (팝업 배경, 아래로 입력이 안 감) */
export function overlay(parent: HTMLElement, alpha = 0.72): HTMLDivElement {
  const r = div("overlay");
  r.style.background = `radial-gradient(ellipse at 50% 45%, rgba(20,10,4,${(alpha * 0.7).toFixed(3)}) 0%, rgba(8,4,2,${Math.min(0.92, alpha * 1.15).toFixed(3)}) 100%)`;
  parent.appendChild(r);
  return r;
}

/** 가운데 정렬 상자 */
export function center(): HTMLDivElement {
  return div("center");
}

/** 정해진 자리에 놓는 상자 (설계 좌표) */
export function place<T extends HTMLElement>(e: T, x: number, y: number, w: number, h: number): T {
  const s = e.style;
  s.position = "absolute";
  s.left = `${x}px`;
  s.top = `${y}px`;
  s.width = `${w}px`;
  s.height = `${h}px`;
  return e;
}

const INK_CSS = "#3b2415";

export const UI_CSS = `
@keyframes ui-pop { 0% { transform: scale(0.55); opacity: 0; } 65% { transform: scale(1.04); opacity: 1; } 100% { transform: scale(1); } }
@keyframes ui-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes ui-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }
@keyframes ui-shine { 0% { left: -45%; } 55%, 100% { left: 130%; } }
.ui-root { position: absolute; transform-origin: 0 0; pointer-events: none; font-family: ${FONT_STACK}; color: ${INK.css()}; user-select: none; -webkit-user-select: none; }
.scene-ui { position: absolute; inset: 0; overflow: hidden; }
.lbl { line-height: 1.28; pointer-events: none; overflow-wrap: anywhere; word-break: keep-all; }
.disp { font-family: ${DISPLAY_STACK}; line-height: 1.2; letter-spacing: 0.01em; }

.btn { pointer-events: auto; position: relative; isolation: isolate; overflow: hidden; box-sizing: border-box; font-family: inherit; color: ${WHITE.css()};
  background: linear-gradient(180deg, var(--top) 0%, var(--bg) 52%, var(--bot) 100%);
  border: 5px solid var(--edge); border-radius: 28px; padding: 10px 26px 12px; margin-bottom: 13px; line-height: 1.15; cursor: pointer; white-space: pre;
  display: flex; align-items: center; justify-content: center; gap: 0.35em; outline: none; -webkit-tap-highlight-color: transparent;
  -webkit-text-stroke: var(--ts) var(--edge); paint-order: stroke fill; text-shadow: 0 3px 0 var(--edge);
  box-shadow: inset 0 -6px 0 rgba(0,0,0,0.13), 0 8px 0 0 var(--lip), 0 8px 0 5px var(--edge), 0 16px 16px 4px rgba(0,0,0,0.32);
  transition: transform 70ms ease-out, box-shadow 70ms ease-out, filter 120ms; }
.btn::before { content: ""; position: absolute; z-index: -1; left: 12px; right: 12px; top: 5px; height: 40%; border-radius: 22px 22px 40px 40px / 22px 22px 18px 18px;
  background: linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.08)); pointer-events: none; }
.btn:hover { filter: brightness(1.07); }
.btn:active { transform: translateY(7px); box-shadow: inset 0 -4px 0 rgba(0,0,0,0.13), 0 2px 0 0 var(--lip), 0 2px 0 5px var(--edge), 0 6px 8px 2px rgba(0,0,0,0.3); }
.btn:disabled { filter: grayscale(0.92) brightness(0.92); cursor: default; }
.btn:disabled:active { transform: none; }
.btn .ic { flex: 0 0 auto; width: 1.2em; height: 1.2em; display: flex; }
.btn .ic svg, .ic svg { width: 100%; height: 100%; display: block; overflow: visible; }
.btn.lively { animation: ui-breathe 1.6s ease-in-out infinite; }
.btn.lively:active { animation: none; }
.btn.lively::after { content: ""; position: absolute; z-index: -1; top: -10%; bottom: -10%; width: 18%; left: -45%; transform: skewX(-20deg);
  background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.55), rgba(255,255,255,0)); animation: ui-shine 3.2s ease-in-out infinite; pointer-events: none; }

.panel { pointer-events: auto; position: relative; display: flex; flex-direction: column; box-sizing: border-box; border: 6px solid ${INK_CSS};
  box-shadow: inset 0 0 0 4px rgba(255,255,255,0.75), inset 0 -10px 0 rgba(150,95,40,0.10), 0 10px 0 0 #2a160b, 0 26px 44px 6px rgba(0,0,0,0.5); }
.panel.pop { animation: ui-pop 0.32s cubic-bezier(.2,.9,.3,1.2) both; }
.ribbon { position: relative; align-self: center; margin-top: calc(-1 * var(--pad, 40px) - var(--rh) * 0.62); margin-bottom: calc(var(--rh) * 0.2 + 12px); z-index: 2; pointer-events: none; }
.ribbon::before, .ribbon::after { content: ""; position: absolute; bottom: calc(var(--rh) * -0.2); width: calc(var(--rh) * 0.8); height: calc(var(--rh) * 0.72); background: var(--rd); border: 5px solid var(--re); z-index: 0; box-sizing: border-box; }
.ribbon::before { left: calc(var(--rh) * -0.5); clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 34% 50%); }
.ribbon::after { right: calc(var(--rh) * -0.5); clip-path: polygon(0 0, 100% 0, 66% 50%, 100% 100%, 0 100%); }
.rb-body { position: relative; z-index: 1; min-height: var(--rh); box-sizing: border-box; display: flex; align-items: center; justify-content: center; padding: 0 1.3em 0.08em; color: #fff; white-space: pre;
  background: linear-gradient(180deg, var(--rt), var(--rb) 60%, var(--rd)); border: 5px solid var(--re); border-radius: 14px; paint-order: stroke fill;
  box-shadow: inset 0 4px 0 rgba(255,255,255,0.35), 0 6px 0 var(--re); text-shadow: 0 4px 0 var(--re); }

.chip { box-sizing: border-box; color: #fff4dc; background: linear-gradient(180deg, #5a3a26 0%, #3a2416 55%, #2c1a10 100%); border: 4px solid #1a0e07;
  box-shadow: inset 0 3px 0 rgba(255,214,160,0.28), inset 0 -4px 0 rgba(0,0,0,0.25), 0 5px 0 rgba(10,5,2,0.55), 0 10px 14px rgba(0,0,0,0.35); }
.gauge { box-sizing: border-box; background: #1a0e07; border-radius: 999px; padding: 3px; box-shadow: inset 0 3px 0 rgba(0,0,0,0.55), 0 0 0 2px rgba(255,214,160,0.25); }
.g-fill { --gc: #ffc531; height: 100%; width: 0; border-radius: 999px; transition: width 0.25s ease-out;
  background: linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.1) 45%, rgba(0,0,0,0.12) 100%), var(--gc); }
.ic { display: flex; pointer-events: none; }
.pips { display: flex; gap: 8px; justify-content: center; }
.pip { box-sizing: border-box; border-radius: 50%; background: #d8ccbb; border: 3px solid #6d5a48; box-shadow: inset 0 3px 0 rgba(0,0,0,0.15); }
.pip.on { background: radial-gradient(circle at 35% 30%, #fff3a0, #ffc531 55%, #e8900e); border-color: #6b3a0c; box-shadow: 0 0 10px rgba(255,190,40,0.6); }
.field { pointer-events: auto; box-sizing: border-box; width: 100%; font-family: inherit; font-size: 44px; color: ${INK_CSS}; background: #fffaf0;
  border: 5px solid ${INK_CSS}; border-radius: 24px; padding: 14px 28px 16px; outline: none; user-select: text; -webkit-user-select: text;
  box-shadow: inset 0 6px 0 rgba(120,70,20,0.12); transition: box-shadow 120ms, border-color 120ms; }
.field:focus { border-color: #c2461a; box-shadow: inset 0 6px 0 rgba(120,70,20,0.12), 0 0 0 6px rgba(238,94,43,0.28); }
.field::placeholder { color: rgba(130,105,80,0.55); }
.inset { box-sizing: border-box; background: rgba(120,70,30,0.09); border: 3px solid rgba(80,45,20,0.18); border-radius: 22px; }

.logo { position: relative; white-space: pre; line-height: 1.15; pointer-events: none; filter: drop-shadow(0 10px 14px rgba(0,0,0,0.55)); }
.logo-back { color: #6a1a0c; -webkit-text-stroke: var(--lw) #3a0c05; paint-order: stroke fill; text-shadow: 0 var(--ld) 0 #3a0c05, 0 calc(var(--ld) + 2px) 0 #3a0c05; }
.logo-front { position: absolute; inset: 0; color: transparent; background: linear-gradient(180deg, #fffdf0 0%, #fff0a8 38%, #ffc53d 72%, #ff9a2a 100%); -webkit-background-clip: text; background-clip: text; }
.title-sub { -webkit-text-stroke: 9px #2a1208; paint-order: stroke fill; text-shadow: 0 4px 0 #2a1208; letter-spacing: 0.08em; margin-top: -4px; }
.up-icon { align-self: center; width: 132px; height: 132px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-sizing: border-box;
  background: radial-gradient(circle at 40% 32%, #fff8e6, #f3d9a8 70%, #e2bd7e); border: 5px solid ${INK_CSS}; box-shadow: inset 0 -6px 0 rgba(120,70,20,0.18), 0 6px 0 rgba(40,20,8,0.35); margin-top: 4px; }
.tag { align-self: center; box-sizing: border-box; padding: 4px 22px 7px; border: 4px solid; border-radius: 999px; color: #fff; white-space: pre-line; text-align: center; line-height: 1.2; paint-order: stroke fill; box-shadow: inset 0 3px 0 rgba(255,255,255,0.35), 0 4px 0 rgba(40,20,8,0.3); }
.dots { min-width: 20px; height: 0; border-bottom: 4px dotted rgba(59,36,21,0.32); transform: translateY(-8px); }
.panel .lbl { text-shadow: none; }
.box { box-sizing: border-box; }
.vbox { display: flex; flex-direction: column; align-items: stretch; min-width: 0; }
.hbox { display: flex; flex-direction: row; align-items: stretch; min-width: 0; }
.spacer { pointer-events: none; }
.divider { min-height: 4px; height: 4px; background: repeating-linear-gradient(90deg, var(--dc) 0 14px, transparent 14px 24px); border-radius: 2px; }
.margin { position: absolute; inset: 0; box-sizing: border-box; display: flex; flex-direction: column; pointer-events: none; }
.margin > * { flex: 1 1 auto; min-height: 0; }
.overlay { position: absolute; inset: 0; pointer-events: auto; animation: ui-fade 0.18s ease-out both; }
.center { display: flex; align-items: center; justify-content: center; pointer-events: none; }
.center > * { pointer-events: auto; }
/* 움직임 줄이기 설정을 켠 사람(과 캡처·테스트 도구)에게는 숨쉬기·튀어나오기 움직임을 끈다 */
@media (prefers-reduced-motion: reduce) { .btn.lively, .btn.lively::after, .panel.pop, .overlay { animation: none; } .btn.lively::after { display: none; } }
`;
