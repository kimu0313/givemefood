// 회색(푸른 기 도는) 얼룩 배경 위에 그린 UI 그림 → 배경 투명 + 여백 잘라 WebP.
// (2026-11-16 사용자가 준 로그인 버튼·로그인 창 그림: 배경이 무늬 있는 회색이라 tools/cutout.mjs 의 단색 기준으로는 안 잘림)
// 배경 = 테두리에서 이어진, 밝기 45~125 이고 파랑 ≥ 빨강 인 회색 픽셀. 그 다음 가장 큰 덩어리(그림)만 남기고
// (배경에 남은 어두운 얼룩 제거), 가장자리 한 줄은 반투명으로 부드럽게.
// node tools/cutout_slate.mjs <입력.png> <출력.webp>  → 잘라 낸 크기와 원본에서의 왼쪽 위 위치를 출력
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const [inp, out] = process.argv.slice(2);
const b64 = fs.readFileSync(inp).toString("base64");
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  const r = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const N = w * h;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const id = ctx.getImageData(0, 0, w, h);
    const d = id.data;
    const isBg = (i) => {
      const R = d[i * 4], G = d[i * 4 + 1], B = d[i * 4 + 2];
      const lum = (R + G + B) / 3;
      return lum >= 45 && lum <= 125 && B - R >= -3 && R - G <= 14;
    };
    const bg = new Uint8Array(N);
    const st = [];
    for (let x = 0; x < w; x++) st.push(x, N - w + x);
    for (let y = 0; y < h; y++) st.push(y * w, y * w + w - 1);
    while (st.length) {
      const i = st.pop();
      if (bg[i] || !isBg(i)) continue;
      bg[i] = 1;
      const x = i % w;
      if (x > 0) st.push(i - 1);
      if (x < w - 1) st.push(i + 1);
      if (i >= w) st.push(i - w);
      if (i < N - w) st.push(i + w);
    }
    // 남은 덩어리 중 가장 큰 것만 그림 (배경의 어두운 얼룩·티끌 제거)
    const comp = new Int32Array(N).fill(-1);
    let best = -1, bestN = 0, k = 0;
    const sizes = [];
    for (let s = 0; s < N; s++) {
      if (bg[s] || comp[s] >= 0) continue;
      let n = 0;
      const q = [s];
      comp[s] = k;
      while (q.length) {
        const i = q.pop();
        n++;
        const x = i % w;
        const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < N - w ? i + w : -1];
        for (const j of nb) if (j >= 0 && !bg[j] && comp[j] < 0) {
          comp[j] = k;
          q.push(j);
        }
      }
      sizes.push(n);
      if (n > bestN) {
        bestN = n;
        best = k;
      }
      k++;
    }
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let i = 0; i < N; i++) {
      const keep = comp[i] === best;
      if (!keep) {
        d[i * 4 + 3] = 0;
        continue;
      }
      const x = i % w, y = (i / w) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      // 배경과 맞닿은 가장자리는 반투명
      const edge = (x > 0 && comp[i - 1] !== best) || (x < w - 1 && comp[i + 1] !== best) || (i >= w && comp[i - w] !== best) || (i < N - w && comp[i + w] !== best);
      if (edge) d[i * 4 + 3] = 150;
    }
    ctx.putImageData(id, 0, 0);
    const o = document.createElement("canvas");
    o.width = x1 - x0 + 1;
    o.height = y1 - y0 + 1;
    o.getContext("2d").drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
    return { x0, y0, w: o.width, h: o.height, webp: o.toDataURL("image/webp", 0.92), png: o.toDataURL("image/png"), parts: sizes.length };
  }, b64);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(r.webp.split(",")[1], "base64"));
  fs.writeFileSync(out.replace(/\.webp$/, "_check.png"), Buffer.from(r.png.split(",")[1], "base64"));
  console.log(`${out}: ${r.w}×${r.h}, 원본에서 (${r.x0}, ${r.y0}) 부터 (덩어리 ${r.parts}개 중 가장 큰 것)`);
} finally {
  await browser.close();
}
