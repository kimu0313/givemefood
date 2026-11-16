// 단골 도감 · 기록 창: 단골 얼굴 카드 + 가게 별점 + 무한 영업 최고 기록 + 기록 초기화.
// 게임 안(스테이지 지도 위쪽 '단골 도감' 버튼)에서 연다 (2026-11-16 사용자 "단골기록 볼 수 있는 ui는 게임 내부에").

import * as Ui from "../engine/ui.ts";
import * as D from "../core/defs.ts";
import { GameState } from "../state/game_state.ts";
import { regularPortrait } from "./portrait.ts";

export interface CollectionHandlers {
  onClose: () => void;
  onReset: () => void; // 기록을 지운 뒤 (화면을 새로 그리러 감)
}

/** host 위에 도감 창을 띄우고 덮개(overlay)를 돌려준다 (닫을 때는 onClose 에서 지운다) */
export function openCollection(host: HTMLElement, h: CollectionHandlers): HTMLDivElement {
  const ov = Ui.overlay(host);
  ov.classList.add("center");
  const p = Ui.popPanel(Ui.PAPER, 40, 32);
  p.style.width = "1700px";
  p.style.marginTop = "40px";
  ov.appendChild(p);
  p.appendChild(Ui.ribbon("단골 도감", Ui.ACCENT, 46));
  const col = Ui.vbox(12);
  col.style.flex = "1 1 auto";
  p.appendChild(col);
  const who = GameState.account !== "" ? `${GameState.account}님의 기록 · ` : "";
  col.appendChild(Ui.label(`${who}단골 손님에게 서빙을 마치면 기록돼요. 단골은 가게를 옮겨도 찾아와요.`, 27, Ui.MUTED));
  const grid = Ui.div();
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(3, 1fr)";
  grid.style.gap = "16px";
  col.appendChild(grid);
  for (const r of D.REGULARS) {
    const visits = GameState.regulars[r.id] ?? 0;
    const card = Ui.inset(14);
    card.classList.add("hbox");
    card.style.gap = "16px";
    card.style.alignItems = "center";
    card.style.minHeight = "150px";
    if (visits > 0) card.style.background = "rgba(255,200,90,0.16)";
    // 얼굴 사진 (못 만난 단골은 그림자 + ?)
    const face = regularPortrait(r.id, 128, visits > 0);
    face.el.style.flex = "0 0 auto";
    card.appendChild(face.el);
    const vb = Ui.vbox(4);
    vb.style.flex = "1 1 auto";
    card.appendChild(vb);
    if (visits <= 0) {
      vb.appendChild(Ui.heading("???", 34, Ui.MUTED, null, "left"));
      vb.appendChild(Ui.label("아직 만나지 못한 단골", 26, Ui.MUTED, "left"));
    } else {
      const head = Ui.hbox(10);
      head.style.alignItems = "baseline";
      const nm = Ui.heading(r.name, 32, Ui.INK, null, "left");
      nm.style.flex = "1 1 auto";
      head.append(nm, Ui.label(`방문 ${visits}번`, 28, Ui.ACCENT, "right"));
      vb.appendChild(head);
      const shown = r.lines.slice(0, Math.min(visits, r.lines.length)).map((l) => `"${l}"`);
      vb.appendChild(Ui.label(shown.join("  "), 26, Ui.INK, "left", true));
    }
    grid.appendChild(card);
  }

  col.appendChild(Ui.divider());
  const starsText: string[] = [];
  const bestText: string[] = [];
  for (const shop of D.SHOPS) {
    if (!GameState.shopOpened(shop.id)) continue;
    starsText.push(`${shop.name} ★${GameState.shopRating(shop.id).toFixed(1)}`);
    if (GameState.shopCleared(shop.id)) bestText.push(`${shop.name} ${D.formatWon(GameState.bestEndlessFor(shop.id))}`);
  }
  col.appendChild(Ui.label("가게 별점 (5점 만점)  " + starsText.join(" · "), 26, Ui.INK, "center", true));
  col.appendChild(Ui.label("무한 영업 최고  " + (bestText.length > 0 ? bestText.join(" · ") : "아직 없음"), 26, Ui.INK, "center", true));
  // 미식가 황 선생의 평가 (가게 사이 이벤트, 한 번씩)
  const evText: string[] = [];
  for (const e of D.EVENTS) {
    if (!GameState.eventPlayed(e.shop)) continue;
    const gr = GameState.eventGrade(e.shop);
    evText.push(`${D.shopDef(e.shop).name} ${"★".repeat(gr)}${"☆".repeat(D.MAX_STARS - gr)}`);
  }
  col.appendChild(Ui.label("미식가 평가  " + (evText.length > 0 ? evText.join(" · ") : "아직 없음"), 26, Ui.EVENT, "center", true));
  col.appendChild(Ui.spacer(8));

  const buttons = Ui.hbox(20);
  col.appendChild(buttons);
  const reset = Ui.button("기록 초기화", Ui.SECONDARY, 30, 96);
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
  const close = Ui.button("닫기", Ui.ACCENT, 38, 96);
  close.style.flex = "1 1 auto";
  Ui.onPress(close, () => h.onClose());
  buttons.appendChild(close);
  return ov;
}
