// 손님 그림 몸통 늘이기 (2026-11-17 사용자 "하얀 두건 요리사 너무 낮아, 위로 더 올려 줘"):
// 원본 그림이 팔짱 낀 팔 아래에서 잘려 있어 손님을 올리면 몸 끝이 카운터 위에 떠 보이므로, 팔 아래로 옷 몸통을 이어 그린다
// (옷 색은 그림에서 떠 오고 양옆은 먹선. 원래 그림이 위에 덮이게 뒤에 그림). 대부분 카운터 뒤에 가려진다.
// 실행: node tools/sprite_body.mjs <이름> <옷 색 뜰 x> <옷 색 뜰 y>   예) node tools/sprite_body.mjs chef 90 290
//   → public/assets/art/customers/guest_<이름>.png 를 고쳐 씀 (tools/customer_sheet.mjs 로 다시 오리면 이것도 다시 돌릴 것)
import { chromium } from "playwright-core";
import fs from "node:fs";

const [name, sx, sy] = process.argv.slice(2);
const file = `public/assets/art/customers/guest_${name}.png`;
const b64 = fs.readFileSync(file).toString("base64");
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  const r = await page.evaluate(
    async ([b64, sx, sy]) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const w = img.width;
      const h = img.height;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, w, h).data;
      const op = (x, y) => d[(y * w + x) * 4 + 3] > 128;
      // 몸 끝 (불투명 40px 이상인 마지막 줄)
      let bottom = 0;
      for (let y = h - 1; y >= 0; y--) {
        let n = 0;
        for (let x = 0; x < w; x++) if (op(x, y)) n++;
        if (n >= 40) {
          bottom = y;
          break;
        }
      }
      // 몸통 양옆: 끝보다 조금 위 줄의 가장 왼쪽·오른쪽
      const ry = bottom - 12;
      let L = 0;
      let R = w - 1;
      while (L < w && !op(L, ry)) L++;
      while (R > 0 && !op(R, ry)) R--;
      // 옷 색 (5×5 평균)
      const col = [0, 0, 0];
      for (let y = sy - 2; y <= sy + 2; y++) for (let x = sx - 2; x <= sx + 2; x++) for (let ch = 0; ch < 3; ch++) col[ch] += d[(y * w + x) * 4 + ch] / 25;
      const fill = `rgb(${col.map(Math.round).join(",")})`;
      const shade = `rgb(${col.map((v) => Math.round(v * 0.86)).join(",")})`;
      const y0 = bottom - 24;
      const out = document.createElement("canvas");
      out.width = w;
      out.height = h;
      const o = out.getContext("2d");
      // 몸통 (아래로 살짝 좁아짐) + 양옆 그늘 + 먹선
      const body = [
        [L + 2, y0],
        [R - 2, y0],
        [R - 14, h],
        [L + 14, h],
      ];
      o.beginPath();
      body.forEach(([x, y], i) => (i === 0 ? o.moveTo(x, y) : o.lineTo(x, y)));
      o.closePath();
      o.fillStyle = fill;
      o.fill();
      o.fillStyle = shade;
      o.beginPath();
      o.moveTo(L + 2, y0);
      o.lineTo(L + 40, y0);
      o.lineTo(L + 50, h);
      o.lineTo(L + 14, h);
      o.closePath();
      o.fill();
      o.strokeStyle = "#2a1d17";
      o.lineWidth = 5;
      o.lineCap = "round";
      for (const [a, b] of [
        [body[0], body[3]],
        [body[1], body[2]],
      ]) {
        o.beginPath();
        o.moveTo(a[0], a[1]);
        o.lineTo(b[0], b[1]);
        o.stroke();
      }
      // 가운데 여밈선 + 단추
      const mx = (L + R) * 0.5 + 18;
      o.lineWidth = 3;
      o.beginPath();
      o.moveTo(mx, y0 + 10);
      o.lineTo(mx - 6, h);
      o.stroke();
      o.fillStyle = "#2a1d17";
      for (let y = y0 + 50; y < h; y += 58) {
        o.beginPath();
        o.arc(mx + 14, y, 5, 0, Math.PI * 2);
        o.fill();
      }
      // 원래 그림을 위에
      o.drawImage(img, 0, 0);
      return { png: out.toDataURL("image/png"), bottom, L, R, fill };
    },
    [b64, Number(sx), Number(sy)],
  );
  fs.writeFileSync(file, Buffer.from(r.png.split(",")[1], "base64"));
  console.log(`${file}: 몸 끝 ${r.bottom} 아래로 옷 몸통 (x ${r.L}~${r.R}, ${r.fill})`);
} finally {
  await browser.close();
}
