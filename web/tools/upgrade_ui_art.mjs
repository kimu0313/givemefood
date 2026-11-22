// 가게 업그레이드(손보기) 화면 UI 조각 (2026-11-22 사용자 예시 그림 "글씨체는 냅두고 가게 업그레이드 눌렀을 때 뜨는 UI 이렇게"):
//   art_src/ui_upgrade_ref.png (투명 바탕 1677×938) → public/assets/art/ui/upg_<이름>.webp
//   awning = 위쪽 줄무늬 차양: 글씨 없는 가운데 한 쌍(빨강+크림, x 742~987)을 옆으로 이어 붙이고, 왼쪽 끝은 원본 실루엣(비스듬한 끝·먹선)으로 자름
//   wallet = 지갑 판 (동전·글씨 지움, 둘레 차양은 투명)
//   card   = 카드 한 장 (안쪽을 종이 한 색으로, 게임이 9-slice 로 씀)
//   disc   = 아이콘 받침 동그라미 (안의 냄비를 둘레 색으로 메움)
//   buy    = 초록 가격 버튼 · back = 갈색 "지도로 돌아가기" 버튼 (글씨 자리를 줄마다 깨끗한 양옆 색으로 메움)
// 지우기 모드: "r" = 줄마다 양옆 깨끗한 칸의 가운데값 · "f" = 둘레 종이 평균색 · "o" [cx, cy, R] = 원 안을 둘레 색으로 · "d" = 번져 채움
// cut: "paper" = 테두리에서 이어진 밝은 종이를 투명으로 · "light" = 테두리에서 이어진 밝거나 붉은 칸(차양)을 투명으로
// 실행: node tools/upgrade_ui_art.mjs [--preview]  (미리보기 tests/shots/upg_preview.png)
import { chromium } from "playwright-core";
import fs from "node:fs";

const SRC = "art_src/ui_upgrade_ref.png";
const AWNING = { y0: 12, y1: 176, tile: [742, 987] };
const PIECES = [
  { name: "wallet", rect: [1318, 68, 1636, 162], seed: [1340, 110], cut: "light", open: 4, erase: [[1342, 84, 1612, 146, "d"]] },
  { name: "card", rect: [58, 182, 568, 748], seed: [100, 470], erase: [[84, 198, 550, 719, "f"]] }, // 아래 먹선·둥근 모서리(y 720~)는 남김
  { name: "disc", rect: [232, 210, 394, 364], seed: [262, 245], cut: "paper", erase: [[0, 0, 0, 0, "o", [311, 281, 63]]] },
  { name: "buy", rect: [84, 604, 550, 716], seed: [110, 640], cut: "paper", erase: [[180, 616, 462, 700, "r"]] },
  { name: "back", rect: [576, 806, 1100, 912], seed: [600, 850], erase: [[680, 820, 1020, 894, "r"]] },
];
const preview = process.argv.includes("--preview");

const b64 = fs.readFileSync(SRC).toString("base64");
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  const res = await page.evaluate(
    async ([b64, PIECES, AWNING]) => {
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
      let seed = 9;
      const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) - 0.5;
      const toUrl = (data, w, h, type) => {
        const cc = document.createElement("canvas");
        cc.width = w;
        cc.height = h;
        cc.getContext("2d").putImageData(new ImageData(data, w, h), 0, 0);
        return cc.toDataURL(type, 0.9);
      };
      const out = [];

      // ---- 차양: 가운데 한 쌍을 이어 붙임 + 왼쪽 끝은 원본 실루엣
      {
        const { y0, y1, tile } = AWNING;
        const h = y1 - y0, w = W, N = w * h;
        const per = tile[1] - tile[0];
        const d = new Uint8ClampedArray(N * 4);
        const src = (x, y) => ((y + y0) * W + x) * 4;
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            const tx = tile[0] + ((((x - tile[0]) % per) + per) % per);
            const si = src(tx, y), di = (y * w + x) * 4;
            for (let k = 0; k < 4; k++) d[di + k] = full[si + k];
          }
        // 이음매 (tile 끝 ↔ 처음) 8px 섞기
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            const ph = ((((x - tile[0]) % per) + per) % per);
            if (ph > 5 && ph < per - 5) continue;
            const di = (y * w + x) * 4;
            const a = src(tile[0] + 6, y), b = src(tile[1] - 6, y);
            for (let k = 0; k < 4; k++) d[di + k] = (full[a + k] + full[b + k]) / 2;
          }
        // 왼쪽 끝 (x < 640): 원본 실루엣으로 자르고, 실루엣 가장자리 먹선은 원본 그대로
        const LEFT = 640, RIGHT = 1632;
        const oa = (x, y) => full[src(x, y) + 3];
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            if (x >= LEFT && x < RIGHT) continue;
            const di = (y * w + x) * 4;
            const orig = oa(x, y);
            if (orig < 40) { d[di + 3] = 0; continue; }
            // 원본 투명에서 6px 안 = 가장자리
            let edge = false;
            for (let dy = -6; dy <= 6 && !edge; dy += 2) for (let dx = -6; dx <= 6; dx += 2) {
              const xx = x + dx, yy = y + dy;
              if (xx < 0 || yy < 0 || xx >= W || yy >= h) { edge = true; break; }
              if (oa(xx, yy) < 40) { edge = true; break; }
            }
            const si = src(x, y);
            const lum = (full[si] + full[si + 1] + full[si + 2]) / 3;
            // 먹선은 비스듬한 끝(위쪽 90px)만 원본에서 — 아래 제목 띠의 테두리는 안 가져옴
            if (edge && lum < 70 && y < 90 && (x < 200 || x >= RIGHT)) for (let k = 0; k < 4; k++) d[di + k] = full[si + k];
            else d[di + 3] = Math.min(d[di + 3], orig);
          }
        out.push({ name: "awning", ox: 0, oy: y0, w, h, webp: toUrl(d, w, h, "image/webp"), png: toUrl(d, w, h, "image/png") });
      }

      // ---- 나머지 조각
      for (const P of PIECES) {
        const [x0, y0, x1, y1] = P.rect;
        const w = x1 - x0, h = y1 - y0, N = w * h;
        const d = new Uint8ClampedArray(N * 4);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const si = ((y + y0) * W + (x + x0)) * 4, di = (y * w + x) * 4;
          for (let k = 0; k < 4; k++) d[di + k] = full[si + k];
        }
        const at = (x, y) => (y * w + x) * 4;
        for (const [ex0, ey0, ex1, ey1, mode, extra] of P.erase) {
          const a0 = ex0 - x0, b0 = ey0 - y0, a1 = ex1 - x0, b1 = ey1 - y0;
          if (mode === "o") {
            const [cx, cy, R] = extra;
            const lx = cx - x0, ly = cy - y0;
            const acc = [0, 0, 0];
            let n = 0;
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
              const r = Math.hypot(x - lx, y - ly);
              if (r < R - 6 || r > R - 1) continue;
              const i = at(x, y);
              if (d[i] + d[i + 1] + d[i + 2] < 540) continue;
              for (let k = 0; k < 3; k++) acc[k] += d[i + k];
              n++;
            }
            for (let k = 0; k < 3; k++) acc[k] /= Math.max(1, n);
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
              const r = Math.hypot(x - lx, y - ly);
              if (r >= R - 2) continue;
              const i = at(x, y);
              const g = -((y - ly) / R) * 9 + rnd() * 4; // 위 밝게 · 아래 어둡게
              for (let k = 0; k < 3; k++) d[i + k] = acc[k] + g;
              d[i + 3] = 255;
            }
            continue;
          }
          if (mode === "f") {
            const acc = [0, 0, 0];
            let n = 0;
            for (let x = a0; x < a1; x++) for (const y of [b0 - 1, b1]) {
              const i = at(x, y);
              if (d[i + 3] > 200 && d[i] + d[i + 1] + d[i + 2] > 660) { for (let k = 0; k < 3; k++) acc[k] += d[i + k]; n++; }
            }
            for (let k = 0; k < 3; k++) acc[k] /= Math.max(1, n);
            for (let y = b0; y < b1; y++) for (let x = a0; x < a1; x++) {
              const i = at(x, y);
              const nz = rnd() * 5;
              for (let k = 0; k < 3; k++) d[i + k] = acc[k] + nz;
              d[i + 3] = 255;
            }
            continue;
          }
          if (mode === "r") {
            for (let y = b0; y < b1; y++) {
              const ch = [[], [], []];
              for (const xs of [[a0 - 46, a0 - 4], [a1 + 4, a1 + 46]])
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
            continue;
          }
          // "d"
          const list = [];
          for (let y = b0; y < b1; y++) for (let x = a0; x < a1; x++) list.push(y * w + x);
          const hole = new Uint8Array(N);
          for (const i of list) hole[i] = 1;
          const col = new Float32Array(N * 3);
          for (let i = 0; i < N; i++) for (let k = 0; k < 3; k++) col[i * 3 + k] = d[i * 4 + k];
          for (const i of list) {
            const y = (i / w) | 0;
            let l = i % w, r = i % w;
            while (l > 0 && hole[y * w + l]) l--;
            while (r < w - 1 && hole[y * w + r]) r++;
            const t = (i % w - l) / Math.max(1, r - l);
            for (let k = 0; k < 3; k++) col[i * 3 + k] = d[(y * w + l) * 4 + k] * (1 - t) + d[(y * w + r) * 4 + k] * t;
          }
          for (let it = 0; it < 260; it++)
            for (const i of list) for (let k = 0; k < 3; k++) col[i * 3 + k] = (col[(i - 1) * 3 + k] + col[(i + 1) * 3 + k] + col[(i - w) * 3 + k] + col[(i + w) * 3 + k]) * 0.25;
          for (const i of list) {
            const nz = rnd() * 6;
            for (let k = 0; k < 3; k++) d[i * 4 + k] = col[i * 3 + k] + nz;
            d[i * 4 + 3] = 255;
          }
        }
        // 둘레 지우기
        const gone = new Uint8Array(N);
        if (P.cut) {
          const test = P.cut === "paper"
            ? (i) => { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; return Math.min(r, g, b) >= 206 && Math.max(r, g, b) - Math.min(r, g, b) <= 42; }
            : (i) => { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; return (r + g + b) / 3 > 125 || r - b > 55; };
          const st = [];
          for (let x = 0; x < w; x++) st.push(x, N - w + x);
          for (let y = 0; y < h; y++) st.push(y * w, y * w + w - 1);
          while (st.length) {
            const i = st.pop();
            if (gone[i] || !(d[i * 4 + 3] < 40 || test(i))) continue;
            gone[i] = 1;
            const x = i % w;
            if (x > 0) st.push(i - 1);
            if (x < w - 1) st.push(i + 1);
            if (i >= w) st.push(i - w);
            if (i < N - w) st.push(i + w);
          }
        }
        if (P.open) {
          // 열기: 깎고 다시 키워서 가는 돌기(차양 먹선 끄트머리)를 뗌
          let m = new Uint8Array(N);
          for (let i = 0; i < N; i++) m[i] = !gone[i] && d[i * 4 + 3] >= 40 ? 1 : 0;
          const step = (src, grow) => {
            const o = new Uint8Array(N);
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
              let v = grow ? 0 : 1;
              for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const xx = x + dx, yy = y + dy;
                const sv = xx < 0 || yy < 0 || xx >= w || yy >= h ? 0 : src[yy * w + xx];
                if (grow && sv) v = 1;
                if (!grow && !sv) v = 0;
              }
              o[y * w + x] = v;
            }
            return o;
          };
          for (let k = 0; k < P.open; k++) m = step(m, false);
          for (let k = 0; k < P.open; k++) m = step(m, true);
          for (let i = 0; i < N; i++) if (!m[i]) gone[i] = 1;
        }
        const keep = new Uint8Array(N);
        const st = [(P.seed[1] - y0) * w + (P.seed[0] - x0)];
        while (st.length) {
          const i = st.pop();
          if (keep[i] || gone[i] || d[i * 4 + 3] < 40) continue;
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
          d[i * 4 + 3] = nb && !gone[i] ? d[i * 4 + 3] : nb ? 70 : 0;
        }
        let a = w, b = h, cc = 0, dd = 0;
        for (let i = 0; i < N; i++) if (d[i * 4 + 3] > 0) { const x = i % w, y = (i / w) | 0; a = Math.min(a, x); cc = Math.max(cc, x); b = Math.min(b, y); dd = Math.max(dd, y); }
        const ow = cc - a + 1, oh = dd - b + 1;
        const o = new Uint8ClampedArray(ow * oh * 4);
        for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) for (let k = 0; k < 4; k++) o[(y * ow + x) * 4 + k] = d[((y + b) * w + x + a) * 4 + k];
        out.push({ name: P.name, ox: x0 + a, oy: y0 + b, w: ow, h: oh, webp: toUrl(o, ow, oh, "image/webp"), png: toUrl(o, ow, oh, "image/png") });
      }
      return out;
    },
    [b64, PIECES, AWNING],
  );
  fs.mkdirSync("public/assets/art/ui", { recursive: true });
  for (const p of res) {
    fs.writeFileSync(`public/assets/art/ui/upg_${p.name}.webp`, Buffer.from(p.webp.split(",")[1], "base64"));
    console.log(`upg_${p.name}.webp ${p.w}×${p.h} (원본에서 ${p.ox}, ${p.oy})`);
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
    fs.writeFileSync("tests/shots/upg_preview.png", Buffer.from(pv.split(",")[1], "base64"));
  }
} finally {
  await browser.close();
}
