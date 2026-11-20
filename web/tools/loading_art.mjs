// 로딩 화면 그림 (2026-11-17 사용자 "로딩 화면은 이 두 장 번갈아 가면서 컷 애니메이션처럼 라면이 끓고 있는 것처럼"):
// 원본 art_src/loading_ramen_1.png · loading_ramen_2.png (1672×941, 가스불 위 라면 냄비 + 오른쪽 아래 "Loading..." 막대).
// 막대 안에 그려진 크림색 채움을 빈 막대(어두운 홈)로 지워 public/assets/art/title/loading_1.webp · loading_2.webp 로 저장.
// 실제 채움은 index.html 이 그 위에 얹는다 (.ld-track = 아래 FILL 을 그림 크기로 나눈 %).
// (예전 로딩 그림 = 다섯 사람 포장마차 → 이제 메인 화면 두 번째 그림, tools/title_art.mjs)
// 실행: node tools/loading_art.mjs
import { chromium } from "playwright-core";
import fs from "node:fs";

const FRAMES = ["art_src/loading_ramen_1.png", "art_src/loading_ramen_2.png"];
// 원본 픽셀 (tools 로 잰 값): 막대 안쪽 홈 = x 1036~1590, y 763~803 / 크림색 채움 = x 1042~(~1440), y 769~798
const ERASE = { x: 1037, y: 764, w: 410, h: 38 }; // 지울 곳 (채움 + 둘레)
const TILE = { x: 1450, w: 138 }; // 빈 홈 무늬를 떠 오는 곳 (같은 줄)
const FILL = { x: 1042, y: 769, w: 546, h: 30 }; // 진짜 채움을 그릴 자리 (index.html)

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  fs.mkdirSync("public/assets/art/title", { recursive: true });
  for (let i = 0; i < FRAMES.length; i++) {
    const b64 = fs.readFileSync(FRAMES[i]).toString("base64");
    const r = await page.evaluate(
      async ([b64, E, T]) => {
        const img = new Image();
        img.src = "data:image/png;base64," + b64;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);
        // 빈 홈 무늬를 좌우로 뒤집어 가며 이어 붙여 채움 자리를 덮음
        for (let x = E.x, k = 0; x < E.x + E.w; x += T.w, k++) {
          const w = Math.min(T.w, E.x + E.w - x);
          ctx.save();
          if (k % 2 === 1) {
            ctx.translate(x + w, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(img, T.x + T.w - w, E.y, w, E.h, 0, E.y, w, E.h);
          } else ctx.drawImage(img, T.x, E.y, w, E.h, x, E.y, w, E.h);
          ctx.restore();
        }
        return { w: c.width, h: c.height, webp: c.toDataURL("image/webp", 0.9) };
      },
      [b64, ERASE, TILE],
    );
    const out = `public/assets/art/title/loading_${i + 1}.webp`;
    const buf = Buffer.from(r.webp.split(",")[1], "base64");
    fs.writeFileSync(out, buf);
    console.log(`${out} (${r.w}×${r.h}, ${(buf.length / 1024) | 0}KB)`);
  }
  const pct = (a, b) => ((a / b) * 100).toFixed(3) + "%";
  console.log(`채움 자리 (index.html .ld-track): left ${pct(FILL.x, 1672)} top ${pct(FILL.y, 941)} width ${pct(FILL.w, 1672)} height ${pct(FILL.h, 941)}`);
} finally {
  await browser.close();
}
