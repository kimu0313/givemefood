// 손님 그림 여러 명이 흰 바탕(또는 투명 바탕)에 나란히 있는 그림 → 한 명씩 오려 380×640 투명 PNG (public/assets/art/customers/guest_<이름>.png)
// (2026-11-17 사용자 "손님들로 넣어 줘": art_src/customers/*.png)
//  1) 배경 = 테두리에서 이어진 거의 흰 픽셀 (흰 셔츠는 크림색이라 남음)
//  2) 사람 가운데 x: 세로줄 그림 픽셀 수로 빈 줄 사이 구간 → 구간 가운데 (붙어 있으면 가장 넓은 구간을 가장 빈 줄에서 자름).
//     --centers 190,470 처럼 직접 줄 수도 있음 (그림 끝에 잘린 사람이 붙어 있을 때)
//  3) 이웃한 두 사람 사이(그리고 그림 왼쪽·오른쪽 끝과 첫·마지막 사람 사이)를 위에서 아래로 잇는 가르는 선:
//     배경 0 · 먹선 2 · 그림 10 의 비용이 가장 작은 길 (seam) → 사람끼리 붙어 있으면 먹선을 따라 갈림
//  4) 두 선 사이 그림 = 그 사람 (가장 큰 덩어리 + 그 안 작은 조각), 안에 갇힌 새하얀 틈(머리카락 사이 배경)은 투명으로
//  5) 380×640 칸에 가로 가운데·위에 맞춰 넣음 (얼굴 크기는 게임이 ArtAssets.SPRITE_FACES 로 맞춤 — 얼굴을 재서 적기)
//  6) 하얀 테두리 지우기 (tools/sprite_defringe.mjs — 흰 바탕과 섞인 밝은 가장자리를 깎고 먹색 테두리로)
// 실행: node tools/customer_sheet.mjs <그림.png> <이름1,이름2,...> [확인용 미리보기.png] [--centers x1,x2,...]
//       한 사람만 있는 그림도 같은 방법 (이름 하나)
import { chromium } from "playwright-core";
import fs from "node:fs";
import { defringeInPage } from "./sprite_defringe.mjs";

const args = process.argv.slice(2);
const ci = args.indexOf("--centers");
const centersArg = ci >= 0 ? args.splice(ci, 2)[1].split(",").map(Number) : null;
const [src, namesArg, preview] = args;
const names = namesArg.split(",");
const b64 = fs.readFileSync(src).toString("base64");
const mime = src.toLowerCase().endsWith(".jpg") || src.toLowerCase().endsWith(".jpeg") ? "image/jpeg" : src.toLowerCase().endsWith(".webp") ? "image/webp" : "image/png";
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  const r = await page.evaluate(
    async ([b64, mime, count, centersArg]) => {
      const img = new Image();
      img.src = `data:${mime};base64,` + b64;
      await img.decode();
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const N = w * h;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, w, h).data;
      const minC = (i) => Math.min(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
      const sat = (i) => Math.max(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) - minC(i);
      // 투명 바탕 그림 (2026-11-17 미식가 그림)은 알파가 낮은 곳이 배경
      const clear = (i) => d[i * 4 + 3] < 128;
      const isBg = (i) => clear(i) || (minC(i) >= 238 && sat(i) <= 14);
      const lum = (i) => (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3;

      // 1) 배경
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

      // 2) 사람 가운데
      let centers = centersArg;
      if (centers === null) {
        const colN = new Int32Array(w);
        const yLim = Math.floor(h * 0.85);
        for (let y = 0; y < yLim; y++) for (let x = 0; x < w; x++) if (!bg[y * w + x]) colN[x]++;
        let segs = [];
        for (let x = 0; x < w; ) {
          if (colN[x] <= 2) {
            x++;
            continue;
          }
          const x0 = x;
          while (x < w && colN[x] > 2) x++;
          segs.push([x0, x - 1]);
        }
        segs = segs.filter(([x0, x1]) => x1 - x0 > w * 0.04 && !((x0 === 0 || x1 === w - 1) && x1 - x0 < w * 0.12 && count > 1));
        while (segs.length < count && segs.length > 0) {
          let wi = 0;
          segs.forEach((sg, i) => {
            if (sg[1] - sg[0] > segs[wi][1] - segs[wi][0]) wi = i;
          });
          const [x0, x1] = segs[wi];
          let best = x0 + ((x1 - x0) >> 1);
          for (let x = x0 + Math.floor((x1 - x0) * 0.25); x <= x0 + Math.floor((x1 - x0) * 0.75); x++) if (colN[x] < colN[best]) best = x;
          segs.splice(wi, 1, [x0, best], [best + 1, x1]);
        }
        centers = segs.slice(0, count).map(([x0, x1]) => (x0 + x1) >> 1);
      }

      // 3) 가르는 선 (seam): x 범위 [lo, hi] 안에서 위→아래 비용이 가장 작은 길. 반환 = 줄마다 x
      const cost = (i) => (bg[i] ? 0 : lum(i) < 90 ? 2 : 10);
      const seam = (lo, hi) => {
        lo = Math.max(0, Math.floor(lo));
        hi = Math.min(w - 1, Math.ceil(hi));
        if (hi <= lo) return new Int32Array(h).fill(lo);
        const W = hi - lo + 1;
        const acc = new Float32Array(W * h);
        const from = new Int8Array(W * h);
        for (let x = 0; x < W; x++) acc[x] = cost(lo + x);
        for (let y = 1; y < h; y++)
          for (let x = 0; x < W; x++) {
            let best = acc[(y - 1) * W + x];
            let dir = 0;
            if (x > 0 && acc[(y - 1) * W + x - 1] < best) {
              best = acc[(y - 1) * W + x - 1];
              dir = -1;
            }
            if (x < W - 1 && acc[(y - 1) * W + x + 1] < best) {
              best = acc[(y - 1) * W + x + 1];
              dir = 1;
            }
            acc[y * W + x] = best + cost(y * w + lo + x);
            from[y * W + x] = dir;
          }
        let bx = 0;
        for (let x = 1; x < W; x++) if (acc[(h - 1) * W + x] < acc[(h - 1) * W + bx]) bx = x;
        const path = new Int32Array(h);
        for (let y = h - 1; y >= 0; y--) {
          path[y] = lo + bx;
          bx += from[y * W + bx];
        }
        return path;
      };
      const n = centers.length;
      const seams = [];
      const gap = (a, b) => (b - a) * 0.22;
      seams.push(centers[0] - 70 > 2 ? seam(1, centers[0] - 70) : new Int32Array(h).fill(-1));
      for (let k = 1; k < n; k++) seams.push(seam(centers[k - 1] + gap(centers[k - 1], centers[k]), centers[k] - gap(centers[k - 1], centers[k])));
      seams.push(centers[n - 1] + 70 < w - 3 ? seam(centers[n - 1] + 70, w - 2) : new Int32Array(h).fill(w));

      const out = [];
      for (let p = 0; p < n; p++) {
        const L = seams[p];
        const R = seams[p + 1];
        const inP = (i) => {
          const x = i % w;
          const y = (i / w) | 0;
          return x > L[y] && x < R[y] && !bg[i] && !clear(i); // 안에 갇힌 투명 틈도 빼고
        };
        // 4) 덩어리
        const comp = new Int32Array(N).fill(-1);
        const blobs = [];
        for (let i0 = 0; i0 < N; i0++) {
          if (comp[i0] >= 0 || !inP(i0)) continue;
          const k = blobs.length;
          let cnt = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
          const q = [i0];
          comp[i0] = k;
          while (q.length) {
            const i = q.pop();
            cnt++;
            const x = i % w;
            const y = (i / w) | 0;
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
            for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < N - w ? i + w : -1]) {
              if (j >= 0 && comp[j] < 0 && inP(j)) {
                comp[j] = k;
                q.push(j);
              }
            }
          }
          blobs.push({ k, cnt, x0, y0, x1, y1 });
        }
        blobs.sort((a, b) => b.cnt - a.cnt);
        const main = blobs[0];
        const keep = new Set([main.k]);
        for (const o of blobs.slice(1)) if (o.x0 >= main.x0 - 4 && o.x1 <= main.x1 + 4 && o.y0 >= main.y0 - 4 && o.y1 <= main.y1 + 4) keep.add(o.k);
        const on = new Uint8Array(N);
        for (let i = 0; i < N; i++) if (comp[i] >= 0 && keep.has(comp[i])) on[i] = 1;
        // 갇힌 새하얀 틈 (머리카락 사이로 보이는 배경): 거의 흰 픽셀 덩어리 중 크고(250px 이상) 대부분 새하얀 것
        const seen = new Uint8Array(N);
        const whiteish = (i) => minC(i) >= 236 && sat(i) <= 16;
        for (let y = main.y0; y <= main.y1; y++)
          for (let x = main.x0; x <= main.x1; x++) {
            const i0 = y * w + x;
            if (!on[i0] || seen[i0] || !whiteish(i0)) continue;
            const reg = [];
            const q = [i0];
            seen[i0] = 1;
            while (q.length) {
              const i = q.pop();
              reg.push(i);
              const xx = i % w;
              for (const j of [xx > 0 ? i - 1 : -1, xx < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < N - w ? i + w : -1]) {
                if (j >= 0 && on[j] && !seen[j] && whiteish(j)) {
                  seen[j] = 1;
                  q.push(j);
                }
              }
            }
            const white = reg.filter((i) => minC(i) >= 246).length;
            if (reg.length >= 250 && white >= reg.length * 0.85) for (const i of reg) on[i] = 0;
          }
        // 5) 오려서 칸에
        const bw = main.x1 - main.x0 + 1;
        const bh = main.y1 - main.y0 + 1;
        const cut = document.createElement("canvas");
        cut.width = bw;
        cut.height = bh;
        const cc = cut.getContext("2d");
        const cd = cc.createImageData(bw, bh);
        for (let y = 0; y < bh; y++)
          for (let x = 0; x < bw; x++) {
            const i = (main.y0 + y) * w + main.x0 + x;
            if (!on[i]) continue;
            const o = (y * bw + x) * 4;
            for (let ch = 0; ch < 3; ch++) cd.data[o + ch] = d[i * 4 + ch];
            const xx = i % w;
            const edge = (xx > 0 && !on[i - 1]) || (xx < w - 1 && !on[i + 1]) || (i >= w && !on[i - w]) || (i < N - w && !on[i + w]);
            cd.data[o + 3] = edge ? 150 : 255;
          }
        cc.putImageData(cd, 0, 0);
        const s = Math.min(380 / bw, 640 / bh, 1.35);
        const o = document.createElement("canvas");
        o.width = 380;
        o.height = 640;
        const oc = o.getContext("2d");
        oc.imageSmoothingQuality = "high";
        oc.drawImage(cut, (380 - bw * s) * 0.5, 6, bw * s, bh * s);
        out.push({ png: o.toDataURL("image/png"), box: [main.x0, main.y0, bw, bh], s });
      }
      return { out, centers };
    },
    [b64, mime, names.length, centersArg],
  );
  console.log("사람 가운데 x:", r.centers.join(", "));
  for (const o of r.out) o.png = (await page.evaluate(defringeInPage, o.png)).png;
  r.out.forEach((o, i) => {
    const file = `public/assets/art/customers/guest_${names[i]}.png`;
    fs.writeFileSync(file, Buffer.from(o.png.split(",")[1], "base64"));
    console.log(`${file}  원본 ${o.box.join(",")}  배율 ${o.s.toFixed(2)}`);
  });
  if (preview) {
    // 미리보기: 오린 그림들을 격자(20px, 100px 마다 빨강)와 함께 나란히 (얼굴 재기용)
    const pv = await page.evaluate(async (pngs) => {
      const c = document.createElement("canvas");
      c.width = 380 * pngs.length;
      c.height = 640;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#cfd6e6";
      ctx.fillRect(0, 0, c.width, c.height);
      for (let i = 0; i < pngs.length; i++) {
        const im = new Image();
        im.src = pngs[i];
        await im.decode();
        ctx.drawImage(im, i * 380, 0);
        for (let x = 0; x <= 380; x += 20) {
          ctx.strokeStyle = x % 100 === 0 ? "rgba(255,0,0,0.7)" : "rgba(0,0,255,0.18)";
          ctx.beginPath();
          ctx.moveTo(i * 380 + x, 0);
          ctx.lineTo(i * 380 + x, 640);
          ctx.stroke();
        }
        for (let y = 0; y <= 640; y += 20) {
          ctx.strokeStyle = y % 100 === 0 ? "rgba(255,0,0,0.7)" : "rgba(0,0,255,0.18)";
          ctx.beginPath();
          ctx.moveTo(i * 380, y);
          ctx.lineTo(i * 380 + 380, y);
          ctx.stroke();
        }
      }
      return c.toDataURL("image/png");
    }, r.out.map((o) => o.png));
    fs.writeFileSync(preview, Buffer.from(pv.split(",")[1], "base64"));
  }
} finally {
  await browser.close();
}
