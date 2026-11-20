// 그림 한 장을 그대로 WebP 로 (크기 그대로): node tools/to_webp.mjs <원본.png> <저장.webp> [품질 0~1, 기본 0.9]
// 예) 메인 화면 그림: node tools/to_webp.mjs art_src/title_menu.png public/assets/art/title/menu.webp
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const [src, dst, q = "0.9"] = process.argv.slice(2);
if (!src || !dst) throw new Error("사용법: node tools/to_webp.mjs <원본> <저장.webp> [품질]");
const b64 = fs.readFileSync(src).toString("base64");
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  const r = await page.evaluate(
    async ([b64, q]) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0);
      return { w: c.width, h: c.height, data: c.toDataURL("image/webp", q) };
    },
    [b64, +q],
  );
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  const buf = Buffer.from(r.data.split(",")[1], "base64");
  fs.writeFileSync(dst, buf);
  console.log(`${dst} (${r.w}×${r.h}, ${(buf.length / 1024) | 0}KB)`);
} finally {
  await browser.close();
}
