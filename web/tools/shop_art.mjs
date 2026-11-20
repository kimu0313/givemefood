// 가게 영업 화면 그림 (사용자 그림: art_src/shop_<가게 id>.png, 약 1672×941 = 16:9)
//   → public/assets/art/shops/<가게 id>.webp        뒤층: 그림 전체 (손님 뒤)
//   → public/assets/art/shops/<가게 id>_front.webp  앞층: 카운터·조리대와 카운터 위에 선 물건만 (나머지는 투명) — 손님 앞
//   (2026-11-18 사용자 "가게의 조리대와 배경을 분리해 줘, 손님 일러스트는 그 사이에 와야 하니까")
// 게임은 뒤층 → 손님 → 앞층 순서로 깔고 그 위에 움직이는 것만 그린다 (완성 칸 그릇·조리 중인 음식·게이지 …, src/art/shop_art.ts).
//
// 가게마다 (좌표는 모두 그림을 1920 폭으로 키운 픽셀 [x0, y0, x1, y1]):
//   erase  = 지울 곳. 칸마다 왼쪽·오른쪽 끝 색을 한 줄씩 이어 칠함 (선반 나뭇결·모서리가 가로라서 자연스러움).
//            그림 속 완성 칸 그릇(게임이 메뉴마다 그림)·왼쪽 아래 그릇 더미(게임에서 안 씀)
//   patch  = 그림에 없는 조리 도구를 같은 그림의 다른 도구를 잘라 붙여 만듦 (from 조각들을 가로로 이어 to 에 맞춰 늘임)
//            가게 도구 배치(D.shopLayout)를 그대로 두려고: 야시장 철판 → 튀김기 2칸, 바다 찜기 → 화구 2개, 실내 포차 큰 볼 → 석쇠 화로 2개,
//            분식집 어묵 칸 → 튀김기 3칸 · 튀김기 → 큰 냄비 하나 더
//   front  = 앞층: line 아래 전부 + objects 네모 안에서 카운터에 선 물건 (네모 테두리에서 비슷한 색을 따라 번지는 곳 = 뒤 배경,
//            안 번진 곳 중 line 에 닿은 덩어리 = 물건) + rects (그대로 앞)
//   floor  = 아래 재료 카드 줄 색을 잴 곳
// 실행: node tools/shop_art.mjs [가게 id ...] [--preview]   (--preview: 앞층을 자홍 바탕에 올린 미리보기 tests/shots/shop_<id>_front.png)
import { chromium } from "playwright-core";
import fs from "node:fs";

const DISHES_Y = (y0, y1) => (x0, x1) => [x0, y0, x1, y1];
const SHOPS = {
  // 골목 포장마차: 초록 접시 2 · 흰 접시 2 · 종이컵 2 · 빨간 바구니 2 (도마는 그림 것을 그대로 씀)
  pocha: {
    erase: [[188, 610, 470, 682], [474, 610, 730, 682], [782, 588, 1008, 684], [1048, 586, 1338, 684], [118, 925, 290, 1076]],
    front: { line: 550, objects: [[96, 470, 268, 549], [1582, 440, 1712, 522], [1672, 470, 1830, 549]], rects: [[1597, 520, 1702, 550]] },
  },
  // 동네 분식집: 양은 냄비 2 · 은박 2 · 접시 2 · 대접 2. 그림 속 도구를 분식집 도구로 (2026-11-20 사용자 "조리대 내가 보낸 일러스트로 써 줘"):
  //   왼쪽 네모 칸 4개(포장마차 어묵 칸) → 오른쪽 튀김기를 잘라 3칸 튀김기로 (왼쪽 틀+칸 1 | 칸 2 | 칸 2+오른쪽 틀)
  //   오른쪽 튀김기 자리 → 가운데 큰 냄비(화구 위)를 하나 더 = 면 삶는 냄비 2칸. 철판 = 화구 4칸 (2×2)
  bunsik: {
    erase: [[154, 552, 462, 632], [480, 562, 730, 620], [764, 558, 1014, 626], [1046, 544, 1318, 630], [112, 925, 290, 1076]],
    patch: [
      { from: [[1494, 690, 1703, 878], [1703, 690, 1858, 878], [1703, 690, 1872, 878]], to: [58, 666, 558, 870] },
      { from: [[1100, 680, 1440, 878]], to: [1494, 680, 1870, 878] },
    ],
    front: { line: 552, objects: [] },
  },
  // 야시장 푸드트럭: 은박 접시 2 · 종이컵 2 · 빨간 통 2 · 줄무늬 상자 2. 창문 아래 벽·창틀 옆 벽은 앞
  market: {
    erase: [[180, 618, 468, 684], [508, 610, 710, 692], [788, 610, 994, 692], [1022, 612, 1312, 688], [112, 925, 290, 1076]],
    patch: [{ from: [[50, 708, 335, 908], [553, 708, 800, 908]], to: [818, 708, 1350, 908] }],
    front: { line: 508, objects: [[1352, 440, 1590, 508]], rects: [[0, 300, 238, 508], [1688, 300, 1920, 508]] },
  },
  // 해변 포장마차: 조개 접시 2 · 나무 쟁반 2 · 검은 쟁반 2 · 나무 접시 2. 찜기 자리에 오른쪽 화구(팬 2개)를 줄여 붙임
  beach: {
    erase: [[160, 618, 428, 690], [452, 628, 720, 688], [752, 628, 1024, 688], [1038, 618, 1312, 692], [900, 684, 1314, 918], [112, 925, 290, 1076]],
    patch: [{ from: [[1355, 700, 1890, 918]], to: [905, 755, 1305, 918] }],
    front: { line: 604, objects: [[108, 420, 470, 603], [1716, 480, 1870, 603]], rects: [[1358, 398, 1722, 604], [120, 452, 196, 604], [208, 442, 290, 500], [190, 486, 304, 604]] },
  },
  // 실내 포차: 접시 더미 2 · 뚝배기 2 · 네모 접시 2 · 물방울 대접 2. 오른쪽 큰 볼 자리에 왼쪽 화로 2개를 붙임
  suljip: {
    erase: [[150, 504, 452, 610], [458, 516, 740, 610], [756, 544, 1038, 604], [1046, 522, 1320, 608], [112, 925, 290, 1076]],
    patch: [{ from: [[85, 622, 570, 908]], to: [1405, 622, 1890, 908] }],
    front: { line: 520, objects: [] },
  },
};
const FLOOR_SAMPLE = [1380, 960, 1600, 1060];

const args = process.argv.slice(2);
const preview = args.includes("--preview");
const ids = args.filter((a) => !a.startsWith("--"));
const list = ids.length > 0 ? ids : Object.keys(SHOPS);
fs.mkdirSync("public/assets/art/shops", { recursive: true });
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  for (const id of list) {
    const cfg = SHOPS[id];
    const b64 = fs.readFileSync(`art_src/shop_${id}.png`).toString("base64");
    const r = await page.evaluate(
      async ([b64, cfg, floor, preview]) => {
        const img = new Image();
        img.src = "data:image/png;base64," + b64;
        await img.decode();
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const k = w / 1920; // 1920 좌표 → 그림 픽셀
        const P = (q) => Math.round(q * k);
        const src = document.createElement("canvas");
        src.width = w;
        src.height = h;
        src.getContext("2d").drawImage(img, 0, 0);
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);

        // 1) 지우기
        let id = ctx.getImageData(0, 0, w, h);
        let d = id.data;
        let seed = 11;
        const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) - 0.5;
        const avg = (x, y, dx) => {
          const o = [0, 0, 0];
          for (let j = 0; j < 4; j++) {
            const i = (y * w + Math.max(0, Math.min(w - 1, x + dx * j))) * 4;
            for (let ch = 0; ch < 3; ch++) o[ch] += d[i + ch] / 4;
          }
          return o;
        };
        for (const [X0, Y0, X1, Y1] of cfg.erase ?? []) {
          const x0 = P(X0), x1 = P(X1), y0 = P(Y0), y1 = Math.min(h - 1, P(Y1));
          for (let y = y0; y <= y1; y++) {
            const L = avg(x0 - 1, y, -1);
            const R = avg(x1 + 1, y, 1);
            for (let x = x0; x <= x1; x++) {
              const t = (x - x0) / Math.max(1, x1 - x0);
              const n = rnd() * 6;
              const edge = Math.min(y - y0, y1 - y) < 3 ? 0.5 : 0; // 위아래 끝은 원래 그림과 섞어 이음매가 안 보이게
              const i = (y * w + x) * 4;
              for (let ch = 0; ch < 3; ch++) d[i + ch] = Math.max(0, Math.min(255, (L[ch] * (1 - t) + R[ch] * t + n) * (1 - edge) + d[i + ch] * edge));
            }
          }
        }
        ctx.putImageData(id, 0, 0);

        // 2) 붙이기: 조각들을 가로로 이어 붙인 뒤 to 에 맞춰 늘이고, 가장자리 FEATHER px 은 섞음
        const FEATHER = 6;
        for (const p of cfg.patch ?? []) {
          const pieces = p.from.map(([a, b, c2, e]) => [P(a), P(b), P(c2) - P(a), P(e) - P(b)]);
          const tw = pieces.reduce((n, q) => n + q[2], 0);
          const th = pieces[0][3];
          const tmp = document.createElement("canvas");
          tmp.width = tw;
          tmp.height = th;
          let x = 0;
          for (const [sx, sy, sw, sh] of pieces) {
            tmp.getContext("2d").drawImage(src, sx, sy, sw, sh, x, 0, sw, th);
            x += sw;
          }
          const [dx0, dy0, dx1, dy1] = p.to.map(P);
          const dw = dx1 - dx0;
          const dh = dy1 - dy0;
          const sc = document.createElement("canvas");
          sc.width = dw;
          sc.height = dh;
          const sctx = sc.getContext("2d");
          sctx.imageSmoothingQuality = "high";
          sctx.drawImage(tmp, 0, 0, tw, th, 0, 0, dw, dh);
          const sd = sctx.getImageData(0, 0, dw, dh).data;
          id = ctx.getImageData(0, 0, w, h);
          d = id.data;
          for (let yy = 0; yy < dh; yy++)
            for (let xx = 0; xx < dw; xx++) {
              const e = Math.min(xx, yy, dw - 1 - xx, dh - 1 - yy);
              const a = Math.min(1, (e + 1) / FEATHER);
              const i = ((dy0 + yy) * w + dx0 + xx) * 4;
              const j = (yy * dw + xx) * 4;
              for (let ch = 0; ch < 3; ch++) d[i + ch] = d[i + ch] * (1 - a) + sd[j + ch] * a;
            }
          ctx.putImageData(id, 0, 0);
        }
        const back = c.toDataURL("image/webp", 0.9);

        // 3) 앞층 알파
        id = ctx.getImageData(0, 0, w, h);
        d = id.data;
        const A = new Uint8Array(w * h);
        const line = P(cfg.front.line);
        for (let y = line; y < h; y++) A.fill(255, y * w, (y + 1) * w);
        for (const [X0, Y0, X1, Y1] of cfg.front.rects ?? []) for (let y = P(Y0); y < Math.min(h, P(Y1)); y++) A.fill(255, y * w + P(X0), y * w + Math.min(w, P(X1)));
        const diff = (i, j) => Math.max(Math.abs(d[i * 4] - d[j * 4]), Math.abs(d[i * 4 + 1] - d[j * 4 + 1]), Math.abs(d[i * 4 + 2] - d[j * 4 + 2]));
        const T = 26;
        for (const [X0, Y0, X1, Y1] of cfg.front.objects ?? []) {
          const x0 = P(X0), x1 = Math.min(w - 1, P(X1)), y0 = P(Y0), y1 = Math.min(line - 1, P(Y1));
          const inR = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
          const bg = new Uint8Array(w * h);
          const q = [];
          for (let x = x0; x <= x1; x++) q.push(y0 * w + x);
          for (let y = y0; y <= y1; y++) q.push(y * w + x0, y * w + x1);
          for (const i of q) bg[i] = 1;
          while (q.length > 0) {
            const i = q.pop();
            const x = i % w;
            const y = (i / w) | 0;
            for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = x + ax, ny = y + ay;
              if (!inR(nx, ny)) continue;
              const j = ny * w + nx;
              if (bg[j] || diff(i, j) >= T) continue;
              bg[j] = 1;
              q.push(j);
            }
          }
          // 안 번진 곳 중 카운터(line)에 닿은 덩어리만 물건
          const obj = new Uint8Array(w * h);
          const s = [];
          for (let x = x0; x <= x1; x++) {
            const i = y1 * w + x;
            if (!bg[i]) {
              obj[i] = 1;
              s.push(i);
            }
          }
          while (s.length > 0) {
            const i = s.pop();
            const x = i % w;
            const y = (i / w) | 0;
            for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = x + ax, ny = y + ay;
              if (!inR(nx, ny)) continue;
              const j = ny * w + nx;
              if (obj[j] || bg[j]) continue;
              obj[j] = 1;
              s.push(j);
            }
          }
          // 바깥 1px: 어두운 먹선이면 물건에 넣음
          for (let y = y0; y <= y1; y++)
            for (let x = x0; x <= x1; x++) {
              const i = y * w + x;
              if (obj[i]) {
                A[i] = 255;
                continue;
              }
              const lum = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3;
              if (lum < 90 && ((x > 0 && obj[i - 1]) || obj[i + 1] || obj[i - w] || obj[i + w])) A[i] = 255;
            }
        }
        for (let i = 0; i < w * h; i++) d[i * 4 + 3] = A[i];
        const fc = document.createElement("canvas");
        fc.width = w;
        fc.height = h;
        fc.getContext("2d").putImageData(id, 0, 0);
        const front = fc.toDataURL("image/webp", 0.9);
        let prev = null;
        if (preview) {
          const pc = document.createElement("canvas");
          pc.width = w;
          pc.height = h;
          const pctx = pc.getContext("2d");
          pctx.fillStyle = "#e0f";
          pctx.fillRect(0, 0, w, h);
          pctx.drawImage(fc, 0, 0);
          prev = pc.toDataURL("image/png");
        }

        // 아래 띠 평균 색
        const [fx0, fy0, fx1, fy1] = floor.map(P);
        const fd = ctx.getImageData(fx0, fy0, fx1 - fx0, fy1 - fy0).data;
        const col = [0, 0, 0];
        for (let i = 0; i < fd.length; i += 4) for (let ch = 0; ch < 3; ch++) col[ch] += fd[i + ch];
        const n = fd.length / 4;
        return { back, front, prev, floor: col.map((q2) => Math.round(q2 / n)) };
      },
      [b64, cfg, FLOOR_SAMPLE, preview],
    );
    const save = (path, url) => {
      const buf = Buffer.from(url.split(",")[1], "base64");
      fs.writeFileSync(path, buf);
      return (buf.length / 1024) | 0;
    };
    const kb1 = save(`public/assets/art/shops/${id}.webp`, r.back);
    const kb2 = save(`public/assets/art/shops/${id}_front.webp`, r.front);
    if (r.prev) {
      fs.mkdirSync("tests/shots", { recursive: true });
      save(`tests/shots/shop_${id}_front.png`, r.prev);
    }
    console.log(`${id}: 뒤층 ${kb1}KB, 앞층 ${kb2}KB, 아래 띠 색 [${r.floor.join(", ")}]`);
  }
} finally {
  await browser.close();
}
