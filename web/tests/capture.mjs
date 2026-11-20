// 화면 캡처 도구: 개발 서버를 띄우고, 설치된 크롬(또는 엣지)으로 장면을 열어 PNG 로 찍는다.
// 실행: node tests/capture.mjs [출력 폴더] [찍을 장면 이름 ...]
//   장면 이름: title map shift_intro kitchen react settlement upgrade stage_open bunsik market beach suljip
// 창 크기는 게임 화면과 같은 1280×720 (16:9).

import { createServer } from "vite";
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const out = process.argv[2] ?? "tests/shots";
const wanted = process.argv.slice(3);
fs.mkdirSync(out, { recursive: true });

const browsers = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];
const exe = browsers.find((p) => fs.existsSync(p));
if (!exe) throw new Error("크롬/엣지를 찾지 못했어요");

const server = await createServer({ server: { port: 5199, host: "127.0.0.1" }, logLevel: "error" });
await server.listen();
const base = "http://127.0.0.1:5199/";

const browser = await chromium.launch({ executablePath: exe, headless: true });
// 움직임 줄이기: 숨 쉬는 버튼·튀어나오는 창이 멈춰 있어야 클릭·캡처가 안정적 (게임 UI 의 prefers-reduced-motion 처리)
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

/** 게임 안에서 시간을 dt 씩 n 번 흘림 */
async function step(n, dt = 1 / 60) {
  await page.evaluate(
    ([n, dt]) => {
      for (let i = 0; i < n; i++) window.__game.frame(dt);
    },
    [n, dt],
  );
}

/** 장면 하나 열기. 튜토리얼은 끈 상태로 (튜토리얼은 flow 장면에서 따로 확인), 재료는 열린 메뉴마다 넉넉히 */
async function open(scene, setup = "", tutorial = false) {
  await page.goto(`${base}?nosave=1&scene=${scene}`);
  await page.waitForFunction(() => window.__game && window.__game.scene !== null);
  if (!tutorial) {
    await page.evaluate((scene) => {
      const st = window.__state;
      st.tutorial = "";
      st.stock = {};
      for (const sid of ["pocha", "bunsik", "market", "beach", "suljip"]) {
        st.stock[sid] = {};
        for (const m of Object.keys(st.stockFor(sid))) st.stock[sid][m] = 30;
      }
      window.__game.goto(scene);
    }, scene);
  }
  if (setup) {
    await page.evaluate(setup);
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(300);
}

async function shot(name) {
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  console.log("shot", name);
}

const shots = {
  async title() {
    await open("title", "window.__state.wallet = 123000; window.__state.level = 9; window.__game.goto('title')");
    await step(30);
    await shot("title");
  },
  /** 기록이 있을 때 "게임 시작" → "새로 시작" 확인 창 (사용자 그림). 한국어 + 영어(덮개·번역 글씨) */
  async newgame() {
    for (const lang of ["ko", "en"]) {
      await open("title", `localStorage.setItem("pocha_tycoon_lang", "${lang}"); history.replaceState(null, "", "?nosave=1&lang=${lang}")`);
      await page.goto(`${base}?nosave=1&lang=${lang}`);
      await page.waitForFunction(() => window.__game && window.__game.scene !== null);
      await page.evaluate(() => {
        window.__state.level = 1;
        window.__state.wallet = 12500;
        window.__game.goto("title");
      });
      await step(10);
      await page.getByRole("button", { name: "게임 시작" }).click();
      await page.waitForTimeout(150);
      await shot(lang === "ko" ? "newgame" : "newgame_en");
    }
    await page.evaluate(() => localStorage.setItem("pocha_tycoon_lang", "ko"));
  },
  async map() {
    await open("map", "Object.assign(window.__state, {level: 9, wallet: 320000}); window.__state.levelStars = {1:5,2:4,3:5,4:3,5:5,6:4,7:5,8:3}; window.__game.goto('map')");
    await step(30);
    await shot("map");
  },
  async map_pocha() {
    await open("map", "Object.assign(window.__state, {level: 3, wallet: 4000}); window.__state.levelStars = {1:5,2:3}; window.__game.goto('map')");
    await step(30);
    await shot("map_pocha");
  },
  async map_bunsik() {
    await open("map", "Object.assign(window.__state, {level: 10, wallet: 50000, mapShop: 'bunsik'}); window.__state.levelStars = {1:5,2:4,3:5,4:3,5:5,6:4,7:5,8:3,9:4}; window.__game.goto('map')");
    await step(60);
    await shot("map_bunsik");
  },
  async shift_intro() {
    await open("title", "window.__state.playLevel = 1; window.__state.mode = 'story'; window.__game.goto('shift')");
    await step(10);
    await shot("shift_intro");
  },
  async kitchen() {
    await open(
      "title",
      "Object.assign(window.__state, {level: 7, playLevel: 6, mode: 'story'}); window.__game.goto('shift')",
    );
    await page.evaluate(() => {
      const sc = window.__game.scene;
      sc.onStart();
      sc.openShop();
      const s = sc.session;
      for (const m of ["tteokbokki", "sundae", "odeng", "odeng", "odeng", "twigim", "twigim"]) s.addIngredient(m);
    });
    await step(240, 1 / 30);
    await page.evaluate(() => {
      const s = window.__game.scene.session;
      s.tapStation("pan", 0);
      s.tapStation("steamer", 0);
      s.tapCutting();
    });
    await step(20);
    await shot("kitchen");
  },
  async react() {
    await open("title", "Object.assign(window.__state, {level: 7, playLevel: 6, mode: 'story'}); window.__game.goto('shift')");
    await page.evaluate(() => {
      const sc = window.__game.scene;
      sc.onStart();
      sc.openShop();
    });
    await step(200, 1 / 30);
    await page.evaluate(() => {
      const sc = window.__game.scene;
      for (let i = 0; i < 3; i++) {
        const v = sc.customerViews[i];
        if (v) v.react(["raw", "burnt", "wrong"][i]);
      }
    });
    await step(12);
    await shot("react");
  },
  async settlement() {
    await open("title", `
      window.__state.recordResult({level: 3, shop: 'pocha', endless: false, sales: 21000, tips: 4300, waste: 900, revenue: 24400, target: 15500, passed: true, stars: 4, perfect_ratio: 0.75, items_ordered: 8, items_perfect: 6, happy: 6, angry: 0, customers: 6, regulars: ['taxi'], elapsed: 140});
      window.__state.level = 3; window.__game.goto('settlement');`);
    await step(20);
    await shot("settlement");
  },
  async upgrade() {
    await open("title", "Object.assign(window.__state, {level: 7, wallet: 15000, mapShop: 'pocha'}); window.__game.goto('upgrade')");
    await step(5);
    await shot("upgrade");
  },
  // 팝업들 (2026-11-15 게임 UI 다시 만들 때 추가)
  async map_popup() {
    await open("map", "Object.assign(window.__state, {level: 9, wallet: 320000}); window.__state.levelStars = {1:5,2:4,3:5,4:3,5:5,6:4,7:5,8:3}; window.__game.goto('map')");
    await step(20);
    await page.evaluate(() => window.__game.scene.openLevelPopup(10));
    await step(30);
    await page.waitForTimeout(400);
    await shot("map_popup");
  },
  async collection() {
    await open("map", "Object.assign(window.__state, {level: 16}); window.__state.regulars = {taxi: 3, student: 1, cafe: 2, office: 1, grandma: 2, guard: 1}; window.__game.goto('map')");
    await shot("map_book_button");
    await page.getByText("단골 도감").click();
    await page.waitForTimeout(400);
    await shot("collection");
  },
  async login() {
    await open("title", "Object.assign(window.__state, {level: 5, wallet: 42000}); window.__game.goto('title')");
    await shot("title_guest");
    // 왼쪽 위 로그인 나무판 → 로그인 창 (그림) → 회원가입 → 아이디·비밀번호 → 가입하기
    await page.locator(".login-plank").click();
    await page.waitForTimeout(300);
    await shot("login");
    await page.getByRole("button", { name: "회원가입" }).click();
    await page.locator(".login-input").nth(0).fill("김사장");
    await page.locator(".login-input").nth(1).fill("1234");
    await page.waitForTimeout(200);
    await shot("signup");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    await shot("title_logged_in");
    await page.locator(".login-plank").click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "로그아웃" }).last().click();
    await page.waitForTimeout(300);
    await shot("logout");
  },
  /** 미식가 이벤트: 지도 발판(잠김·도전 가능·다녀감) → 안내 창 → 영업 시작 안내 → 영업 중 → 정산 */
  async event() {
    const toBoundary = "window.__game.scene.setScroll(1664 - 960); window.__game.frame(1/60)";
    await open("map", `Object.assign(window.__state, {level: 7, wallet: 40000}); window.__state.levelStars = {1:5,2:4,3:5,4:3,5:5,6:4,7:5}; window.__game.goto('map')`);
    await page.evaluate(toBoundary);
    await step(30);
    await shot("event_map_open");
    await page.evaluate(() => window.__game.scene.onEventPressed("pocha"));
    await page.waitForTimeout(300);
    await shot("event_popup");
    await open("map", `Object.assign(window.__state, {level: 9, wallet: 40000}); window.__state.levelStars = {1:5,2:4,3:5,4:3,5:5,6:4,7:5,8:3}; window.__state.events = {pocha: 4}; window.__game.goto('map')`);
    await page.evaluate(toBoundary);
    await step(30);
    await shot("event_map_done");
    await open("map", "Object.assign(window.__state, {level: 3}); window.__game.goto('map')");
    await page.evaluate(toBoundary);
    await step(30);
    await shot("event_map_locked");
    await open("title", `Object.assign(window.__state, {level: 7, mode: 'event', eventShop: 'pocha'}); window.__state.levelStars = {7:5}; window.__game.goto('shift')`);
    await page.waitForTimeout(300);
    await shot("event_intro");
    await page.evaluate(() => {
      const sc = window.__game.scene;
      sc.onStart();
      sc.openShop();
      for (let i = 0; i < 150; i++) window.__game.frame(1 / 60);
      const s = sc.session;
      const m = s.gourmet.unservedMenus()[0];
      const slot = s.freeTraySlot(m);
      s.tray[slot] = { menu: m, quality: 2 };
      s.autoServe(slot);
      for (let i = 0; i < 30; i++) window.__game.frame(1 / 60);
    });
    await page.waitForTimeout(200);
    await shot("event_shift");
    await open("title", `Object.assign(window.__state, {level: 7}); window.__state.recordResult({level: 7, shop: 'pocha', endless: false, event: true, gourmet: {grade: 4, satisfaction: 0.82, reward: 48000, perfect: 11, cooked: 2, bad: 1, missed: 1, total: 15}, sales: 61000, tips: 52000, waste: 1200, revenue: 111800, target: 0, passed: true, stars: 4, perfect_ratio: 0.73, items_ordered: 15, items_perfect: 11, happy: 1, angry: 0, customers: 1, regulars: [], elapsed: 140}); window.__game.goto('settlement')`);
    await page.waitForTimeout(400);
    await shot("event_settlement");
    // 미식가 이야기: 신문 → 손님이 몰림 → 매출 상승
    await page.getByText("다음 이야기").click();
    await page.waitForTimeout(300);
    await shot("event_story_1");
    await page.getByText("다음", { exact: true }).click();
    await page.waitForTimeout(300);
    await shot("event_story_2");
    await page.getByText("다음", { exact: true }).click();
    await page.waitForTimeout(300);
    await shot("event_story_3");
  },
  /** 메뉴 가격 (영업 중 위 "가격표") · 실시간 평점 + 손님 평가 */
  async prices() {
    await open("title", "Object.assign(window.__state, {level: 4, playLevel: 4, mode: 'story'}); window.__state.prices = {pocha: {tteokbokki: 'pricey'}}; window.__state.ratings = {pocha: 3.4}; window.__game.goto('shift')");
    await page.evaluate(() => {
      const sc = window.__game.scene;
      sc.onStart();
      sc.openShop();
      const s = sc.session;
      for (let i = 0; i < 600 && s.seatedCount() < 1; i++) window.__game.frame(1 / 60);
      const C = s.seats.find((c) => c !== null).constructor;
      const seat = s.seats.findIndex((c) => c === null);
      s.debugSeatCustomer(seat, new C("normal", ["tteokbokki"]));
      for (let i = 0; i < 30; i++) window.__game.frame(1 / 60);
      const slot = s.freeTraySlot("tteokbokki");
      s.tray[slot] = { menu: "tteokbokki", quality: 1 };
      sc.serveBowl(slot);
      for (let i = 0; i < 40; i++) window.__game.frame(1 / 60);
    });
    await page.waitForTimeout(200);
    await shot("price_shift");
    await page.getByRole("button", { name: "가격표" }).click();
    await page.waitForTimeout(300);
    const si = await page.evaluate(() => { const sc = window.__game.scene; return sc.kitchen.binMenus().filter((m) => sc.session.menuPool.includes(m)).indexOf("sundae"); });
    await page.getByRole("button", { name: /비쌈/ }).nth(si).click();
    await page.waitForTimeout(200);
    await shot("price_panel");
    const lv = await page.evaluate(() => [window.__game.scene.session.priceLevel("sundae"), window.__state.prices.pocha.sundae]);
    if (lv[0] !== "pricey" || lv[1] !== "pricey") throw new Error("가격표에서 바꾼 값이 영업·저장에 안 들어감: " + lv);
    await page.getByRole("button", { name: "닫기" }).click();
  },
  /** 단골이 완벽한 요리를 받고 팁을 주며 한마디 (팁은 단골만) */
  async tip() {
    await open("title", "Object.assign(window.__state, {level: 3, playLevel: 3, mode: 'story'}); window.__game.goto('shift')");
    await page.evaluate(() => {
      const sc = window.__game.scene;
      sc.onStart();
      sc.openShop();
      const s = sc.session;
      for (let i = 0; i < 400 && s.seatedCount() === 0; i++) window.__game.frame(1 / 60);
      const C = s.seats.find((c) => c !== null).constructor;
      const seat = s.seats.findIndex((c) => c === null);
      const reg = new C("regular", ["tteokbokki", "sundae"]);
      reg.regularId = "grandma";
      s.debugSeatCustomer(seat, reg);
      for (let i = 0; i < 40; i++) window.__game.frame(1 / 60);
      const slot = s.freeTraySlot("tteokbokki");
      s.tray[slot] = { menu: "tteokbokki", quality: 2 };
      s.serve(slot, seat);
      for (let i = 0; i < 20; i++) window.__game.frame(1 / 60);
    });
    await page.waitForTimeout(200);
    await shot("tip");
  },
  /** 미식가 스테이지 전 만화 (첫 가게): 첫 컷 · 셋째 컷 · 다 나온 뒤 */
  async comic() {
    await open("title", "Object.assign(window.__state, {level: 8, mapShop: 'pocha'}); window.__state.chooseEvent('pocha'); window.__game.goto('comic')");
    await page.waitForTimeout(900);
    await shot("comic_1");
    for (let k = 0; k < 2; k++) {
      await page.mouse.click(640, 360);
      await page.waitForTimeout(250);
    }
    await shot("comic_3");
    for (let k = 0; k < 3; k++) {
      await page.mouse.click(640, 360);
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(1700);
    await shot("comic_all");
    await page.getByRole("button", { name: "계속하기" }).click();
    await page.waitForFunction(() => window.__game.scene.constructor.name === "ShiftView");
    await page.waitForTimeout(300);
    await page.waitForTimeout(2500);
    await shot("comic_then_shift"); // 안내 창 없이 바로 가게 · 미식가 입장
    console.log("[comic] 바로 영업 · 미식가 입장:", await page.evaluate(() => window.__game.scene.session.opened && window.__state.eventPlayed("pocha") && !!window.__game.scene.session.gourmet));
  },
  /** 두 번째 가게 미식가 만화 (다 나온 뒤) */
  async comic_bunsik() {
    await open("title", "Object.assign(window.__state, {level: 15, mapShop: 'bunsik'}); window.__state.chooseEvent('bunsik'); window.__game.goto('comic')");
    await page.waitForTimeout(700);
    for (let k = 0; k < 6; k++) {
      await page.mouse.click(640, 360);
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(1700);
    await shot("comic_bunsik_all");
  },
  /** 장보기 (마법의 가루 카드) · 팻말 · 가루 준비 + 가루 뿌린 판 · 품절 재료통을 눌렀을 때 사기 창 */
  async magic() {
    await open("title", "Object.assign(window.__state, {level: 4, wallet: 64000, powder: 2, mapShop: 'pocha'}); window.__state.stock.pocha.twigim = 0; window.__game.goto('supply')");
    await page.waitForTimeout(300);
    await shot("supply_magic");
    // 가게 탭: 세 가게가 열린 상태에서 야시장 탭
    await open("title", "Object.assign(window.__state, {level: 17, wallet: 250000, powder: 3, mapShop: 'bunsik'}); window.__game.goto('supply')");
    await page.waitForTimeout(300);
    await shot("supply_tabs");
    await page.getByRole("button", { name: /야시장/ }).click();
    await page.waitForTimeout(250);
    await shot("supply_tab_market");
    await open("title", "Object.assign(window.__state, {level: 4, playLevel: 4, mode: 'story', powder: 2}); window.__state.stock.pocha.twigim = 0; window.__game.goto('shift')");
    await page.evaluate(() => window.__game.scene.onStart());
    await step(30);
    await shot("sign_closed");
    await page.evaluate(() => {
      const sc = window.__game.scene;
      sc.openShop();
      sc.session.armPowder();
      sc.session.addIngredient("tteokbokki");
      sc.session.armPowder();
      for (let i = 0; i < 200; i++) window.__game.frame(1 / 60);
    });
    await page.waitForTimeout(200);
    await shot("magic_armed");
    await page.evaluate(() => {
      const sc = window.__game.scene;
      const bin = sc.kitchen.binMenus().indexOf("twigim");
      const c = sc.kitchen.binCenter(bin);
      sc.pending = { kind: "bin", menu: "twigim" };
      sc.tap();
    });
    await page.waitForTimeout(300);
    await shot("buy_in_shift");
  },
  async quit() {
    await open("title");
    await page.getByText("게임 종료").click();
    await page.waitForTimeout(400);
    await shot("quit");
  },
  async pause() {
    await open("title", "Object.assign(window.__state, {level: 2, playLevel: 2, mode: 'story'}); window.__game.goto('shift')");
    await page.evaluate(() => { window.__game.scene.onStart(); window.__game.scene.openShop(); });
    await step(30);
    await page.locator('button[aria-label="일시정지"]').click();
    await page.waitForTimeout(400);
    await shot("pause");
  },
  async stage_open() {
    await open("title", "Object.assign(window.__state, {level: 8, justOpened: 'bunsik'}); window.__game.goto('stage_open')");
    await step(20);
    await shot("stage_open");
  },
};

/** 설계 좌표(1080 높이 기준) → 창 좌표 */
async function toScreen(x, y) {
  return page.evaluate(([x, y]) => {
    const g = window.__game;
    return [g.offX + x * g.scale, g.offY + y * g.scale];
  }, [x, y]);
}

async function clickDesign(x, y) {
  const [sx, sy] = await toScreen(x, y);
  await page.mouse.click(sx, sy);
  await page.waitForTimeout(60);
}

/** HTML 요소 가운데를 진짜 마우스로 누름 (튜토리얼 덮개 구멍을 지나가는지도 같이 확인) */
async function clickEl(fnSrc) {
  const r = await page.evaluate(fnSrc);
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  await page.waitForTimeout(80);
}

/** 지도 위 캔버스 단추 가운데 (설계 좌표) */
async function mapButtonCenter(kind) {
  return await page.evaluate((kind) => {
    const sc = window.__game.scene;
    const b = sc.upgradeBtns.pocha;
    return { x: b.position.x + b.size.x / 2 - sc.scrollX(), y: b.position.y + b.size.y / 2 };
  }, kind);
}

const sceneName = () => page.evaluate(() => window.__game.scene.constructor.name);

/**
 * 사람처럼 눌러 보는 흐름 (새 게임 = 튜토리얼 그대로): 타이틀 → 지도(인사 → 장보기) → 떡볶이 10인분 → 지도 → 업그레이드 → 판 키우기
 * → 지도 → 스테이지 1 → 영업 시작 → 재료통 → 판 → 그릇 → 일시정지 → 다시 → 끝까지 → 정산 → 지도
 */
shots.flow = async () => {
  const fails = [];
  const check = (cond, msg) => {
    console.log((cond ? "  ok   " : "  FAIL ") + msg);
    if (!cond) fails.push(msg);
  };
  await page.goto(`${base}?nosave=1`);
  await page.waitForFunction(() => window.__game && window.__game.scene !== null);
  await page.evaluate(() => window.__state.resetGame());
  await page.getByRole("button", { name: "게임 시작" }).click();
  await page.waitForFunction(() => window.__game.scene.constructor.name === "StageMap");
  check(true, "타이틀 → 지도");
  await step(5);
  check(await page.getByText("어서 와요, 새 사장님!", { exact: false }).isVisible(), "튜토리얼: 이모 인사");
  await shot("tut_1_hello");
  await page.getByText("좋아요!").click();
  await step(2);
  // 덮개 밖(스테이지 1)은 안 눌림
  const n1 = await page.evaluate(() => {
    const sc = window.__game.scene;
    const n = sc.levelNodes().find((k) => k.number === 1 && !k.endless && !k.event);
    return { x: n.position.x - sc.scrollX(), y: n.position.y };
  });
  await clickDesign(n1.x, n1.y - 20);
  check(!(await page.getByText("영업 시작", { exact: true }).isVisible()), "튜토리얼 중엔 가리킨 곳 말고는 안 눌림");
  await shot("tut_2_supply_button");
  // 장보기 = 지도 위쪽 막대의 버튼 하나 (2026-11-20, 모든 가게 재료를 한 곳에서)
  await clickEl(() => window.__game.scene.supplyButton().getBoundingClientRect().toJSON());
  await page.waitForFunction(() => window.__game.scene.constructor.name === "SupplyScene");
  check(true, "장보기 → 장보기 화면");
  await page.waitForTimeout(200);
  await shot("tut_3_supply");
  for (let k = 0; k < 2; k++) await clickEl(() => window.__game.scene.buyButtons.tteokbokki.getBoundingClientRect().toJSON());
  check(await page.evaluate(() => window.__state.stockOf("pocha", "tteokbokki") === 10 && window.__state.wallet === 0), "떡볶이 재료 5인분 × 2 = 10인분 (튜토리얼은 공짜, 처음 돈 0원)");
  await page.waitForTimeout(150);
  await shot("tut_4_supply_back");
  await clickEl(() => window.__game.scene.backButton().getBoundingClientRect().toJSON());
  await page.waitForFunction(() => window.__game.scene.constructor.name === "StageMap");
  await step(5);
  await shot("tut_5_upgrade_button");
  const ub = await mapButtonCenter("upgrade");
  await clickDesign(ub.x, ub.y);
  await page.waitForFunction(() => window.__game.scene.constructor.name === "UpgradeScene");
  await page.waitForTimeout(200);
  await shot("tut_6_upgrade");
  // 처음 돈 0원 → 장비는 아직 못 삼 (튜토리얼은 설명만)
  check(await page.evaluate(() => window.__game.scene.buyBtns.burners.disabled && window.__state.upgradeLevel("burners", "pocha") === 0), "튜토리얼: 돈이 없어 장비는 설명만 (사기 버튼 잠김)");
  await clickEl(() => window.__game.scene.backBtn.getBoundingClientRect().toJSON());
  await page.waitForFunction(() => window.__game.scene.constructor.name === "StageMap");
  await step(5);
  await shot("tut_7_stage");
  await clickDesign(n1.x, n1.y - 20);
  check(await page.getByText("영업 시작", { exact: true }).isVisible(), "스테이지 1 누르면 안내 창");
  await page.waitForTimeout(150);
  await shot("tut_8_popup");
  await page.getByText("영업 시작", { exact: true }).click();
  await page.waitForFunction(() => window.__game.scene.constructor.name === "ShiftView");
  check(await page.evaluate(() => window.__state.tutorial === "cook"), "튜토리얼 단계 저장 (cook)");
  await page.getByText("영업 시작!").click();
  await step(2);
  check(await page.evaluate(() => window.__game.scene.phase === 1), "영업 시작 → 진행 중");
  await step(120);
  check(await page.evaluate(() => window.__game.scene.session.spawned === 0), "'준비 중' 팻말이면 손님이 안 옴");
  // 2026-11-21: 튜토리얼 = 손님 없이 먼저 만들기 → 설명 → 마지막에 팻말 (튜토리얼이 끝나야 손님이 옴)
  await clickEl(() => window.__game.scene.hud.signElement().getBoundingClientRect().toJSON());
  check(await page.evaluate(() => !window.__game.scene.session.opened), "튜토리얼 중엔 팻말을 눌러도 문이 안 열림 (가린 곳)");
  await shot("tut_9_bin");
  const L = await page.evaluate(() => {
    const sc = window.__game.scene;
    const pan = sc.stationViews.find((s) => s.station === "pan");
    return { bin: sc.kitchen.binCenter(0), pan: { x: pan.position.x, y: pan.position.y }, tray: sc.kitchen.trayCenter(0) };
  });
  await clickDesign(L.bin.x, L.bin.y);
  check(await page.evaluate(() => window.__game.scene.session.stationItem("pan", 0) !== null && window.__game.scene.session.stockLeft("tteokbokki") === 8), "떡볶이 재료 탭 → 판에 올라감 (판 2그릇 = 재료 2인분)");
  await step(30);
  await shot("tut_10_pan");
  await clickDesign(L.pan.x, L.pan.y);
  check(await page.evaluate(() => window.__game.scene.session.tray[0] === null && window.__game.scene.session.stationItem("pan", 0).portions === 2), "완벽 전에 판을 누르면 안 덜림 (튜토리얼)");
  await step(30 * 60);
  check(await page.evaluate(() => window.__game.scene.session.stationItem("pan", 0).stepQuality() === 2), "튜토리얼 중엔 오래 둬도 완벽 그대로 (졸지 않음)");
  await clickDesign(L.pan.x, L.pan.y);
  check(await page.evaluate(() => window.__game.scene.session.tray[0] !== null && window.__game.scene.session.tray[0].quality === 2), "완벽할 때 판 탭 → 완성 칸에 완벽 한 그릇");
  await step(10);
  await shot("tut_11_tray");
  await page.getByText("알겠어요!").click();
  await step(5);
  await page.getByText("좋아요!").click();
  await step(5);
  check(await page.evaluate(() => window.__game.scene.session.spawned === 0), "설명이 끝날 때까지 손님이 안 옴");
  await shot("tut_12_sign");
  await clickEl(() => window.__game.scene.hud.signElement().getBoundingClientRect().toJSON());
  check(await page.evaluate(() => window.__game.scene.session.opened && window.__state.tutorial === "" && !window.__game.scene.session.frozen), "마지막에 팻말 → 문 열림 · 튜토리얼 끝 · 손님 인내심 흐름");
  await step(120);
  check(await page.evaluate(() => window.__game.scene.session.spawned > 0), "튜토리얼이 끝난 뒤 손님이 옴");
  await clickDesign(L.tray.x, L.tray.y - 14);
  await step(10);
  check(await page.evaluate(() => window.__game.scene.session.sales > 0 || !window.__game.scene.session.seats.some((c) => c && c.unservedMenus().includes("tteokbokki"))), "그릇 탭 → 손님에게 자동 서빙");
  await shot("tut_13_customer");
  await page.locator("button[aria-label=\"일시정지\"]").click();
  check(await page.evaluate(() => window.__game.paused), "일시정지");
  await page.getByText("계속 영업하기").click();
  check(await page.evaluate(() => !window.__game.paused), "다시 영업");
  // 나머지는 봇처럼 빠르게: 시간을 돌려 하루를 끝낸다
  await page.evaluate(() => {
    const sc = window.__game.scene;
    let g = 0;
    while (!sc.session.isOver && g++ < 20000) window.__game.frame(0.1);
  });
  await step(4 * 60);
  await page.waitForFunction(() => window.__game.scene.constructor.name === "SettlementScene", null, { timeout: 5000 });
  check(true, "하루가 끝나면 셔터 → 정산");
  await shot("flow_settlement");
  await page.getByText("지도로").first().click();
  await page.waitForFunction(() => window.__game.scene.constructor.name === "StageMap");
  check(true, "정산 → 지도");
  // 지도 밀기: 왼쪽으로 크게 밀면 오른쪽 가게가 보임
  const before = await page.evaluate(() => window.__game.scene.scrollX());
  const [ax, ay] = await toScreen(1500, 540);
  await page.mouse.move(ax, ay);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(ax - i * 60, ay);
  await page.mouse.up();
  await step(60);
  const after = await page.evaluate(() => window.__game.scene.scrollX());
  check(after > before + 300, `지도를 밀면 움직임 (${before.toFixed(0)} → ${after.toFixed(0)})`);
  await shot("flow_map");
  console.log(fails.length === 0 ? "[flow] RESULT: PASS" : `[flow] RESULT: FAIL (${fails.length})`);
};

/** 로딩 화면 (주소에 아무것도 안 붙이고 열면 잠깐 나온다) → 다 끝난 뒤 시작 화면 */
shots.loading = async () => {
  await page.goto(base);
  await page.waitForTimeout(500);
  await shot("loading");
  await page.waitForTimeout(1100);
  await shot("loading_mid");
  await page.waitForFunction(() => document.getElementById("loading")?.classList.contains("done"), null, { timeout: 8000 });
  await page.waitForTimeout(300);
  await shot("loading_perfect");
  await page.waitForFunction(() => !document.getElementById("loading"), null, { timeout: 8000 });
  await page.waitForTimeout(200);
  await shot("loading_done");
  await page.evaluate(() => localStorage.clear());
};

/** 장면마다 한 프레임(진행 + 그리기)에 걸리는 시간 */
shots.perf = async () => {
  const cases = [
    ["title", "window.__game.goto('title')"],
    ["map", "Object.assign(window.__state, {level: 20, wallet: 0}); window.__game.goto('map')"],
    ["shift pocha", "Object.assign(window.__state, {level: 7, playLevel: 6, mode: 'story'}); window.__game.goto('shift')"],
    ["shift market", "Object.assign(window.__state, {level: 19, playLevel: 19, mode: 'story'}); window.__game.goto('shift')"],
  ];
  for (const [name, setup] of cases) {
    await open("title", setup);
    await page.evaluate(() => {
      const sc = window.__game.scene;
      if (sc.session) {
        sc.onStart();
      sc.openShop();
        for (const m of sc.session.menuPool) for (let k = 0; k < 2; k++) sc.session.addIngredient(m);
      }
    });
    const ms = await page.evaluate(() => {
      const g = window.__game;
      for (let i = 0; i < 30; i++) g.frame(1 / 60);
      const t0 = performance.now();
      for (let i = 0; i < 120; i++) g.frame(1 / 60);
      return (performance.now() - t0) / 120;
    });
    console.log(`  ${name}: ${ms.toFixed(2)} ms/frame`);
  }
};

for (const [shop, lv] of [["bunsik", 12], ["market", 19], ["beach", 26], ["suljip", 33]]) {
  shots[shop] = async () => {
    await open("title", `Object.assign(window.__state, {level: ${lv}, playLevel: ${lv}, mode: 'story'}); window.__game.goto('shift')`);
    await page.evaluate(() => {
      const sc = window.__game.scene;
      sc.onStart();
      sc.openShop();
      const s = sc.session;
      for (const m of s.menuPool) for (let k = 0; k < 2; k++) s.addIngredient(m);
    });
    await step(150, 1 / 30);
    await shot(shop);
  };
}

// 지도에서 각 가게 구역 (map_market / map_beach / map_suljip)
for (const [shop, lv] of [["market", 17], ["beach", 24], ["suljip", 31]]) {
  shots[`map_${shop}`] = async () => {
    await open("map", `Object.assign(window.__state, {level: ${lv}, wallet: 80000, mapShop: '${shop}'}); window.__game.goto('map')`);
    await step(60);
    await shot(`map_${shop}`);
  };
}

const names = wanted.length > 0 ? wanted : Object.keys(shots);
for (const n of names) {
  if (!shots[n]) {
    console.log("unknown shot", n);
    continue;
  }
  try {
    await shots[n]();
  } catch (e) {
    console.log("shot failed", n, String(e));
  }
}
if (errors.length > 0) {
  console.log("PAGE ERRORS:");
  for (const e of [...new Set(errors)].slice(0, 20)) console.log("  " + e);
}
await browser.close();
await server.close();
