// 가게마다 영업 화면 배경(StreetArt)을 손님·주방·글자 없이 1920×1080 PNG 로 뽑는다.
// 실행: node tools/export_backgrounds.mjs [출력 폴더]
//   bg_<가게 id>.png       = 화면 전체 (장보기·업그레이드 화면처럼 배경이 아래까지)
//   bg_<가게 id>_game.png  = 영업 화면에서 실제로 보이는 부분 (카운터 위, 1920 × COUNTER_Y)
//   (골목 포장마차는 비 효과 없이 배경만)
// 지도 전체 그림은 node tools/map_full.mjs [폴더] 1 (map_bg.png / map_full.png)

import { createServer } from "vite";
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const out = process.argv[2] ?? "exports/backgrounds";
fs.mkdirSync(out, { recursive: true });

const exe = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find((p) => fs.existsSync(p));
if (!exe) throw new Error("크롬/엣지를 찾지 못했어요");

const server = await createServer({ server: { port: 5198, host: "127.0.0.1" }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch({ executablePath: exe, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.goto("http://127.0.0.1:5198/?nosave=1&scene=title");
  await page.waitForFunction(() => window.__game && window.__game.scene !== null);
  await page.waitForTimeout(800); // 글꼴
  const shots = await page.evaluate(async () => {
    const D = await import("/src/core/defs.ts");
    const { StreetArt } = await import("/src/art/street_art.ts");
    const { Gfx } = await import("/src/engine/gfx.ts");
    const { v } = await import("/src/engine/geom.ts");
    const { COUNTER_Y } = await import("/src/shift/shift_view.ts");
    const res = [];
    for (const [suffix, cy] of [["", 1080], ["_game", COUNTER_Y]]) for (const shop of D.SHOPS) {
      const c = document.createElement("canvas");
      c.width = 1920;
      c.height = cy;
      const ctx = c.getContext("2d");
      const art = new StreetArt();
      art.size = v(1920, 1080);
      art.awningY = 0.0;
      art.awningH = 64.0;
      art.counterY = cy;
      art.theme = shop.theme;
      if (["alley", "market", "beach"].includes(shop.theme)) art.signText = shop.short;
      for (const m of shop.menus) art.menuNames.push(D.menuName(m));
      art.enterTree();
      art.process(0.5);
      art.draw(new Gfx(ctx));
      res.push({ id: shop.id + suffix, name: shop.name, data: c.toDataURL("image/png") });
    }
    return res;
  });
  for (const s of shots) {
    const file = path.join(out, `bg_${s.id}.png`);
    fs.writeFileSync(file, Buffer.from(s.data.split(",")[1], "base64"));
    console.log(file, `(${s.name})`);
  }
} finally {
  await browser.close();
  await server.close();
}
