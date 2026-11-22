// 투명 바탕 그림 한 장 → 투명 여백을 잘라 내고 (최대 폭 maxW 로 줄여) WebP:
//   node tools/trim_webp.mjs <원본.png> <저장.webp> [maxW, 기본 그대로] [품질 0~1, 기본 0.9]
// 예) 마법의 가루 병: node tools/trim_webp.mjs art_src/powder_jar.png public/assets/art/ui/powder.webp 420
import { chromium } from "playwright-core";
import fs from "node:fs";

const [src, dst, maxW = "0", q = "0.9"] = process.argv.slice(2);
if (!src || !dst) throw new Error("사용법: node tools/trim_webp.mjs <원본.png> <저장.webp> [maxW] [품질]");
const b64 = fs.readFileSync(src).toString("base64");
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  const r = await page.evaluate(
    async ([b64, maxW, q]) => {
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
      const k = maxW > 0 && w > maxW ? maxW / w : 1;
      const o = document.createElement("canvas");
      o.width = Math.round(w * k);
      o.height = Math.round(h * k);
      const og = o.getContext("2d");
      og.imageSmoothingQuality = "high";
      og.drawImage(c, x0, y0, w, h, 0, 0, o.width, o.height);
      return { w: o.width, h: o.height, box: [x0, y0, w, h], url: o.toDataURL("image/webp", q) };
    },
    [b64, Number(maxW), Number(q)],
  );
  const buf = Buffer.from(r.url.split(",")[1], "base64");
  fs.writeFileSync(dst, buf);
  console.log(`${dst} ${r.w}×${r.h} (${(buf.length / 1024) | 0}KB), 원본 [${r.box.join(", ")}]`);
} finally {
  await browser.close();
}
