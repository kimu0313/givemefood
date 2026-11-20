// "새로 시작" 확인 창 그림 (2026-11-17 사용자 그림 "게임 시작 눌렀을 때 UI 스타일 이렇게"):
//   art_src/ui_newgame_dialog.png (어두운 장면 위 양피지 창 + 빨간 리본 "새로 시작" + 이어하기·처음부터·취소 버튼)
//   → 배경을 오려 내고 본문 글씨 세 줄(기록이 그때그때 달라서)을 양피지로 지워 public/assets/art/ui/dialog_newgame.webp
//   리본·버튼 글씨는 그림 그대로 (한국어), 다른 언어면 ui/title.ts 가 같은 색 판으로 덮고 번역 글씨.
// 오려 내기: 테두리에서 이어진 "양피지도 빨강도 아닌" 픽셀 = 배경 → 그림 가장자리에 닿지 않는 큰 덩어리(창·리본)만 → 닫힘(가는 먹선 틈 메움) + 구멍 메움
//   → 바깥 6px 띠는 원본을 어둡게 해서 먹 테두리로 (원래 먹선이 얇은 곳도 고르게).
// 실행: node tools/dialog_art.mjs → 잘라 낸 크기·원본에서의 왼쪽 위 + 버튼·리본 자리(잘라 낸 그림 기준)를 출력
import { chromium } from "playwright-core";
import fs from "node:fs";

const SRC = "art_src/ui_newgame_dialog.png";
const OUT = "public/assets/art/ui/dialog_newgame.webp";
// 지울 본문 글씨 (원본 픽셀 [x0, y0, x1, y1]) — 밑줄 붓자국은 남김
const ERASE = [
  [215, 232, 1360, 392],
  [405, 424, 1185, 484],
];

const b64 = fs.readFileSync(SRC).toString("base64");
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  const r = await page.evaluate(
    async ([b64, ERASE]) => {
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
      const lum = (i) => (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3;
      const red = (i) => d[i * 4] > 90 && d[i * 4] - d[i * 4 + 1] > 50;
      const isBg = (i) => lum(i) < 140 && !red(i);

      // 1) 배경 채우기
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
      // 2) 덩어리 나누기: 가장 큰 것(창)에서 시작해 14px 안에 붙은 덩어리(리본·리본 꼬리 — 사이 먹선이 배경으로 먹혀 떨어짐)를
      //    차례로 붙인다. 그림 가장자리에 닿는 덩어리(뒤 천막 등)·자잘한 점은 버림
      const comp = new Int32Array(N).fill(-1);
      const sizes = [];
      const edges = [];
      let k = 0;
      for (let s = 0; s < N; s++) {
        if (bg[s] || comp[s] >= 0) continue;
        let n = 0;
        let edge = false;
        const q = [s];
        comp[s] = k;
        while (q.length) {
          const i = q.pop();
          n++;
          const x = i % w;
          if (x === 0 || x === w - 1 || i < w || i >= N - w) edge = true;
          for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < N - w ? i + w : -1]) {
            if (j >= 0 && !bg[j] && comp[j] < 0) {
              comp[j] = k;
              q.push(j);
            }
          }
        }
        sizes.push(n);
        edges.push(edge);
        k++;
      }
      // 거리 (체임퍼 3-4, /3 ≈ 픽셀): 0 = 안
      const dist = (M) => {
        const D = new Float32Array(N);
        for (let i = 0; i < N; i++) D[i] = M[i] ? 0 : 1e9;
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            const i = y * w + x;
            if (D[i] === 0) continue;
            let v = D[i];
            if (x > 0) v = Math.min(v, D[i - 1] + 3);
            if (y > 0) {
              v = Math.min(v, D[i - w] + 3);
              if (x > 0) v = Math.min(v, D[i - w - 1] + 4);
              if (x < w - 1) v = Math.min(v, D[i - w + 1] + 4);
            }
            D[i] = v;
          }
        for (let y = h - 1; y >= 0; y--)
          for (let x = w - 1; x >= 0; x--) {
            const i = y * w + x;
            if (D[i] === 0) continue;
            let v = D[i];
            if (x < w - 1) v = Math.min(v, D[i + 1] + 3);
            if (y < h - 1) {
              v = Math.min(v, D[i + w] + 3);
              if (x < w - 1) v = Math.min(v, D[i + w + 1] + 4);
              if (x > 0) v = Math.min(v, D[i + w - 1] + 4);
            }
            D[i] = v;
          }
        for (let i = 0; i < N; i++) D[i] /= 3;
        return D;
      };
      const keep = new Set([sizes.indexOf(Math.max(...sizes))]);
      let K = new Uint8Array(N);
      for (let round = 0; round < 4; round++) {
        for (let i = 0; i < N; i++) K[i] = keep.has(comp[i]) ? 1 : 0;
        const dk = dist(K);
        let added = false;
        for (let i = 0; i < N; i++) {
          const c = comp[i];
          if (c < 0 || keep.has(c) || edges[c] || sizes[c] < 1500 || dk[i] > 14) continue;
          keep.add(c);
          added = true;
        }
        if (!added) break;
      }
      for (let i = 0; i < N; i++) K[i] = keep.has(comp[i]) ? 1 : 0;
      // 3) 닫힘 (r 9): 먹선이 배경 쪽으로 먹혀 생긴 가는 틈을 메움
      const R = 9;
      const dOut = dist(K);
      const grown = new Uint8Array(N);
      for (let i = 0; i < N; i++) grown[i] = dOut[i] <= R ? 1 : 0;
      const inv = new Uint8Array(N);
      for (let i = 0; i < N; i++) inv[i] = grown[i] ? 0 : 1;
      const dIn = dist(inv);
      for (let i = 0; i < N; i++) K[i] = grown[i] && dIn[i] > R ? 1 : 0;
      // 4) 구멍 메움: 테두리에서 닿지 않는 바깥 = 안
      const out = new Uint8Array(N);
      for (let x = 0; x < w; x++) st.push(x, N - w + x);
      for (let y = 0; y < h; y++) st.push(y * w, y * w + w - 1);
      while (st.length) {
        const i = st.pop();
        if (out[i] || K[i]) continue;
        out[i] = 1;
        const x = i % w;
        if (x > 0) st.push(i - 1);
        if (x < w - 1) st.push(i + 1);
        if (i >= w) st.push(i - w);
        if (i < N - w) st.push(i + w);
      }
      for (let i = 0; i < N; i++) if (!out[i]) K[i] = 1;

      // 5) 본문 글씨 지우기: 글씨(어두운 픽셀 + 2px)를 둘레 양피지에서 번져 채움 + 고운 결
      const hole = new Uint8Array(N);
      for (const [x0, y0, x1, y1] of ERASE) {
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (lum(y * w + x) < 196) hole[y * w + x] = 1;
      }
      const dh = dist(hole);
      for (const [x0, y0, x1, y1] of ERASE) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (dh[y * w + x] <= 2.5) hole[y * w + x] = 1;
      const list = [];
      for (let i = 0; i < N; i++) if (hole[i]) list.push(i);
      // 처음 값: 같은 줄에서 가장 가까운 안 지운 픽셀
      const col = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) for (let ch = 0; ch < 3; ch++) col[i * 3 + ch] = d[i * 4 + ch];
      for (const i of list) {
        const y = (i / w) | 0;
        let x = i % w, l = x, rr = x;
        while (l > 0 && hole[y * w + l]) l--;
        while (rr < w - 1 && hole[y * w + rr]) rr++;
        const j = x - l < rr - x ? y * w + l : y * w + rr;
        for (let ch = 0; ch < 3; ch++) col[i * 3 + ch] = d[j * 4 + ch];
      }
      for (let it = 0; it < 260; it++) {
        for (const i of list) {
          for (let ch = 0; ch < 3; ch++) col[i * 3 + ch] = (col[(i - 1) * 3 + ch] + col[(i + 1) * 3 + ch] + col[(i - w) * 3 + ch] + col[(i + w) * 3 + ch]) * 0.25;
        }
      }
      let seed = 7;
      const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) - 0.5;
      for (const i of list) {
        const n = rnd() * 7;
        for (let ch = 0; ch < 3; ch++) d[i * 4 + ch] = Math.max(0, Math.min(255, col[i * 3 + ch] + n));
      }

      // 6) 알파 + 먹 테두리 띠
      const dK = dist(K);
      let x0 = w, y0 = h, x1 = 0, y1 = 0;
      for (let i = 0; i < N; i++) {
        const dd = dK[i];
        if (dd > 6.5) {
          d[i * 4 + 3] = 0;
          continue;
        }
        const x = i % w, y = (i / w) | 0;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
        if (dd === 0) continue;
        // 띠: 원본을 먹색으로 (어두운 먹선은 그대로)
        const L = lum(i);
        const t = Math.min(1, Math.max(0, (L - 30) / 60));
        d[i * 4] = d[i * 4] * (1 - t) + 24 * t;
        d[i * 4 + 1] = d[i * 4 + 1] * (1 - t) + 16 * t;
        d[i * 4 + 2] = d[i * 4 + 2] * (1 - t) + 11 * t;
        d[i * 4 + 3] = dd > 5.5 ? Math.round(255 * (6.5 - dd)) : 255;
      }
      ctx.putImageData(id, 0, 0);

      // 버튼·리본 자리 재기 (원본 좌표): 색 덩어리 bbox
      const box = (rx0, ry0, rx1, ry1, test) => {
        let a = rx1, b = ry1, cc = rx0, dd = ry0, n = 0;
        for (let y = ry0; y < ry1; y++)
          for (let x = rx0; x < rx1; x++) {
            const i = y * w + x;
            if (!test(d[i * 4], d[i * 4 + 1], d[i * 4 + 2])) continue;
            n++;
            a = Math.min(a, x);
            cc = Math.max(cc, x);
            b = Math.min(b, y);
            dd = Math.max(dd, y);
          }
        return [a, b, cc, dd, n];
      };
      const boxes = {
        ribbon: box(300, 0, 1270, 240, (r, g, b) => r > 150 && r - g > 70),
        keep: box(80, 500, 790, 760, (r, g, b) => g > r + 5 && g > b + 15 && g > 70),
        fresh: box(790, 500, 1500, 760, (r, g, b) => r > 170 && r - g > 60 && r - b > 80),
        cancel: box(80, 740, 1500, 960, (r, g, b) => r - b > 45 && r - b < 110 && (r + g + b) / 3 > 90 && (r + g + b) / 3 < 170 && r < 205),
      };

      const o = document.createElement("canvas");
      o.width = x1 - x0 + 1;
      o.height = y1 - y0 + 1;
      o.getContext("2d").drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
      const prev = document.createElement("canvas");
      prev.width = o.width * 2;
      prev.height = o.height;
      const pc = prev.getContext("2d");
      pc.fillStyle = "#e9e3d6";
      pc.fillRect(0, 0, o.width, o.height);
      pc.fillStyle = "#1d2433";
      pc.fillRect(o.width, 0, o.width, o.height);
      pc.drawImage(o, 0, 0);
      pc.drawImage(o, o.width, 0);
      return { ox: x0, oy: y0, w: o.width, h: o.height, webp: o.toDataURL("image/webp", 0.9), preview: prev.toDataURL("image/png"), boxes };
    },
    [b64, ERASE],
  );
  fs.mkdirSync("public/assets/art/ui", { recursive: true });
  const buf = Buffer.from(r.webp.split(",")[1], "base64");
  fs.writeFileSync(OUT, buf);
  if (process.argv[2]) fs.writeFileSync(process.argv[2], Buffer.from(r.preview.split(",")[1], "base64"));
  console.log(`${OUT} ${r.w}×${r.h} (${(buf.length / 1024) | 0}KB), 원본에서 (${r.ox}, ${r.oy})`);
  for (const [k, [a, b, c, d, n]] of Object.entries(r.boxes)) console.log(`${k}: 원본 [${a}, ${b}, ${c}, ${d}] → 그림 기준 [${a - r.ox}, ${b - r.oy}, ${c - r.ox}, ${d - r.oy}] (${n}px)`);
} finally {
  await browser.close();
}
