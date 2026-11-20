// 메인(타이틀) 화면 UI 를 더 밝고 하얗게 (2026-11-18 사용자 "게임 시작 화면 UI 색 좀 더 밝게, 조금 더 하얗게").
// 그림 속 UI(제목 글자·"오늘도 장사중!" 띠·나무판 버튼 4개)와 로그인 버튼 그림만 밝히고 사람·거리 그림은 그대로 둔다.
//   art_src/title_menu.png      → public/assets/art/title/menu.webp   (REGIONS 안의 UI 만)
//   art_src/ui_login_button.png → public/assets/art/ui/login_button.webp (tools/cutout_slate.mjs 로 오린 뒤 전부)
// 밝히기 = 흰색 쪽으로 섞기: c + (255 - c) × LIFT × w, w = 밝기 70~170 사이 smoothstep (검은 선·글자 테두리는 그대로).
// "게임 시작" 빨간 판 몸통만 흰색을 섞지 않고 밝기를 곱함 (RED_GAIN, 분홍으로 바래지 않게) — 그 위 글자는 똑같이 하얗게.
// UI 자리 찾기 (그림 px 네모 안): "light" = 밝은 픽셀(밝기 ≥ t) 덩어리, "red" = 붉은 판 덩어리, "dark" = 제목 뒤 검은 판 덩어리
// (가는 선은 열기 연산으로 떼어 냄). 덩어리 안 구멍(글자·아이콘)을 메우고 3px 넓혀서 테두리 쪽 번짐까지 밝힌다.
// node tools/title_ui_art.mjs [--preview]  (--preview = tests/shots/title_ui_mask.png 에 밝힌 자리 표시)
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const LIFT = 0.42;
export const RED_GAIN = 0.12; // "게임 시작" 빨간 판 몸통은 흰색 대신 밝기만 ×1.12 (색이 바래지 않게)
const REGIONS = [
  { name: "logo", rect: [1100, 40, 1640, 232], kind: "light", t: 125, minArea: 60 },
  { name: "ribbon", rect: [1225, 238, 1610, 330], kind: "light", t: 120, minArea: 600 },
  { name: "start", rect: [1305, 362, 1652, 490], kind: "red", minArea: 3000 },
  { name: "continue", rect: [1336, 470, 1638, 572], kind: "light", t: 120, minArea: 3000 },
  { name: "settings", rect: [1349, 556, 1638, 660], kind: "light", t: 120, minArea: 3000 },
  { name: "quit", rect: [1366, 642, 1638, 748], kind: "light", t: 120, minArea: 3000 },
];
const preview = process.argv.includes("--preview");

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  const run = (src, mime, regions, withPreview) =>
    page.evaluate(
      async ([b64, mime, regions, LIFT, RED_GAIN, withPreview]) => {
        const img = new Image();
        img.src = `data:${mime};base64,` + b64;
        await img.decode();
        const w = img.naturalWidth, h = img.naturalHeight, N = w * h;
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const id = ctx.getImageData(0, 0, w, h);
        const d = id.data;
        const L = (i) => 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
        const mask = new Uint8Array(N);
        const report = [];
        if (regions === null) {
          for (let i = 0; i < N; i++) if (d[i * 4 + 3] > 0) mask[i] = 1;
        }
        for (const r of regions ?? []) {
          const [x0, y0, x1, y1] = r.rect;
          const rw = x1 - x0, rh = y1 - y0, M = rw * rh;
          const at = (lx, ly) => (y0 + ly) * w + x0 + lx;
          let sel = new Uint8Array(M);
          for (let ly = 0; ly < rh; ly++)
            for (let lx = 0; lx < rw; lx++) {
              const i = at(lx, ly);
              const R = d[i * 4], G = d[i * 4 + 1], B = d[i * 4 + 2];
              sel[ly * rw + lx] = r.kind === "light" ? +(L(i) >= r.t) : r.kind === "red" ? +(R - B > 60 && R - G > 45 && L(i) > 60) : +(L(i) < 48);
            }
          const morph = (a, grow) => {
            const o = new Uint8Array(M);
            for (let ly = 0; ly < rh; ly++)
              for (let lx = 0; lx < rw; lx++) {
                let v = grow ? 0 : 1;
                for (let dy = -1; dy <= 1 && v === (grow ? 0 : 1); dy++)
                  for (let dx = -1; dx <= 1; dx++) {
                    const xx = lx + dx, yy = ly + dy;
                    const s = xx < 0 || yy < 0 || xx >= rw || yy >= rh ? 0 : a[yy * rw + xx];
                    if (grow ? s : !s) { v = grow ? 1 : 0; break; }
                  }
                o[ly * rw + lx] = v;
              }
            return o;
          };
          // 가는 선 떼기 (검은 판: 건물 선이 판에 붙어 있어서)
          for (let k = 0; k < (r.open ?? 0); k++) sel = morph(sel, false);
          for (let k = 0; k < (r.open ?? 0); k++) sel = morph(sel, true);
          // 덩어리: dark = 가장 큰 것 하나, light/red = minArea 보다 큰 것 전부
          const comp = new Int32Array(M).fill(-1);
          const sizes = [];
          for (let s = 0; s < M; s++) {
            if (!sel[s] || comp[s] >= 0) continue;
            const k = sizes.length;
            let n = 0;
            const st = [s];
            comp[s] = k;
            while (st.length) {
              const p = st.pop();
              n++;
              const px = p % rw, py = (p / rw) | 0;
              for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const xx = px + dx, yy = py + dy;
                if (xx < 0 || yy < 0 || xx >= rw || yy >= rh) continue;
                const q = yy * rw + xx;
                if (sel[q] && comp[q] < 0) { comp[q] = k; st.push(q); }
              }
            }
            sizes.push(n);
          }
          const big = sizes.length ? Math.max(...sizes) : 0;
          const keep = sizes.map((n) => (r.kind === "dark" ? n === big : n >= r.minArea));
          let m = new Uint8Array(M);
          for (let p = 0; p < M; p++) if (comp[p] >= 0 && keep[comp[p]]) m[p] = 1;
          // 구멍 메우기: 네모 가장자리에서 덩어리 밖으로 못 가는 곳 = 안쪽
          const out = new Uint8Array(M);
          const st = [];
          for (let lx = 0; lx < rw; lx++) st.push(lx, (rh - 1) * rw + lx);
          for (let ly = 0; ly < rh; ly++) st.push(ly * rw, ly * rw + rw - 1);
          while (st.length) {
            const p = st.pop();
            if (out[p] || m[p]) continue;
            out[p] = 1;
            const px = p % rw, py = (p / rw) | 0;
            if (px > 0) st.push(p - 1);
            if (px < rw - 1) st.push(p + 1);
            if (py > 0) st.push(p - rw);
            if (py < rh - 1) st.push(p + rw);
          }
          for (let p = 0; p < M; p++) if (!out[p]) m[p] = 1;
          for (let k = 0; k < 3; k++) m = morph(m, true);
          let area = 0;
          for (let ly = 0; ly < rh; ly++)
            for (let lx = 0; lx < rw; lx++)
              if (m[ly * rw + lx]) { mask[at(lx, ly)] = r.kind === "red" ? 2 : 1; area++; }
          report.push(`${r.name} ${area}px (${keep.filter(Boolean).length}덩어리)`);
        }
        const ss = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
        let prev = null;
        if (withPreview) {
          prev = new ImageData(new Uint8ClampedArray(d), w, h);
          for (let i = 0; i < N; i++) if (!mask[i]) for (let ch = 0; ch < 3; ch++) prev.data[i * 4 + ch] *= 0.25;
        }
        for (let i = 0; i < N; i++) {
          if (!mask[i]) continue;
          const R = d[i * 4], G = d[i * 4 + 1], B = d[i * 4 + 2];
          if (mask[i] === 2 && R - B > 50 && R - G > 35) {
            // 빨간 판 몸통: 흰색을 섞으면 분홍으로 바래서, 색은 그대로 밝기만 올림
            const k = 1.0 + RED_GAIN * ss((L(i) - 60) / 50);
            for (let ch = 0; ch < 3; ch++) d[i * 4 + ch] = Math.min(255, Math.round(d[i * 4 + ch] * k));
            continue;
          }
          const a = LIFT * ss((L(i) - 70) / 100);
          for (let ch = 0; ch < 3; ch++) d[i * 4 + ch] = Math.round(d[i * 4 + ch] + (255 - d[i * 4 + ch]) * a);
        }
        ctx.putImageData(id, 0, 0);
        const webp = c.toDataURL("image/webp", 0.9);
        let png = null;
        if (prev) {
          ctx.putImageData(prev, 0, 0);
          png = c.toDataURL("image/png");
        }
        return { w, h, webp, png, report };
      },
      [fs.readFileSync(src).toString("base64"), mime, regions, LIFT, RED_GAIN, withPreview],
    );
  const save = (file, dataUrl) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(dataUrl.split(",")[1], "base64"));
  };
  const t = await run("art_src/title_menu.png", "image/png", REGIONS, preview);
  save("public/assets/art/title/menu.webp", t.webp);
  if (t.png) save("tests/shots/title_ui_mask.png", t.png);
  console.log(`title/menu.webp ${t.w}×${t.h}: ${t.report.join(", ")}`);
  // 로그인 버튼: 회색 바탕을 오려 낸 뒤 (tools/cutout_slate.mjs) 그림 전체를 밝힘
  const tmp = path.join(os.tmpdir(), `login_button_${process.pid}.webp`);
  execFileSync(process.execPath, ["tools/cutout_slate.mjs", "art_src/ui_login_button.png", tmp], { stdio: "inherit" });
  const lb = await run(tmp, "image/webp", null, false);
  fs.unlinkSync(tmp);
  save("public/assets/art/ui/login_button.webp", lb.webp);
  console.log(`ui/login_button.webp ${lb.w}×${lb.h}`);
} finally {
  await browser.close();
}
