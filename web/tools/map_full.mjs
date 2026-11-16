// 스테이지 지도 전체를 한 장의 PNG 로 찍는다 (지도는 좌우로 긴 하나의 세계: 가게 5곳 × 1664 + 끝 빈터 1280 = 9600 × 1080).
// 실행: node tools/map_full.mjs [출력 폴더] [배율=1]
//   map_full.png = 지도 그림 + 스테이지 노드·간판·단추 (화면 위 HUD 와 화살표는 빼고)
//   map_bg.png   = 지도 그림만 (땅·길·건물·집·나무·소품)
// 모든 가게가 열린 상태로 찍는다 (?nosave=1 이라 실제 저장은 그대로).

import { createServer } from "vite";
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const out = process.argv[2] ?? "tests/shots";
const scale = Number(process.argv[3] ?? "1");
fs.mkdirSync(out, { recursive: true });

const exe = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find((p) => fs.existsSync(p));
if (!exe) throw new Error("크롬/엣지를 찾지 못했어요");

const server = await createServer({ server: { port: 5199, host: "127.0.0.1" }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch({ executablePath: exe, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("http://127.0.0.1:5199/?nosave=1&scene=title");
  await page.waitForFunction(() => window.__game && window.__state);
  await page.evaluate(() => {
    const stars = {};
    for (let i = 1; i <= 34; i++) stars[i] = 5 - (i % 3);
    Object.assign(window.__state, { level: 35, wallet: 0, mapShop: "pocha", levelStars: stars });
    window.__game.goto("map");
  });
  await page.waitForTimeout(1500); // 그림 불러오기 + 몇 프레임

  const shots = await page.evaluate(async (k) => {
    const { Gfx } = await import("/src/engine/gfx.ts");
    const sc = window.__game.scene;
    const layer = sc.layer;
    const art = sc.art;
    const W = Math.round(art.size.x);
    const H = Math.round(art.size.y);
    const shoot = (what) => {
      const cv = document.createElement("canvas");
      cv.width = Math.round(W * k);
      cv.height = Math.round(H * k);
      const ctx = cv.getContext("2d");
      ctx.scale(k, k);
      ctx.fillStyle = sc.clearColor.css();
      ctx.fillRect(0, 0, W, H);
      const keep = [layer.position, art.viewX0, art.viewX1];
      layer.position = layer.position.constructor ? new layer.position.constructor(0, 0) : { x: 0, y: 0 };
      art.viewX0 = -1e9;
      art.viewX1 = 1e9;
      const g = new Gfx(ctx);
      if (what === "full") layer.render(g);
      else art.render(g);
      [layer.position, art.viewX0, art.viewX1] = keep;
      return cv.toDataURL("image/png");
    };
    return { W, H, full: shoot("full"), bg: shoot("bg") };
  }, scale);

  for (const [name, url] of [["map_full", shots.full], ["map_bg", shots.bg]]) {
    const file = path.join(out, `${name}.png`);
    fs.writeFileSync(file, Buffer.from(url.split(",")[1], "base64"));
    console.log(`${file}  (${Math.round(shots.W * scale)}×${Math.round(shots.H * scale)})`);
  }
  console.log(`지도 세계 크기: ${shots.W} × ${shots.H}`);
  if (errors.length > 0) console.log("오류:\n" + errors.join("\n"));
} finally {
  await browser.close();
  await server.close();
}
