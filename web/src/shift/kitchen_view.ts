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

const INK = rgb(0.2, 0.13, 0.09);

const TRAY_CENTER_X = 730.0; // 완성 칸 전체의 가운데
const SLOT_STEP = 120.0; // 한 메뉴 그릇 2칸 사이
const GROUP_GAP = 30.0; // 메뉴 묶음 사이 간격
const SLOT_SIZE = v(116, 112);
export const BOWL_SCALE = 0.6;
const BOARD_X = 1440.0;
const BOARD_SIZE = v(230, 112);

const BIN_BASE = v(166, 176); // 원본 크기
const BIN_SCALE = 0.82;
const BIN_CENTER_X = 960.0;
const BIN_STEP = 180.0; // 재료통(메뉴 카드) 간격. 메뉴 수(최대 4)에 맞춰 가운데 정렬

const TRASH_X = 1720.0;
const TRASH_SCALE = 0.85;
const BOWLS_X = 200.0;
const BOWLS_SCALE = 0.8;

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
    return v(this.x0 + x, this.trayY);
  }

  trayRect(i: number): R {
    return R.of(this.trayCenter(i).sub(SLOT_SIZE.mul(0.5)), SLOT_SIZE);
  }

  boardCenter(): V {
    return v(this.x0 + BOARD_X, this.trayY);
  }

  boardRect(): R {
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

  draw(g: Gfx): void {
    const sz = this.size;
    const cy = this.counterY;
    const kitchenTop = this.trayY + SLOT_SIZE.y * 0.5 + 4.0;
    const shelfTop = this.binsY - BIN_BASE.y * BIN_SCALE * 0.5 - 12.0;
    // 카운터
    g.rect(new R(0, cy, sz.x, 20), rgb(0.55, 0.34, 0.2));
    g.rect(new R(0, cy + 20.0, sz.x, kitchenTop - cy - 20.0), rgb(0.76, 0.57, 0.37));
    for (let k = 0; k < 3; k++) {
      const y = cy + 44.0 + k * 30.0;
      g.line(v(0, y), v(sz.x, y + 4.0), rgb(0.68, 0.49, 0.3, 0.35), 2.0);
    }
    // 조리대 (스테인리스)
    g.rect(new R(0, kitchenTop, sz.x, shelfTop - kitchenTop), rgb(0.3, 0.31, 0.33));
    g.rect(new R(0, kitchenTop, sz.x, 10.0), rgb(0.55, 0.57, 0.6));
    for (let x = 0.0; x < sz.x; x += 140.0) g.line(v(x, kitchenTop + 10.0), v(x + 40.0, shelfTop), rgb(1, 1, 1, 0.04), 18.0);
    // 재료 선반
    g.rect(new R(0, shelfTop, sz.x, sz.y - shelfTop), rgb(0.46, 0.3, 0.19));
    g.rect(new R(0, shelfTop, sz.x, 8), rgb(0.36, 0.22, 0.13));

    FoodArt.text(g, "완성 칸\n탭하면 서빙 →", v(this.trayCenter(0).x - SLOT_SIZE.x * 0.5 - 92.0, this.trayY), 22, rgb(0.36, 0.22, 0.12), 170.0);
    this.drawTray(g);
    this.drawBoard(g);
    this.drawBins(g);
    this.drawBowlStack(g);
    this.drawTrash(g);
    g.resetTransform();
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
      else DishArt.draw(g, bowl.menu, c, BOWL_SCALE, bowl.quality);
    }
    for (let gi = 0; gi < Math.trunc(n / D.TRAY_PER_MENU); gi++) {
      const first = gi * D.TRAY_PER_MENU;
      const menu = s.trayMenu(first);
      const left = this.trayRect(first).x;
      const right = this.trayRect(first + D.TRAY_PER_MENU - 1).endX;
      const mid = (left + right) * 0.5;
      if (!s.menuPool.includes(menu)) {
        FoodArt.roundedRect(g, new R(left - 4.0, this.trayY - SLOT_SIZE.y * 0.5 + 2.0, right - left + 8.0, SLOT_SIZE.y - 4.0), rgb(0.62, 0.45, 0.28, 0.78), 16.0);
        FoodArt.lockIcon(g, v(mid, this.trayY - 14.0), 0.8, rgb(0.36, 0.24, 0.14));
        FoodArt.text(g, D.levelName(D.menuUnlockLevel(menu)), v(mid, this.trayY + 46.0), 20, rgb(0.36, 0.24, 0.14, 0.9), right - left);
        continue;
      }
      FoodArt.textOutlined(g, D.menuLabel(menu), v(mid, this.trayY + 46.0), 20, rgb(1.0, 0.97, 0.9), rgb(0.36, 0.22, 0.12, 0.85), 5, right - left + 20.0);
    }
  }

  private drawBoard(g: Gfx): void {
    const r = this.boardRect();
    const sc = 1.0 + 0.08 * this.boardPop;
    const c = this.boardCenter();
    FoodArt.roundedRect(g, R.of(c.sub(BOARD_SIZE.mul(0.5 * sc)).add(v(0, 4)), BOARD_SIZE.mul(sc).sub(v(0, 8))), rgb(0.88, 0.72, 0.5), 20.0, rgb(0.66, 0.5, 0.3), 3);
    for (let k = 0; k < 3; k++) g.line(c.add(v(-86, -22 + k * 22)), c.add(v(86, -18 + k * 22)), rgb(0.78, 0.6, 0.38, 0.6), 2.0);
    const cut = this.session.cutting;
    if (cut === null || this.hideBoard) {
      FoodArt.text(g, this.boardNote(), c, 24, rgb(0.55, 0.38, 0.22, 0.8), r.w);
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
        FoodArt.text(g, D.formatWon(D.menuPrice(id)), r.pos.add(v(r.w * 0.5, 158)), 22, rgb(0.35, 0.3, 0.28), r.w);
      } else {
        FoodArt.roundedRect(g, r.grow(-4.0), rgb(0.12, 0.1, 0.1, 0.88), 20.0);
        FoodArt.lockIcon(g, r.pos.add(v(r.w * 0.5, 61)), 1.1, rgb(0.85, 0.8, 0.75));
        FoodArt.text(g, D.levelName(D.menuUnlockLevel(id)), r.pos.add(v(r.w * 0.5, 132)), 30, rgb(0.9, 0.86, 0.8), r.w);
      }
    }
    g.resetTransform();
  }

  private drawBowlStack(g: Gfx): void {
    g.setTransform(v(this.x0 + BOWLS_X, this.binsY + 2.0), 0, BOWLS_SCALE);
    for (let k = 0; k < 5; k++) {
      const p = v(0, -k * 16.0);
      FoodArt.ellipse(g, p.add(v(0, 14)), 78.0, 26.0, FoodArt.BOWL.darkened(0.18));
      FoodArt.ellipse(g, p, 78.0, 22.0, FoodArt.BOWL);
      g.line(p.add(v(-60, 12)), p.add(v(60, 12)), FoodArt.BOWL_STRIPE, 3.0);
    }
    FoodArt.text(g, "그릇", v(0, 62), 28, rgb(0.92, 0.86, 0.78));
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
    FoodArt.text(g, "쓰레기통", v(0, 80), 26, rgb(0.92, 0.86, 0.78));
    g.resetTransform();
  }
}
