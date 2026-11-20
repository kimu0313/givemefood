// 만화 한 쪽(칸 사이가 밝은 종이색) → 칸마다 잘라 투명 바탕 WebP (2026-11-20 사용자 "미식가 스테이지 누르면 플레이 전에 이 만화가 한 컷 한 컷 나오게")
//  1) 종이색 = 네 귀퉁이 평균 색. 거의 다 종이색인 가로줄 = 칸 사이 (위아래로 칸 줄을 나눔)
//  2) 칸 줄마다 거의 다 종이색인 세로줄 = 칸 사이 → 칸 네모
//  3) 칸 네모를 잘라 테두리에서 이어진 종이색(둥근 귀퉁이 바깥)을 투명으로
//  4) <출력 접두어>_<번호>.webp (왼쪽 위부터 읽는 순서) + 칸 자리(원본 px)를 출력 — src/ui/comic.ts COMICS 에 적음
// 실행: node tools/comic_panels.mjs art_src/comic_event_pocha.png public/assets/art/comic/pocha
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const [inp, outPrefix] = process.argv.slice(2);
if (!inp || !outPrefix) throw new Error("사용법: node tools/comic_panels.mjs <만화.png> <출력 접두어>");
const b64 = fs.readFileSync(inp).toString("base64");
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  const r = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const w = img.naturalWidth, h = img.naturalHeight;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, w, h).data;
    const P = [0, 1, 2].map((k) => (d[k] + d[(w - 1) * 4 + k] + d[((h - 1) * w) * 4 + k] + d[((h - 1) * w + w - 1) * 4 + k]) / 4);
    const paper = (x, y) => {
      const i = (y * w + x) * 4;
      return Math.abs(d[i] - P[0]) < 26 && Math.abs(d[i + 1] - P[1]) < 26 && Math.abs(d[i + 2] - P[2]) < 26;
    };
    const runs = (n, isGap) => {
      const out = [];
      let start = -1;
      for (let k = 0; k <= n; k++) {
        const g = k === n ? true : isGap(k);
        if (!g && start < 0) start = k;
        if (g && start >= 0) {
          if (k - start > 40) out.push([start, k]);
          start = -1;
        }
      }
      return out;
    };
    const rowGap = (y) => {
      let n = 0;
      for (let x = 0; x < w; x += 2) if (paper(x, y)) n++;
      return n >= (w / 2) * 0.97;
    };
    const panels = [];
    for (const [y0, y1] of runs(h, rowGap)) {
      const colGap = (x) => {
        let n = 0;
        for (let y = y0; y < y1; y += 2) if (paper(x, y)) n++;
        return n >= ((y1 - y0) / 2) * 0.97;
      };
      for (const [x0, x1] of runs(w, colGap)) panels.push([x0, y0, x1, y1]);
    }
    const out = [];
    for (const [x0, y0, x1, y1] of panels) {
      const pw = x1 - x0, ph = y1 - y0;
      const pc = document.createElement("canvas");
      pc.width = pw;
      pc.height = ph;
      const px = pc.getContext("2d");
      px.drawImage(c, x0, y0, pw, ph, 0, 0, pw, ph);
      const id = px.getImageData(0, 0, pw, ph);
      const pd = id.data;
      const N = pw * ph;
      const seen = new Uint8Array(N);
      const st = [];
      for (let x = 0; x < pw; x++) st.push(x, (ph - 1) * pw + x);
      for (let y = 0; y < ph; y++) st.push(y * pw, y * pw + pw - 1);
      while (st.length) {
        const i = st.pop();
        if (seen[i]) continue;
        const k = i * 4;
        if (!(Math.abs(pd[k] - P[0]) < 30 && Math.abs(pd[k + 1] - P[1]) < 30 && Math.abs(pd[k + 2] - P[2]) < 30)) continue;
        seen[i] = 1;
        pd[k + 3] = 0;
        const x = i % pw;
        if (x > 0) st.push(i - 1);
        if (x < pw - 1) st.push(i + 1);
        if (i >= pw) st.push(i - pw);
        if (i < N - pw) st.push(i + pw);
      }
      px.putImageData(id, 0, 0);
      out.push({ rect: [x0, y0, x1, y1], webp: pc.toDataURL("image/webp", 0.92) });
    }
    return { w, h, paper: P.map(Math.round), out };
  }, b64);
  fs.mkdirSync(path.dirname(outPrefix), { recursive: true });
  r.out.forEach((o, i) => fs.writeFileSync(`${outPrefix}_${i + 1}.webp`, Buffer.from(o.webp.split(",")[1], "base64")));
  console.log(`page ${r.w}×${r.h}, paper rgb(${r.paper}), ${r.out.length} panels:`);
  console.log(JSON.stringify(r.out.map((o) => o.rect)));
} finally {
  await browser.close();
}
