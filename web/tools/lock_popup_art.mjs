// 잠긴 스테이지 팝업 그림 (2026-11-22 사용자 그림 "안 깨진 스테이지 눌렀을 때 나오는 UI 이렇게"):
//   art_src/ui_lock_popup.png (투명 바탕 1590×989: 양피지 창 + 주황 리본 "스테이지 9" + 자물쇠 + 가게 이름 + 안내 한 줄 + 밑줄 + 갈색 "확인" 버튼)
//   → 글씨(리본 제목 · 가게 이름 · 안내 · 버튼 글씨)를 지워 public/assets/art/ui/popup_lock.webp. 게임이 그 자리에 그때그때 글씨를 씀 (다른 언어도).
// 지우기: "all" = 네모 안 전부를 둘레 색에서 번져 채움 (리본·버튼 위 글씨), "text" = 네모 안 어두운 글씨(+3px)만 번져 채움 (양피지 위 글씨, 자물쇠·밑줄은 남김)
// 실행: node tools/lock_popup_art.mjs [preview.png] → 잘라 낸 크기 + 원본에서의 왼쪽 위
import { chromium } from "playwright-core";
import fs from "node:fs";

const SRC = "art_src/ui_lock_popup.png";
const OUT = "public/assets/art/ui/popup_lock.webp";
const ERASE = [
  [565, 58, 1030, 158, "all"], // 리본 제목
  [630, 432, 962, 516, "text"], // 가게 이름
  [376, 536, 1224, 616, "text"], // 안내 한 줄 (밑줄 y 625~ 은 남김)
  [694, 692, 898, 815, "all"], // 버튼 글씨 (아래 그림자 줄 y 820~ 은 안 건드림)
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
      const w = img.naturalWidth, h = img.naturalHeight, N = w * h;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const id = ctx.getImageData(0, 0, w, h);
      const d = id.data;
      const lum = (i) => (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3;
      const hole = new Uint8Array(N);
      for (const [x0, y0, x1, y1, mode] of ERASE) {
        if (mode === "all") {
          for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) hole[y * w + x] = 1;
          continue;
        }
        const dark = new Uint8Array(N);
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (lum(y * w + x) < 205) dark[y * w + x] = 1;
        for (let y = y0; y < y1; y++)
          for (let x = x0; x < x1; x++) {
            let on = false;
            for (let dy = -3; dy <= 3 && !on; dy++) for (let dx = -3; dx <= 3; dx++) {
              const xx = x + dx, yy = y + dy;
              if (xx >= x0 && yy >= y0 && xx < x1 && yy < y1 && dark[yy * w + xx]) { on = true; break; }
            }
            if (on) hole[y * w + x] = 1;
          }
      }
      const list = [];
      for (let i = 0; i < N; i++) if (hole[i]) list.push(i);
      const col = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) for (let ch = 0; ch < 3; ch++) col[i * 3 + ch] = d[i * 4 + ch];
      for (const i of list) {
        const y = (i / w) | 0, x = i % w;
        let l = x, rr = x;
        while (l > 0 && hole[y * w + l]) l--;
        while (rr < w - 1 && hole[y * w + rr]) rr++;
        const t = (x - l) / Math.max(1, rr - l);
        for (let ch = 0; ch < 3; ch++) col[i * 3 + ch] = d[(y * w + l) * 4 + ch] * (1 - t) + d[(y * w + rr) * 4 + ch] * t;
      }
      for (let it = 0; it < 320; it++)
        for (const i of list) for (let ch = 0; ch < 3; ch++) col[i * 3 + ch] = (col[(i - 1) * 3 + ch] + col[(i + 1) * 3 + ch] + col[(i - w) * 3 + ch] + col[(i + w) * 3 + ch]) * 0.25;
      let seed = 7;
      const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) - 0.5;
      for (const i of list) {
        const n = rnd() * 6;
        for (let ch = 0; ch < 3; ch++) d[i * 4 + ch] = Math.max(0, Math.min(255, col[i * 3 + ch] + n));
        d[i * 4 + 3] = 255;
      }
      ctx.putImageData(id, 0, 0);
      let x0 = w, y0 = h, x1 = 0, y1 = 0;
      for (let i = 0; i < N; i++) {
        if (d[i * 4 + 3] < 8) continue;
        const x = i % w, y = (i / w) | 0;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
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
      return { ox: x0, oy: y0, w: o.width, h: o.height, webp: o.toDataURL("image/webp", 0.9), preview: prev.toDataURL("image/png") };
    },
    [b64, ERASE],
  );
  fs.mkdirSync("public/assets/art/ui", { recursive: true });
  const buf = Buffer.from(r.webp.split(",")[1], "base64");
  fs.writeFileSync(OUT, buf);
  if (process.argv[2]) fs.writeFileSync(process.argv[2], Buffer.from(r.preview.split(",")[1], "base64"));
  console.log(`${OUT} ${r.w}×${r.h} (${(buf.length / 1024) | 0}KB), 원본에서 (${r.ox}, ${r.oy})`);
} finally {
  await browser.close();
}
