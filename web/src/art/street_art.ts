// 영업 화면 뒤쪽 배경 (임시 아트). theme 으로 가게마다 다르게 그린다.
//   alley  골목 포장마차: 참고 일러스트 그림체(먹선 + 셀 채색)의 겨울 저녁 거리 — AlleyArt
//   bunsik 동네 분식집: 타일 벽, 메뉴판, 창밖 = 길 건너 학교(왼쪽, 창틀에 잘림)와 벚꽃 핀 동네(오른쪽), 펜던트 조명
//   market 야시장 푸드트럭: 노점 천막들, 사람 실루엣, 알록달록 전구
//   beach  해변 포장마차: 달밤 바다, 파도, 모래사장, 등대
//   suljip 실내 포차: 주황 비닐 천막 벽, 벽에 붙은 메뉴, 백열전구

import { Color, PI, R, V, fmod, rgb, v } from "../engine/geom.ts";
import { Gfx } from "../engine/gfx.ts";
import { Node2D } from "../engine/node.ts";
import { Rng } from "../engine/rng.ts";
import * as Ink from "./ink.ts";
import * as FoodArt from "./food_art.ts";
import * as AlleyArt from "./alley_art.ts";
import * as ArtAssets from "./art_assets.ts";
import { ART_BANDS, SHOP_ART, drawShopArt } from "./shop_art.ts";

export const TARP_RED = rgb(0.84, 0.29, 0.19);
export const TARP_CREAM = rgb(0.96, 0.88, 0.74);

interface Stall {
  x: number;
  w: number;
  col: Color;
  h: number;
}

export class StreetArt extends Node2D {
  size = v(1920, 1080);
  awningY = 96.0; // 차양 윗변
  awningH = 54.0; // 차양 줄무늬 높이 (아래로 반원 장식이 더 붙음)
  counterY = 450.0; // 배경이 끝나고 카운터가 시작되는 높이
  theme = "alley";
  shopId = ""; // 그림 파일(ArtAssets.background)이 있으면 도형 대신 그 그림
  menuNames: string[] = []; // 가게 벽 메뉴판에 쓸 이름
  signText = ""; // 왼쪽 기둥에 걸린 세로 간판 글자 (비어 있으면 간판 없음)

  private buildings: R[] = [];
  private windows: R[] = [];
  private stalls: Stall[] = [];
  private t = 0.0;
  private cache: HTMLCanvasElement | null = null; // 골목 배경의 안 움직이는 부분
  private cacheScale = 0;

  enterTree(): void {
    const rng = new Rng(77);
    const streetY = this.counterY - 110.0;
    let x = -30.0;
    while (x < this.size.x) {
      const w = rng.randfRange(130.0, 230.0);
      const h = rng.randfRange(150.0, 290.0);
      const r = new R(x, streetY - h, w, h);
      this.buildings.push(r);
      let wy = r.y + 24.0;
      while (wy < r.endY - 40.0) {
        let wx = r.x + 18.0;
        while (wx < r.endX - 34.0) {
          if (rng.randf() < 0.32) this.windows.push(new R(wx, wy, 20, 26));
          wx += 40.0;
        }
        wy += 48.0;
      }
      x += w + rng.randfRange(6.0, 30.0);
    }
    const palette = [rgb(0.85, 0.25, 0.25), rgb(0.95, 0.75, 0.2), rgb(0.25, 0.55, 0.85), rgb(0.3, 0.7, 0.45), rgb(0.8, 0.4, 0.75)];
    let sx = -40.0;
    while (sx < this.size.x) {
      const sw = rng.randfRange(170.0, 240.0);
      this.stalls.push({ x: sx, w: sw, col: palette[rng.randiRange(0, palette.length - 1)], h: rng.randfRange(110.0, 150.0) });
      sx += sw + rng.randfRange(10.0, 40.0);
    }
  }

  process(dt: number): void {
    this.t += dt;
  }

  draw(g: Gfx): void {
    // 가게 영업 화면 그림 (사용자 그림): 화면 전체 (카운터·조리대까지 그려져 있음 — 영업 화면은 KitchenView 가 그 위에)
    const shopImg = this.shopId !== "" ? ArtAssets.shopImage(this.shopId) : null;
    if (shopImg !== null) {
      const a = SHOP_ART[this.shopId];
      drawShopArt(g.ctx, shopImg, a); // 영업 화면 띠에 맞춰 세 띠로 (shop_art.ts mapY)
      // 그림 속 조리 도구가 이 가게 것이 아니면 (kitchen = null) 장보기·업그레이드 배경에서도 영업 화면처럼
      // 조리대 띠로 가림 — 영업 화면에서는 KitchenView 가 덮으니 그대로
      if (a.kitchen === null && this.counterY > 900) {
        const { kitchenTop: kt, shelfTop: st } = ART_BANDS;
        g.rect(new R(0, kt, this.size.x, st - kt), rgb(0.3, 0.31, 0.33));
        g.rect(new R(0, kt, this.size.x, 10), rgb(0.55, 0.57, 0.6));
        const fl = rgb(a.floor[0] / 255, a.floor[1] / 255, a.floor[2] / 255);
        g.rect(new R(0, st, this.size.x, this.size.y - st), fl);
        g.rect(new R(0, st, this.size.x, 8), fl.darkened(0.3));
      }
      return;
    }
    const tex = this.shopId !== "" ? ArtAssets.background(this.shopId) : null;
    if (tex !== null) {
      g.texture(tex, new R(0, 0, this.size.x, this.counterY));
      return;
    }
    switch (this.theme) {
      case "bunsik":
        this.drawBunsik(g);
        break;
      case "market":
        this.drawMarket(g);
        break;
      case "beach":
        this.drawBeach(g);
        break;
      case "suljip":
        this.drawSuljip(g);
        break;
      default:
        this.drawAlley(g);
    }
  }

  // ---------------------------------------------------------------- 골목 포장마차

  private drawAlley(g: Gfx): void {
    this.drawAlleyStatic(g);
    AlleyArt.drawLive(g, this.size, this.counterY, this.t);
    AlleyArt.frame(g, this.size, this.awningY + this.awningH, this.counterY, this.t);
    AlleyArt.awning(g, this.size, this.awningY, this.awningH, rgb(0.88, 0.36, 0.2), rgb(0.97, 0.9, 0.76));
    this.drawSign(g, true);
  }

  /** 하늘·건물·나무·보도블록은 지금 화면 배율로 한 번 그려 둔 그림을 붙인다 (매 프레임 다시 그리면 폰에서 무거움) */
  private drawAlleyStatic(g: Gfx): void {
    if (typeof document === "undefined") {
      AlleyArt.drawStatic(g, this.size, this.counterY);
      return;
    }
    const m = g.ctx.getTransform();
    const k = Math.hypot(m.a, m.b);
    if (this.cache === null || Math.abs(this.cacheScale - k) > 0.01) {
      const c = this.cache ?? document.createElement("canvas");
      c.width = Math.max(1, Math.ceil(this.size.x * k));
      c.height = Math.max(1, Math.ceil(this.counterY * k));
      const ctx = c.getContext("2d")!;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      AlleyArt.drawStatic(new Gfx(ctx), this.size, this.counterY);
      this.cache = c;
      this.cacheScale = k;
    }
    g.ctx.drawImage(this.cache, 0, 0, this.size.x, this.counterY);
  }

  private drawAwning(g: Gfx, a: Color, b: Color): void {
    const stripe = 90.0;
    const bottom = this.awningY + this.awningH;
    const n = Math.trunc(Math.ceil(this.size.x / stripe));
    for (let i = 0; i < n; i++) g.circle(v(i * stripe + stripe * 0.5, bottom), stripe * 0.5, i % 2 === 0 ? a : b);
    for (let i = 0; i < n; i++) g.rect(new R(i * stripe, this.awningY, stripe, bottom - this.awningY), i % 2 === 0 ? a : b);
    g.rect(new R(0, this.awningY, this.size.x, 10.0), rgb(0, 0, 0, 0.2));
  }

  /** 노점 틀: 양쪽 나무 기둥 + 기둥 옆에 매달린 큰 전구 + 왼쪽 기둥의 세로 간판 */
  private drawStallFrame(g: Gfx, post: Color): void {
    const top = this.awningY + this.awningH * 0.5;
    const cy = this.counterY;
    for (const x of [0.0, this.size.x - 34.0]) {
      g.rect(new R(x, top, 34.0, cy - top), post);
      g.rect(new R(x + 6.0, top, 6.0, cy - top), post.lightened(0.15));
      g.rect(new R(x + 26.0, top, 8.0, cy - top), post.darkened(0.25));
    }
    // 큰 전구 두 개
    for (const bx of [118.0, this.size.x - 118.0]) {
      const by = this.awningY + this.awningH + 64.0;
      g.line(v(bx, this.awningY + this.awningH * 0.6), v(bx, by - 18.0), rgb(0.1, 0.08, 0.06), 3.0);
      g.rect(new R(bx - 8.0, by - 22.0, 16.0, 10.0), rgb(0.3, 0.27, 0.22));
      const flicker = 0.92 + 0.08 * Math.sin(this.t * 5.0 + bx);
      g.circle(v(bx, by), 70.0, rgb(1.0, 0.78, 0.4, 0.12 * flicker));
      g.circle(v(bx, by), 36.0, rgb(1.0, 0.82, 0.45, 0.22 * flicker));
      g.circle(v(bx, by), 15.0, rgb(1.0, 0.93, 0.7).mul(flicker));
    }
    this.drawSign(g, false);
  }

  /** 왼쪽 기둥의 세로 간판 (나무 판 + 글자 + 하트). ink = 먹선 그림체 */
  private drawSign(g: Gfx, ink: boolean): void {
    if (this.signText === "") return;
    const chars = [...this.signText.replace(/ /g, "")];
    const n = chars.length;
    const board = new R(42.0, this.awningY + this.awningH + 150.0, 74.0, 56.0 * n + 70.0);
    g.line(v(board.x + 14.0, this.awningY + this.awningH + 10.0), board.pos.add(v(14.0, 0)), rgb(0.15, 0.1, 0.06), 3.0);
    g.line(v(board.endX - 14.0, this.awningY + this.awningH + 10.0), v(board.endX - 14.0, board.y), rgb(0.15, 0.1, 0.06), 3.0);
    if (ink) {
      FoodArt.roundedRect(g, board.grow(2.0), rgb(0.97, 0.92, 0.8), 8.0, Ink.LINE, 5);
      g.rect(new R(board.endX - 12.0, board.y + 6.0, 8.0, board.h - 12.0), rgb(0.85, 0.78, 0.64));
    } else {
      FoodArt.roundedRect(g, board, rgb(0.93, 0.88, 0.76), 8.0, rgb(0.42, 0.3, 0.2), 4);
    }
    for (let j = 0; j < n; j++) FoodArt.text(g, chars[j], v(board.center().x, board.y + 38.0 + j * 56.0), 40, rgb(0.25, 0.17, 0.12), board.w);
    const hp = v(board.center().x, board.endY - 30.0);
    g.circle(hp.add(v(-7, -3)), 8.0, rgb(0.35, 0.22, 0.18));
    g.circle(hp.add(v(7, -3)), 8.0, rgb(0.35, 0.22, 0.18));
    g.polygon([hp.add(v(-14.5, 0)), hp.add(v(14.5, 0)), hp.add(v(0, 15))], rgb(0.35, 0.22, 0.18));
  }

  /** 처진 전선에 달린 전구. colorful = 알록달록 (야시장) */
  private drawBulbs(g: Gfx, warm: Color, colorful: boolean): void {
    const y0 = this.awningY + this.awningH + 64.0;
    const pts: V[] = [];
    for (let k = 0; k < 25; k++) {
      const x = (this.size.x * k) / 24.0;
      pts.push(v(x, y0 + Math.sin((PI * (k % 6)) / 6.0) * 26.0));
    }
    g.polyline(pts, rgb(0.12, 0.1, 0.08), 3.0);
    const colors = [rgb(1.0, 0.4, 0.35), rgb(1.0, 0.85, 0.3), rgb(0.45, 0.8, 1.0), rgb(0.5, 1.0, 0.55), rgb(1.0, 0.55, 0.9)];
    for (let k = 0; k < 25; k += 2) {
      const p = pts[k].add(v(0, 12));
      const flicker = 0.85 + 0.15 * Math.sin(this.t * 3.0 + k * 1.7);
      const col = colorful ? colors[Math.trunc(k / 2.0) % colors.length] : warm;
      g.circle(p, 26.0, col.withA(0.16 * flicker));
      g.circle(p, 9.0, col.lightened(0.2).mul(flicker));
    }
  }

  // ---------------------------------------------------------------- 동네 분식집

  private drawBunsik(g: Gfx): void {
    const sz = this.size;
    const cy = this.counterY;
    const wallTop = this.awningY;
    const floorY = cy - 60.0;
    // 벽: 위는 크림색, 아래는 하늘색 타일
    g.rect(new R(0, 0, sz.x, cy), rgb(0.96, 0.9, 0.76));
    const tileTop = floorY - 120.0;
    g.rect(new R(0, tileTop, sz.x, cy - tileTop), rgb(0.62, 0.8, 0.84));
    for (let x = 0.0; x < sz.x; x += 48.0) g.line(v(x, tileTop), v(x, cy), rgb(1, 1, 1, 0.5), 2.0);
    for (let y = tileTop; y < cy; y += 48.0) g.line(v(0, y), v(sz.x, y), rgb(1, 1, 1, 0.5), 2.0);
    // 창문 2개: 왼쪽 = 길 건너 학교 (창틀에 잘림), 오른쪽 = 벚꽃 핀 동네 (2026-11-16 사용자 "분식 스테이지 배경에 잘려도 되니까 학교")
    [sz.x * 0.08, sz.x * 0.72].forEach((wx, wi) => {
      const win = new R(wx, wallTop + 110.0, sz.x * 0.2, tileTop - wallTop - 140.0);
      g.rect(win.grow(10.0), rgb(0.55, 0.38, 0.22));
      const ctx = g.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.rect(win.x, win.y, win.w, win.h);
      ctx.clip();
      // 늦은 오후 하늘
      const sky = ctx.createLinearGradient(0, win.y, 0, win.endY);
      sky.addColorStop(0, "#9fd0ef");
      sky.addColorStop(0.75, "#ffe2b8");
      sky.addColorStop(1, "#ffd3a0");
      ctx.fillStyle = sky;
      ctx.fillRect(win.x, win.y, win.w, win.h);
      g.circle(v(win.x + win.w * 0.2, win.y + 34), 22, rgb(1, 1, 1, 0.75));
      g.circle(v(win.x + win.w * 0.28, win.y + 30), 28, rgb(1, 1, 1, 0.75));
      if (wi === 0) this.drawSchool(g, win);
      else this.drawNeighborhood(g, win);
      ctx.restore();
      // 창살 + 유리 반사
      g.line(v(win.center().x, win.y), v(win.center().x, win.endY), rgb(0.55, 0.38, 0.22), 8.0);
      g.line(v(win.x + 18, win.endY - 20), v(win.x + 60, win.y + 20), rgb(1, 1, 1, 0.22), 10.0);
    });
    // 가운데 메뉴판
    const board = new R(sz.x * 0.33, wallTop + 96.0, sz.x * 0.34, 190.0);
    FoodArt.roundedRect(g, board.grow(8.0), rgb(0.45, 0.28, 0.15), 14.0);
    FoodArt.roundedRect(g, board, rgb(0.16, 0.28, 0.2), 10.0);
    FoodArt.text(g, "메 뉴", v(board.center().x, board.y + 30.0), 30, rgb(1.0, 0.9, 0.5));
    this.menuNames.forEach((name, i) => {
      const colX = board.x + board.w * (i % 2 === 0 ? 0.25 : 0.75);
      const rowY = board.y + 74.0 + Math.floor(i / 2.0) * 40.0;
      FoodArt.text(g, name, v(colX, rowY), 26, rgb(0.96, 0.96, 0.9), board.w * 0.5);
    });
    // 위쪽 간판 띠 (노랑/빨강)
    this.drawAwning(g, rgb(0.95, 0.72, 0.15), rgb(0.86, 0.24, 0.16));
    // 펜던트 조명 (창문과 메뉴판 사이)
    for (const fx of [0.305, 0.695]) {
      const lx = sz.x * fx;
      const ly = this.awningY + this.awningH + 120.0;
      g.line(v(lx, this.awningY + this.awningH), v(lx, ly - 18.0), rgb(0.2, 0.15, 0.1), 3.0);
      g.polygon([v(lx - 34.0, ly), v(lx - 14.0, ly - 22.0), v(lx + 14.0, ly - 22.0), v(lx + 34.0, ly)], rgb(0.2, 0.45, 0.4));
      g.circle(v(lx, ly + 2.0), 46.0, rgb(1.0, 0.9, 0.6, 0.18));
      g.circle(v(lx, ly + 2.0), 10.0, rgb(1.0, 0.95, 0.75));
    }
  }

  /** 창밖 길 건너 학교: 시계탑 + 교문 간판 "햇살초등학교" + 줄줄이 창문 + 운동장 울타리 (창틀에 잘려도 됨) */
  private drawSchool(g: Gfx, win: R): void {
    const ground = win.endY - 26;
    const wall = rgb(0.98, 0.9, 0.78);
    const trim = rgb(0.72, 0.42, 0.3);
    // 본관 (창보다 넓게 — 양옆이 잘림)
    const b = new R(win.x - 70, ground - 150, win.w + 140, 150);
    FoodArt.roundedRect(g, b, wall, 4, rgb(0.45, 0.32, 0.22), 3);
    g.rect(new R(b.x, b.y, b.w, 12), trim);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 9; col++) {
        const x = b.x + 22 + col * ((b.w - 30) / 9);
        const y = b.y + 24 + row * 40;
        g.rect(new R(x, y, 26, 24), rgb(0.55, 0.78, 0.92));
        g.line(v(x + 13, y), v(x + 13, y + 24), rgb(1, 1, 1, 0.6), 2);
      }
    }
    // 가운데 시계탑
    const tx = win.center().x;
    const tw = 70;
    FoodArt.roundedRect(g, new R(tx - tw / 2, b.y - 70, tw, 80), wall.darkened(0.04), 4, rgb(0.45, 0.32, 0.22), 3);
    g.polygon([v(tx - tw / 2 - 8, b.y - 70), v(tx + tw / 2 + 8, b.y - 70), v(tx, b.y - 104)], trim);
    g.circle(v(tx, b.y - 34), 22, rgb(1, 1, 1));
    g.arc(v(tx, b.y - 34), 22, 0, Math.PI * 2, rgb(0.3, 0.22, 0.16), 3);
    g.line(v(tx, b.y - 34), v(tx, b.y - 48), rgb(0.2, 0.15, 0.1), 3);
    g.line(v(tx, b.y - 34), v(tx + 10, b.y - 30), rgb(0.2, 0.15, 0.1), 3);
    // 학교 이름 간판
    FoodArt.roundedRect(g, new R(tx - 90, b.y + 4, 180, 26), rgb(0.2, 0.45, 0.3), 5);
    FoodArt.text(g, "햇살초등학교", v(tx, b.y + 17), 18, rgb(1, 1, 1), 176);
    // 운동장 울타리 + 나무
    g.rect(new R(win.x, ground, win.w, 26), rgb(0.85, 0.72, 0.5));
    for (let x = win.x - 10; x < win.endX + 10; x += 22) g.line(v(x, ground + 4), v(x, ground - 22), rgb(0.35, 0.55, 0.4), 4);
    g.line(v(win.x, ground - 16), v(win.endX, ground - 16), rgb(0.35, 0.55, 0.4), 4);
    g.circle(v(win.x + 30, ground - 56), 34, rgb(0.4, 0.68, 0.38));
    g.rect(new R(win.x + 26, ground - 30, 8, 30), rgb(0.45, 0.3, 0.2));
  }

  /** 창밖 오른쪽: 문구점·주택 + 벚꽃 나무 (꽃잎이 날림) */
  private drawNeighborhood(g: Gfx, win: R): void {
    const ground = win.endY - 26;
    const houses: [number, number, Color, string][] = [
      [win.x - 20, 120, rgb(0.93, 0.85, 0.7), "문구"],
      [win.x + win.w * 0.42, 150, rgb(0.85, 0.66, 0.52), ""],
      [win.x + win.w * 0.75, 110, rgb(0.78, 0.82, 0.88), ""],
    ];
    for (const [x, h, col, sign] of houses) {
      const r = new R(x, ground - h, win.w * 0.36, h);
      FoodArt.roundedRect(g, r, col, 3, rgb(0.45, 0.32, 0.22), 3);
      for (let k = 0; k < 2; k++) g.rect(new R(r.x + 16 + k * 44, r.y + 20, 28, 26), rgb(0.6, 0.8, 0.92));
      if (sign !== "") {
        FoodArt.roundedRect(g, new R(r.x + 10, r.endY - 44, r.w - 20, 22), rgb(0.25, 0.55, 0.85), 4);
        FoodArt.text(g, sign, v(r.center().x, r.endY - 33), 16, rgb(1, 1, 1), r.w - 24);
      }
    }
    g.rect(new R(win.x, ground, win.w, 26), rgb(0.8, 0.78, 0.74));
    // 벚꽃 나무 + 날리는 꽃잎
    const tc = v(win.endX - 50, ground - 80);
    g.rect(new R(tc.x - 6, tc.y + 20, 12, 60), rgb(0.45, 0.3, 0.22));
    for (const [dx, dy, r] of [
      [0, 0, 44],
      [-34, 14, 30],
      [30, 16, 30],
    ]) g.circle(tc.add(v(dx, dy)), r, rgb(1.0, 0.72, 0.82));
    for (let k = 0; k < 8; k++) {
      const px = win.x + fmod(k * 61.0 + this.t * 22.0, win.w);
      const py = win.y + fmod(k * 43.0 + this.t * 30.0, win.h);
      g.circle(v(px, py), 3.5, rgb(1.0, 0.75, 0.85, 0.9));
    }
  }

  // ---------------------------------------------------------------- 야시장 푸드트럭

  private drawMarket(g: Gfx): void {
    const sz = this.size;
    const cy = this.counterY;
    const ground = cy - 70.0;
    g.rect(new R(0, 0, sz.x, cy), rgb(0.1, 0.06, 0.16));
    for (let i = 0; i < 6; i++) g.rect(new R(0, ground - 300.0 + i * 50.0, sz.x, 50.0), rgb(0.45, 0.18, 0.4, 0.05 * (i + 1)));
    // 멀리 빌딩 실루엣
    for (const b of this.buildings) g.rect(new R(b.x, b.y - 40.0, b.w, b.h + 40.0), rgb(0.13, 0.08, 0.2));
    // 노점 천막 줄
    for (const st of this.stalls) {
      const top = ground - st.h;
      g.rect(new R(st.x + 10.0, top, st.w - 20.0, st.h), rgb(0.95, 0.72, 0.4, 0.5));
      g.rect(new R(st.x + 10.0, top + st.h * 0.45, st.w - 20.0, st.h * 0.55), rgb(0.3, 0.16, 0.12));
      g.polygon([v(st.x, top), v(st.x + st.w * 0.5, top - 46.0), v(st.x + st.w, top)], st.col);
      for (let k = 0; k < 4; k++) {
        const cx = st.x + (st.w * (k + 0.5)) / 4.0;
        g.circle(v(cx, top), st.w / 8.0, k % 2 === 0 ? st.col : st.col.lightened(0.35));
      }
      g.circle(v(st.x + st.w * 0.5, top + 28.0), 12.0, rgb(1.0, 0.5, 0.3, 0.85));
      g.circle(v(st.x + st.w * 0.5, top + 28.0), 30.0, rgb(1.0, 0.5, 0.3, 0.15));
    }
    // 지나가는 사람들 실루엣
    for (let k = 0; k < 14; k++) {
      let px = fmod(k * 157.0 + this.t * (22.0 + (k % 3) * 8.0) * (k % 2 === 0 ? 1.0 : -1.0), sz.x + 200.0);
      if (px < 0.0) px += sz.x + 200.0;
      px -= 100.0;
      const py = ground + 6.0 + (k % 3) * 10.0;
      const bob = Math.abs(Math.sin(this.t * 6.0 + k)) * 4.0;
      g.circle(v(px, py - 92.0 - bob), 17.0, rgb(0.06, 0.03, 0.08, 0.85));
      FoodArt.roundedRect(g, new R(px - 24.0, py - 76.0 - bob, 48.0, 80.0), rgb(0.06, 0.03, 0.08, 0.85), 18.0);
    }
    g.rect(new R(0, ground, sz.x, cy - ground), rgb(0.18, 0.12, 0.14));
    // 트럭 차양 (청록/흰색)
    this.drawAwning(g, rgb(0.18, 0.6, 0.6), rgb(0.96, 0.96, 0.92));
    this.drawBulbs(g, rgb(1.0, 0.8, 0.4), true);
    this.drawStallFrame(g, rgb(0.78, 0.78, 0.82));
  }

  // ---------------------------------------------------------------- 해변 포장마차

  private drawBeach(g: Gfx): void {
    const sz = this.size;
    const cy = this.counterY;
    const horizon = this.awningY + this.awningH + 200.0;
    const sandY = cy - 90.0;
    // 밤하늘
    for (let i = 0; i < 8; i++) {
      const a = i / 7.0;
      g.rect(new R(0, horizon * a - 4.0, sz.x, horizon / 7.0 + 8.0), rgb(0.04, 0.07, 0.18).lerp(rgb(0.2, 0.14, 0.32), a));
    }
    for (let k = 0; k < 40; k++) {
      const sx = fmod(k * 211.0, sz.x);
      const sy = fmod(k * 97.0, horizon - 60.0) + 40.0;
      const tw = 0.5 + 0.5 * Math.sin(this.t * 2.0 + k);
      g.circle(v(sx, sy), 1.5 + (k % 3) * 0.6, rgb(1, 1, 1, 0.35 + 0.45 * tw));
    }
    const moon = v(sz.x * 0.78, horizon - 120.0);
    g.circle(moon, 110.0, rgb(1.0, 0.95, 0.75, 0.08));
    g.circle(moon, 46.0, rgb(1.0, 0.97, 0.85));
    g.circle(moon.add(v(14, -8)), 8.0, rgb(0.9, 0.86, 0.72));
    // 바다
    g.rect(new R(0, horizon, sz.x, sandY - horizon), rgb(0.05, 0.12, 0.25));
    for (let k = 0; k < 12; k++) {
      const wy = horizon + 10.0 + (k * (sandY - horizon - 20.0)) / 12.0;
      const w = 60.0 + k * 14.0;
      const off = Math.sin(this.t * 1.2 + k) * 14.0;
      g.line(v(moon.x - w + off, wy), v(moon.x + w + off, wy), rgb(1.0, 0.95, 0.75, 0.35 - k * 0.02), 3.0);
    }
    // 파도
    for (let k = 0; k < 3; k++) {
      const pts: V[] = [];
      const baseY = sandY - 12.0 - k * 22.0;
      for (let j = 0; j < 33; j++) {
        const x = (sz.x * j) / 32.0;
        pts.push(v(x, baseY + Math.sin(x * 0.012 + this.t * (1.4 + k * 0.3) + k) * 6.0));
      }
      g.polyline(pts, rgb(0.85, 0.95, 1.0, 0.5 - k * 0.12), 4.0 - k);
    }
    // 모래사장
    g.rect(new R(0, sandY, sz.x, cy - sandY), rgb(0.55, 0.47, 0.36));
    for (let k = 0; k < 30; k++) g.circle(v(fmod(k * 131.0, sz.x), sandY + 12.0 + fmod(k * 17.0, cy - sandY - 20.0)), 2.0, rgb(0.42, 0.35, 0.26));
    // 등대
    const lh = v(sz.x * 0.12, horizon - 10.0);
    g.polygon([lh.add(v(-16, 0)), lh.add(v(-10, -110)), lh.add(v(10, -110)), lh.add(v(16, 0))], rgb(0.9, 0.9, 0.92));
    g.rect(new R(lh.x - 13.0, lh.y - 70.0, 26.0, 18.0), rgb(0.85, 0.25, 0.2));
    const beam = 0.5 + 0.5 * Math.sin(this.t * 2.5);
    g.circle(lh.add(v(0, -118)), 12.0, rgb(1.0, 0.95, 0.6));
    g.circle(lh.add(v(0, -118)), 50.0, rgb(1.0, 0.95, 0.6, 0.12 * beam));
    // 천막 (파랑/흰색) + 기둥 + 전구
    this.drawAwning(g, rgb(0.2, 0.45, 0.82), rgb(0.96, 0.96, 0.94));
    this.drawBulbs(g, rgb(1.0, 0.8, 0.45), false);
    this.drawStallFrame(g, rgb(0.72, 0.58, 0.4));
  }

  // ---------------------------------------------------------------- 실내 포차

  private drawSuljip(g: Gfx): void {
    const sz = this.size;
    const cy = this.counterY;
    const ay = this.awningY;
    // 주황 비닐 천막 벽
    g.rect(new R(0, 0, sz.x, cy), rgb(0.86, 0.4, 0.12));
    for (let x = 0.0; x < sz.x; x += 160.0) {
      g.rect(new R(x, ay, 6.0, cy - ay), rgb(0.7, 0.3, 0.08));
      g.rect(new R(x + 60.0, ay, 40.0, cy - ay), rgb(1.0, 0.6, 0.25, 0.18));
    }
    // 투명 비닐 창 (밖은 비 오는 밤)
    for (const wx of [sz.x * 0.05, sz.x * 0.76]) {
      const win = new R(wx, ay + 120.0, sz.x * 0.19, cy - ay - 230.0);
      g.rect(win.grow(8.0), rgb(0.6, 0.26, 0.08));
      g.rect(win, rgb(0.1, 0.1, 0.16, 0.92));
      for (let k = 0; k < 12; k++) {
        const rx = win.x + fmod(k * 47.0 + this.t * 30.0, win.w);
        const ry = win.y + fmod(k * 29.0 + this.t * 380.0, win.h - 18.0);
        g.line(v(rx, ry), v(rx - 2.0, ry + 14.0), rgb(0.75, 0.8, 1.0, 0.45), 1.5);
      }
      g.rect(new R(win.x, win.y, win.w, 10.0), rgb(1, 1, 1, 0.12));
    }
    // 벽에 붙은 메뉴 종이
    const start = sz.x * 0.3;
    const span = sz.x * 0.4;
    this.menuNames.forEach((name, i) => {
      const px = start + (span * (i + 0.5)) / Math.max(1.0, this.menuNames.length);
      const paper = new R(px - 40.0, ay + 124.0, 80.0, 190.0);
      g.rect(paper, rgb(0.99, 0.93, 0.62));
      g.rect(new R(paper.x, paper.y, paper.w, 8.0), rgb(0.85, 0.2, 0.12));
      const chars = [...name.replace(/ /g, "")];
      const n = chars.length;
      for (let j = 0; j < n; j++) FoodArt.text(g, chars[j], v(px, paper.y + 36.0 + j * (150.0 / Math.max(4.0, n))), 26, rgb(0.2, 0.12, 0.08), 80.0);
    });
    // 천장 이음새 + 백열전구
    g.rect(new R(0, ay, sz.x, this.awningH), rgb(0.62, 0.26, 0.08));
    g.rect(new R(0, ay + this.awningH - 8.0, sz.x, 8.0), rgb(0.45, 0.18, 0.05));
    for (let k = 0; k < 6; k++) {
      const lx = sz.x * (0.09 + k * 0.164);
      const ly = ay + this.awningH + 30.0 + (k % 2) * 10.0;
      g.line(v(lx, ay + this.awningH), v(lx, ly - 10.0), rgb(0.15, 0.08, 0.04), 3.0);
      const flicker = 0.9 + 0.1 * Math.sin(this.t * 4.0 + k * 2.0);
      g.circle(v(lx, ly), 44.0, rgb(1.0, 0.8, 0.45, 0.14 * flicker));
      g.circle(v(lx, ly), 12.0, rgb(1.0, 0.92, 0.65).mul(flicker));
    }
  }
}
