// 단골 도감 얼굴 사진: 동그란 액자 안에 단골 손님 얼굴·어깨 (2026-11-15 사용자 "단골도감에 사람 얼굴도 추가해줘").
// 영업 화면과 같은 그림 (도형 그림은 CustomerArt, 대학생은 사용자 캐릭터 그림). 아직 못 만난 단골은 검은 그림자 + "?".

import { TAU, rgb, v } from "../engine/geom.ts";
import { CanvasWidget } from "../engine/game.ts";
import { DISPLAY, Gfx } from "../engine/gfx.ts";
import * as D from "../core/defs.ts";
import * as ArtAssets from "../art/art_assets.ts";
import * as FoodArt from "../art/food_art.ts";
import * as CustomerArt from "../shift/customer_art.ts";

/** 손님 머리 가운데 (0,0) 기준 그림을 그린다 */
function drawPerson(g: Gfx, regularId: string, mood: string): void {
  // "gourmet:<미식가 id>" = 미식가 스테이지 미식가
  const sprites = regularId.startsWith("gourmet") ? ArtAssets.customerSpritePool("gourmet", regularId.slice(8)) : ArtAssets.customerSpritePool("regular", regularId);
  if (sprites.length > 0) {
    const img = ArtAssets.customerSprite(sprites[0]);
    if (img === null) return;
    // 캐릭터 그림을 도형 그림 얼굴(지름 116, 액자 크기 기준)에 맞춰 키움 (영업 화면은 도형 쪽을 PROC_SCALE 로 줄임)
    const ctx = g.ctx;
    ctx.save();
    ctx.scale(1.0 / ArtAssets.PROC_SCALE, 1.0 / ArtAssets.PROC_SCALE);
    g.texture(img, ArtAssets.customerSpriteRect(sprites[0], ArtAssets.SPRITE_SIZE, v(0, -4), false));
    ctx.restore();
    return;
  }
  if (regularId.startsWith("gourmet")) {
    const gd = D.CUSTOMERS.gourmet;
    CustomerArt.draw(g, "gourmet", gd.body, gd.hair, v(0, 6), mood, 0.3, 0);
    return;
  }
  const def = D.CUSTOMERS.regular;
  CustomerArt.draw(g, "regular", def.body, def.hair, v(0, 0), mood, 0.3, 0, 0, regularId);
}

export function regularPortrait(regularId: string, size: number, met: boolean): CanvasWidget {
  return new CanvasWidget(size, size, (g) => {
    const ctx = g.ctx;
    const c = v(size * 0.5, size * 0.5);
    const r = size * 0.5 - 6.0;
    // 아래 두께 그림자
    ctx.beginPath();
    ctx.arc(c.x, c.y + 4, r + 3, 0, TAU);
    ctx.fillStyle = "rgba(40,20,8,0.35)";
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, TAU);
    const bg = ctx.createRadialGradient(c.x - r * 0.3, c.y - r * 0.4, 0, c.x, c.y, r * 1.1);
    if (met) {
      bg.addColorStop(0, "#fff3cf");
      bg.addColorStop(0.6, "#ffd68a");
      bg.addColorStop(1, "#f0a24e");
    } else {
      bg.addColorStop(0, "#d8cfc2");
      bg.addColorStop(1, "#a99c8c");
    }
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.clip();
    // 사람은 따로 그려서 (못 만난 단골은 그림자로 칠한 뒤) 액자 안에 붙인다
    const off = document.createElement("canvas");
    off.width = ctx.canvas.width;
    off.height = ctx.canvas.height;
    const octx = off.getContext("2d")!;
    octx.setTransform(ctx.getTransform());
    const k = size / 212.0;
    octx.translate(c.x, c.y - size * 0.03);
    octx.scale(k, k);
    drawPerson(new Gfx(octx), regularId, met ? "happy" : "normal");
    if (!met) {
      octx.setTransform(1, 0, 0, 1, 0, 0);
      octx.globalCompositeOperation = "source-atop";
      octx.fillStyle = "#4a3a30";
      octx.fillRect(0, 0, off.width, off.height);
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(off, 0, 0);
    ctx.restore();
    ctx.restore();
    // 액자 테두리
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, TAU);
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#3b2415";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c.x, c.y, r - 6, 0, TAU);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = met ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.35)";
    ctx.stroke();
    if (!met) FoodArt.textOutlined(g, "?", c.add(v(0, size * 0.04)), Math.round(size * 0.36), rgb(1, 0.97, 0.9), rgb(0.23, 0.14, 0.08), 8, size, DISPLAY);
  });
}

/** 그 가게 미식가 스테이지 미식가 얼굴 사진 (이벤트 안내·정산) */
export function gourmetPortrait(shopId: string, size: number, met = true): CanvasWidget {
  return regularPortrait(`gourmet:${D.eventFor(shopId)?.critic ?? ""}`, size, met);
}

/** 단골 도감 카드용 상반신 그림 (2026-11-22 도감을 가로로 넘기는 카드로 바꿀 때): 액자 없이 사람만, 머리는 위쪽 40%.
 *  못 만난 단골은 검은 그림자 + 큰 "?" */
export function regularBust(regularId: string, w: number, h: number, met: boolean): CanvasWidget {
  return new CanvasWidget(w, h, (g) => {
    const ctx = g.ctx;
    const off = document.createElement("canvas");
    off.width = ctx.canvas.width;
    off.height = ctx.canvas.height;
    const octx = off.getContext("2d")!;
    octx.setTransform(ctx.getTransform());
    const k = w / 300.0;
    octx.translate(w * 0.5, h * 0.4);
    octx.scale(k, k);
    drawPerson(new Gfx(octx), regularId, met ? "happy" : "normal");
    if (!met) {
      octx.setTransform(1, 0, 0, 1, 0, 0);
      octx.globalCompositeOperation = "source-atop";
      octx.fillStyle = "#3e3028";
      octx.fillRect(0, 0, off.width, off.height);
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(off, 0, 0);
    ctx.restore();
    if (!met) FoodArt.textOutlined(g, "?", v(w * 0.5, h * 0.42), Math.round(h * 0.34), rgb(1, 0.97, 0.9), rgb(0.23, 0.14, 0.08), 10, w, DISPLAY);
  });
}
