// 단색 배경 그림 → 배경 투명 (테두리에서 이어진 배경 + 안쪽에 갇힌 배경 구멍) + 바닥 그림자는 반투명 갈색으로
// + 여백 잘라 내기 + 줄여서 WebP/PNG 저장. 헤드리스 크롬 캔버스로 처리.
// node tools/cutout.mjs <입력.png> <출력 접두어> <최대 가로> [배경 거리 T=20] [가장자리 E=60] [구멍 평균 거리=11]
// 예: node tools/cutout.mjs art_src/map_bunsik.png public/assets/art/map/bunsik 900  → bunsik.webp (게임용) + .png + _preview.png (밝은/어두운 바탕 확인용, 지울 것)
import { chromium } from "playwright-core";
import fs from "node:fs";

const [inp, outPrefix, maxWStr, tStr, eStr, pStr] = process.argv.slice(2);
const opts = { maxW: Number(maxWStr ?? 1000), T: Number(tStr ?? 20), E: Number(eStr ?? 60), P: Number(pStr ?? 11) };
const b64 = fs.readFileSync(inp).toString("base64");
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const page = await browser.newPage();
const res = await page.evaluate(
  async ([b64, o]) => {
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
    const cs = [0, w - 1, (h - 1) * w, N - 1];
    const B = [0, 1, 2].map((k) => cs.reduce((a, i) => a + d[i * 4 + k], 0) / 4);
    const dist = (i) => Math.max(Math.abs(d[i * 4] - B[0]), Math.abs(d[i * 4 + 1] - B[1]), Math.abs(d[i * 4 + 2] - B[2]));
    const nb = (i, f) => {
      const x = i % w;
      if (x > 0) f(i - 1);
      if (x < w - 1) f(i + 1);
      if (i >= w) f(i - w);
      if (i < N - w) f(i + w);
    };
    // 0 = 그림, 1 = 배경, 2 = 그림자
    const kind = new Uint8Array(N);
    const st = [];
    for (let x = 0; x < w; x++) st.push(x, N - w + x);
    for (let y = 0; y < h; y++) st.push(y * w, y * w + w - 1);
    while (st.length) {
      const i = st.pop();
      if (kind[i] || dist(i) > o.T) continue;
      kind[i] = 1;
      nb(i, (j) => st.push(j));
    }
    // 안쪽에 갇힌 배경 구멍 (난간 사이, 관 사이): 배경색에 아주 가까운 덩어리만
    const seen = new Uint8Array(N);
    let holes = 0;
    for (let s = 0; s < N; s++) {
      if (kind[s] || seen[s] || dist(s) > o.T) continue;
      const comp = [];
      const q = [s];
      seen[s] = 1;
      let sum = 0;
      while (q.length) {
        const i = q.pop();
        comp.push(i);
        sum += dist(i);
        nb(i, (j) => {
          if (!kind[j] && !seen[j] && dist(j) <= o.T) {
            seen[j] = 1;
            q.push(j);
          }
        });
      }
      if (comp.length >= 20 && sum / comp.length <= o.P) {
        for (const i of comp) kind[i] = 1;
        holes++;
      }
    }
    // 바닥 그림자: 배경과 이어진, 배경을 고르게 어둡게 한 색 (채널 비율이 거의 같음)
    const ratio = (i) => [0, 1, 2].map((k) => d[i * 4 + k] / Math.max(1, B[k]));
    const shadowLike = (i) => {
      const r = ratio(i);
      const lo = Math.min(...r);
      const hi = Math.max(...r);
      // 따뜻한(갈색) 그림자도: 빨강 비율 ≥ 파랑 비율, 비율 차이 0.18 이하
      return lo >= 0.42 && hi <= 1.02 && hi - lo <= 0.18 && r[0] >= r[2] - 0.02;
    };
    for (let i = 0; i < N; i++) if (kind[i] === 1) nb(i, (j) => { if (kind[j] === 0 && shadowLike(j)) st.push(j); });
    let shadowN = 0;
    while (st.length) {
      const i = st.pop();
      if (kind[i] !== 0 || !shadowLike(i)) continue;
      kind[i] = 2;
      shadowN++;
      nb(i, (j) => st.push(j));
    }
    // 배경 옆 가장자리 띠(2칸): 배경과 섞인 만큼 반투명 + 배경색 빼기
    const near = new Uint8Array(N);
    for (let pass = 0; pass < 2; pass++) {
      const prev = near.slice();
      for (let i = 0; i < N; i++) {
        if (kind[i] || near[i]) continue;
        let hit = false;
        nb(i, (j) => { if (kind[j] === 1 || prev[j]) hit = true; });
        if (hit) near[i] = 1;
      }
    }
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let i = 0; i < N; i++) {
      if (kind[i] === 1) {
        d[i * 4 + 3] = 0;
        continue;
      }
      if (kind[i] === 2) {
        // 배경 위에 진한 갈색 CS 를 알파 a 로 깐 색이라고 보고 a 를 구한다 (밝기 기준)
        const CS = [45, 30, 20];
        const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
        const lb = lum(B[0], B[1], B[2]);
        const a = Math.max(0, Math.min(1, (lb - lum(d[i * 4], d[i * 4 + 1], d[i * 4 + 2])) / (lb - lum(CS[0], CS[1], CS[2]))));
        d[i * 4] = CS[0]; d[i * 4 + 1] = CS[1]; d[i * 4 + 2] = CS[2];
        d[i * 4 + 3] = Math.round(255 * a);
      } else if (near[i]) {
        const m = dist(i);
        if (m < o.E) {
          const a = m / o.E;
          d[i * 4 + 3] = Math.round(255 * a);
          if (a > 0) for (let k = 0; k < 3; k++) d[i * 4 + k] = Math.max(0, Math.min(255, Math.round(B[k] + (d[i * 4 + k] - B[k]) / a)));
        }
      }
      if (d[i * 4 + 3] > 8) {
        const x = i % w;
        const y = (i - x) / w;
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
    }
    ctx.putImageData(id, 0, 0);
    const pad = 4;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
    const cw = x1 - x0 + 1;
    const ch = y1 - y0 + 1;
    const k = Math.min(1, o.maxW / cw);
    const ow = Math.round(cw * k);
    const oh = Math.round(ch * k);
    const out = document.createElement("canvas");
    out.width = ow;
    out.height = oh;
    const octx = out.getContext("2d");
    octx.imageSmoothingQuality = "high";
    octx.drawImage(c, x0, y0, cw, ch, 0, 0, ow, oh);
    const pv = document.createElement("canvas");
    pv.width = ow * 2;
    pv.height = oh;
    const pctx = pv.getContext("2d");
    pctx.fillStyle = "#c8b49a";
    pctx.fillRect(0, 0, ow, oh);
    pctx.fillStyle = "#2b2e3b";
    pctx.fillRect(ow, 0, ow, oh);
    pctx.drawImage(out, 0, 0);
    pctx.drawImage(out, ow, 0);
    return {
      w, h, B, holes, shadowN, crop: [x0, y0, cw, ch], out: [ow, oh],
      webp: out.toDataURL("image/webp", 0.9),
      png: out.toDataURL("image/png"),
      preview: pv.toDataURL("image/png"),
    };
  },
  [b64, opts],
);
await browser.close();
const save = (url, file) => fs.writeFileSync(file, Buffer.from(url.split(",")[1], "base64"));
save(res.webp, outPrefix + ".webp");
save(res.png, outPrefix + ".png");
save(res.preview, outPrefix + "_preview.png");
console.log(JSON.stringify({ size: [res.w, res.h], bg: res.B, holes: res.holes, shadowPixels: res.shadowN, crop: res.crop, out: res.out }));
for (const ext of [".webp", ".png"]) console.log(ext, fs.statSync(outPrefix + ext).size);
