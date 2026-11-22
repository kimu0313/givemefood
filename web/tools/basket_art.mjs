// 재료 바구니 그림 (2026-11-22 사용자 그림 "따뜻한 질감의 빈 타원형 바구니", "바구니 이걸로 바꿔줘"):
//   art_src/basket.png (투명 바탕 1756×896) → 투명 여백을 자르고 폭 MAXW 로 줄여
//   public/assets/art/ui/basket_back.webp = 바구니 전체, basket_front.webp = 앞쪽 테두리(밧줄) + 앞면만 (같은 크기)
//   → 재료 가게가 뒤 그림 · 재료 그림 · 앞 그림 순서로 겹쳐 재료가 바구니 안에 담긴 것처럼 보이게.
// FRONT = 앞 테두리 밧줄 윗선 (원본 px, 먹선이 들어가게 몇 px 위). 이 선 아래가 앞 그림.
// 실행: node tools/basket_art.mjs
import { chromium } from "playwright-core";
import fs from "node:fs";

const SRC = "art_src/basket.png";
const MAXW = 460;
const FRONT = [
  [150, 300], [260, 330], [300, 372], [350, 400], [400, 418], [450, 432], [500, 442], [600, 457], [700, 470], [800, 476], [900, 482],
  [1000, 480], [1100, 471], [1200, 458], [1300, 436], [1400, 402], [1450, 378], [1480, 352], [1500, 322], [1530, 290], [1650, 280],
];

const b64 = fs.readFileSync(SRC).toString("base64");
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  const r = await page.evaluate(
    async ([b64, MAXW, FRONT]) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const W = img.naturalWidth, H = img.naturalHeight;
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, W, H).data;
      let x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++)
          if (d[(y * W + x) * 4 + 3] > 6) {
            x0 = Math.min(x0, x);
            x1 = Math.max(x1, x);
            y0 = Math.min(y0, y);
            y1 = Math.max(y1, y);
          }
      const w = x1 - x0 + 1, h = y1 - y0 + 1;
      const k = Math.min(1, MAXW / w);
      const ow = Math.round(w * k), oh = Math.round(h * k);
      const out = (front) => {
        const o = document.createElement("canvas");
        o.width = ow;
        o.height = oh;
        const g = o.getContext("2d");
        g.imageSmoothingQuality = "high";
        if (front) {
          // 앞 테두리 선 아래만 (선 위는 지움)
          g.beginPath();
          g.moveTo(0, oh);
          for (const [x, y] of FRONT) g.lineTo((x - x0) * k, (y - y0) * k);
          g.lineTo(ow, (FRONT[FRONT.length - 1][1] - y0) * k);
          g.lineTo(ow, oh);
          g.closePath();
          g.clip();
        }
        g.drawImage(c, x0, y0, w, h, 0, 0, ow, oh);
        return o.toDataURL("image/webp", 0.88);
      };
      return { w: ow, h: oh, back: out(false), front: out(true) };
    },
    [b64, MAXW, FRONT],
  );
  for (const n of ["back", "front"]) {
    const buf = Buffer.from(r[n].split(",")[1], "base64");
    fs.writeFileSync(`public/assets/art/ui/basket_${n}.webp`, buf);
    console.log(`basket_${n}.webp ${r.w}×${r.h} ${(buf.length / 1024) | 0}KB`);
  }
} finally {
  await browser.close();
}
