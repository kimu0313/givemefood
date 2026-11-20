// 미식가 스테이지 시작 전 만화 (2026-11-20 사용자 "첫 번째 가게 미식가 스테이지 누르면 플레이 전에 이 만화 일러스트가 나오게.
// 한 컷 한 컷 순서대로, 약간 웅성거리는 소리랑 긴장되는 소리 넣으면서"):
// 지도의 미식가 팝업에서 "도전하기" → 이 장면 → 영업(shift). 만화 한 쪽을 원래 칸 배치 그대로 어두운 바탕 위에 두고,
// 칸이 하나씩 톡 나타나며(쿵 소리) 앞 칸은 살짝 어두워짐. 자동으로 넘어가고, 누르면 바로 다음 칸. 다 나오면 "도전 시작!".
// 오른쪽 위 "건너뛰기"는 언제든. 소리 = Sound.startComicAmbience (웅성거림 + 낮은 웅 + 떨림음 + 심장 박동), 칸마다 Sound.comicHit.
// 칸 그림: node tools/comic_panels.mjs art_src/comic_event_<가게>.png public/assets/art/comic/<가게> → <가게>_<n>.webp + 칸 자리

import { rgb } from "../engine/geom.ts";
import { Scene } from "../engine/game.ts";
import { Sound } from "../engine/audio.ts";
import * as Ui from "../engine/ui.ts";
import { GameState } from "../state/game_state.ts";
import { ROOT } from "../art/art_assets.ts";

type Rect4 = [number, number, number, number];

/** 가게(미식가 스테이지)마다 만화: 원본 쪽 크기 + 칸 자리(원본 px, 읽는 순서) + 세게 칠 칸(클로즈업) */
export const COMICS: Record<string, { page: [number, number]; panels: Rect4[]; strong: number[] }> = {
  // 골목 포장마차 · 강 평론가 (art_src/comic_event_pocha.png)
  pocha: {
    page: [1536, 1024],
    panels: [[9, 10, 633, 508], [641, 10, 1099, 508], [1107, 10, 1528, 508], [9, 517, 446, 1014], [453, 517, 1045, 1014], [1055, 517, 1528, 1014]],
    strong: [2, 5], // 3번째(얼굴), 6번째(포장마차를 노려봄)
  },
  // 동네 분식집 · 서 평론가 (art_src/comic_event_bunsik.png, 2026-11-20 사용자 "두 번째 가게 미식가 스테이지도 첫 번째랑 비슷하게")
  bunsik: {
    page: [1536, 1024],
    panels: [[8, 7, 507, 508], [513, 7, 1017, 508], [1018, 7, 1527, 508], [8, 515, 486, 1016], [492, 515, 980, 1016], [987, 515, 1527, 1016]],
    strong: [3, 4], // 4번째(놀란 얼굴), 5번째(끓는 라면)
  },
};

export function comicFor(shopId: string): boolean {
  return COMICS[shopId] !== undefined;
}

export function comicFiles(shopId: string): string[] {
  const c = COMICS[shopId];
  return c ? c.panels.map((_, i) => `${ROOT}/comic/${shopId}_${i + 1}.webp`) : [];
}

const PANEL_TIME = 2.6; // 한 컷이 혼자 보이는 시간 (초), 누르면 바로 다음
const CSS = `
.cm { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; pointer-events: auto; cursor: pointer;
  background: radial-gradient(ellipse at 50% 45%, #2a1d16 0%, #120b08 70%, #070403 100%); }
.cm-page { position: absolute; }
.cm-panel { position: absolute; opacity: 0; transform: scale(1.08) translateY(18px); transform-origin: 50% 50%;
  transition: opacity 0.45s ease-out, transform 0.55s cubic-bezier(.2,.9,.3,1.15), filter 0.6s; filter: drop-shadow(0 14px 22px rgba(0,0,0,0.6)); }
.cm-panel.on { opacity: 1; transform: none; }
.cm-panel.past { filter: brightness(0.5) saturate(0.7) drop-shadow(0 10px 16px rgba(0,0,0,0.5)); }
.cm-panel.on.flash { animation: cm-flash 0.5s ease-out; }
.cm-skip { position: absolute; right: 26px; top: 20px; z-index: 3; }
.cm-go { position: absolute; left: 0; right: 0; bottom: 26px; display: flex; justify-content: center; z-index: 3; opacity: 0; transition: opacity 0.4s; pointer-events: none; }
.cm-go.on { opacity: 1; pointer-events: auto; }
.cm-hint { position: absolute; left: 0; right: 0; bottom: 12px; text-align: center; color: rgba(255,240,220,0.55); font-size: 24px; pointer-events: none; }
@keyframes cm-flash { 0% { filter: brightness(2.2) drop-shadow(0 14px 22px rgba(0,0,0,0.6)); } 100% { filter: brightness(1) drop-shadow(0 14px 22px rgba(0,0,0,0.6)); } }
@media (prefers-reduced-motion: reduce) { .cm-panel { transition: opacity 0.2s; transform: none; } .cm-panel.on.flash { animation: none; } }
`;
let cssAdded = false;
function addCss(): void {
  if (cssAdded || typeof document === "undefined") return;
  cssAdded = true;
  const s = document.createElement("style");
  s.textContent = CSS;
  document.head.appendChild(s);
}

export class ComicScene extends Scene {
  private shopId = "";
  private panels: HTMLImageElement[] = [];
  private shown = 0; // 나온 칸 수
  private t = 0.0; // 마지막 칸이 나온 뒤 지난 시간
  private goBtn!: HTMLElement;
  private hint!: HTMLElement;
  private done = false;

  ready(): void {
    addCss();
    this.clearColor = rgb(0.03, 0.02, 0.01);
    this.shopId = GameState.eventShop;
    const def = COMICS[this.shopId];
    if (def === undefined) {
      this.finish();
      return;
    }
    const root = Ui.div("cm");
    this.ui.appendChild(root);
    // 쪽을 화면 안에 (위아래 여백 조금)
    const [pw, ph] = def.page;
    const k = Math.min(1840 / pw, 1000 / ph);
    const page = Ui.div("cm-page");
    Object.assign(page.style, { left: `${(1920 - pw * k) / 2}px`, top: `${(1080 - ph * k) / 2 - 10}px`, width: `${pw * k}px`, height: `${ph * k}px` });
    root.appendChild(page);
    const files = comicFiles(this.shopId);
    def.panels.forEach(([x0, y0, x1, y1], i) => {
      const im = document.createElement("img");
      im.className = "cm-panel";
      im.src = files[i];
      im.alt = "";
      Object.assign(im.style, { left: `${x0 * k}px`, top: `${y0 * k}px`, width: `${(x1 - x0) * k}px`, height: `${(y1 - y0) * k}px` });
      page.appendChild(im);
      this.panels.push(im);
    });
    const skip = Ui.button("건너뛰기", Ui.SECONDARY, 30, 80);
    skip.style.minWidth = "200px";
    Ui.onPress(skip, () => this.finish());
    const skipBox = Ui.div("cm-skip");
    skipBox.appendChild(skip);
    root.appendChild(skipBox);
    const go = Ui.button("", Ui.EVENT, 42, 110);
    Ui.withIcon(go, Ui.ICON.play, "계속하기"); // 다음 화면(영업 안내)에 "도전 시작!" 이 또 있어서 다른 말로
    Ui.lively(go);
    go.style.minWidth = "420px";
    Ui.onPress(go, () => this.finish());
    const goBox = Ui.div("cm-go");
    goBox.appendChild(go);
    root.appendChild(goBox);
    this.goBtn = goBox;
    this.hint = Ui.div("cm-hint");
    this.hint.textContent = "화면을 누르면 다음 컷";
    root.appendChild(this.hint);
    root.addEventListener("click", () => this.next());
    Sound.playBgm("comic"); // 곡 없음 = 배경 음악 멈춤
    Sound.startComicAmbience();
    this.t = PANEL_TIME - 0.5; // 첫 컷은 0.5초 뒤
  }

  process(dt: number): void {
    if (this.done || this.panels.length === 0) return;
    this.t += dt;
    if (this.shown < this.panels.length && this.t >= PANEL_TIME) this.next();
  }

  /** 다음 컷 (다 나왔으면 아무것도 안 함 — "도전 시작!"을 눌러야 시작) */
  private next(): void {
    if (this.done || this.shown >= this.panels.length) return;
    const i = this.shown;
    this.panels.forEach((p, j) => p.classList.toggle("past", j < i));
    const p = this.panels[i];
    p.classList.add("on", "flash");
    this.shown += 1;
    this.t = 0.0;
    Sound.comicHit((COMICS[this.shopId]?.strong ?? []).includes(i));
    if (this.shown >= this.panels.length) {
      // 다 나오면 모든 칸을 다시 밝게 → "도전 시작!"
      setTimeout(() => {
        if (this.done) return;
        this.panels.forEach((q) => q.classList.remove("past"));
        this.goBtn.classList.add("on");
        this.hint.textContent = "";
      }, 1400);
    }
  }

  onBack(): void {
    this.finish();
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    Sound.stopComicAmbience();
    // 만화 다음엔 미식가 안내 창 없이 바로 가게로 — 미식가가 곧장 들어옴 (2026-11-21 사용자)
    GameState.eventFromComic = true;
    this.game.goto("shift");
  }

  dispose(): void {
    Sound.stopComicAmbience();
  }
}
