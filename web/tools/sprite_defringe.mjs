// 손님 그림 하얀 테두리 지우기 (2026-11-17 사용자 "손님 사진 자세히 보면 하얀 테두리가 많아, 하얀 테두리 없게 다시 잘라 줘"):
// 흰 바탕에서 오린 그림은 가장자리 1~3px 이 먹선과 흰 바탕이 섞인 밝은 색이라 어두운 가게 앞에서 하얀 테두리로 보인다.
//  1) 투명한 곳과 맞닿은 밝고 색이 옅은 픽셀(밝기 ≥ LIGHT, 채도 ≤ SAT)을 깎아 냄 — PASSES 번 (먹선에 닿으면 멈춤)
//  2) 남은 가장자리 픽셀은 먹색 쪽으로 섞고 살짝 투명하게 (부드러운 어두운 테두리)
// 실행: node tools/sprite_defringe.mjs <png> [<png> ...]   (제자리에서 고쳐 씀, 여러 번 돌려도 거의 그대로)
// tools/customer_sheet.mjs 도 오린 뒤 이 함수를 씀.
import { chromium } from "playwright-core";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

/** 브라우저 안에서 도는 함수 (page.evaluate): PNG data URL → 고친 PNG data URL + 깎은 픽셀 수 */
export async function defringeInPage(src) {
  const PASSES = 3;
  const LIGHT = 112; // 밝기 (r+g+b)/3
  const SAT = 64; // max - min
  const INK = [42, 29, 23];
  const img = new Image();
  img.src = src;
  await img.decode();
  const w = img.width;
  const h = img.height;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  const N = w * h;
  const A = (i) => d[i * 4 + 3];
  // 투명한 이웃(8방향)이 있는 불투명 픽셀 = 가장자리. 그림 칸 바깥은 이웃으로 치지 않음 (잘린 아래 끝은 그대로)
  const onEdge = (i) => {
    const x = i % w;
    const y = (i / w) | 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        if (A(yy * w + xx) < 24) return true;
      }
    return false;
  };
  const light = (i) => {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    return (r + g + b) / 3 >= LIGHT && mx - mn <= SAT;
  };
  let peeled = 0;
  for (let p = 0; p < PASSES; p++) {
    const kill = [];
    for (let i = 0; i < N; i++) if (A(i) >= 24 && light(i) && onEdge(i)) kill.push(i);
    if (kill.length === 0) break;
    for (const i of kill) d[i * 4 + 3] = 0;
    peeled += kill.length;
  }
  // 얇게 남은 반투명 찌꺼기 정리 + 가장자리를 먹색 쪽으로
  for (let i = 0; i < N; i++) if (A(i) > 0 && A(i) < 24) d[i * 4 + 3] = 0;
  const rim = [];
  for (let i = 0; i < N; i++) if (A(i) >= 24 && onEdge(i)) rim.push(i);
  for (const i of rim) {
    const lum = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3;
    const k = lum > 90 ? 0.55 : 0.25; // 밝은 가장자리일수록 더 어둡게
    for (let ch = 0; ch < 3; ch++) d[i * 4 + ch] = Math.round(d[i * 4 + ch] * (1 - k) + INK[ch] * k);
    d[i * 4 + 3] = Math.min(d[i * 4 + 3], 210);
  }
  ctx.putImageData(id, 0, 0);
  return { png: c.toDataURL("image/png"), peeled, rim: rim.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const files = process.argv.slice(2);
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    const page = await browser.newPage();
    for (const f of files) {
      const src = "data:image/png;base64," + fs.readFileSync(f).toString("base64");
      const r = await page.evaluate(defringeInPage, src);
      fs.writeFileSync(f, Buffer.from(r.png.split(",")[1], "base64"));
      console.log(`${f}: 밝은 가장자리 ${r.peeled}px 깎음, 테두리 ${r.rim}px 먹색으로`);
    }
  } finally {
    await browser.close();
  }
}
