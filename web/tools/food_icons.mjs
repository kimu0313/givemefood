// 메뉴 아이콘 그림 (사용자 그림 한 장에 음식 여러 개, 투명 바탕) → public/assets/art/icons/<메뉴 id>.png
// 2026-11-18 사용자 "첫 번째 가게 떡볶이·순대·튀김·오뎅 이미지 UI 이걸로, 손님한테 주는 음식 말고 UI 에만":
// 게임은 주문 말풍선·재료 카드·지도·장보기·새 메뉴 안내 같은 UI 아이콘에만 쓰고 (FoodArt.drawIcon, menuPic),
// 완성 칸 그릇·조리 중인 음식은 그대로 그린다.
// 바탕이 칠해진 그림(투명한 곳이 하나도 없음, 2026-11-18 분식집 그림처럼 체크무늬가 박힌 것)은 먼저 그림 가장자리에서부터
// 밝고 색 없는 곳(밝기 ≥ 222, 채도 ≤ 24)을 따라 번져 바탕을 지운다 (음식은 먹선에 막혀 안 지워짐). 자른 뒤 sprite_defringe 로 밝은 테두리 정리.
// 그림 속 덩어리(불투명 픽셀이 이어진 곳)를 무게 중심이 들어간 칸(cols × rows)으로 나눠 모으고, 칸마다 잘라 MAX px 안으로 줄임.
// 실행: node tools/food_icons.mjs <그림.png> <cols> <rows> <메뉴 id (왼쪽 위부터 줄마다)...>
//   예: node tools/food_icons.mjs art_src/food_pocha.png 2 2 tteokbokki sundae odeng twigim --cut 440,471,560,447
//   --cut x0,y0,x1,y1 (여러 번 가능, 그림 px): 서로 맞닿아 한 덩어리로 붙은 음식을 이 선(3px)으로 끊어서 나눔 (끊은 선의 픽셀은 가까운 쪽 음식으로 돌아감)
//   2026-11-18 포장마차 그림 2판: 어묵 꼬치 끝이 떡볶이 접시 아래 테두리에 붙어 있음 → --cut 440,471,560,447
import { chromium } from "playwright-core";
import fs from "node:fs";
import { defringeInPage } from "./sprite_defringe.mjs";

const argv = process.argv.slice(2);
const cuts = [];
for (let i = argv.indexOf("--cut"); i >= 0; i = argv.indexOf("--cut")) {
  cuts.push(argv[i + 1].split(",").map(Number));
  argv.splice(i, 2);
}
const [src, cols, rows, ...ids] = argv;
const MAX = 360;
const b64 = fs.readFileSync(src).toString("base64");
fs.mkdirSync("public/assets/art/icons", { recursive: true });
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  const out = await page.evaluate(
    async ([b64, cols, rows, n, MAX, cuts]) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      // 바탕이 칠해진 그림: 가장자리에서 번져 바탕 지우기
      {
        const bid = ctx.getImageData(0, 0, w, h);
        const bd = bid.data;
        let clear = 0;
        for (let i = 3; i < bd.length; i += 4) if (bd[i] < 250) clear++;
        // 투명 바탕 그림인데 음식까지 살짝 비치는 것(가장 진한 알파 < 255, 2026-11-18 실내 포차 그림 = 246): 가장 진한 곳이 255 가 되게 늘림
        let amax = 0;
        for (let i = 3; i < bd.length; i += 4) amax = Math.max(amax, bd[i]);
        if (amax > 0 && amax < 255) {
          for (let i = 3; i < bd.length; i += 4) bd[i] = Math.min(255, Math.round((bd[i] * 255) / amax));
          ctx.putImageData(bid, 0, 0);
        }
        if (clear === 0) {
          const bgLike = (i) => {
            const r = bd[i * 4], g = bd[i * 4 + 1], b = bd[i * 4 + 2];
            return (r + g + b) / 3 >= 222 && Math.max(r, g, b) - Math.min(r, g, b) <= 24;
          };
          const bg = new Uint8Array(w * h);
          const st = [];
          for (let x = 0; x < w; x++) st.push(x, (h - 1) * w + x);
          for (let y = 0; y < h; y++) st.push(y * w, y * w + w - 1);
          const q = st.filter((i) => bgLike(i));
          for (const i of q) bg[i] = 1;
          while (q.length > 0) {
            const i = q.pop();
            const x = i % w, y = (i / w) | 0;
            for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = x + ax, ny = y + ay;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              const j = ny * w + nx;
              if (bg[j] || !bgLike(j)) continue;
              bg[j] = 1;
              q.push(j);
            }
          }
          for (let i = 0; i < w * h; i++) if (bg[i]) bd[i * 4 + 3] = 0;
          ctx.putImageData(bid, 0, 0);
        }
      }
      const d = ctx.getImageData(0, 0, w, h).data;
      const solid = (i) => d[i * 4 + 3] > 24;
      // 덩어리 나누기. 음식끼리 살짝 닿아 한 덩어리가 되면 (2026-11-18 포장마차 그림: 어묵 꼬치 끝이 떡볶이 접시에 닿음)
      // 칸 하나가 비므로, 가장자리를 r px 깎아(침식) 닿은 곳을 끊고 덩어리를 나눈 뒤 깎인 픽셀은 가까운 덩어리로 되돌림. r 을 0 부터 키워 가며 칸이 다 찰 때까지
      const label = (r) => {
        let m = new Uint8Array(w * h);
        for (let i = 0; i < w * h; i++) m[i] = solid(i) ? 1 : 0;
        if (r > 0) {
          const t = new Uint8Array(w * h);
          for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
              let ok = 1;
              for (let k = -r; k <= r && ok; k++) {
                const xx = x + k;
                if (xx < 0 || xx >= w || !m[y * w + xx]) ok = 0;
              }
              t[y * w + x] = ok;
            }
          const u = new Uint8Array(w * h);
          for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
              let ok = 1;
              for (let k = -r; k <= r && ok; k++) {
                const yy = y + k;
                if (yy < 0 || yy >= h || !t[yy * w + x]) ok = 0;
              }
              u[y * w + x] = ok;
            }
          m = u;
        }
        // 끊는 선 (3px 두께)
        for (const [ax, ay, bx, by] of cuts) {
          const len = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
          for (let k = 0; k <= len; k++) {
            const px = ax + ((bx - ax) * k) / len, py = ay + ((by - ay) * k) / len;
            for (let oy = -1; oy <= 1; oy++)
              for (let ox = -1; ox <= 1; ox++) {
                const x = Math.round(px) + ox, y = Math.round(py) + oy;
                if (x >= 0 && y >= 0 && x < w && y < h) m[y * w + x] = 0;
              }
          }
        }
        const lab = new Int32Array(w * h).fill(-1);
        let nid = 0;
        const flood = (s0, ok) => {
          const st = [s0];
          lab[s0] = nid;
          while (st.length > 0) {
            const i = st.pop();
            const x = i % w, y = (i / w) | 0;
            for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = x + ax, ny = y + ay;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              const j = ny * w + nx;
              if (lab[j] < 0 && ok(j)) {
                lab[j] = nid;
                st.push(j);
              }
            }
          }
          nid++;
        };
        for (let i = 0; i < w * h; i++) if (m[i] && lab[i] < 0) flood(i, (j) => m[j] === 1);
        // 깎인 픽셀을 가까운 덩어리로 (너비 우선)
        let q = [];
        for (let i = 0; i < w * h; i++) if (lab[i] >= 0) q.push(i);
        while (q.length > 0) {
          const nq = [];
          for (const i of q) {
            const x = i % w, y = (i / w) | 0;
            for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = x + ax, ny = y + ay;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              const j = ny * w + nx;
              if (lab[j] < 0 && solid(j)) {
                lab[j] = lab[i];
                nq.push(j);
              }
            }
          }
          q = nq;
        }
        // 다 깎여 없어진 작은 조각
        for (let i = 0; i < w * h; i++) if (solid(i) && lab[i] < 0) flood(i, (j) => solid(j));
        const boxes = Array.from({ length: nid }, () => ({ x0: w, y0: h, x1: 0, y1: 0, sx: 0, sy: 0, cnt: 0 }));
        for (let i = 0; i < w * h; i++) {
          const id = lab[i];
          if (id < 0) continue;
          const bx = boxes[id];
          const x = i % w, y = (i / w) | 0;
          bx.x0 = Math.min(bx.x0, x); bx.x1 = Math.max(bx.x1, x); bx.y0 = Math.min(bx.y0, y); bx.y1 = Math.max(bx.y1, y);
          bx.sx += x; bx.sy += y; bx.cnt++;
        }
        for (const bx of boxes) {
          bx.cx = bx.sx / Math.max(1, bx.cnt);
          bx.cy = bx.sy / Math.max(1, bx.cnt);
        }
        return { lab, boxes };
      };
      let lab, boxes;
      for (let r = 0; r <= 8; r++) {
        ({ lab, boxes } = label(r));
        const filled = new Set();
        for (const bx of boxes) if (bx.cnt >= 3000) filled.add(Math.min(rows - 1, Math.floor((bx.cy / h) * rows)) * cols + Math.min(cols - 1, Math.floor((bx.cx / w) * cols)));
        if ([...Array(n).keys()].every((k) => filled.has(k))) break;
      }
      // 칸마다 모으기 (아주 작은 티끌은 버림)
      const cells = Array.from({ length: n }, () => ({ x0: w, y0: h, x1: 0, y1: 0, ids: new Set() }));
      // 큰 덩어리는 무게 중심이 든 칸, 부스러기는 가장 가까운 큰 덩어리의 칸으로
      const BIG = 3000;
      const cellOf = new Map();
      boxes.forEach((b, id) => {
        if (b.cnt >= BIG) cellOf.set(id, Math.min(rows - 1, Math.floor((b.cy / h) * rows)) * cols + Math.min(cols - 1, Math.floor((b.cx / w) * cols)));
      });
      const gap = (a, b) => Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.y0 - b.y1, b.y0 - a.y1));
      boxes.forEach((b, id) => {
        if (b.cnt < 30) return;
        let k = cellOf.get(id);
        if (k === undefined) {
          let best = Infinity;
          for (const [bid, bk] of cellOf) {
            const g = gap(b, boxes[bid]);
            if (g < best) { best = g; k = bk; }
          }
        }
        if (k === undefined || k >= n) return;
        const cell = cells[k];
        cell.ids.add(id);
        cell.x0 = Math.min(cell.x0, b.x0); cell.y0 = Math.min(cell.y0, b.y0);
        cell.x1 = Math.max(cell.x1, b.x1); cell.y1 = Math.max(cell.y1, b.y1);
      });
      const id0 = ctx.getImageData(0, 0, w, h);
      return cells.map((cell) => {
        const cw = cell.x1 - cell.x0 + 1, ch = cell.y1 - cell.y0 + 1;
        const part = new ImageData(cw, ch);
        for (let y = 0; y < ch; y++)
          for (let x = 0; x < cw; x++) {
            const i = (cell.y0 + y) * w + cell.x0 + x;
            if (!cell.ids.has(lab[i])) continue;
            for (let q = 0; q < 4; q++) part.data[(y * cw + x) * 4 + q] = id0.data[i * 4 + q];
          }
        const pc = document.createElement("canvas");
        pc.width = cw;
        pc.height = ch;
        pc.getContext("2d").putImageData(part, 0, 0);
        const k = Math.min(1, MAX / Math.max(cw, ch));
        const oc = document.createElement("canvas");
        oc.width = Math.round(cw * k);
        oc.height = Math.round(ch * k);
        const octx = oc.getContext("2d");
        octx.imageSmoothingQuality = "high";
        octx.drawImage(pc, 0, 0, oc.width, oc.height);
        return { png: oc.toDataURL("image/png"), w: oc.width, h: oc.height, box: [cell.x0, cell.y0, cell.x1, cell.y1] };
      });
    },
    [b64, +cols, +rows, ids.length, MAX, cuts],
  );
  for (let i = 0; i < out.length; i++) {
    const o = out[i];
    // 밝은 바탕과 섞인 가장자리 정리 (손님 그림과 같은 도구)
    const png = (await page.evaluate(defringeInPage, o.png)).png;
    fs.writeFileSync(`public/assets/art/icons/${ids[i]}.png`, Buffer.from(png.split(",")[1], "base64"));
    console.log(`${ids[i]}: ${o.w}×${o.h} (원본 ${o.box.join(",")})`);
  }
} finally {
  await browser.close();
}
