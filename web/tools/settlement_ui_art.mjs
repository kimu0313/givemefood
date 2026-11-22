// 정산 화면 UI 조각 (2026-11-22 사용자 예시 그림 "스테이지 끝나면 나오는 화면 UI 이걸로", 다운로드 "스테이지 1 정산 화면 (1).png"):
//   art_src/ui_settlement_ref.png (투명 바탕 1679×937) → public/assets/art/ui/st_<이름>.webp
//   card  = 영수증 종이 + 주황 리본 (리본 글씨 · 안쪽 글씨/점선/알약 칸은 지움 — 게임이 그 자리에 씀)
//   star  = 금색 별 하나 (게임이 별 수만큼 그림, 빈 별은 회색으로)
//   burst_l / burst_r = "할당량 달성!" 양옆 반짝 선
//   blue_* / orange_* / brown_* = 버튼 3조각 (l = 왼쪽 끝, m = 가운데 한 줄(글씨 없는 곳), r = 오른쪽 끝) → CSS 배경 3겹으로 아무 폭에나
// 지우기 모드: "f" = 둘레 종이 평균색 · "r" = 줄마다 양옆 깨끗한 칸의 가운데값 (리본 · 버튼)
// 조각: flood = 씨앗과 이어진 불투명 덩어리만 (옆 별과 떨어뜨림), 없으면 네모 그대로 (투명 바탕이라 알파 그대로)
// 실행: node tools/settlement_ui_art.mjs [--preview]  (미리보기 tests/shots/st_preview.png)
import { chromium } from "playwright-core";
import fs from "node:fs";

const SRC = "art_src/ui_settlement_ref.png";
const BTN = {
  blue: { y: [644, 754], l: [818, 900], m: [1478, 1522], r: [1552, 1634] },
  orange: { y: [756, 870], l: [1060, 1140], m: [1522, 1556], r: [1556, 1640] },
  brown: { y: [756, 868], l: [806, 866], m: [866, 878], r: [998, 1058] }, // 글씨 "지" 가 x 882 부터
};
const PIECES = [
  { name: "card", rect: [34, 162, 806, 778], seed: [400, 500], flood: true, erase: [[80, 284, 764, 744, "f"], [262, 184, 606, 258, "r"]] },
  { name: "star", rect: [1164, 210, 1276, 322], seed: [1220, 270], flood: true, erase: [] },
  { name: "burst_l", rect: [880, 104, 972, 214], erase: [] },
  { name: "burst_r", rect: [1458, 104, 1548, 214], erase: [] },
];
for (const [c, b] of Object.entries(BTN)) for (const part of ["l", "m", "r"]) PIECES.push({ name: `${c}_${part}`, rect: [b[part][0], b.y[0], b[part][1], b.y[1]], erase: [], keepBox: true });
const preview = process.argv.includes("--preview");

const b64 = fs.readFileSync(SRC).toString("base64");
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  const res = await page.evaluate(
    async ([b64, PIECES]) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const W = img.naturalWidth, H = img.naturalHeight;
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const full = ctx.getImageData(0, 0, W, H).data;
      let seed = 11;
      const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) - 0.5;
      const toUrl = (data, w, h, type) => {
        const cc = document.createElement("canvas");
        cc.width = w;
        cc.height = h;
        cc.getContext("2d").putImageData(new ImageData(data, w, h), 0, 0);
        return cc.toDataURL(type, 0.9);
      };
      const out = [];
      for (const P of PIECES) {
        const [x0, y0, x1, y1] = P.rect;
        const w = x1 - x0, h = y1 - y0, N = w * h;
        const d = new Uint8ClampedArray(N * 4);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const si = ((y + y0) * W + (x + x0)) * 4, di = (y * w + x) * 4;
          for (let k = 0; k < 4; k++) d[di + k] = full[si + k];
        }
        const at = (x, y) => (y * w + x) * 4;
        for (const [ex0, ey0, ex1, ey1, mode] of P.erase) {
          const a0 = ex0 - x0, b0 = ey0 - y0, a1 = ex1 - x0, b1 = ey1 - y0;
          if (mode === "f") {
            const acc = [0, 0, 0];
            let n = 0;
            for (let x = a0; x < a1; x++) for (const y of [b0 - 1, b1]) {
              const i = at(x, y);
              if (d[i + 3] > 200 && d[i] + d[i + 1] + d[i + 2] > 640) { for (let k = 0; k < 3; k++) acc[k] += d[i + k]; n++; }
            }
            for (let y = b0; y < b1; y++) for (let x = a0; x < a1; x++) {
              const i = at(x, y);
              if (d[i] + d[i + 1] + d[i + 2] > 0 || d[i + 3] > 0) {
                const nz = rnd() * 5;
                for (let k = 0; k < 3; k++) d[i + k] = acc[k] / Math.max(1, n) + nz;
                d[i + 3] = 255;
              }
            }
            continue;
          }
          // "r": 줄마다 양옆 깨끗한 칸 가운데값
          for (let y = b0; y < b1; y++) {
            const ch = [[], [], []];
            for (const xs of [[a0 - 26, a0 - 3], [a1 + 3, a1 + 26]])
              for (let x = Math.max(0, xs[0]); x < Math.min(w, xs[1]); x++) {
                const i = at(x, y);
                if (d[i + 3] < 200) continue;
                for (let k = 0; k < 3; k++) ch[k].push(d[i + k]);
              }
            const med = ch.map((a) => (a.sort((p, q) => p - q), a[a.length >> 1] ?? 128));
            for (let x = a0; x < a1; x++) {
              const i = at(x, y);
              const nz = rnd() * 6;
              for (let k = 0; k < 3; k++) d[i + k] = med[k] + nz;
              d[i + 3] = 255;
            }
          }
        }
        if (P.flood) {
          const keep = new Uint8Array(N);
          const st = [(P.seed[1] - y0) * w + (P.seed[0] - x0)];
          while (st.length) {
            const i = st.pop();
            if (keep[i] || d[i * 4 + 3] < 30) continue;
            keep[i] = 1;
            const x = i % w;
            if (x > 0) st.push(i - 1);
            if (x < w - 1) st.push(i + 1);
            if (i >= w) st.push(i - w);
            if (i < N - w) st.push(i + w);
          }
          for (let i = 0; i < N; i++) if (!keep[i]) {
            const x = i % w;
            const nb = (x > 0 && keep[i - 1]) || (x < w - 1 && keep[i + 1]) || (i >= w && keep[i - w]) || (i < N - w && keep[i + w]);
            if (!nb) d[i * 4 + 3] = 0;
          }
        }
        // 잘라 내기 (버튼 조각은 세 조각 높이를 맞추려고 네모 그대로)
        let a = 0, b = 0, cc = w - 1, dd = h - 1;
        if (!P.keepBox) {
          a = w; b = h; cc = 0; dd = 0;
          for (let i = 0; i < N; i++) if (d[i * 4 + 3] > 0) { const x = i % w, y = (i / w) | 0; a = Math.min(a, x); cc = Math.max(cc, x); b = Math.min(b, y); dd = Math.max(dd, y); }
        }
        const ow = cc - a + 1, oh = dd - b + 1;
        const o = new Uint8ClampedArray(ow * oh * 4);
        for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) for (let k = 0; k < 4; k++) o[(y * ow + x) * 4 + k] = d[((y + b) * w + x + a) * 4 + k];
        out.push({ name: P.name, ox: x0 + a, oy: y0 + b, w: ow, h: oh, webp: toUrl(o, ow, oh, "image/webp"), png: toUrl(o, ow, oh, "image/png") });
      }
      return out;
    },
    [b64, PIECES],
  );
  fs.mkdirSync("public/assets/art/ui", { recursive: true });
  for (const p of res) {
    fs.writeFileSync(`public/assets/art/ui/st_${p.name}.webp`, Buffer.from(p.webp.split(",")[1], "base64"));
    console.log(`st_${p.name}.webp ${p.w}×${p.h} (원본에서 ${p.ox}, ${p.oy})`);
  }
  if (preview) {
    const pv = await page.evaluate(async (pieces) => {
      const c = document.createElement("canvas");
      c.width = 1700;
      c.height = 900;
      const g = c.getContext("2d");
      g.fillStyle = "#3a2a22";
      g.fillRect(0, 0, c.width, c.height);
      let x = 10, y = 10, rowH = 0;
      for (const p of pieces) {
        const im = new Image();
        im.src = p.png;
        await im.decode();
        if (x + im.width > c.width) { x = 10; y += rowH + 10; rowH = 0; }
        g.drawImage(im, x, y);
        x += im.width + 10;
        rowH = Math.max(rowH, im.height);
      }
      return c.toDataURL("image/png");
    }, res);
    fs.mkdirSync("tests/shots", { recursive: true });
    fs.writeFileSync("tests/shots/st_preview.png", Buffer.from(pv.split(",")[1], "base64"));
  }
} finally {
  await browser.close();
}
