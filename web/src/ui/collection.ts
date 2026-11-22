// 단골 도감 · 기록 창: 단골 카드 + 가게 기록(평점 · 무한 영업 최고 · 미식가 평가) + 기록 초기화.
// 게임 안(스테이지 지도 위쪽 '단골 도감' 버튼)에서 연다 (2026-11-16 사용자 "단골기록 볼 수 있는 ui는 게임 내부에").
// 2026-11-22 사용자 "단골도감 UI 형태 바꾸고 싶어, 가로로 길게 있었으면, 넘겨서 볼 수 있게":
//   단골마다 세로로 긴 카드(위: 가게 색 바탕 + 상반신 그림, 아래: 이름 · 가게 · 방문 수 · 들은 말 3칸)를 가로 한 줄로 늘어놓고,
//   마지막에 넓은 '가게 기록' 카드. 한 화면에 카드 4장, 양옆 화살표 · 손가락/마우스 끌기 · 휠 · ←→ 키로 넘기고 아래 점으로 쪽 표시.

import * as Ui from "../engine/ui.ts";
import { game } from "../engine/game.ts";
import { Sound } from "../engine/audio.ts";
import * as D from "../core/defs.ts";
import { GameState } from "../state/game_state.ts";
import { regularBust } from "./portrait.ts";

export interface CollectionHandlers {
  onClose: () => void;
  onReset: () => void; // 기록을 지운 뒤 (화면을 새로 그리러 감)
}

const VIEW_W = 1640; // 카드가 보이는 창 폭
const VIEW_H = 590;
const CARD_W = 380;
const WIDE_W = 784; // 가게 기록 카드 (카드 2장 + 사이)
const GAP = 24;
const PER_PAGE = 4;

const COLL_CSS = `
.coll-wrap { position: relative; width: ${VIEW_W}px; align-self: center; }
.coll-view { position: relative; width: ${VIEW_W}px; height: ${VIEW_H + 14}px; overflow: hidden; touch-action: none; cursor: grab; }
.coll-view.drag { cursor: grabbing; }
.coll-track { position: absolute; left: 0; top: 0; height: ${VIEW_H}px; display: flex; gap: ${GAP}px; transition: transform 0.38s cubic-bezier(.2,.85,.25,1); will-change: transform; }
.coll-track.drag { transition: none; }
.coll-card { flex: 0 0 ${CARD_W}px; height: 100%; box-sizing: border-box; border-radius: 26px; border: 5px solid #3b2415; background: #fff7e6;
  box-shadow: 0 8px 0 rgba(59,36,21,0.32); display: flex; flex-direction: column; overflow: hidden; position: relative; user-select: none; }
.coll-card.wide { flex-basis: ${WIDE_W}px; }
.coll-card .top { flex: 0 0 300px; position: relative; border-bottom: 5px solid #3b2415; overflow: hidden; }
.coll-card .top::after { content: ""; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(135deg, rgba(255,255,255,0.10) 0 14px, rgba(255,255,255,0) 14px 28px); }
.coll-card .top canvas { position: absolute; left: 0; bottom: 0; z-index: 1; }
.coll-card .no { position: absolute; left: 12px; top: 10px; z-index: 2; background: #3b2415; color: #fff3da; border-radius: 14px; padding: 2px 14px 4px;
  font-size: 26px; }
.coll-card .visits { position: absolute; right: 12px; top: 10px; z-index: 2; background: #fff3da; color: #c8461c; border: 4px solid #3b2415; border-radius: 16px;
  padding: 0 14px 2px; font-size: 26px; }
.coll-card .body { flex: 1 1 auto; display: flex; flex-direction: column; gap: 8px; padding: 12px 16px 14px; }
.coll-card .shopTag { display: flex; align-items: center; gap: 8px; justify-content: center; }
.coll-card .shopTag i { width: 18px; height: 18px; border-radius: 50%; border: 3px solid #3b2415; flex: 0 0 auto; }
.coll-line { box-sizing: border-box; border-radius: 14px; border: 3px solid #3b2415; background: #fff; padding: 4px 12px 6px; font-size: 23px; line-height: 1.2;
  color: #3b2415; text-align: center; }
.coll-line:not(.locked)::before { content: '"'; }
.coll-line:not(.locked)::after { content: '"'; }
.coll-line.locked { border-style: dashed; border-color: #b9a58f; background: rgba(185,165,143,0.14); color: #9a8672; display: flex; align-items: center; justify-content: center; gap: 6px; }
.coll-line.locked .ic { width: 24px; height: 24px; opacity: 0.6; }
.coll-rec { display: grid; grid-template-columns: 1.7fr 1fr 1.25fr 1.25fr; align-items: center; column-gap: 10px; padding: 0 22px; }
.coll-rec.head { color: #8a7562; font-size: 23px; padding-top: 4px; }
.coll-rec.row { min-height: 74px; border-top: 3px dashed rgba(59,36,21,0.22); font-size: 27px; color: #3b2415; }
.coll-rec.row.off { color: #ab9a88; }
.coll-rec .nm { display: flex; align-items: center; gap: 10px; }
.coll-rec .num { width: 42px; height: 42px; border-radius: 50%; border: 4px solid #3b2415; color: #fff; display: flex; align-items: center; justify-content: center;
  font-size: 24px; flex: 0 0 auto; text-shadow: 0 2px 0 rgba(0,0,0,0.35); }
.coll-rec .c { text-align: center; }
.coll-rec .span { grid-column: span 3; }
.coll-rec .gold { color: #d98a00; }
.coll-rec .ev { color: #8e4cd1; letter-spacing: 1px; }
.coll-arrow { position: absolute; top: ${VIEW_H / 2 - 50}px; width: 100px; height: 100px; border-radius: 50%; border: 6px solid #3b2415; background: #fff3da;
  box-shadow: 0 7px 0 #3b2415; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 3; padding: 0;
  transition: transform 0.08s, opacity 0.15s; }
.coll-arrow:active:not(:disabled) { transform: translateY(5px); box-shadow: 0 2px 0 #3b2415; }
.coll-arrow:disabled { opacity: 0.3; cursor: default; }
.coll-arrow.prev { left: -78px; }
.coll-arrow.next { right: -78px; }
.coll-arrow.next .ic { transform: scaleX(-1); }
.coll-dots { display: flex; gap: 14px; justify-content: center; align-items: center; }
.coll-dot { width: 18px; height: 18px; border-radius: 50%; border: 4px solid #3b2415; background: #e4d6c4; cursor: pointer; transition: all 0.2s; }
.coll-dot.on { width: 44px; border-radius: 12px; background: #ee5e2b; }
`;
let cssAdded = false;

/** 도감 창마다 ←→ 키 처리 (지도 장면이 키를 넘겨줌) */
const KEY_HANDLERS = new WeakMap<HTMLElement, (key: string) => void>();
export function collectionKey(ov: HTMLElement, key: string): void {
  KEY_HANDLERS.get(ov)?.(key);
}

/** host 위에 도감 창을 띄우고 덮개(overlay)를 돌려준다 (닫을 때는 onClose 에서 지운다) */
export function openCollection(host: HTMLElement, h: CollectionHandlers): HTMLDivElement {
  if (!cssAdded) {
    cssAdded = true;
    const st = document.createElement("style");
    st.textContent = COLL_CSS;
    document.head.appendChild(st);
  }
  const ov = Ui.overlay(host);
  ov.classList.add("center");
  const p = Ui.popPanel(Ui.PAPER, 40, 30);
  p.style.width = "1740px";
  p.style.marginTop = "34px";
  p.style.overflow = "visible";
  ov.appendChild(p);
  p.appendChild(Ui.ribbon("단골 도감", Ui.ACCENT, 46));
  const col = Ui.vbox(12);
  col.style.flex = "1 1 auto";
  p.appendChild(col);
  const met = D.REGULARS.filter((r) => (GameState.regulars[r.id] ?? 0) > 0).length;
  const who = GameState.account !== "" ? `${GameState.account}님의 기록 · ` : "";
  col.appendChild(Ui.label(`${who}만난 단골 ${met} / ${D.REGULARS.length}명 · 단골 손님에게 서빙을 마치면 기록돼요. 단골은 가게를 옮겨도 찾아와요.`, 26, Ui.MUTED));

  // ---- 카드 줄
  const wrap = Ui.div("coll-wrap");
  col.appendChild(wrap);
  const view = Ui.div("coll-view");
  wrap.appendChild(view);
  const track = Ui.div("coll-track");
  view.appendChild(track);
  D.REGULARS.forEach((r, i) => track.appendChild(regularCard(r, i)));
  track.appendChild(recordCard());

  // 카드 왼쪽 끝 자리 (고정 폭이라 계산으로)
  const widths = [...D.REGULARS.map(() => CARD_W), WIDE_W];
  const lefts: number[] = [];
  let x = 0;
  for (const w of widths) {
    lefts.push(x);
    x += w + GAP;
  }
  const total = x - GAP;
  const maxOff = Math.max(0, total - VIEW_W);
  const stops = [...new Set(lefts.map((l) => Math.min(l, maxOff)))];
  const pages: number[] = [];
  for (let i = 0; i < lefts.length; i += PER_PAGE) pages.push(Math.min(lefts[i], maxOff));
  const pageStarts = [...new Set(pages)];

  let off = 0;
  const prev = document.createElement("button");
  prev.className = "coll-arrow prev";
  prev.setAttribute("aria-label", "이전");
  const next = document.createElement("button");
  next.className = "coll-arrow next";
  next.setAttribute("aria-label", "다음");
  for (const b of [prev, next]) {
    const ic = Ui.icon(Ui.ICON.back, 54);
    ic.classList.add("ic");
    b.appendChild(ic);
    wrap.appendChild(b);
  }
  const dots = Ui.div("coll-dots");
  col.appendChild(dots);
  const dotEls = pageStarts.map((ps) => {
    const d = Ui.div("coll-dot");
    d.addEventListener("click", () => goTo(ps));
    dots.appendChild(d);
    return d;
  });

  const apply = (): void => {
    track.style.transform = `translateX(${-off}px)`;
    prev.disabled = off <= 1;
    next.disabled = off >= maxOff - 1;
    let page = 0;
    pageStarts.forEach((ps, i) => {
      if (off >= ps - 40) page = i;
    });
    dotEls.forEach((d, i) => d.classList.toggle("on", i === page));
  };
  const goTo = (target: number): void => {
    const t = Math.max(0, Math.min(maxOff, target));
    if (Math.abs(t - off) > 1) Sound.playSfx("click");
    off = t;
    apply();
  };
  const flip = (dir: number): void => {
    if (dir > 0) goTo(pageStarts.find((ps) => ps > off + 1) ?? maxOff);
    else goTo([...pageStarts].reverse().find((ps) => ps < off - 1) ?? 0);
  };
  prev.addEventListener("click", () => flip(-1));
  next.addEventListener("click", () => flip(1));
  KEY_HANDLERS.set(ov, (key) => {
    if (key === "ArrowLeft") flip(-1);
    else if (key === "ArrowRight") flip(1);
  });

  // 끌어서 넘기기 (회전된 모바일 화면도 game.toDesign 으로 설계 좌표로 바꿔서 잼)
  let dragId = -1;
  let startX = 0;
  let startOff = 0;
  let lastX = 0;
  let lastT = 0;
  let vel = 0;
  const designX = (e: PointerEvent): number => (game !== null ? game.toDesign(e.clientX, e.clientY).x : e.clientX);
  view.addEventListener("pointerdown", (e) => {
    dragId = e.pointerId;
    view.setPointerCapture(e.pointerId);
    startX = lastX = designX(e);
    startOff = off;
    lastT = performance.now();
    vel = 0;
    track.classList.add("drag");
    view.classList.add("drag");
  });
  view.addEventListener("pointermove", (e) => {
    if (e.pointerId !== dragId) return;
    const x = designX(e);
    const now = performance.now();
    const dt = Math.max(1, now - lastT) / 1000;
    vel = vel * 0.4 + ((x - lastX) / dt) * 0.6;
    lastX = x;
    lastT = now;
    let o = startOff - (x - startX);
    if (o < 0) o *= 0.35; // 끝에서 살짝 늘어남
    else if (o > maxOff) o = maxOff + (o - maxOff) * 0.35;
    off = o;
    track.style.transform = `translateX(${-off}px)`;
  });
  const release = (e: PointerEvent): void => {
    if (e.pointerId !== dragId) return;
    dragId = -1;
    track.classList.remove("drag");
    view.classList.remove("drag");
    if (performance.now() - lastT > 90) vel = 0;
    const aim = off - vel * 0.22; // 밀던 속도만큼 더 감
    let best = stops[0];
    for (const s of stops) if (Math.abs(s - aim) < Math.abs(best - aim)) best = s;
    const moved = Math.abs(off - startOff);
    off = Math.max(0, Math.min(maxOff, off));
    goTo(moved < 6 ? startOff : best);
  };
  view.addEventListener("pointerup", release);
  view.addEventListener("pointercancel", release);
  // 휠 = 한 쪽씩 (연달아 굴려도 0.35초에 한 번)
  let wheelAt = 0;
  view.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const now = performance.now();
      if (Math.abs(d) < 4 || now - wheelAt < 350) return;
      wheelAt = now;
      flip(d > 0 ? 1 : -1);
    },
    { passive: false },
  );
  apply();

  // ---- 버튼
  const buttons = Ui.hbox(20);
  col.appendChild(buttons);
  const reset = Ui.button("기록 초기화", Ui.SECONDARY, 30, 88);
  reset.style.minWidth = "640px";
  let armed = false;
  Ui.onPress(reset, () => {
    if (!armed) {
      armed = true;
      reset.textContent = "한 번 더 누르면 모든 기록이 지워져요";
      return;
    }
    GameState.resetGame();
    h.onReset();
  });
  buttons.appendChild(reset);
  const close = Ui.button("닫기", Ui.ACCENT, 38, 88);
  close.style.flex = "1 1 auto";
  Ui.onPress(close, () => h.onClose());
  buttons.appendChild(close);
  return ov;
}

/** 단골 한 명 카드 */
function regularCard(r: D.RegularDef, index: number): HTMLDivElement {
  const visits = GameState.regulars[r.id] ?? 0;
  const metIt = visits > 0;
  const shop = D.shopDef(r.shop);
  const card = Ui.div("coll-card");
  const top = Ui.div("top");
  const c = shop.color;
  top.style.background = metIt
    ? `linear-gradient(180deg, ${c.lerp(Ui.CREAM, 0.55).css()} 0%, ${c.lerp(Ui.CREAM, 0.15).css()} 100%)`
    : "linear-gradient(180deg, #cfc4b6 0%, #a89a8a 100%)";
  card.appendChild(top);
  const no = Ui.div("no disp");
  no.textContent = `No.${index + 1}`;
  no.setAttribute("data-notr", "");
  top.appendChild(no);
  if (metIt) {
    const vs = Ui.div("visits disp");
    vs.textContent = `방문 ${visits}번`;
    top.appendChild(vs);
  }
  top.appendChild(regularBust(r.id, CARD_W - 10, 300, metIt).el);

  const body = Ui.div("body");
  card.appendChild(body);
  const name = Ui.heading(metIt ? r.name : "???", 34, metIt ? Ui.INK : Ui.MUTED, null);
  name.style.whiteSpace = "nowrap";
  body.appendChild(name);
  fitWidth(name, 34, 20);
  const tag = Ui.div("shopTag");
  const dot = document.createElement("i");
  dot.style.background = shop.color.css();
  tag.appendChild(dot);
  tag.appendChild(Ui.label(metIt ? `${D.shopIndex(shop.id) + 1}번째 가게 · ${shop.name}` : `${D.shopIndex(shop.id) + 1}번째 가게 '${shop.name}'에서 만나요`, metIt ? 22 : 20, Ui.MUTED, "center", true));
  body.appendChild(tag);
  r.lines.forEach((line, i) => {
    const el = Ui.div(i < visits ? "coll-line" : "coll-line locked");
    if (i < visits) el.textContent = line; // 따옴표는 CSS 로 (번역 사전이 그대로 찾게)
    else {
      const ic = Ui.icon(Ui.ICON.lock, 24);
      ic.classList.add("ic");
      const t = document.createElement("span");
      t.textContent = `${i + 1}번째 방문에 들을 수 있어요`;
      el.append(ic, t);
    }
    body.appendChild(el);
  });
  return card;
}

/** 글자가 칸보다 길면 (번역된 이름 등) 들어갈 때까지 글자 크기를 줄인다 — 번역은 붙인 뒤에 바뀌므로 다음 그림 때 잼 */
function fitWidth(el: HTMLElement, size: number, min: number): void {
  const fit = (): void => {
    if (!el.isConnected) return;
    let s = size;
    el.style.fontSize = `${s}px`;
    while (el.scrollWidth > el.clientWidth + 1 && s > min) {
      s -= 2;
      el.style.fontSize = `${s}px`;
    }
  };
  requestAnimationFrame(() => requestAnimationFrame(fit));
}

/** 마지막 넓은 카드: 가게마다 평점 · 무한 영업 최고 · 미식가 평가 */
function recordCard(): HTMLDivElement {
  const card = Ui.div("coll-card wide");
  const head = Ui.div();
  head.style.cssText = "padding: 16px 0 8px; border-bottom: 5px solid #3b2415; background: linear-gradient(180deg, #ffe6b3, #ffd28a);";
  head.appendChild(Ui.heading("가게 기록", 44, Ui.CREAM, Ui.INK));
  card.appendChild(head);
  const hdr = Ui.div("coll-rec head");
  for (const [t, cls] of [["가게", ""], ["평점", "c"], ["무한 영업 최고", "c"], ["미식가 평가", "c"]]) {
    const s = document.createElement("span");
    s.textContent = t;
    if (cls) s.className = cls;
    hdr.appendChild(s);
  }
  card.appendChild(hdr);
  D.SHOPS.forEach((shop, i) => {
    const opened = GameState.shopOpened(shop.id);
    const row = Ui.div(opened ? "coll-rec row" : "coll-rec row off");
    const nm = Ui.div("nm");
    const num = Ui.div("num disp");
    num.textContent = String(i + 1);
    num.style.background = opened ? shop.color.css() : "#bdb0a2";
    const name = document.createElement("span");
    name.textContent = opened ? shop.name : "???";
    nm.append(num, name);
    row.appendChild(nm);
    const cell = (text: string, cls: string): void => {
      const s = document.createElement("span");
      s.className = `c ${cls}`;
      s.textContent = text;
      row.appendChild(s);
    };
    if (!opened) {
      cell("아직 안 열었어요", "span");
    } else {
      cell(`★ ${GameState.liveRating(shop.id).toFixed(1)}`, "gold");
      cell(GameState.shopCleared(shop.id) ? D.formatWon(GameState.bestEndlessFor(shop.id)) : "-", "");
      if (D.eventFor(shop.id) !== null && GameState.eventPlayed(shop.id)) {
        const gr = GameState.eventGrade(shop.id);
        cell(`${"★".repeat(gr)}${"☆".repeat(D.MAX_STARS - gr)}`, "ev");
      } else cell("아직 없음", "");
    }
    card.appendChild(row);
  });
  const foot = Ui.label("평점 = 손님 평가 (5점 만점) · 무한 영업은 그 가게 마지막 스테이지를 깬 뒤 열려요", 21, Ui.MUTED, "center", true);
  foot.style.padding = "10px 20px 0";
  card.appendChild(foot);
  return card;
}
