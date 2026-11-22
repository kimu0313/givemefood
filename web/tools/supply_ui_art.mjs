// 재료 가게(장보기) 화면 그림 (2026-11-22 사용자 예시 그림 "재료가게 UI 이걸로 써. 오른쪽 이모는 튜토리얼 이모로"):
//   art_src/ui_supply_ref.png (1677×938, 불투명) → public/assets/art/ui/mk_*.webp + src/art/supply_ui_meta.ts (조각 위치, 예시 그림 px)
//   mk_bg     = 화면 전체 (그림 속 이모 · 말풍선을 지우고 나무벽 · 그릇 선반을 이어 그림, 글씨 · 탭 글씨 · 자물쇠 · 막대 채움 지움,
//               첫 번째 빨간 탭은 두 번째 베이지 탭을 옮겨 붙여 다섯 칸 모두 베이지) — 게임이 그 위에 글씨 · 재료를 올림
//   mk_front  = 계산대(금전등록기) + 카운터 + 행주 (튜토리얼 이모 그림이 이 뒤에 섬)
//   mk_bubble = 말풍선 (글씨 지움), mk_tab_on = 고른 가게 탭 (빨강, 글씨 · 번호 · 빨간 점 지움), mk_lock = 자물쇠
//   mk_wallet_l / _m / _r = 지갑 칩 3조각 (왼쪽 = 동전까지, 가운데 = 글씨 없는 세로 줄, 오른쪽 끝) → 아무 폭에나
// 실행: node tools/supply_ui_art.mjs [preview.png]
import { chromium } from "playwright-core";
import fs from "node:fs";

const SRC = "art_src/ui_supply_ref.png";
const OUT = "public/assets/art/ui";
const META = "src/art/supply_ui_meta.ts";

// 베이지 탭 (두 번째~다섯 번째) 위 · 아래 (예시 그림 px). 첫 번째 칸은 두 번째 탭을 TAB_SHIFT 만큼 위로 옮겨 붙임
const TABS = [[267, 373], [391, 494], [513, 619], [636, 744]];
const TAB_SHIFT = 124;
// 그림 속 이모 (머리 · 반다나 꼬리 · 몸 · 팔) 를 넉넉히 감싼 다각형. 선반 1 왼쪽 끝 (x < 1266, y 518~552) 은 뺌
const AUNTIE = [
  [1225, 250], [1262, 216], [1300, 206], [1395, 208], [1462, 226], [1494, 262], [1494, 556], [1501, 560], [1507, 575], [1523, 600],
  [1531, 633], [1538, 660], [1549, 700], [1560, 740], [1571, 798], [1182, 798], [1176, 775], [1174, 748], [1182, 728], [1189, 700], [1191, 600], [1218, 572], [1266, 553], [1266, 518],
  [1212, 513], [1201, 470], [1201, 405], [1192, 400], [1190, 340], [1203, 290],
];
// 금전등록기 바깥 먹선 안쪽 (먹선은 둘레 3px 의 어두운 점으로 더함)
const REGISTER = [
  [1278, 652], [1280, 644], [1285, 639], [1293, 636.5], [1458, 636.5], [1458, 628], [1462, 624.5], [1481, 624.5], [1485, 628], [1485, 636.5],
  [1500, 636.5], [1509, 640], [1514, 645], [1516, 652], [1516, 716], [1520, 728], [1526, 740], [1526, 800], [1529, 803], [1529, 832],
  [1261, 832], [1261, 803], [1266, 800], [1266, 740], [1271, 728], [1277, 717],
];
const COUNTER = [[1071, 798], [1677, 798], [1677, 938], [1071, 938]];
const DONOR = [1598, 118, 1677, 410]; // 깨끗한 나무벽 (결 · 잔무늬 빌려 옴)

const b64 = fs.readFileSync(SRC).toString("base64");
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  const res = await page.evaluate(
    async ([b64, TABS, TAB_SHIFT, AUNTIE, REGISTER, COUNTER, DONOR]) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const W = img.naturalWidth, H = img.naturalHeight, N = W * H;
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const o = ctx.getImageData(0, 0, W, H).data; // 원본
      const d = new Uint8ClampedArray(o); // 고치는 판
      const lumOf = (a, i) => (a[i * 4] + a[i * 4 + 1] + a[i * 4 + 2]) / 3;
      let seed = 17;
      const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) - 0.5;

      const inPoly = (poly, x, y) => {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const [xi, yi] = poly[i], [xj, yj] = poly[j];
          if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
      };
      const polyMask = (poly) => {
        const m = new Uint8Array(N);
        const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
        for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(H - 1, Math.ceil(Math.max(...ys))); y++)
          for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(W - 1, Math.ceil(Math.max(...xs))); x++) if (inPoly(poly, x + 0.5, y + 0.5)) m[y * W + x] = 1;
        return m;
      };
      const dilate = (m, r) => {
        let a = m;
        for (let k = 0; k < r; k++) {
          const b = new Uint8Array(a);
          for (let i = 0; i < N; i++) {
            if (a[i]) continue;
            const x = i % W;
            if ((x > 0 && a[i - 1]) || (x < W - 1 && a[i + 1]) || (i >= W && a[i - W]) || (i < N - W && a[i + W])) b[i] = 1;
          }
          a = b;
        }
        return a;
      };
      /** 씨앗에서 cond 로 이어진 곳 + 그 안에 갇힌 구멍까지 (box 안에서만) */
      const floodFilled = (sx, sy, box, cond) => {
        const [x0, y0, x1, y1] = box;
        const inBox = (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;
        const m = new Uint8Array(N);
        const st = [sy * W + sx];
        while (st.length) {
          const i = st.pop();
          const x = i % W, y = (i / W) | 0;
          if (!inBox(x, y) || m[i] || !cond(i)) continue;
          m[i] = 1;
          st.push(i - 1, i + 1, i - W, i + W);
        }
        // 구멍 메우기: 상자 둘레에서 m 이 아닌 곳으로 이어진 곳 = 바깥
        const out = new Uint8Array(N);
        const st2 = [];
        for (let x = x0; x < x1; x++) st2.push(y0 * W + x, (y1 - 1) * W + x);
        for (let y = y0; y < y1; y++) st2.push(y * W + x0, y * W + x1 - 1);
        while (st2.length) {
          const i = st2.pop();
          const x = i % W, y = (i / W) | 0;
          if (!inBox(x, y) || out[i] || m[i]) continue;
          out[i] = 1;
          st2.push(i - 1, i + 1, i - W, i + W);
        }
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (!out[y * W + x]) m[y * W + x] = 1;
        return m;
      };
      /** 구멍을 둘레 색에서 번져 채움 (+잔무늬) */
      const diffuse = (a, hole, noise = 6) => {
        const list = [];
        for (let i = 0; i < N; i++) if (hole[i]) list.push(i);
        const col = new Float32Array(N * 3);
        for (const i of list) {
          const y = (i / W) | 0, x = i % W;
          let l = x, r = x;
          while (l > 0 && hole[y * W + l]) l--;
          while (r < W - 1 && hole[y * W + r]) r++;
          const t = (x - l) / Math.max(1, r - l);
          for (let ch = 0; ch < 3; ch++) col[i * 3 + ch] = a[(y * W + l) * 4 + ch] * (1 - t) + a[(y * W + r) * 4 + ch] * t;
        }
        const get = (j, ch) => (hole[j] ? col[j * 3 + ch] : a[j * 4 + ch]);
        for (let it = 0; it < 300; it++)
          for (const i of list) for (let ch = 0; ch < 3; ch++) col[i * 3 + ch] = (get(i - 1, ch) + get(i + 1, ch) + get(i - W, ch) + get(i + W, ch)) * 0.25;
        for (const i of list) {
          const n = rnd() * noise;
          for (let ch = 0; ch < 3; ch++) a[i * 4 + ch] = col[i * 3 + ch] + n;
          a[i * 4 + 3] = 255;
        }
      };
      /** 네모 안에서 조건에 맞는 점 (+r px) 을 지울 구멍으로 */
      const pick = (rect, cond, r) => {
        const [x0, y0, x1, y1] = rect;
        const m = new Uint8Array(N);
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (cond(y * W + x)) m[y * W + x] = 1;
        const g = dilate(m, r);
        for (let i = 0; i < N; i++) {
          const x = i % W, y = (i / W) | 0;
          if (x < x0 || x >= x1 || y < y0 || y >= y1) g[i] = 0;
        }
        return g;
      };
      const rectMask = ([x0, y0, x1, y1]) => {
        const m = new Uint8Array(N);
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m[y * W + x] = 1;
        return m;
      };
      /** 줄마다 양옆(또는 한쪽) 깨끗한 칸을 거울로 이어 붙여 채움 — 가로결 나무 · 어두운 막대 */
      const rowsFill = (a, rect, side = "lr", L = 40) => {
        const [x0, y0, x1, y1] = rect;
        for (let y = y0; y < y1; y++) {
          const w = x1 - x0;
          for (let x = x0; x < x1; x++) {
            const k = x - x0;
            const li = y * W + (x0 - 1 - (k % L)); // 왼쪽 거울
            const ri = y * W + (x1 + ((x1 - 1 - x) % L)); // 오른쪽 거울
            const t = side === "l" ? 0 : side === "r" ? 1 : (k + 0.5) / w;
            const i = y * W + x;
            const n = rnd() * 3;
            for (let ch = 0; ch < 3; ch++) a[i * 4 + ch] = (side === "r" ? 0 : a[li * 4 + ch] * (1 - t)) + (side === "l" ? 0 : a[ri * 4 + ch] * t) + n;
          }
        }
      };
      /** 칸마다 위 · 아래 깨끗한 줄을 거울로 이어 붙여 채움 (가로결 나무판 위 글씨) */
      const colsFill = (a, rect, above, below) => {
        const [x0, y0, x1, y1] = rect;
        const La = y0 - above, Lb = below - y1;
        for (let x = x0; x < x1; x++)
          for (let y = y0; y < y1; y++) {
            const k = y - y0;
            const ai = (y0 - 1 - (k % La)) * W + x;
            const bi = (y1 + ((y1 - 1 - y) % Lb)) * W + x;
            const t = (k + 0.5) / (y1 - y0);
            const i = y * W + x;
            const n = rnd() * 3;
            for (let ch = 0; ch < 3; ch++) a[i * 4 + ch] = a[ai * 4 + ch] * (1 - t) + a[bi * 4 + ch] * t + n;
          }
      };
      /** 선반 윗면(가로결) 띠를 여러 장 쌓아 rect 를 채우고, 둘레 깨끗한 나무 색에 맞춘 뒤 가장자리를 섞음 */
      const patchFill = (a, rect, strips, ring, feather = 8) => {
        const [x0, y0, x1, y1] = rect;
        const w = x1 - x0, h = y1 - y0;
        const patch = new Float32Array(w * h * 3);
        for (let y = 0; y < h; y++) {
          const [sx, sy, rows] = strips[Math.floor(y / strips[0][2]) % strips.length];
          const yy = sy + (y % rows);
          for (let x = 0; x < w; x++) for (let k = 0; k < 3; k++) patch[(y * w + x) * 3 + k] = o[(yy * W + sx + x) * 4 + k];
        }
        const stat = (vals) => { const m = vals.reduce((p, q) => p + q, 0) / vals.length; return [m, Math.sqrt(vals.reduce((p, q) => p + (q - m) * (q - m), 0) / vals.length) || 1]; };
        for (let k = 0; k < 3; k++) {
          const tv = [];
          for (const [rx0, ry0, rx1, ry1] of ring) for (let y = ry0; y < ry1; y++) for (let x = rx0; x < rx1; x++) tv.push(o[(y * W + x) * 4 + k]);
          const pv = [];
          for (let i = 0; i < w * h; i++) pv.push(patch[i * 3 + k]);
          const [tm, ts] = stat(tv), [pm, ps] = stat(pv);
          const g = Math.max(0.6, Math.min(1.4, ts / ps));
          for (let i = 0; i < w * h; i++) patch[i * 3 + k] = (patch[i * 3 + k] - pm) * g + tm;
        }
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const e = Math.min(x + 0.5, w - x - 0.5, (y + 0.5) * 2, (h - y - 0.5) * 2);
          const t = Math.min(1, e / feather);
          const i = (y + y0) * W + x + x0;
          for (let k = 0; k < 3; k++) a[i * 4 + k] = a[i * 4 + k] * (1 - t) + patch[(y * w + x) * 3 + k] * t;
        }
      };
      const sat = (a, i) => Math.max(a[i * 4], a[i * 4 + 1], a[i * 4 + 2]) - Math.min(a[i * 4], a[i * 4 + 1], a[i * 4 + 2]);

      /** 조각 하나: mask 부분만 (나머지 투명), 상자로 잘라 webp */
      const piece = (src, mask, box) => {
        let [x0, y0, x1, y1] = box ?? [W, H, 0, 0];
        if (!box) for (let i = 0; i < N; i++) if (mask[i]) { const x = i % W, y = (i / W) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1); }
        const w = x1 - x0, h = y1 - y0;
        const out = new Uint8ClampedArray(w * h * 4);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const si = (y + y0) * W + x + x0, di = y * w + x;
          for (let k = 0; k < 3; k++) out[di * 4 + k] = src[si * 4 + k];
          out[di * 4 + 3] = mask[si] === undefined ? 255 : Math.round(mask[si] * 255);
        }
        const cc = document.createElement("canvas");
        cc.width = w;
        cc.height = h;
        cc.getContext("2d").putImageData(new ImageData(out, w, h), 0, 0);
        return { x: x0, y: y0, w, h, url: cc.toDataURL("image/webp", 0.9), png: cc.toDataURL("image/png") };
      };
      const pieces = {};

      // ── 1. 말풍선 (원본에서) ──
      const bubbleIn = floodFilled(1350, 160, [1100, 92, 1612, 258], (i) => lumOf(o, i) > 120);
      const bubbleMask = dilate(bubbleIn, 4);
      {
        const b = new Uint8ClampedArray(o);
        diffuse(b, rectMask([1140, 114, 1574, 202]), 4);
        pieces.bubble = piece(b, bubbleMask);
      }

      // ── 2. 고른 탭 (빨강) ──
      {
        const b = new Uint8ClampedArray(o);
        // 둥근 네모 (바깥 먹선 x 16.5~184.5, y 134.5~252.5, 모서리 15)
        const m = new Float32Array(N);
        for (let y = 128; y < 258; y++) for (let x = 10; x < 192; x++) {
          const px = x + 0.5, py = y + 0.5, R = 15;
          const qx = Math.min(Math.max(px, 16.5 + R), 184.5 - R), qy = Math.min(Math.max(py, 134.5 + R), 252.5 - R);
          m[y * W + x] = Math.max(0, Math.min(1, R + 0.5 - Math.hypot(px - qx, py - qy)));
        }
        // 오른쪽 위 빨간 점: 왼쪽 위 모서리를 좌우로 뒤집어 붙임 (탭 가운데 x ≈ 100.8)
        for (let y = 118; y < 176; y++)
          for (let x = 146; x < 196; x++) {
            const sx = Math.round(201.6 - x), i = y * W + x, s = y * W + sx;
            m[i] = m[s];
            for (let k = 0; k < 4; k++) b[i * 4 + k] = b[s * 4 + k];
          }
        // 번호 동그라미 · 이름 글씨 (빨강이 아닌 점)
        const notRed = (i) => {
          const r = b[i * 4], g = b[i * 4 + 1];
          return !(r - g > 55 && r > 130);
        };
        diffuse(b, pick([32, 143, 168, 240], notRed, 2), 7);
        pieces.tab_on = piece(b, m);
      }

      // ── 3. 자물쇠 (두 번째 탭, 어두운 선만) ──
      {
        const box = [82, 269, 114, 305];
        const m = new Float32Array(N);
        const b = new Uint8ClampedArray(o);
        for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) {
          const i = y * W + x;
          m[i] = Math.max(0, Math.min(1, (165 - lumOf(o, i)) / 95));
          for (let k = 0; k < 3; k++) b[i * 4 + k] = Math.min(o[i * 4 + k], 70);
        }
        pieces.lock = piece(b, m, box);
      }

      // ── 4. 지갑 칩 3조각 (둥근 막대 모양 x 22.5~189.5, y 11.5~89.5) ──
      {
        const m = new Float32Array(N);
        const cy = 50.5, r = 39, cl = 61.5, cr = 150.5;
        for (let y = 8; y < 94; y++) for (let x = 18; x < 194; x++) {
          const px = x + 0.5, py = y + 0.5;
          const qx = px < cl ? cl : px > cr ? cr : px;
          const dist = Math.hypot(px - qx, py - cy);
          m[y * W + x] = Math.max(0, Math.min(1, r + 0.5 - dist));
        }
        pieces.wallet_l = piece(o, m, [20, 9, 92, 92]);
        pieces.wallet_m = piece(o, m, [92, 9, 96, 92]);
        pieces.wallet_r = piece(o, m, [157, 9, 192, 92]);
      }

      // ── 5. 바탕: 탭 글씨 · 자물쇠 지우기 → 두 번째 탭을 첫 칸으로 ──
      for (const [t, bt] of TABS) diffuse(d, pick([27, t + 4, 171, bt - 4], (i) => lumOf(o, i) < 112, 2), 6);
      for (let y = 136; y < 260; y++)
        for (let x = 0; x < 192; x++) {
          const i = y * W + x, s = (y + TAB_SHIFT) * W + x;
          for (let k = 0; k < 4; k++) d[i * 4 + k] = d[s * 4 + k];
        }
      for (let y = 126; y < 136; y++) // 빨간 점 · 빨간 탭 윗선이 있던 줄 = 바로 위 줄을 거울로
        for (let x = 0; x < 192; x++) {
          const i = y * W + x, s = (2 * 126 - y - 1) * W + x;
          for (let k = 0; k < 4; k++) d[i * 4 + k] = d[s * 4 + k];
        }

      // ── 6. 지갑 글씨 · 간판 글씨 · 아래 막대 ──
      diffuse(d, pick([96, 26, 160, 76], (i) => lumOf(o, i) > 95 || (i % W) < 158, 2), 4);
      // 간판 "재료 가게" · 아래 판 "스테이지 1 재료 준비": 가운데 선반 윗면(가로결, y 401~426) 띠를 쌓아 덮음
      patchFill(d, [530, 34, 856, 117], [[232, 401, 25], [470, 401, 25], [700, 401, 25], [600, 401, 25]], [[474, 54, 528, 98], [858, 54, 910, 98]], 12);
      patchFill(d, [178, 856, 432, 898], [[300, 401, 25], [640, 401, 25]], [[184, 842, 428, 855], [184, 899, 428, 905]], 8);
      // 막대 노란 채움 + 그 끝 먹선 → 막대 안 어두운 색 (오른쪽에서 거울로)
      {
        const m = pick([440, 858, 590, 894], (i) => {
          const x = i % W;
          return (o[i * 4] > 150 && o[i * 4 + 1] > 90 && o[i * 4 + 2] < 120 && sat(o, i) > 70) || lumOf(o, i) > 140 || (x >= 556 && x < 590);
        }, 1);
        const list = [];
        for (let i = 0; i < N; i++) if (m[i]) list.push(i);
        for (const i of list) {
          const x = i % W, y = (i / W) | 0;
          const s = y * W + 592 + ((592 - x) % 70 + 70) % 70;
          const n = rnd() * 3;
          for (let k = 0; k < 3; k++) d[i * 4 + k] = d[s * 4 + k] + n;
        }
      }
      rowsFill(d, [700, 861, 836, 893], "lr", 40); // "2 / 10인분"
      // 계산대 화면 글씨 (동전 + "0원") · 이름판 "계산대"
      rowsFill(d, [1360, 658, 1450, 695], "lr", 30);
      diffuse(d, pick([1346, 758, 1446, 790], (i) => lumOf(o, i) < 120, 2), 5);

      // ── 7. 앞 조각: 계산대 + 카운터 + 행주 (지운 뒤의 d 에서, 벽을 고치기 전에) ──
      {
        const reg = polyMask(REGISTER);
        const ring = dilate(reg, 3);
        const m = polyMask(COUNTER);
        for (let i = 0; i < N; i++) if (reg[i] || (ring[i] && lumOf(o, i) < 80)) m[i] = 1;
        pieces.front = piece(d, m);
      }

      // ── 8. 그림 속 이모 · 말풍선 자리 → 나무벽 ──
      const aunt = polyMask(AUNTIE);
      const bub = dilate(bubbleMask, 2);
      const hole = new Uint8Array(N);
      for (let i = 0; i < N; i++) if (aunt[i] || bub[i]) hole[i] = 1;
      const BX0 = 1096, BY0 = 92, BX1 = W, BY1 = 800;
      // (a) 말풍선 자리: 같은 세로줄 바로 아래 깨끗한 벽을 거울로 (판자 이음매가 그대로 이어짐)
      const filled = new Uint8Array(N);
      for (let x = BX0; x < BX1; x++) {
        let bot = -1;
        for (let y = BY0; y < 300; y++) if (bub[y * W + x]) bot = y;
        if (bot < 0) continue;
        for (let y = BY0; y <= bot; y++) {
          const i = y * W + x;
          if (!bub[i]) continue;
          const sy = 2 * bot - y + 1;
          const s = sy * W + x;
          if (sy >= H || hole[s]) continue;
          for (let k = 0; k < 3; k++) d[i * 4 + k] = d[s * 4 + k];
          filled[i] = 1;
        }
      }
      // (b) 나머지: 세로줄마다 판자 모양(깨끗한 벽의 가운데값, 없으면 빌려 온 벽) + 빌려 온 잔무늬 + 부드러운 밝기 보정
      const wallOk = (i) => !hole[i] && lumOf(o, i) < 95;
      const [DX0, DY0, DX1, DY1] = DONOR;
      const DW = DX1 - DX0, DH = DY1 - DY0;
      const mir = (v, n) => { const p = ((v % (2 * n)) + 2 * n) % (2 * n); return p < n ? p : 2 * n - 1 - p; };
      const donorProf = [];
      for (let u = 0; u < DW; u++) {
        const ch = [[], [], []];
        for (let v = 0; v < DH; v++) { const i = (DY0 + v) * W + DX0 + u; for (let k = 0; k < 3; k++) ch[k].push(o[i * 4 + k]); }
        donorProf.push(ch.map((a) => (a.sort((p, q) => p - q), a[a.length >> 1])));
      }
      const prof = new Float32Array(W * 3);
      for (let x = BX0; x < BX1; x++) {
        const ch = [[], [], []];
        for (let y = BY0; y < BY1; y++) { const i = y * W + x; if (wallOk(i)) for (let k = 0; k < 3; k++) ch[k].push(o[i * 4 + k]); }
        const own = ch[0].length >= 24;
        const dp = donorProf[mir(x - BX0, DW)];
        for (let k = 0; k < 3; k++) prof[x * 3 + k] = own ? (ch[k].sort((p, q) => p - q), ch[k][ch[k].length >> 1]) : dp[k];
      }
      // 밝기 보정장: 깨끗한 벽에서 (원본 − 판자 모양) 을 밀고 당겨(push-pull) 구멍 안으로 부드럽게
      const bw = BX1 - BX0, bh = BY1 - BY0;
      const lv = [];
      {
        const v0 = new Float32Array(bw * bh * 3), w0 = new Float32Array(bw * bh);
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
          const i = (y + BY0) * W + x + BX0;
          if (!wallOk(i) && !filled[i]) continue;
          w0[y * bw + x] = 1;
          for (let k = 0; k < 3; k++) v0[(y * bw + x) * 3 + k] = d[i * 4 + k] - prof[(x + BX0) * 3 + k];
        }
        lv.push({ w: bw, h: bh, v: v0, wt: w0 });
        while (lv[lv.length - 1].w > 1 || lv[lv.length - 1].h > 1) {
          const p = lv[lv.length - 1];
          const w = Math.max(1, (p.w + 1) >> 1), h = Math.max(1, (p.h + 1) >> 1);
          const v = new Float32Array(w * h * 3), wt = new Float32Array(w * h);
          for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
            const a = (y >> 1) * w + (x >> 1), q = p.wt[y * p.w + x];
            if (!q) continue;
            wt[a] += q;
            for (let k = 0; k < 3; k++) v[a * 3 + k] += p.v[(y * p.w + x) * 3 + k] * q;
          }
          for (let a = 0; a < w * h; a++) if (wt[a] > 0) for (let k = 0; k < 3; k++) v[a * 3 + k] /= wt[a];
          lv.push({ w, h, v, wt });
        }
        for (let l = lv.length - 2; l >= 0; l--) {
          const p = lv[l], q = lv[l + 1];
          for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
            const a = y * p.w + x;
            const t = Math.min(1, p.wt[a]);
            if (t >= 1) continue;
            const fx = Math.min(q.w - 1, Math.max(0, x / 2 - 0.25)), fy = Math.min(q.h - 1, Math.max(0, y / 2 - 0.25));
            const ix = Math.floor(fx), iy = Math.floor(fy), ax = fx - ix, ay = fy - iy;
            const ix1 = Math.min(q.w - 1, ix + 1), iy1 = Math.min(q.h - 1, iy + 1);
            for (let k = 0; k < 3; k++) {
              const up = (q.v[(iy * q.w + ix) * 3 + k] * (1 - ax) + q.v[(iy * q.w + ix1) * 3 + k] * ax) * (1 - ay) + (q.v[(iy1 * q.w + ix) * 3 + k] * (1 - ax) + q.v[(iy1 * q.w + ix1) * 3 + k] * ax) * ay;
              p.v[a * 3 + k] = p.v[a * 3 + k] * t + up * (1 - t);
            }
            p.wt[a] = 1;
          }
        }
      }
      const corr = lv[0].v;
      // 보정장은 넓게 흐리게 (구멍 안만)
      {
        const tmp = new Float32Array(corr);
        const R = 14;
        for (let pass = 0; pass < 2; pass++) {
          const src = pass === 0 ? corr : tmp, dst = pass === 0 ? tmp : corr;
          for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
            if (!hole[(y + BY0) * W + x + BX0]) { for (let k = 0; k < 3; k++) dst[(y * bw + x) * 3 + k] = src[(y * bw + x) * 3 + k]; continue; }
            const acc = [0, 0, 0];
            let n = 0;
            for (let t = -R; t <= R; t++) {
              const xx = pass === 0 ? x + t : x, yy = pass === 0 ? y : y + t;
              if (xx < 0 || yy < 0 || xx >= bw || yy >= bh) continue;
              for (let k = 0; k < 3; k++) acc[k] += src[(yy * bw + xx) * 3 + k];
              n++;
            }
            for (let k = 0; k < 3; k++) dst[(y * bw + x) * 3 + k] = acc[k] / n;
          }
        }
      }
      for (let y = BY0; y < BY1; y++) for (let x = BX0; x < BX1; x++) {
        const i = y * W + x;
        if (!hole[i] || filled[i]) continue;
        const u = mir(x - BX0, DW), v = mir(y - DY0, DH);
        const di = (DY0 + v) * W + DX0 + u;
        const a = (y - BY0) * bw + x - BX0;
        for (let k = 0; k < 3; k++) d[i * 4 + k] = prof[x * 3 + k] + corr[a * 3 + k] + (o[di * 4 + k] - donorProf[u][k]) * 0.8;
      }
      // (c) 그릇 선반 두 장: 구멍 안 줄은 옆의 선반을 거울로 이어 붙임
      rowsFill(d, [1266, 522, 1494, 551], "lr", 40);
      rowsFill(d, [1505, 640, 1545, 664], "r", 40);
      rowsFill(d, [1172, 728, 1189, 797], "l", 30);
      for (let y = 729; y < 797; y++) for (let x = 1186; x < 1190; x++) { const i = y * W + x; d[i * 4] = 52; d[i * 4 + 1] = 30; d[i * 4 + 2] = 18; }
      for (let y = 690; y < 728; y++) for (let x = 1178; x < 1191; x++) { const i = y * W + x, sidx = (2 * 690 - y - 1) * W + x; for (let k = 0; k < 3; k++) d[i * 4 + k] = d[sidx * 4 + k]; }
      // (d) 아래 그릇 더미 왼쪽 가장자리: 그릇 가운데를 기준으로 뒤집어 (밝은 그릇 점만)
      for (const [y0, y1, cx] of [[566, 592, 1541], [592, 613, 1551], [613, 642, 1561]])
        for (let y = y0; y < y1; y++) for (let x = 1495; x < cx; x++) {
          const i = y * W + x, s = y * W + (2 * cx - x);
          if (!hole[i] || hole[s]) continue;
          if (lumOf(o, s) < 110 || sat(o, s) > 60) continue;
          for (let k = 0; k < 3; k++) d[i * 4 + k] = o[s * 4 + k];
        }

      pieces.bg = piece(d, new Float32Array(N).fill(1), [0, 0, W, H]);
      pieces.bg.url = (() => {
        const cc = document.createElement("canvas");
        cc.width = W;
        cc.height = H;
        cc.getContext("2d").putImageData(new ImageData(d, W, H), 0, 0);
        return cc.toDataURL("image/webp", 0.88);
      })();
      return pieces;
    },
    [b64, TABS, TAB_SHIFT, AUNTIE, REGISTER, COUNTER, DONOR],
  );
  fs.mkdirSync(OUT, { recursive: true });
  const meta = {};
  for (const [name, p] of Object.entries(res)) {
    const buf = Buffer.from(p.url.split(",")[1], "base64");
    fs.writeFileSync(`${OUT}/mk_${name}.webp`, buf);
    meta[name] = [p.x, p.y, p.w, p.h];
    console.log(`mk_${name}.webp ${p.w}×${p.h} at (${p.x}, ${p.y}) ${(buf.length / 1024) | 0}KB`);
  }
  fs.writeFileSync(
    META,
    `// 자동 생성: node tools/supply_ui_art.mjs (재료 가게 그림 조각의 예시 그림 위치 [x, y, w, h], 1677×938 px)\nexport const SUPPLY_UI_META: Record<string, [number, number, number, number]> = {\n${Object.entries(meta).map(([k, v]) => `  ${k}: [${v.join(", ")}],`).join("\n")}\n};\n`,
  );
  if (process.argv[2]) {
    // 미리보기: 바탕 + 앞 조각 (이모 없이) + 말풍선 + 빨간 탭
    const pv = await page.evaluate(async (res) => {
      const load = async (u) => { const im = new Image(); im.src = u; await im.decode(); return im; };
      const c = document.createElement("canvas");
      c.width = res.bg.w;
      c.height = res.bg.h;
      const g = c.getContext("2d");
      g.drawImage(await load(res.bg.url), 0, 0);
      for (const n of ["front", "bubble", "tab_on"]) g.drawImage(await load(res[n].png), res[n].x, res[n].y);
      return c.toDataURL("image/png");
    }, res);
    fs.writeFileSync(process.argv[2], Buffer.from(pv.split(",")[1], "base64"));
  }
} finally {
  await browser.close();
}
