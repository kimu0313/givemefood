// 사용자가 준 스테이지 지도 그림 한 장 → 게임 지도 배경 (2026-11-16 사용자 "이거 스테이지 배경에 넣어줘").
// 실행: node tools/world_map.mjs [원본=art_src/map_world.png]
//   1) 위·아래 흰 여백을 잘라 public/assets/art/map/world.webp 로 저장
//   2) 길 가운데 흰 줄을 왼쪽부터 따라가며 (동적 계획법) 길 중심선을 뽑고
//   3) 길이 꺾이는 곳 (꼭대기 = 가게 경계, 바닥 = 가게 건물 앞) 을 찾아
//   4) src/art/map_world.ts 에 지도 좌표(높이 1080 기준)로 써 둔다 → map_geo 가 이걸로 스테이지 발판·가게 자리를 잡음
// 새 그림을 받으면 art_src/map_world.png 를 바꾸고 다시 실행하면 된다 (가게 5곳 = 꼭대기 5개·바닥 5개가 나와야 함).
import { chromium } from "playwright-core";
import fs from "node:fs";

const src = process.argv[2] ?? "art_src/map_world.png";
const b64 = fs.readFileSync(src).toString("base64");
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  const r = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const c0 = document.createElement("canvas");
    c0.width = w;
    c0.height = h;
    const x0 = c0.getContext("2d");
    x0.drawImage(img, 0, 0);
    const d0 = x0.getImageData(0, 0, w, h).data;
    const isWhite = (x, y) => {
      const i = (y * w + x) * 4;
      return d0[i] > 245 && d0[i + 1] > 245 && d0[i + 2] > 245;
    };
    const rowInk = (y) => {
      let n = 0;
      for (let x = 0; x < w; x += 4) if (!isWhite(x, y)) n++;
      return n / (w / 4);
    };
    let top = 0;
    while (top < h - 1 && rowInk(top) < 0.5) top++;
    let bot = h - 1;
    while (bot > top && rowInk(bot) < 0.5) bot--;
    const H = bot - top + 1;
    // 1) 잘라서 WebP
    const c = document.createElement("canvas");
    c.width = w;
    c.height = H;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, top, w, H, 0, 0, w, H);
    const webp = c.toDataURL("image/webp", 0.95);
    // 2) 길 가운데 흰 줄 따라가기
    const d = ctx.getImageData(0, 0, w, H).data;
    const white = (x, y) => {
      if (y < 0 || y >= H) return 0;
      const i = (y * w + x) * 4;
      const mn = Math.min(d[i], d[i + 1], d[i + 2]);
      const mx = Math.max(d[i], d[i + 1], d[i + 2]);
      return mn > 225 && mx - mn < 40 ? 1 : 0;
    };
    const score = (x, y) => white(x, y) + 0.5 * (white(x, y - 1) + white(x, y + 1));
    const Y0 = Math.round(H * 0.2);
    const Y1 = Math.round(H * 0.97);
    const n = Y1 - Y0;
    let cost = new Float64Array(n);
    const back = [];
    for (let x = 0; x < w; x++) {
      const nc = new Float64Array(n);
      const bk = new Int16Array(n);
      for (let j = 0; j < n; j++) {
        let best = Infinity;
        let bj = j;
        for (let dj = -3; dj <= 3; dj++) {
          const k = j + dj;
          if (k < 0 || k >= n) continue;
          const v = cost[k] + Math.abs(dj) * 0.35;
          if (v < best) {
            best = v;
            bj = k;
          }
        }
        nc[j] = best + (2 - score(x, Y0 + j));
        bk[j] = bj;
      }
      cost = nc;
      back.push(bk);
    }
    let j = 0;
    for (let k = 1; k < n; k++) if (cost[k] < cost[j]) j = k;
    const ys = new Array(w);
    for (let x = w - 1; x >= 0; x--) {
      ys[x] = Y0 + j;
      j = back[x][j];
    }
    const hit = ys.map((y, x) => (score(x, y) > 0.9 ? 1 : 0));
    return { w, H, top, webp, ys, hit };
  }, b64);

  // 길 끝: 흰 줄이 30px 넘게 안 보이기 시작하는 곳
  let end = r.w - 1;
  for (let x = 0; x < r.w - 30; x++) {
    let miss = 0;
    for (let k = x; k < x + 30; k++) miss += 1 - r.hit[k];
    if (miss > 24 && x > r.w * 0.5) {
      end = x;
      break;
    }
  }
  // 부드럽게 (창 15px)
  const sm = r.ys.map((_, x) => {
    let s = 0;
    let c = 0;
    for (let k = Math.max(0, x - 7); k <= Math.min(end, x + 7); k++) {
      s += r.ys[k];
      c++;
    }
    return s / c;
  });
  // 꺾이는 곳: 꼭대기(작은 y) · 바닥(큰 y), 서로 150px 넘게 떨어진 것만
  const extrema = (sign) => {
    const out = [];
    for (let x = 20; x < end - 5; x++) {
      let ok = true;
      for (let k = Math.max(0, x - 60); k <= Math.min(end, x + 60); k++) if (sign * sm[k] > sign * sm[x] + 1e-9) ok = false;
      if (ok && (out.length === 0 || x - out[out.length - 1] > 150)) out.push(x);
    }
    return out;
  };
  const peaks = extrema(-1);
  // 바닥은 마지막 꼭대기(빈터로 가는 길) 앞까지만 — 길 끝이 바닥처럼 잡히는 것 빼기
  const bottoms = extrema(1).filter((x) => x < peaks[peaks.length - 1]);
  const k = 1080 / r.H;
  const path = [];
  for (let x = 0; x <= end; x += 6) path.push([+(x * k).toFixed(1), +(sm[x] * k).toFixed(1)]);
  fs.mkdirSync("public/assets/art/map", { recursive: true });
  fs.writeFileSync("public/assets/art/map/world.webp", Buffer.from(r.webp.split(",")[1], "base64"));
  const ts = `// 자동 생성: node tools/world_map.mjs (원본 ${src}, ${r.w}×${r.H} 를 높이 1080 으로 ${k.toFixed(4)}배) — 직접 고치지 말 것.
// 사용자가 준 스테이지 지도 그림의 길 가운데 선과 꺾이는 곳 (지도 좌표). map_geo 가 이걸로 발판·가게 자리를 잡는다.

export const WORLD_FILE = "map/world.webp";
export const WORLD_IMG_W = ${r.w};
export const WORLD_IMG_H = ${r.H};
export const WORLD_SCALE = ${k.toFixed(6)};
export const WORLD_W = ${Math.round(r.w * k)};
/** 길 가운데 선 (왼쪽 → 오른쪽, 지도 좌표 [x, y]) */
export const WORLD_PATH: [number, number][] = ${JSON.stringify(path)};
/** 길 꼭대기 x (가게와 가게 사이 · 마지막은 실내 포차와 빈터 사이) */
export const WORLD_PEAKS = ${JSON.stringify(peaks.map((x) => +(x * k).toFixed(1)))};
/** 길 바닥 x (가게 건물이 서는 곳 앞) */
export const WORLD_BOTTOMS = ${JSON.stringify(bottoms.map((x) => +(x * k).toFixed(1)))};
`;
  fs.writeFileSync("src/art/map_world.ts", ts);
  console.log(`잘라 냄: 위 ${r.top}px, ${r.w}×${r.H} → public/assets/art/map/world.webp`);
  console.log(`길 끝 x=${end}, 꼭대기 ${peaks.join(",")} / 바닥 ${bottoms.join(",")} → src/art/map_world.ts (점 ${path.length}개)`);
} finally {
  await browser.close();
}
