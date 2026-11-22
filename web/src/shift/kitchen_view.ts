// 카운터(완성 칸·도마), 주방 바닥, 재료통, 그릇 더미, 쓰레기통을 그리고 위치 판정을 제공한다.
// 이 노드는 원점에 두고 화면 좌표로 그린다. x0 = 넓은 화면에서 가운데 정렬 오프셋.
// 완성 칸 = 메뉴마다 그 메뉴 전용 그릇 2칸 (가게 메뉴 순서, ShiftSession.trayMenu). 그릇 모양은 DishArt.

import { Color, R, V, WHITE, rgb, v } from "../engine/geom.ts";
import type { Gfx } from "../engine/gfx.ts";
import { Node2D } from "../engine/node.ts";
import * as D from "../core/defs.ts";
import type { ShiftSession } from "../core/shift_session.ts";
import * as FoodArt from "../art/food_art.ts";
import * as DishArt from "../art/dish_art.ts";
import * as ArtAssets from "../art/art_assets.ts";
import { type ShopArt, drawShopArt, mapRect, mapY } from "../art/shop_art.ts";

const INK = rgb(0.2, 0.13, 0.09);

const TRAY_CENTER_X = 748.0; // 완성 칸 전체의 가운데
const SLOT_STEP = 134.0; // 한 메뉴 그릇 2칸 사이 (2026-11-16 그릇을 키우며 넓힘, 예전 120)
const GROUP_GAP = 30.0; // 메뉴 묶음 사이 간격
const SLOT_SIZE = v(130, 118);
export const BOWL_SCALE = 0.7; // 완성 그릇 크기 (2026-11-16 사용자 "음식 크기가 좀 작다", 예전 0.6)
const BOARD_X = 1440.0;
const BOARD_SIZE = v(230, 112);

const BIN_BASE = v(166, 176); // 원본 크기
const BIN_SCALE = 0.7; // 2026-11-17 손님이 더 보이게 조리대를 줄이며 같이 줄임 (예전 0.82 → 0.78)
const BIN_CENTER_X = 960.0;
const BIN_STEP = 180.0; // 재료통(메뉴 카드) 간격. 메뉴 수(최대 4)에 맞춰 가운데 정렬

const TRASH_X = 1720.0;
const TRASH_SCALE = 0.85;
// (예전 왼쪽 아래 "그릇" 더미는 2026-11-17 사용자 "안 쓰는 그릇은 지워 줘"로 뺌 — 장식이었음)
const POWDER_X = 455.0; // 마법의 가루 통 (그릇 더미와 재료통 사이)
const POWDER_SIZE = v(150, 176);

/** 도마 위 음식: 한 번이라도 손질하면 손질된 모습. 단계가 있는 메뉴(김밥)는 단계마다 모습이 바뀐다 */
export function drawBoardFood(g: Gfx, menu: string, taps: number, c: V, s: number, col: Color): void {
  if (D.boardSteps(menu).length > 0) {
    FoodArt.drawFood(g, menu, c, s, col, { stage: taps });
    return;
  }
  FoodArt.drawFood(g, menu, c, s, col, { sliced: taps > 0 });
}

export class KitchenView extends Node2D {
  session!: ShiftSession;
  size = v(1920, 1080);
  x0 = 0.0;
  counterY = 580.0;
  trayY = 642.0;
  binsY = 992.0;

  /** 가게 영업 화면 그림 (사용자 그림, shop_art.ts). 있으면 카운터·도마(·조리대)는 그림 것을 씀 */
  art: ShopArt | null = null;

  hiddenTraySlot = -1;
  hideBoard = false;
  dragging = false;
  trashHot = false;

  private t = 0.0;
  private binPop: Record<string, number> = {};
  private boardPop = 0.0;

  private groupW(): number {
    return SLOT_STEP * (D.TRAY_PER_MENU - 1) + SLOT_SIZE.x;
  }

  trayCenter(i: number): V {
    const groups = this.binMenus().length;
    const total = groups * this.groupW() + (groups - 1) * GROUP_GAP;
    const gi = Math.trunc(i / D.TRAY_PER_MENU);
    const k = i % D.TRAY_PER_MENU;
    const x = TRAY_CENTER_X - total * 0.5 + gi * (this.groupW() + GROUP_GAP) + k * SLOT_STEP + SLOT_SIZE.x * 0.5;
    return v(this.x0 + x, this.trayY + (this.art?.trayDy ?? 0));
  }

  trayRect(i: number): R {
    return R.of(this.trayCenter(i).sub(SLOT_SIZE.mul(0.5)), SLOT_SIZE);
  }

  boardCenter(): V {
    const art = this.art;
    if (art) {
      const b = mapRect(art, art.board);
      return v(this.x0 + (b[0] + b[2]) * 0.5, (b[1] + b[3]) * 0.5);
    }
    return v(this.x0 + BOARD_X, this.trayY);
  }

  boardRect(): R {
    const art = this.art;
    if (art) {
      const b = mapRect(art, art.board);
      return new R(this.x0 + b[0], b[1], b[2] - b[0], b[3] - b[1]);
    }
    return R.of(this.boardCenter().sub(BOARD_SIZE.mul(0.5)), BOARD_SIZE);
  }

  binCenter(i: number): V {
    const n = this.binMenus().length;
    return v(this.x0 + BIN_CENTER_X + (i - (n - 1) * 0.5) * BIN_STEP, this.binsY);
  }

  binRect(i: number): R {
    const s = BIN_BASE.mul(BIN_SCALE);
    return R.of(this.binCenter(i).sub(s.mul(0.5)), s);
  }

  powderCenter(): V {
    return v(this.x0 + POWDER_X, this.binsY);
  }

  powderRect(): R {
    return R.of(this.powderCenter().sub(POWDER_SIZE.mul(0.5)), POWDER_SIZE);
  }

  trashCenter(): V {
    return v(this.x0 + TRASH_X, this.binsY);
  }

  trashRect(): R {
    return R.of(this.trashCenter().sub(v(130, 86)), v(260, 172));
  }

  traySlotAt(p: V): number {
    for (let i = 0; i < this.session.tray.length; i++) if (this.trayRect(i).hasPoint(p)) return i;
    return -1;
  }

  /** 재료통 순서 = 오늘 가게의 메뉴 순서 */
  binMenus(): string[] {
    return this.session.shop.menus;
  }

  binAt(p: V): string {
    const menus = this.binMenus();
    for (let i = 0; i < menus.length; i++) if (this.binRect(i).hasPoint(p)) return menus[i];
    return "";
  }

  popBin(menu: string): void {
    this.binPop[menu] = 1.0;
  }

  popBoard(): void {
    this.boardPop = 1.0;
  }

  process(dt: number): void {
    this.t += dt;
    this.boardPop = Math.max(0.0, this.boardPop - dt * 4.0);
    for (const k of Object.keys(this.binPop)) this.binPop[k] = Math.max(0.0, this.binPop[k] - dt * 4.0);
  }

  /** 조리대(스테인리스) 윗면 = 완성 칸 바로 아래 */
  kitchenTop(): number {
    return this.trayY + SLOT_SIZE.y * 0.5 + 4.0;
  }

  /** 재료 선반 윗면 (조리대가 끝나는 곳) */
  shelfTop(): number {
    return this.binsY - BIN_BASE.y * BIN_SCALE * 0.5 - 12.0;
  }

  draw(g: Gfx): void {
    const sz = this.size;
    const cy = this.counterY;
    const kitchenTop = this.kitchenTop();
    const shelfTop = this.shelfTop();
    const art = this.art;
    const img = art !== null ? ArtAssets.shopImage(this.session.shopId) : null;
    if (art !== null && img !== null) {
      // 가게 그림: 뒤층(StreetArt)은 이미 손님 뒤에 깔려 있다. 앞층(카운터·조리대·카운터 위 물건)을 손님 위에
      // (2026-11-18 사용자 "조리대와 배경을 분리해 줘, 손님 일러스트는 그 사이에"). 앞층을 아직 못 받았으면 counterLine 아래를 한 번 더.
      // 그림 속 조리대를 쓰는 가게는 조리대까지, 아니면 완성 칸 선반까지 — 그 아래는 게임 조리대 띠가 덮음
      const y1 = art.kitchen !== null ? shelfTop : kitchenTop;
      const front = ArtAssets.shopFrontImage(this.session.shopId);
      if (front !== null) drawShopArt(g.ctx, front, art, 0, y1, this.x0);
      else drawShopArt(g.ctx, img, art, mapY(art, art.counterLine), y1, this.x0);
    } else {
      // 카운터
      g.rect(new R(0, cy, sz.x, 20), rgb(0.55, 0.34, 0.2));
      g.rect(new R(0, cy + 20.0, sz.x, kitchenTop - cy - 20.0), rgb(0.76, 0.57, 0.37));
      for (let k = 0; k < 3; k++) {
        const y = cy + 44.0 + k * 30.0;
        g.line(v(0, y), v(sz.x, y + 4.0), rgb(0.68, 0.49, 0.3, 0.35), 2.0);
      }
    }
    if (art === null || img === null || art.kitchen === null) {
      // 조리대 (스테인리스) — 그림 속 조리 도구가 이 가게 것이 아니면 덮어서 가림
      g.rect(new R(0, kitchenTop, sz.x, shelfTop - kitchenTop), rgb(0.3, 0.31, 0.33));
      g.rect(new R(0, kitchenTop, sz.x, 10.0), rgb(0.55, 0.57, 0.6));
      for (let x = 0.0; x < sz.x; x += 140.0) g.line(v(x, kitchenTop + 10.0), v(x + 40.0, shelfTop), rgb(1, 1, 1, 0.04), 18.0);
    }
    // 재료 선반 (그림이 있으면 그림의 아래 띠 색)
    const floor = art !== null && img !== null ? rgb(art.floor[0] / 255, art.floor[1] / 255, art.floor[2] / 255) : rgb(0.46, 0.3, 0.19);
    g.rect(new R(0, shelfTop, sz.x, sz.y - shelfTop), floor);
    g.rect(new R(0, shelfTop, sz.x, 8), floor.darkened(0.3));

    // 완성 칸 왼쪽 안내 (그릇을 키우며 칸이 넓어져 화면 왼쪽 끝 안에 들어오게). 가게 그림이면 그림 속 간판과 겹쳐서 뺌
    if (img === null) FoodArt.text(g, "완성 칸\n탭하면 서빙 →", v(Math.max(this.x0 + 84.0, this.trayCenter(0).x - SLOT_SIZE.x * 0.5 - 86.0), this.trayY), 21, rgb(0.36, 0.22, 0.12), 160.0);
    this.drawTray(g);
    this.drawBoard(g);
    this.drawBins(g);
    this.drawTrash(g);
    this.drawPowder(g);
    g.resetTransform();
  }

  /**
   * 마법의 가루 통: 유리병 + 보라 뚜껑 + 반짝이는 가루 (남은 개수만큼 차 있음) + 개수 배지.
   * 준비(armed)하면 빛 고리가 퍼지고 열린 재료통들이 보랏빛으로 빛남 ("어디에 뿌릴까요?")
   */
  private drawPowder(g: Gfx): void {
    const s = this.session;
    const c = this.powderCenter();
    const t = this.t;
    const armed = s.powderArmed;
    const have = s.powder;
    if (armed) {
      const ring = (t * 1.2) % 1.0;
      g.ctx.save();
      g.ctx.strokeStyle = rgb(0.9, 0.6, 1.0, 0.9 * (1.0 - ring)).css();
      g.ctx.lineWidth = 6.0;
      g.ctx.beginPath();
      g.ctx.ellipse(c.x, c.y, 80 + ring * 30, 92 + ring * 30, 0, 0, Math.PI * 2);
      g.ctx.stroke();
      g.ctx.restore();
      // 열린 재료통도 보랏빛 테두리
      const menus = this.binMenus();
      for (let i = 0; i < menus.length; i++) {
        if (!s.menuPool.includes(menus[i])) continue;
        FoodArt.roundedRect(g, this.binRect(i).grow(6.0), rgb(0, 0, 0, 0), 22.0, rgb(0.85, 0.55, 1.0, 0.6 + 0.4 * Math.sin(t * 6.0)), 5);
      }
    }
    const bob = armed ? Math.sin(t * 6.0) * 4.0 : 0.0;
    const body = new R(c.x - 48, c.y - 56 + bob, 96, 100);
    FoodArt.ellipse(g, v(c.x, c.y + 48), 56.0, 12.0, rgb(0, 0, 0, 0.25));
    // 2026-11-22 사용자 그림 (코르크 마개 유리병 + 보라 가루 + 끈 · 별 꼬리표). 다 쓰면 흐린 회색
    const jar = ArtAssets.powderImage();
    if (jar !== null) {
      const jh = 140.0;
      const jw = (jar.width / jar.height) * jh;
      const ctx = g.ctx;
      ctx.save();
      if (have <= 0) {
        ctx.filter = "grayscale(1) brightness(0.75)";
        ctx.globalAlpha = 0.8;
      }
      ctx.drawImage(jar, c.x - jw * 0.5, c.y + 50 - jh + bob, jw, jh);
      ctx.restore();
      if (have > 0) FoodArt.magicSparkles(g, v(c.x, c.y - 6 + bob), 62.0, t, armed ? 6 : 3);
      FoodArt.textOutlined(g, armed ? "뿌릴 준비!" : "마법의 가루", v(c.x, c.y + 64), 21, armed ? rgb(1.0, 0.85, 1.0) : rgb(1.0, 0.95, 0.85), rgb(0.25, 0.1, 0.3), 6, 190);
      this.powderBadge(g, v(c.x + jw * 0.5 - 6, c.y + 50 - jh + 22 + bob), have);
      return;
    }
    // 가루 (남은 개수만큼)
    const fill = Math.min(1.0, have / 5.0);
    if (fill > 0) {
      const fh = (body.h - 18) * fill;
      FoodArt.roundedRect(g, new R(body.x + 7, body.endY - 9 - fh, body.w - 14, fh), have > 0 ? rgb(0.93, 0.55, 0.95) : rgb(0.5, 0.5, 0.5), 14.0);
      FoodArt.roundedRect(g, new R(body.x + 7, body.endY - 9 - fh, body.w - 14, Math.min(fh, 10)), rgb(1.0, 0.85, 1.0, 0.8), 6.0);
    }
    // 유리병
    FoodArt.roundedRect(g, body, rgb(0.85, 0.95, 1.0, 0.28), 20.0, rgb(0.23, 0.14, 0.08), 5);
    g.line(v(body.x + 18, body.y + 16), v(body.x + 18, body.endY - 22), rgb(1, 1, 1, 0.6), 6.0);
    // 뚜껑 + 별 장식
    FoodArt.roundedRect(g, new R(c.x - 40, body.y - 22, 80, 26), rgb(0.55, 0.3, 0.82), 9.0, rgb(0.23, 0.14, 0.08), 4);
    FoodArt.sparkle(g, v(c.x, body.y - 9), 0.75, rgb(1.0, 0.86, 0.35));
    if (have > 0) FoodArt.magicSparkles(g, v(c.x, body.y + 34 + bob), 62.0, t, armed ? 6 : 3);
    // 이름표 + 개수
    FoodArt.textOutlined(g, armed ? "뿌릴 준비!" : "마법의 가루", v(c.x, c.y + 64), 21, armed ? rgb(1.0, 0.85, 1.0) : rgb(1.0, 0.95, 0.85), rgb(0.25, 0.1, 0.3), 6, 190);
    this.powderBadge(g, v(body.endX - 4, body.y - 14), have);
  }

  /** 가루 통 개수 배지 (보라 동그라미) */
  private powderBadge(g: Gfx, bc: V, have: number): void {
    g.circle(bc.add(v(0, 3)), 22.0, rgb(0, 0, 0, 0.3));
    g.circle(bc, 22.0, rgb(0.23, 0.14, 0.08));
    g.circle(bc, 18.0, have > 0 ? rgb(0.62, 0.32, 0.88) : rgb(0.5, 0.48, 0.5));
    FoodArt.textOutlined(g, String(have), bc.add(v(0, 1)), 24, WHITE, rgb(0.15, 0.05, 0.2), 5, 40);
  }

  /** 메뉴마다 전용 그릇 2개. 빈 칸엔 빈 그릇, 아직 안 열린 메뉴는 흐리게 + 자물쇠. 묶음 아래에 메뉴 이름 */
  private drawTray(g: Gfx): void {
    const s = this.session;
    const n = s.tray.length;
    for (let i = 0; i < n; i++) {
      const menu = s.trayMenu(i);
      const c = this.trayCenter(i).add(v(0, -14));
      FoodArt.ellipse(g, this.trayCenter(i).add(v(0, 30)), 56.0, 13.0, rgb(0, 0, 0, 0.16));
      const bowl = s.tray[i];
      if (bowl === null || i === this.hiddenTraySlot) DishArt.draw(g, menu, c, BOWL_SCALE, D.Q.PERFECT, true);
      else {
        DishArt.draw(g, bowl.menu, c, BOWL_SCALE, bowl.quality);
        if (bowl.magic) FoodArt.magicSparkles(g, c, 50.0, this.t + i, 4);
      }
    }
    for (let gi = 0; gi < Math.trunc(n / D.TRAY_PER_MENU); gi++) {
      const first = gi * D.TRAY_PER_MENU;
      const menu = s.trayMenu(first);
      const left = this.trayRect(first).x;
      const right = this.trayRect(first + D.TRAY_PER_MENU - 1).endX;
      const mid = (left + right) * 0.5;
      const ty = this.trayCenter(first).y;
      if (!s.menuPool.includes(menu)) {
        FoodArt.roundedRect(g, new R(left - 4.0, ty - SLOT_SIZE.y * 0.5 + 2.0, right - left + 8.0, SLOT_SIZE.y - 4.0), rgb(0.62, 0.45, 0.28, 0.78), 16.0);
        FoodArt.lockIcon(g, v(mid, ty - 14.0), 0.8, rgb(0.36, 0.24, 0.14));
        FoodArt.text(g, D.levelName(D.menuUnlockLevel(menu)), v(mid, ty + 46.0), 20, rgb(0.36, 0.24, 0.14, 0.9), right - left);
        continue;
      }
      FoodArt.textOutlined(g, D.menuLabel(menu), v(mid, ty + 46.0), 20, rgb(1.0, 0.97, 0.9), rgb(0.36, 0.22, 0.12, 0.85), 5, right - left + 20.0);
    }
  }

  private drawBoard(g: Gfx): void {
    const r = this.boardRect();
    const sc = 1.0 + 0.08 * this.boardPop;
    const c = this.boardCenter();
    const drawn = this.art !== null && ArtAssets.shopImage(this.session.shopId) !== null; // 그림 속 도마를 씀
    if (!drawn) {
      FoodArt.roundedRect(g, R.of(c.sub(BOARD_SIZE.mul(0.5 * sc)).add(v(0, 4)), BOARD_SIZE.mul(sc).sub(v(0, 8))), rgb(0.88, 0.72, 0.5), 20.0, rgb(0.66, 0.5, 0.3), 3);
      for (let k = 0; k < 3; k++) g.line(c.add(v(-86, -22 + k * 22)), c.add(v(86, -18 + k * 22)), rgb(0.78, 0.6, 0.38, 0.6), 2.0);
    }
    const cut = this.session.cutting;
    if (cut === null || this.hideBoard) {
      const note = this.boardNote();
      // 그림 속 도마는 보면 도마라서 "도마" 이름은 빼고, 아직 안 열린 메뉴 안내만
      if (!drawn || note !== "도마") FoodArt.text(g, note, c, 24, rgb(0.55, 0.38, 0.22, 0.8), r.w);
      return;
    }
    const menu = cut.menu;
    const taps = cut.taps;
    const need = D.boardTaps(menu);
    const col = FoodArt.qualityColor(menu, cut.quality);
    drawBoardFood(g, menu, taps, c.add(v(0, -2)), 0.62 * sc, col);
    for (let k = 0; k < need; k++) g.circle(c.add(v((k - (need - 1) * 0.5) * 24.0, 40)), 7.0, k < taps ? rgb(0.3, 0.6, 0.3) : rgb(0.6, 0.48, 0.34));
    const hint = D.boardSteps(menu).length > 0 ? `탭: ${D.boardStepVerb(menu, taps)} (${taps}/${need})` : `탭해서 ${D.boardVerb(menu)} ${taps}/${need}`;
    FoodArt.textOutlined(g, hint, c.add(v(0, -40)), 20, WHITE, rgb(0, 0, 0, 0.6), 5, r.w);
    this.drawBoardQueue(g, r);
  }

  /** 도마 오른쪽 카운터에 기다리는 꺼낸 음식: 작은 그릇으로 놓고 "대기 n" (D.BOARD_QUEUE_MAX). 왼쪽은 완성 칸이라 오른쪽 (세 가게 모두 장식만 있음) */
  private drawBoardQueue(g: Gfx, r: R): void {
    const q = this.session.boardQueue;
    if (q.length === 0) return;
    const base = v(r.x + r.w + 34, r.y + r.h * 0.6);
    for (let i = 0; i < q.length; i++) {
      const p = base.add(v(i * 30, 0));
      g.circle(p.add(v(0, 3)), 22, rgb(0, 0, 0, 0.3));
      g.circle(p, 22, rgb(0.97, 0.94, 0.88));
      g.arc(p, 22, 0, Math.PI * 2, rgb(0.23, 0.14, 0.08), 3);
      drawBoardFood(g, q[i].menu, 0, p.add(v(0, -2)), 0.2, FoodArt.qualityColor(q[i].menu, q[i].quality));
    }
    const lx = base.x + (q.length - 1) * 15;
    FoodArt.textOutlined(g, `대기 ${q.length}`, v(lx, base.y - 36), 20, rgb(1, 0.92, 0.6), rgb(0, 0, 0, 0.7), 5, 120);
  }

  /** 빈 도마에 쓰는 안내: 도마를 쓰는 메뉴가 아직 안 열렸으면 언제 열리는지 */
  boardNote(): string {
    for (const m of this.binMenus()) {
      if (D.usesBoard(m)) {
        if (this.session.menuPool.includes(m)) return "도마";
        return `도마 (${D.menuName(m)} ${D.levelName(D.menuUnlockLevel(m))})`;
      }
    }
    return "도마";
  }

  private drawBins(g: Gfx): void {
    const menus = this.binMenus();
    for (let i = 0; i < menus.length; i++) {
      const id = menus[i];
      const unlocked = this.session.menuPool.includes(id);
      const s = 1.0 + 0.1 * (this.binPop[id] ?? 0.0);
      g.setTransform(this.binCenter(i), 0, BIN_SCALE);
      const r = R.of(BIN_BASE.mul(-0.5), BIN_BASE);
      // 종이 메뉴 카드
      FoodArt.roundedRect(g, r.grow(-2.0), rgb(0, 0, 0, 0.25), 18.0);
      FoodArt.roundedRect(g, new R(r.x + 2, r.y - 4, r.w - 4, r.h - 4), rgb(0.95, 0.9, 0.8), 18.0, rgb(0.55, 0.42, 0.3), 4);
      if (unlocked) {
        FoodArt.drawIcon(g, id, r.pos.add(v(r.w * 0.5, 61)), 1.2 * s);
        const mname = D.menuName(id);
        const fs = mname.length <= 4 ? 30 : mname.length === 5 ? 26 : 22;
        FoodArt.text(g, mname, r.pos.add(v(r.w * 0.5, 128)), fs, INK, r.w);
        const lvl = this.session.priceLevel(id);
        const pc = lvl === "cheap" ? rgb(0.15, 0.45, 0.85) : lvl === "pricey" ? rgb(0.85, 0.2, 0.15) : rgb(0.35, 0.3, 0.28);
        FoodArt.text(g, D.formatWon(this.session.postedPrice(id)) + (lvl !== "normal" ? ` ${D.PRICE_LEVELS[lvl].name}` : ""), r.pos.add(v(r.w * 0.5, 158)), 20, pc, r.w);
        // 남은 재료 (재료를 사서 쓰는 영업만): 오른쪽 위 동그란 배지, 다 떨어지면 카드 위에 "품절"
        const left = this.session.stockLeft(id);
        if (left !== Infinity) {
          const bc = r.pos.add(v(r.w - 14.0, 10.0));
          const col = left <= 0 ? rgb(0.85, 0.24, 0.18) : left <= 3 ? rgb(0.95, 0.6, 0.12) : rgb(0.29, 0.62, 0.27);
          g.circle(bc.add(v(0, 3)), 27.0, rgb(0, 0, 0, 0.3));
          g.circle(bc, 27.0, rgb(0.23, 0.14, 0.08));
          g.circle(bc, 23.0, col);
          FoodArt.textOutlined(g, String(left), bc.add(v(0, 1)), left >= 10 ? 24 : 28, WHITE, rgb(0.15, 0.08, 0.04), 5, 46.0);
          if (left <= 0) {
            FoodArt.roundedRect(g, r.grow(-4.0), rgb(0.1, 0.06, 0.05, 0.55), 18.0);
            FoodArt.textOutlined(g, "품절", r.pos.add(v(r.w * 0.5, 72)), 40, rgb(1.0, 0.86, 0.8), rgb(0.5, 0.08, 0.05), 8, r.w);
          }
        }
      } else {
        FoodArt.roundedRect(g, r.grow(-4.0), rgb(0.12, 0.1, 0.1, 0.88), 20.0);
        FoodArt.lockIcon(g, r.pos.add(v(r.w * 0.5, 61)), 1.1, rgb(0.85, 0.8, 0.75));
        FoodArt.text(g, D.levelName(D.menuUnlockLevel(id)), r.pos.add(v(r.w * 0.5, 132)), 30, rgb(0.9, 0.86, 0.8), r.w);
      }
    }
    g.resetTransform();
  }

  private drawTrash(g: Gfx): void {
    const c = this.trashCenter();
    const hot = this.dragging && this.trashHot;
    const col = hot ? rgb(0.85, 0.3, 0.25) : rgb(0.42, 0.45, 0.5);
    if (this.dragging) {
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 8.0);
      FoodArt.roundedRect(g, this.trashRect(), rgb(1.0, 0.4, 0.3, 0.12 + 0.12 * pulse), 24.0);
    }
    g.setTransform(c, 0, TRASH_SCALE);
    FoodArt.roundedRect(g, new R(-70.0, -46.0, 140.0, 104.0), col, 16.0);
    FoodArt.roundedRect(g, new R(-82.0, hot ? -70.0 : -62.0, 164.0, 22.0), col.darkened(0.2), 10.0);
    for (let k = 0; k < 3; k++) g.line(v(-34.0 + k * 34.0, -26.0), v(-34.0 + k * 34.0, 44.0), col.darkened(0.25), 4.0);
    FoodArt.text(g, "쓰레기통", v(0, 74), 26, rgb(0.92, 0.86, 0.78));
    g.resetTransform();
  }
}
