// 포장마차 타이쿤 — 시작점. 장면을 등록하고 타이틀부터 띄운다.
// 주소 뒤에 ?scene=map 처럼 붙이면 그 장면부터 (개발·캡처용), ?nosave=1 이면 저장을 건드리지 않는다.

import "@fontsource/jua/400.css";
import "@fontsource/bagel-fat-one/400.css";
import { Game } from "./engine/game.ts";
import { UI_CSS } from "./engine/ui.ts";
import { TUTORIAL_CSS } from "./ui/tutorial.ts";
import { MAP_CSS } from "./ui/stage_map.ts";
import { SupplyScene } from "./ui/supply.ts";
import { ComicScene } from "./ui/comic.ts";
import * as D from "./core/defs.ts";
import * as ArtAssets from "./art/art_assets.ts";
import * as FoodArt from "./art/food_art.ts";
import { GameState } from "./state/game_state.ts";
import { Sound } from "./engine/audio.ts";
import { TitleScene } from "./ui/title.ts";
import { StageMap } from "./ui/stage_map.ts";
import { StageOpenScene } from "./ui/stage_open.ts";
import { UpgradeScene } from "./ui/upgrade.ts";
import { SettlementScene } from "./ui/settlement.ts";
import { ShiftView } from "./shift/shift_view.ts";
import { getLang, langFonts, onLangChange, setLang, watchDom } from "./i18n/i18n.ts";

const style = document.createElement("style");
style.textContent = UI_CSS + TUTORIAL_CSS + MAP_CSS;
document.head.appendChild(style);

// 언어 (설정): 화면에 붙는 HTML 글자를 바로 번역하고, 일본어·중국어면 그 나라 글꼴을 주아 다음에 둔다.
// ?lang=en 처럼 붙이면 그 언어로 (캡처·확인용, 저장됨)
const applyLang = (): void => {
  document.documentElement.style.setProperty("--lang-fonts", langFonts());
  document.documentElement.lang = { ko: "ko", en: "en", ja: "ja", zh: "zh-CN" }[getLang()];
};
const langParam = new URLSearchParams(location.search).get("lang");
if (langParam === "ko" || langParam === "en" || langParam === "ja" || langParam === "zh") setLang(langParam);
applyLang();
onLangChange(applyLang);
watchDom(document.body);

const params = new URLSearchParams(location.search);
if (params.get("nosave") === "1") GameState.saveEnabled = false;
GameState.loadGame();
// 디버그: ?debug=clear → 모든 스테이지 깬 걸로, ?debug=events → 미식가 스테이지를 안 한 걸로 (쉼표로 같이: clear,events). 저장됨.
// 이 기기의 모든 저장 칸(게스트 + 모든 계정)에 적용 — 나중에 다른 아이디로 로그인해도 그대로. 다시 고침해도 또 적용되지 않게 주소에서 지운다
const debug = (params.get("debug") ?? "").split(",");
if (debug.includes("clear") || debug.includes("events")) {
  GameState.debugEverySlot(() => {
    if (debug.includes("clear")) GameState.debugClearAll();
    if (debug.includes("events")) GameState.debugResetEvents();
  });
  params.delete("debug");
  const q = params.toString();
  history.replaceState(null, "", location.pathname + (q ? `?${q}` : ""));
}

const game = new Game(document.getElementById("app")!);
game.register("title", () => new TitleScene());
game.register("map", () => new StageMap());
game.register("stage_open", () => new StageOpenScene());
game.register("upgrade", () => new UpgradeScene());
game.register("supply", () => new SupplyScene());
game.register("comic", () => new ComicScene());
game.register("settlement", () => new SettlementScene());
game.register("shift", () => new ShiftView());

// 글꼴 묶음이 새로 받아지면 한 번만 그리는 작은 캔버스(메뉴 그림 이름표 등)도 다시 그린다 (처음에 다른 글꼴로 남지 않게)
document.fonts?.addEventListener("loadingdone", () => {
  for (const w of game.widgets) w.dirty = true;
});

// 끓는 거품 같은 움직임에 쓰는 시계
let clock = 0;
const baseFrame = game.frame.bind(game);
game.frame = (dt: number) => {
  clock += dt;
  FoodArt.setClock(clock);
  baseFrame(dt);
};

// 캡처·테스트 도구가 쓰는 손잡이
(window as unknown as Record<string, unknown>).__game = game;
(window as unknown as Record<string, unknown>).__state = GameState;
(window as unknown as Record<string, unknown>).__sound = Sound;

// play.cmd 로 연 게임 창(?app=1): 게임 화면 안쪽이 딱 1280×720 이 되게 창 크기를 맞춘다 (제목 표시줄 두께는 PC마다 달라서 열고 나서 잰다)
if (params.get("app") === "1") {
  const fit = () => {
    const dw = 1280 - window.innerWidth;
    const dh = 720 - window.innerHeight;
    if (dw !== 0 || dh !== 0) window.resizeTo(window.outerWidth + dw, window.outerHeight + dh);
  };
  fit();
  setTimeout(fit, 400);
}

// 로딩 화면 (index.html #loading, 사용자가 준 라면 끓는 그림 두 장을 번갈아 = 컷 애니메이션): 그림 속 "Loading..." 막대가
// 진행(--p 0~1)만큼 차오르고, 막대 아래 팁은 돌아가며 바뀜. 다 받으면 잠깐 뒤 흐려지며 시작 화면으로.
// 너무 빨리 끝나도 MIN_LOADING_MS 동안은 보여 준다. 테스트·캡처(?nosave=1 / ?scene=…)는 기다리지 않는다.
const loading = document.getElementById("loading");
const tipEl = loading?.querySelector<HTMLElement>(".ld-tip") ?? null;
const quick = params.has("scene") || params.get("nosave") === "1";
const MIN_LOADING_MS = quick ? 0 : 2200;
const t0 = performance.now();
let loadFrac = 0;
let loaded = false;
const LOADING_TIPS = [
  "팁: 막대가 초록색 '완벽' 구간일 때 꺼내면 손님이 좋아해요",
  "팁: '준비 중' 팻말을 뒤집어야 손님이 와요. 문 열기 전에 미리 만들어 둬도 돼요",
  "팁: 재료가 떨어진 메뉴는 품절! 장보기에서 넉넉히 사 두세요",
  "팁: 비싸게 팔면 돈은 더 벌지만 손님 평가가 깐깐해져요",
  "팁: 단골은 완벽한 요리에 기분 좋게 팁을 줘요",
  "팁: 그릇을 탭하면 가장 급한 손님에게 바로 가요",
];
let tipIdx = Math.floor(Math.random() * LOADING_TIPS.length);
if (tipEl) tipEl.textContent = LOADING_TIPS[tipIdx];
const tipTimer = setInterval(() => {
  tipIdx = (tipIdx + 1) % LOADING_TIPS.length;
  if (tipEl) tipEl.textContent = LOADING_TIPS[tipIdx];
}, 2600);
const drawBar = () => {
  const k = loaded ? 1 : Math.min(loadFrac, MIN_LOADING_MS > 0 ? (performance.now() - t0) / MIN_LOADING_MS : 1);
  loading?.style.setProperty("--p", k.toFixed(3));
  if (!loaded) requestAnimationFrame(drawBar);
};
requestAnimationFrame(drawBar);

/**
 * 게임 글꼴 미리 받기: 한글 글꼴은 글자 묶음별로 나뉘어 있어서, 화면에 자주 나오는 글자(가게·메뉴·단골 이름과 설명, 공통 문구)가
 * 든 묶음을 먼저 받아 둔다 (캔버스 글자가 처음에 다른 글꼴로 그려지지 않게). 느린 망에서는 2.5초까지만 기다린다.
 */
function loadFonts(): Promise<unknown> {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  const common =
    "0123456789,.·:!?~+-×/%()★ 원개명초번째 가게 스테이지 영업 시작 하러 가기 타이틀 지도 업그레이드 무한 도전 할당량 오늘 매출 달성 미달 정산 판매 팁 폐기 손실 " +
    "다음 다시 닫기 확인 구매 최대 지갑 단골 도감 기록 잠깐 쉬는 중 계속 새 메뉴 손님 인내심 완성 칸 탭하면 서빙 그릇 쓰레기통 꺼내기 덜기 썰기 탔어요 버틴 시간 기회 " +
    "포장마차 타이쿤 오늘 밤도 영업합니다 가게 문 여는 중";
  const sample = common + JSON.stringify([D.SHOPS, D.MENUS, D.REGULARS, D.CUSTOMERS, D.UPGRADES]).replace(/[^가-힣]/g, "");
  const all = Promise.all([document.fonts.load(`40px "Jua"`, sample), document.fonts.load(`40px "Bagel Fat One"`, common)]);
  return Promise.race([all, new Promise((r) => setTimeout(r, 2500))]);
}

void Promise.all([ArtAssets.preload((n, total) => (loadFrac = n / total)), loadFonts()]).then(async () => {
  const wait = MIN_LOADING_MS - (performance.now() - t0);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  loaded = true;
  clearInterval(tipTimer);
  loading?.style.setProperty("--p", "1");
  loading?.classList.add("done");
  if (!quick) await new Promise((r) => setTimeout(r, 500)); // 꽉 찬 막대를 잠깐 보여 줌
  const start = params.get("scene") ?? "title";
  game.goto(game.scenes.has(start) ? start : "title");
  game.start();
  if (loading) {
    if (quick) loading.remove();
    else {
      setTimeout(() => loading.classList.add("hide"), 150);
      setTimeout(() => loading.remove(), 800);
    }
  }
});
