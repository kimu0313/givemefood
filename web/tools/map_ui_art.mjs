// 스테이지 지도 UI 조각 (2026-11-18 사용자 "게임 스테이지 UI 이걸로 교체해 줘, 알아서 잘라서 써": art_src/ref_map_ui_alpha.png,
// 1686×933 투명 바탕 — 처음 받은 바탕 있는 예시 art_src/ref_map_ui.png 와 자리가 같음)
//   → public/assets/art/ui/map_<이름>.webp : 위 버튼(타이틀·단골 도감·소리), 가게 간판, 별·지갑 판, 가게 이름표, 업그레이드·장보기 버튼,
//     스테이지 발판 (빨강 = 그림, 회색 = 그림, 금·파랑·보라·흐린 보라 = 회색 발판을 색 입힘), "도전!" 꼬리표 (+ 보라 "이벤트!")
// 그림 속 글자는 지우고 (게임이 글자를 씀 → 다른 언어·숫자가 바뀜), 모양(알약·둥근 네모·원)대로 오려 낸다.
// 좌표는 모두 원본 그림 px. 지우기 방식: h = 줄마다 왼쪽·오른쪽 끝 색을 이음, m = 줄마다 왼쪽·오른쪽 24px 의 가운데값 색을 이음,
// g = 줄마다 [mx0, mx1] 의 가운데값 색 하나 (무늬 없는 판). m·g 는 가장자리 6px 을 원래 그림과 섞음. 소리 버튼 = 단골 도감 버튼 양끝 반원을 붙인 동그라미
// 실행: node tools/map_ui_art.mjs   (+ tests/shots/map_ui_preview.png)
import { chromium } from "playwright-core";
import fs from "node:fs";

const SRC = "art_src/ref_map_ui_alpha.png";
// 발판: box = 오릴 곳, num = 숫자 자리 (지움), face = 윗면 타원 [cx, cy, rx, ry] (숫자 위로 삐져나온 곳은 투명, 윗면은 타원을 따라 이어 칠함)
const DISCS = {
  red: { box: [38, 523, 168, 599], num: [83, 510, 119, 566], face: [103, 551, 61, 24] },
  gray: { box: [1140, 598, 1262, 668], num: [1180, 588, 1219, 636], face: [1201.5, 627, 55.5, 24] },
};
// 회색 발판에 입힐 색 (윗면 밝기 기준 색)
const TINTS = { gold: [255, 206, 74], blue: [108, 160, 246], purple: [184, 128, 246], dim: [168, 152, 184] };
// "도전!" 꼬리표: box, 글자 자리 (상자 색으로 칠함)
// area = 넉넉한 자리 (seed 에서 이어진 곳만 가져가 테두리째 오림), text = 글자 자리
const TAG = { area: [56, 440, 138, 512], seed: [100, 470], text: [72, 456, 129, 485] };
// 조각마다 area = 넉넉한 자리 (옆 조각과의 틈에서 끊음), seed = 조각 안쪽 한 점. 그림의 불투명한 곳을 seed 에서부터 이어진 만큼만 가져가서
// 바깥 굵은 먹선 테두리·그림자까지 그대로 남긴다 (2026-11-18 사용자 "진한 갈색 테두리가 다 잘렸잖아, 겉에 선 안 잘리게").
// 오린 조각의 자리(그림 px)는 src/art/map_ui_meta.ts 에 적어서 게임이 그림 좌표로 계산한다.
const PIECES = {
  btn_title: { area: [0, 0, 201, 98], seed: [100, 45], erase: [["h", 80, 18, 179, 67]] },
  btn_book: { area: [201, 0, 429, 98], seed: [315, 45], erase: [["h", 228, 18, 403, 67]] },
  title: { area: [532, 0, 1142, 112], seed: [840, 50], erase: [["m", 600, 13, 1082, 95]] },
  wallet: { area: [1232, 0, 1686, 98], seed: [1460, 45], erase: [["g", 1262, 16, 1660, 75, 1290, 1630]] },
  plate: { area: [352, 132, 751, 220], seed: [560, 178], erase: [["h", 381, 157, 414, 200], ["g", 437, 157, 738, 201, 432, 742]] },
  btn_green: { area: [751, 132, 978, 212], seed: [866, 178], erase: [["h", 821, 157, 951, 197]] },
  btn_red: { area: [978, 132, 1182, 216], seed: [1075, 178], erase: [["h", 1047, 157, 1142, 198]] },
  btn_green_blank: { area: [751, 132, 978, 212], seed: [866, 178], erase: [["h", 768, 157, 951, 199]] },
};

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  const b64 = fs.readFileSync(SRC).toString("base64");
  const out = await page.evaluate(
    async ([b64, PIECES, DISCS, TINTS, TAG]) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const res = {};
      for (const [name, p] of Object.entries(PIECES)) {
        const [X0, Y0, ax1, ay1] = p.area;
        const w = ax1 - X0, h = ay1 - Y0;
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, X0, Y0, w, h, 0, 0, w, h);
        const id = ctx.getImageData(0, 0, w, h);
        const d = id.data;
        let seed = 5;
        const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) - 0.5;
        const at = (x, y) => (y * w + x) * 4;
        for (const e of p.erase) {
          const [mode, ex0, ey0, ex1, ey1, mx0, mx1] = e;
          const x0 = Math.round(ex0) - X0, x1 = Math.round(ex1) - X0, y0 = Math.round(ey0) - Y0, y1 = Math.round(ey1) - Y0;
          // 줄마다 왼쪽(L)·오른쪽(R) 색을 먼저 정하고, m·g 는 위아래 9줄 가운데값으로 다듬음 (글자가 많은 줄에서 튀는 색 막기)
          const rows = [];
          for (let y = y0; y <= y1; y++) {
            let L = [0, 0, 0], R = [0, 0, 0];
            if (mode === "h") {
              for (let j = 0; j < 3; j++)
                for (let ch = 0; ch < 3; ch++) {
                  L[ch] += d[at(x0 - 1 - j, y) + ch] / 3;
                  R[ch] += d[at(x1 + 1 + j, y) + ch] / 3;
                }
            } else {
              const median = (a, b) => {
                const med = [];
                for (let ch = 0; ch < 3; ch++) {
                  const vals = [];
                  for (let x = a; x <= b; x++) vals.push(d[at(x, y) + ch]);
                  vals.sort((u, v) => u - v);
                  med.push(vals[(vals.length / 2) | 0]);
                }
                return med;
              };
              if (mode === "g") {
                L = median(Math.round(mx0) - X0, Math.round(mx1) - X0);
                R = L;
              } else {
                L = median(x0 - 24, x0 - 1);
                R = median(x1 + 1, x1 + 24);
              }
            }
            rows.push([L, R]);
          }
          if (mode !== "h") {
            const sm = rows.map((_, k) =>
              [0, 1].map((side) =>
                [0, 1, 2].map((ch) => {
                  const vals = [];
                  for (let j = Math.max(0, k - 4); j <= Math.min(rows.length - 1, k + 4); j++) vals.push(rows[j][side][ch]);
                  vals.sort((u, v) => u - v);
                  return vals[(vals.length / 2) | 0];
                }),
              ),
            );
            for (let k = 0; k < rows.length; k++) rows[k] = sm[k];
          }
          const F = mode === "h" ? 0 : 6;
          for (let y = y0; y <= y1; y++) {
            const [L, R] = rows[y - y0];
            for (let x = x0; x <= x1; x++) {
              const t = (x - x0) / Math.max(1, x1 - x0);
              const n = rnd() * 7;
              const i = at(x, y);
              const a = F > 0 ? Math.min(1, (Math.min(x - x0, x1 - x) + 1) / F) : 1;
              for (let ch = 0; ch < 3; ch++) d[i + ch] = Math.max(0, Math.min(255, (L[ch] * (1 - t) + R[ch] * t + n) * a + d[i + ch] * (1 - a)));
            }
          }
        }
        // seed 에서 이어진 불투명한 곳 (알파 > 16) + 1px 둘레 (흐린 가장자리)
        const keep = new Uint8Array(w * h);
        {
          const st = [(p.seed[1] - Y0) * w + (p.seed[0] - X0)];
          keep[st[0]] = 1;
          while (st.length > 0) {
            const i = st.pop();
            const x = i % w, y = (i / w) | 0;
            for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = x + ax, ny = y + ay;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              const j = ny * w + nx;
              if (keep[j] || d[j * 4 + 3] <= 16) continue;
              keep[j] = 1;
              st.push(j);
            }
          }
          const grow = new Uint8Array(keep);
          for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
              if (keep[y * w + x]) continue;
              if ((x > 0 && keep[y * w + x - 1]) || (x < w - 1 && keep[y * w + x + 1]) || (y > 0 && keep[(y - 1) * w + x]) || (y < h - 1 && keep[(y + 1) * w + x])) grow[y * w + x] = 1;
            }
          for (let i = 0; i < w * h; i++) if (!grow[i]) d[i * 4 + 3] = 0;
        }
        ctx.putImageData(id, 0, 0);
        // 남은 곳만큼 잘라 냄
        let tx0 = w, ty0 = h, tx1 = 0, ty1 = 0;
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++)
            if (d[(y * w + x) * 4 + 3] > 0) {
              tx0 = Math.min(tx0, x); tx1 = Math.max(tx1, x); ty0 = Math.min(ty0, y); ty1 = Math.max(ty1, y);
            }
        const tc = document.createElement("canvas");
        tc.width = tx1 - tx0 + 1;
        tc.height = ty1 - ty0 + 1;
        tc.getContext("2d").drawImage(c, tx0, ty0, tc.width, tc.height, 0, 0, tc.width, tc.height);
        const meta = { x: X0 + tx0, y: Y0 + ty0, w: tc.width, h: tc.height };
        if (name === "btn_book") {
          // 소리 버튼: 단골 도감 버튼의 왼쪽·오른쪽 끝(글자 지운 뒤, 테두리째)을 붙여 동그라미
          const hw = Math.round(tc.height / 2);
          const rc = document.createElement("canvas");
          rc.width = hw * 2;
          rc.height = tc.height;
          const rctx = rc.getContext("2d");
          rctx.drawImage(tc, 0, 0, hw, tc.height, 0, 0, hw, tc.height);
          rctx.drawImage(tc, tc.width - hw, 0, hw, tc.height, hw, 0, hw, tc.height);
          res.btn_round = { url: rc.toDataURL("image/webp", 0.92), w: rc.width, h: rc.height, x0: meta.x, y0: meta.y, meta: { x: meta.x, y: meta.y, w: rc.width, h: rc.height } };
        }
        res[name] = { url: tc.toDataURL("image/webp", 0.92), w: tc.width, h: tc.height, x0: meta.x, y0: meta.y, meta };
      }
      // ---- 발판
      const crop = (box) => {
        const [x0, y0, x1, y1] = box;
        const c = document.createElement("canvas");
        c.width = x1 - x0;
        c.height = y1 - y0;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
        return { c, ctx, id: ctx.getImageData(0, 0, c.width, c.height) };
      };
      const discs = {};
      for (const [name, D] of Object.entries(DISCS)) {
        const { c, ctx, id } = crop(D.box);
        const w = c.width;
        const d = id.data;
        const [bx0, by0] = D.box;
        const [cx, cy, rx, ry] = D.face;
        const yTop = (x) => cy - ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));
        const [nx0, ny0, nx1, ny1] = D.num;
        const xl = nx0 - 1, xr = nx1 + 1;
        const px = (x, y) => (Math.round(y - by0) * w + Math.round(x - bx0)) * 4;
        const src = new Uint8ClampedArray(d);
        let seed = 3;
        const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) - 0.5;
        for (let y = Math.max(by0, ny0); y <= Math.min(D.box[3] - 1, ny1); y++)
          for (let x = nx0; x <= nx1; x++) {
            const i = px(x, y);
            const dy = y - yTop(x);
            if (dy < -0.5) {
              d[i + 3] = 0;
              continue;
            }
            const t = (x - xl) / (xr - xl);
            const L = px(xl, yTop(xl) + dy);
            const R = px(xr, yTop(xr) + dy);
            const n = rnd() * 4;
            for (let ch = 0; ch < 3; ch++) d[i + ch] = src[L + ch] * (1 - t) + src[R + ch] * t + n;
            d[i + 3] = src[L + 3] * (1 - t) + src[R + 3] * t;
          }
        // 윗면 타원 위쪽은 모두 투명 (옆 메뉴 배지 조각이 딸려 오지 않게)
        for (let y = by0; y < D.box[3]; y++)
          for (let x = bx0; x < D.box[2]; x++) if (y < yTop(x) - 1.5) d[px(x, y) + 3] = 0;
        ctx.putImageData(id, 0, 0);
        discs[name] = { c, face: [cx - bx0, cy - by0, rx, ry] };
      }
      // 회색 발판에 색 입히기 (그라데이션 맵: 윗면 밝기 = 그 색, 더 어두우면 어둡게, 더 밝으면 흰색 쪽으로)
      const gray = discs.gray;
      const gd = gray.c.getContext("2d").getImageData(0, 0, gray.c.width, gray.c.height).data;
      // 윗면 가운데 밝기
      let lref = 0, nref = 0;
      {
        const [fx, fy, frx, fry] = gray.face;
        for (let y = Math.round(fy - fry * 0.3); y <= Math.round(fy + fry * 0.3); y++)
          for (let x = Math.round(fx - frx * 0.5); x <= Math.round(fx + frx * 0.5); x++) {
            const i = (y * gray.c.width + x) * 4;
            lref += (gd[i] + gd[i + 1] + gd[i + 2]) / 3;
            nref++;
          }
        lref /= nref;
      }
      for (const [name, col] of Object.entries(TINTS)) {
        const c = document.createElement("canvas");
        c.width = gray.c.width;
        c.height = gray.c.height;
        const ctx = c.getContext("2d");
        const id = ctx.createImageData(c.width, c.height);
        const d = id.data;
        for (let i = 0; i < gd.length; i += 4) {
          const l = (gd[i] + gd[i + 1] + gd[i + 2]) / 3;
          for (let ch = 0; ch < 3; ch++) {
            const v = l <= lref ? (col[ch] * l) / lref : col[ch] + ((255 - col[ch]) * (l - lref)) / (255 - lref);
            d[i + ch] = Math.max(0, Math.min(255, v));
          }
          d[i + 3] = gd[i + 3];
        }
        ctx.putImageData(id, 0, 0);
        discs[name] = { c, face: gray.face };
      }
      for (const [name, dd] of Object.entries(discs)) res[`disc_${name}`] = { url: dd.c.toDataURL("image/webp", 0.92), w: dd.c.width, h: dd.c.height, x0: 0, y0: 0, face: dd.face };
      // ---- "도전!" 꼬리표: 글자 자리를 상자 색(가운데값)으로
      {
        const { c, ctx, id } = crop(TAG.area);
        const w = c.width;
        const d = id.data;
        // seed 에서 이어진 불투명한 곳 + 1px 둘레만 (옆 메뉴 배지·숫자는 안 이어짐)
        {
          const h = c.height;
          const keep = new Uint8Array(w * h);
          const st = [(TAG.seed[1] - TAG.area[1]) * w + (TAG.seed[0] - TAG.area[0])];
          keep[st[0]] = 1;
          while (st.length > 0) {
            const i = st.pop();
            const x = i % w, y = (i / w) | 0;
            for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = x + ax, ny = y + ay;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              const j = ny * w + nx;
              if (keep[j] || d[j * 4 + 3] <= 16) continue;
              keep[j] = 1;
              st.push(j);
            }
          }
          for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
              const i = y * w + x;
              const near = keep[i] || (x > 0 && keep[i - 1]) || (x < w - 1 && keep[i + 1]) || (y > 0 && keep[i - w]) || (y < h - 1 && keep[i + w]);
              if (!near) d[i * 4 + 3] = 0;
            }
        }
        const [tx0, ty0, tx1, ty1] = TAG.text.map((q, k) => q - TAG.area[k % 2]);
        // 상자 색 = 글자 자리 바로 바깥 테두리 줄의 가운데값
        const vals = [[], [], []];
        for (let x = tx0; x <= tx1; x++)
          for (const y of [ty0 - 2, ty1 + 2]) for (let ch = 0; ch < 3; ch++) vals[ch].push(d[(y * w + x) * 4 + ch]);
        const med = vals.map((a) => a.sort((p, q) => p - q)[(a.length / 2) | 0]);
        for (let y = ty0; y <= ty1; y++)
          for (let x = tx0; x <= tx1; x++) {
            const i = (y * w + x) * 4;
            const e = Math.min(x - tx0, tx1 - x, y - ty0, ty1 - y);
            const a = Math.min(1, (e + 1) / 3);
            for (let ch = 0; ch < 3; ch++) d[i + ch] = med[ch] * a + d[i + ch] * (1 - a);
            d[i + 3] = 255;
          }
        ctx.putImageData(id, 0, 0);
        // 남은 곳만큼 잘라 냄
        let mx0 = w, my0 = c.height, mx1 = 0, my1 = 0;
        for (let y = 0; y < c.height; y++)
          for (let x = 0; x < w; x++)
            if (d[(y * w + x) * 4 + 3] > 0) {
              mx0 = Math.min(mx0, x); mx1 = Math.max(mx1, x); my0 = Math.min(my0, y); my1 = Math.max(my1, y);
            }
        const tc = document.createElement("canvas");
        tc.width = mx1 - mx0 + 1;
        tc.height = my1 - my0 + 1;
        tc.getContext("2d").drawImage(c, mx0, my0, tc.width, tc.height, 0, 0, tc.width, tc.height);
        const meta = { x: TAG.area[0] + mx0, y: TAG.area[1] + my0, w: tc.width, h: tc.height };
        res.tag_red = { url: tc.toDataURL("image/webp", 0.92), w: tc.width, h: tc.height, x0: meta.x, y0: meta.y, box: med, meta };
        // 보라 (이벤트!): 색상만 돌림
        const p = document.createElement("canvas");
        p.width = tc.width;
        p.height = tc.height;
        const pctx = p.getContext("2d");
        pctx.filter = "hue-rotate(255deg) saturate(0.9)";
        pctx.drawImage(tc, 0, 0);
        res.tag_purple = { url: p.toDataURL("image/webp", 0.92), w: p.width, h: p.height, x0: meta.x, y0: meta.y, meta };
      }
      return res;
    },
    [b64, PIECES, DISCS, TINTS, TAG],
  );
  // 조각 자리 (그림 px) → src/art/map_ui_meta.ts
  const metaLines = Object.entries(out)
    .filter(([, r]) => r.meta)
    .map(([n, r]) => `  ${n}: { x: ${r.meta.x}, y: ${r.meta.y}, w: ${r.meta.w}, h: ${r.meta.h} },`);
  fs.writeFileSync(
    "src/art/map_ui_meta.ts",
    `// tools/map_ui_art.mjs 가 만든 파일 (손으로 고치지 말 것): 지도 UI 조각이 예시 그림(art_src/ref_map_ui_alpha.png)의 어디서 왔는지 (그림 px)
export const MAP_UI_META: Record<string, { x: number; y: number; w: number; h: number }> = {
${metaLines.join("\n")}
};
`,
  );
  let html = '<body style="margin:0;background:#3a6a8a">';
  for (const [name, r] of Object.entries(out)) {
    fs.writeFileSync(`public/assets/art/ui/map_${name}.webp`, Buffer.from(r.url.split(",")[1], "base64"));
    console.log(`map_${name}.webp ${r.w}×${r.h} (원본 ${r.x0},${r.y0})${r.face ? " 윗면 " + r.face.map((q) => +q.toFixed(1)).join(",") : ""}${r.box ? " 상자 색 " + r.box.join(",") : ""}`);
    html += `<img src="${r.url}" style="margin:8px;zoom:1.6">`;
  }
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.setContent(html + "</body>");
  await page.waitForTimeout(200);
  fs.mkdirSync("tests/shots", { recursive: true });
  await page.screenshot({ path: "tests/shots/map_ui_preview.png" });
} finally {
  await browser.close();
}
