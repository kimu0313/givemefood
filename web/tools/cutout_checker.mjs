// 체크무늬(투명 표시 무늬)나 밝은 단색 바탕이 그림에 박혀 있는 그림 → 바탕 투명 + 여백 잘라 WebP
// (2026-11-20 사용자가 준 지도 가게 건물 그림 01·02·05 는 흰색·옅은 회색 체크무늬가, 04 는 옅은 미색 바탕이 그림에 박혀 있음.
//  tools/cutout.mjs 는 단색 바탕 기준이라 체크무늬가 안 지워짐)
//  1) 바탕 후보 = 색이 거의 없고(최대-최소 ≤ 12) 밝은(가장 어두운 채널 ≥ 205) 픽셀
//  2) 그림 테두리에서 이어진 바탕 후보 = 바탕
//  3) 그림 안에 갇힌 바탕 후보 덩어리 (의자 다리 사이 등): 흰 칸(≥ 246)과 회색 칸(≤ 240)이 둘 다 15% 넘게 섞여 있으면 체크무늬 = 바탕.
//     단색 바탕 그림은 테두리 바탕 평균색과 거의 같은(≤ 8) 큰 덩어리(≥ 300px)만 바탕
//  4) 바탕과 맞닿은 밝고 색이 옅은 가장자리(먹선과 바탕이 섞인 픽셀)를 2번 깎음
//  5) 여백 잘라 가로 최대 maxW 로 줄여 저장 + 밝은/어두운 바탕 미리보기(<출력>_preview.png, 확인 뒤 지울 것)
// 실행: node tools/cutout_checker.mjs <입력.png> <출력 접두어> [가로 최대 1000]
//   예) node tools/cutout_checker.mjs art_src/map_pocha.png public/assets/art/map/pocha 1000
import { chromium } from "playwright-core";
import fs from "node:fs";

const [inp, outPrefix, maxWStr] = process.argv.slice(2);
if (!inp || !outPrefix) throw new Error("사용법: node tools/cutout_checker.mjs <입력.png> <출력 접두어> [가로 최대]");
const maxW = Number(maxWStr ?? 1000);
const b64 = fs.readFileSync(inp).toString("base64");
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  const r = await page.evaluate(
    async ([b64, maxW]) => {
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
      const mn = (i) => Math.min(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
      const mx = (i) => Math.max(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
      const like = new Uint8Array(N);
      for (let i = 0; i < N; i++) like[i] = mx(i) - mn(i) <= 12 && mn(i) >= 205 ? 1 : 0;
      const bg = new Uint8Array(N);
      const flood = (starts, ok) => {
        const st = [...starts];
        while (st.length) {
          const i = st.pop();
          if (bg[i] || !ok(i)) continue;
          bg[i] = 1;
          const x = i % w;
          if (x > 0) st.push(i - 1);
          if (x < w - 1) st.push(i + 1);
          if (i >= w) st.push(i - w);
          if (i < N - w) st.push(i + w);
        }
      };
      const border = [];
      for (let x = 0; x < w; x++) border.push(x, N - w + x);
      for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1);
      flood(border, (i) => like[i] === 1);
      // 테두리 바탕 평균색 (단색 바탕 판단용)
      const avg = [0, 0, 0];
      let nb = 0;
      for (let i = 0; i < N; i += 7) if (bg[i]) { for (let k = 0; k < 3; k++) avg[k] += d[i * 4 + k]; nb++; }
      for (let k = 0; k < 3; k++) avg[k] /= Math.max(1, nb);
      // 테두리 바탕 안에 흰·회색이 둘 다 많으면 체크무늬
      let wN = 0, gN = 0;
      for (let i = 0; i < N; i += 7) if (bg[i]) { if (mn(i) >= 246) wN++; else if (mn(i) <= 240) gN++; }
      const checker = wN > nb * 0.15 && gN > nb * 0.15;
      // 갇힌 바탕 후보 덩어리
      const seen = new Uint8Array(N);
      let holes = 0;
      for (let s = 0; s < N; s++) {
        if (!like[s] || bg[s] || seen[s]) continue;
        const comp = [];
        const st = [s];
        seen[s] = 1;
        while (st.length) {
          const i = st.pop();
          comp.push(i);
          const x = i % w;
          for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
            if (j < 0 || j >= N || seen[j] || !like[j] || bg[j]) continue;
            seen[j] = 1;
            st.push(j);
          }
        }
        let isBg = false;
        if (checker) {
          if (comp.length >= 60) {
            let cw = 0, cg = 0;
            for (const i of comp) { if (mn(i) >= 246) cw++; else if (mn(i) <= 240) cg++; }
            isBg = cw > comp.length * 0.15 && cg > comp.length * 0.15;
          }
        } else if (comp.length >= 300) {
          const m = [0, 0, 0];
          for (const i of comp) for (let k = 0; k < 3; k++) m[k] += d[i * 4 + k] / comp.length;
          isBg = Math.max(...m.map((v, k) => Math.abs(v - avg[k]))) <= 8;
        }
        if (isBg) { for (const i of comp) bg[i] = 1; holes++; }
      }
      // 가장자리 깎기
      for (let p = 0; p < 2; p++) {
        const kill = [];
        for (let i = 0; i < N; i++) {
          if (bg[i] || mn(i) < 185 || mx(i) - mn(i) > 24) continue;
          const x = i % w;
          if ((x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (i >= w && bg[i - w]) || (i < N - w && bg[i + w])) kill.push(i);
        }
        for (const i of kill) bg[i] = 1;
      }
      let x0 = w, y0 = h, x1 = 0, y1 = 0;
      for (let i = 0; i < N; i++) {
        if (bg[i]) { d[i * 4 + 3] = 0; continue; }
        const x = i % w, y = (i / w) | 0;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      ctx.putImageData(id, 0, 0);
      const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
      const k = Math.min(1, maxW / cw);
      const ow = Math.round(cw * k), oh = Math.round(ch * k);
      const o = document.createElement("canvas");
      o.width = ow;
      o.height = oh;
      const octx = o.getContext("2d");
      octx.imageSmoothingQuality = "high";
      octx.drawImage(c, x0, y0, cw, ch, 0, 0, ow, oh);
      const p = document.createElement("canvas");
      p.width = ow * 2 + 20;
      p.height = oh;
      const pctx = p.getContext("2d");
      pctx.fillStyle = "#d8cfc0";
      pctx.fillRect(0, 0, ow, oh);
      pctx.fillStyle = "#2b2f45";
      pctx.fillRect(ow + 20, 0, ow, oh);
      pctx.drawImage(o, 0, 0);
      pctx.drawImage(o, ow + 20, 0);
      return { webp: o.toDataURL("image/webp", 0.9), preview: p.toDataURL("image/png"), w: ow, h: oh, crop: [x0, y0, cw, ch], checker, holes };
    },
    [b64, maxW],
  );
  fs.writeFileSync(`${outPrefix}.webp`, Buffer.from(r.webp.split(",")[1], "base64"));
  fs.writeFileSync(`${outPrefix}_preview.png`, Buffer.from(r.preview.split(",")[1], "base64"));
  console.log(`${outPrefix}.webp ${r.w}×${r.h} (원본에서 ${r.crop.join(",")} 잘라 냄, ${r.checker ? "체크무늬" : "단색"} 바탕, 갇힌 바탕 ${r.holes}곳)`);
} finally {
  await browser.close();
}
