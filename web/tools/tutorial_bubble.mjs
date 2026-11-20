// 튜토리얼 이모 말풍선 (2026-11-18 사용자 그림 "이모 대사 UI": art_src/ui_tutorial_bubble.png, 1774×887, 체크무늬 바탕이 그려진 RGB)
//   → public/assets/art/ui/tut_panel.webp  말풍선 판 (이름표·꼬리·버튼을 지우고 테두리를 이어 그림) — CSS border-image 9조각으로 늘림
//   → public/assets/art/ui/tut_tag.webp    "포장마차 이모" 이름표 (글자 지움 → 게임이 글자를 씀, 다른 언어도)
//   → public/assets/art/ui/tut_ok.webp     주황 버튼 (글자 지움, "좋아요!"·"영업 계속!" …)
//   → public/assets/art/ui/tut_skip.webp   "건너뛰기" 버튼 (글자 지움)
// 꼬리는 자리가 단계마다 바뀌어서(왼쪽·오른쪽, 위·아래) 그림과 같은 색의 SVG 로 그린다 (src/ui/tutorial.ts).
// 좌표는 모두 원본 그림 px. 실행: node tools/tutorial_bubble.mjs  (+ tests/shots/tut_bubble_preview.png)
import { chromium } from "playwright-core";
import fs from "node:fs";
import { defringeInPage } from "./sprite_defringe.mjs";

const SRC = "art_src/ui_tutorial_bubble.png";
const CFG = {
  // 이름표 자리를 오른쪽 윗변(같은 높이)으로 덮어 테두리를 이음: [x0, x1, y0, y1, 오른쪽으로 몇 px 떨어진 곳을 베낄지]
  tagFix: [343, 762, 92, 248, 415],
  // 꼬리 자리: 왼쪽 테두리를 위아래 테두리 위치 사이로 이어 그림 (y0 ~ y1, x0 ~ x1), 베낄 줄 = 위로 up px
  tailFix: { y0: 466, y1: 582, x0: 168, x1: 362, up: 122 },
  // 버튼 자리: 위쪽 종이로 덮음
  btnFix: [966, 1620, 424, 598, 176],
  // 조각 (오려 낼 네모)
  tag: [336, 100, 768, 236],
  ok: [972, 428, 1354, 594],
  skip: [1350, 442, 1614, 586],
  // 글자 지울 곳 (줄마다 왼쪽·오른쪽 끝 색을 이어 칠함)
  tagText: [396, 128, 708, 202],
  okText: [1062, 458, 1272, 544],
  skipText: [1398, 474, 1566, 532],
};

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  const b64 = fs.readFileSync(SRC).toString("base64");
  const r = await page.evaluate(
    async ([b64, C]) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const W = img.naturalWidth;
      const H = img.naturalHeight;
      const mk = (w, h) => {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        return c;
      };
      const base = mk(W, H);
      const bctx = base.getContext("2d");
      bctx.drawImage(img, 0, 0);
      const orig = bctx.getImageData(0, 0, W, H).data;
      const lum = (d, i) => (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3;
      const sat = (d, i) => Math.max(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) - Math.min(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);

      // 글자 지우기 (줄마다 좌우 끝 색 보간)
      const eraseText = (d, w, [x0, y0, x1, y1]) => {
        const avg = (x, y, dx) => {
          const o = [0, 0, 0];
          for (let j = 0; j < 3; j++) {
            const i = (y * w + x + dx * j) * 4;
            for (let ch = 0; ch < 3; ch++) o[ch] += d[i + ch] / 3;
          }
          return o;
        };
        let seed = 7;
        const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) - 0.5;
        for (let y = y0; y <= y1; y++) {
          const L = avg(x0 - 1, y, -1);
          const R = avg(x1 + 1, y, 1);
          for (let x = x0; x <= x1; x++) {
            const t = (x - x0) / (x1 - x0);
            const n = rnd() * 8;
            const i = (y * w + x) * 4;
            for (let ch = 0; ch < 3; ch++) d[i + ch] = Math.max(0, Math.min(255, L[ch] * (1 - t) + R[ch] * t + n));
          }
        }
      };

      // ---- 판: 이름표·꼬리·버튼 자리 고치기
      const pid = bctx.getImageData(0, 0, W, H);
      const P = pid.data;
      const copyPx = (dx, dy, sx, sy, a) => {
        const i = (dy * W + dx) * 4;
        const j = (sy * W + sx) * 4;
        for (let ch = 0; ch < 3; ch++) P[i + ch] = P[i + ch] * (1 - a) + orig[j + ch] * a;
      };
      {
        const [x0, x1, y0, y1, off] = C.tagFix;
        const F = 8;
        for (let y = y0; y <= y1; y++)
          for (let x = x0; x <= x1; x++) copyPx(x, y, x + off, y, Math.min(1, (Math.min(x - x0, x1 - x) + 1) / F));
      }
      {
        // 왼쪽 테두리 바깥 x (첫 먹선)
        const edgeX = (y) => {
          for (let x = 240; x < 380; x++) if (lum(orig, y * W + x) < 80) return x;
          return 300;
        };
        const { y0, y1, x0, x1, up } = C.tailFix;
        const a0 = edgeX(y0 - 2);
        const a1 = edgeX(y1 + 2);
        for (let y = y0; y <= y1; y++) {
          const want = a0 + ((a1 - a0) * (y - y0)) / (y1 - y0);
          const sy = y - up;
          const shift = Math.round(want - edgeX(sy));
          const edgeA = Math.min(1, (Math.min(y - y0, y1 - y) + 1) / 4);
          for (let x = x0; x <= x1; x++) {
            const sx = Math.max(0, Math.min(W - 1, x - shift));
            copyPx(x, y, sx, sy, Math.min(edgeA, Math.min(1, (x1 - x + 1) / 8)));
          }
        }
      }
      {
        const [x0, x1, y0, y1, up] = C.btnFix;
        const F = 8;
        for (let y = y0; y <= y1; y++)
          for (let x = x0; x <= x1; x++) copyPx(x, y, x, y - up, Math.min(1, (Math.min(x - x0, x1 - x, y - y0) + 1) / F, (y1 - y + 1) / 3));
      }
      // 바탕(체크무늬) 날리기: 그림 가장자리에서 밝고 색 없는 곳을 따라 번짐
      const bgLike = (i) => lum(P, i) > 150 && sat(P, i) < 40;
      const bg = new Uint8Array(W * H);
      const st = [];
      for (let x = 0; x < W; x++) st.push(x, (H - 1) * W + x);
      for (let y = 0; y < H; y++) st.push(y * W, y * W + W - 1);
      for (const i of st) bg[i] = bgLike(i) ? 1 : 0;
      const q = st.filter((i) => bg[i]);
      while (q.length > 0) {
        const i = q.pop();
        const x = i % W;
        const y = (i / W) | 0;
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + ax, ny = y + ay;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (bg[j] || !bgLike(j)) continue;
          bg[j] = 1;
          q.push(j);
        }
      }
      // 판 덩어리 하나만 남김 (꼬리 끝에 남은 먹선 부스러기 등)
      {
        const lab = new Int32Array(W * H).fill(-1);
        let best = -1, bestN = 0;
        for (let s0 = 0; s0 < W * H; s0++) {
          if (bg[s0] || lab[s0] >= 0) continue;
          const id = s0;
          const s1 = [s0];
          lab[s0] = id;
          let n = 0;
          while (s1.length > 0) {
            const i = s1.pop();
            n++;
            const x = i % W, y = (i / W) | 0;
            for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = x + ax, ny = y + ay;
              if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
              const j = ny * W + nx;
              if (bg[j] || lab[j] >= 0) continue;
              lab[j] = id;
              s1.push(j);
            }
          }
          if (n > bestN) { bestN = n; best = id; }
        }
        for (let i = 0; i < W * H; i++) if (!bg[i] && lab[i] !== best) bg[i] = 1;
      }
      let bx0 = W, by0 = H, bx1 = 0, by1 = 0;
      for (let i = 0; i < W * H; i++) {
        P[i * 4 + 3] = bg[i] ? 0 : 255;
        if (!bg[i]) {
          const x = i % W, y = (i / W) | 0;
          bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y);
        }
      }
      bctx.putImageData(pid, 0, 0);
      const panel = mk(bx1 - bx0 + 1, by1 - by0 + 1);
      panel.getContext("2d").drawImage(base, bx0, by0, panel.width, panel.height, 0, 0, panel.width, panel.height);

      // ---- 조각 (이름표·버튼): 원본에서 잘라 글자 지우고, 네모 가장자리에서 먹선 바깥(밝은 곳)을 날림
      const piece = (rect, text, keepPoly) => {
        const [x0, y0, x1, y1] = rect;
        const w = x1 - x0 + 1, h = y1 - y0 + 1;
        const c = mk(w, h);
        const ctx = c.getContext("2d");
        ctx.drawImage(img, x0, y0, w, h, 0, 0, w, h);
        const id = ctx.getImageData(0, 0, w, h);
        const d = id.data;
        eraseText(d, w, [text[0] - x0, text[1] - y0, text[2] - x0, text[3] - y0]);
        const out = new Uint8Array(w * h);
        const s = [];
        const light = (i) => lum(d, i) > 75;
        for (let x = 0; x < w; x++) s.push(x, (h - 1) * w + x);
        for (let y = 0; y < h; y++) s.push(y * w, y * w + w - 1);
        for (const i of s) if (light(i)) out[i] = 1;
        const q2 = s.filter((i) => out[i]);
        while (q2.length > 0) {
          const i = q2.pop();
          const x = i % w, y = (i / w) | 0;
          for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + ax, ny = y + ay;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const j = ny * w + nx;
            if (out[j] || !light(j)) continue;
            out[j] = 1;
            q2.push(j);
          }
        }
        // 이름표: 판 테두리와 이어진 먹선은 이름표 모양(볼록 다각형) 밖이면 날림
        const inside = (x, y) => {
          if (!keepPoly) return true;
          const p = keepPoly;
          for (let k = 0; k < p.length; k++) {
            const [ax, ay] = p[k];
            const [cx, cy] = p[(k + 1) % p.length];
            if ((cx - ax) * (y + y0 - ay) - (cy - ay) * (x + x0 - ax) < 0) return false;
          }
          return true;
        };
        let mx0 = w, my0 = h, mx1 = 0, my1 = 0;
        for (let i = 0; i < w * h; i++) {
          const x = i % w, y = (i / w) | 0;
          const keep = !out[i] && inside(x, y);
          d[i * 4 + 3] = keep ? 255 : 0;
          if (keep) {
            mx0 = Math.min(mx0, x); mx1 = Math.max(mx1, x); my0 = Math.min(my0, y); my1 = Math.max(my1, y);
          }
        }
        ctx.putImageData(id, 0, 0);
        const t = mk(mx1 - mx0 + 1, my1 - my0 + 1);
        t.getContext("2d").drawImage(c, mx0, my0, t.width, t.height, 0, 0, t.width, t.height);
        return { c: t, x: x0 + mx0, y: y0 + my0 };
      };
      // 이름표 바깥 테두리 (시계 방향, 원본 px, 먹선 바깥 조금 여유)
      const tagPoly = [[372, 104], [728, 104], [760, 146], [758, 200], [730, 232], [370, 232], [338, 176], [352, 140]];
      const tag = piece(C.tag, C.tagText, tagPoly);
      const ok = piece(C.ok, C.okText, null);
      const skip = piece(C.skip, C.skipText, null);
      const url = (c) => c.toDataURL("image/png");
      return {
        panel: url(panel), panelBox: [bx0, by0, bx1, by1],
        tag: url(tag.c), tagAt: [tag.x, tag.y, tag.c.width, tag.c.height],
        ok: url(ok.c), okSize: [ok.c.width, ok.c.height],
        skip: url(skip.c), skipSize: [skip.c.width, skip.c.height],
      };
    },
    [b64, CFG],
  );
  const toWebp = async (png) =>
    page.evaluate(async (src) => {
      const im = new Image();
      im.src = src;
      await im.decode();
      const c = document.createElement("canvas");
      c.width = im.width;
      c.height = im.height;
      c.getContext("2d").drawImage(im, 0, 0);
      return c.toDataURL("image/webp", 0.92);
    }, png);
  const save = async (name, png, defringe) => {
    let p = png;
    if (defringe) p = (await page.evaluate(defringeInPage, p)).png;
    const w = await toWebp(p);
    fs.writeFileSync(`public/assets/art/ui/${name}.webp`, Buffer.from(w.split(",")[1], "base64"));
    return p;
  };
  const panel = await save("tut_panel", r.panel, true);
  const tag = await save("tut_tag", r.tag, true);
  const ok = await save("tut_ok", r.ok, false);
  const skip = await save("tut_skip", r.skip, false);
  console.log("판", r.panelBox.join(","), "→", r.panelBox[2] - r.panelBox[0] + 1, "×", r.panelBox[3] - r.panelBox[1] + 1);
  console.log("이름표 (판 기준)", r.tagAt[0] - r.panelBox[0], r.tagAt[1] - r.panelBox[1], r.tagAt[2], "×", r.tagAt[3]);
  console.log("좋아요 버튼", r.okSize.join("×"), " 건너뛰기", r.skipSize.join("×"));
  // 미리보기: 어두운 바탕 위에 판 + 이름표 + 버튼
  const html = `<body style="margin:0;background:#2b1a10"><div style="position:relative;margin:20px">
    <img src="${panel}" style="position:absolute;left:0;top:${r.tagAt[1] < r.panelBox[1] ? r.panelBox[1] - r.tagAt[1] : 0}px">
    <img src="${tag}" style="position:absolute;left:${r.tagAt[0] - r.panelBox[0]}px;top:0">
    <img src="${ok}" style="position:absolute;left:30px;top:${r.panelBox[3] - r.panelBox[1] + 120}px">
    <img src="${skip}" style="position:absolute;left:460px;top:${r.panelBox[3] - r.panelBox[1] + 120}px"></div></body>`;
  await page.setViewportSize({ width: 1500, height: 820 });
  await page.setContent(html);
  await page.waitForTimeout(200);
  fs.mkdirSync("tests/shots", { recursive: true });
  await page.screenshot({ path: "tests/shots/tut_bubble_preview.png" });
} finally {
  await browser.close();
}
