// 조리 칸 하나(화구 1개 / 어묵 사각틀 4칸 / 튀김기 2칸 / 떡볶이 판 / 순대 솥 …): 음식, 익음 게이지, 안내 문구를 그린다.
// 한 도구를 양쪽에 나눠 둘 때는 firstIndex 부터 slotCount 칸을 맡는다 (야시장 튀김기 3칸 + 2칸).
// gridCols > 0 이면 칸을 여러 줄로 나눈다 (어묵 사각틀 2×2).

import { Color, PI, R, TAU, V, WHITE, clamp, fmod, lerp, rgb, v } from "../engine/geom.ts";
import type { Gfx } from "../engine/gfx.ts";
import { Node2D } from "../engine/node.ts";
import * as D from "../core/defs.ts";
import type { CookItem } from "../core/cook_item.ts";
import type { ShiftSession } from "../core/shift_session.ts";
import * as Ink from "../art/ink.ts";
import * as FoodArt from "../art/food_art.ts";
import * as FoodShapes from "../art/food_shapes.ts";
import { Steam } from "./steam.ts";

const GREEN = rgb(0.45, 0.95, 0.5);
const RED = rgb(1.0, 0.4, 0.32);
const YELLOW = rgb(1.0, 0.88, 0.4);
const ORANGE = rgb(1.0, 0.7, 0.35);
const IRON = rgb(0.17, 0.17, 0.19);
const STEEL = rgb(0.7, 0.72, 0.76);
const BROTH = rgb(0.66, 0.45, 0.2);
const FRAME_TOP = 34.0; // 사각틀·판·솥 위쪽 이름 자리

/** [문구, 색, 깜빡임]. compact = 사각틀·튀김기처럼 좁은 칸용 짧은 문구 */
export function hintFor(item: CookItem, compact = false): [string, Color, boolean] {
  const action = item.nextTapAction();
  const q = item.stepQuality();
  const label = item.step().label;
  const qname = D.QUALITY_NAMES[q];
  const verb = item.tapLabel();
  if (item.burnt) return ["탔어요!", RED, true];
  if (action === "wait") return [label + "…", rgb(0.7, 0.85, 1.0), false];
  if (action === "take_out") {
    if (q === D.Q.PERFECT) {
      if (item.magic) return [compact ? "✨반짝" : `✨ 반짝반짝! ${verb}`, GREEN, false];
      if (item.holds()) return [`다 쪘어요! ${verb}`, GREEN, false];
      return [compact ? verb + "!" : `지금 ${verb}!`, GREEN, true];
    }
    if (item.isOvercooked()) {
      const over = item.overLabel();
      return [compact ? over : `${over} (완벽 아님)`, ORANGE, item.burns()];
    }
    if ((item.stepCount() > 1 || item.isBatch()) && !compact) return [`${label} · ${qname}`, WHITE, false];
    return [qname, WHITE, false];
  }
  // 다음 단계로 넘기는 탭 (뒤집기, 면 넣기, 말기…)
  if (item.isWaitStep()) return [`탭: ${verb}!`, YELLOW, true];
  if (q === D.Q.PERFECT) return [compact ? verb + "!" : `지금 ${verb}!`, GREEN, true];
  if (item.isOvercooked()) return [compact ? verb + "!" : `지금 ${verb}! (${item.overLabel()})`, ORANGE, false];
  return [compact ? qname : `${label} · ${qname}`, WHITE, false];
}

/** 조리 중인 음식 그리기 (드래그 고스트에서도 사용) */
export function drawCookItem(g: Gfx, item: CookItem, c: V, s: number, noPan = false): void {
  const col = FoodArt.itemColor(item);
  switch (item.menuId) {
    case "tteokbokki":
      FoodArt.drawFood(g, item.menuId, c, 0.95 * s, col, { pan: true });
      break;
    case "sundae":
      FoodArt.drawFood(g, item.menuId, c, 0.9 * s, col);
      break;
    case "ramen": {
      const waiting = item.isWaitStep();
      FoodArt.drawFood(g, item.menuId, c.add(v(0, 10).mul(s)), 0.95 * s, col, {
        pot: true,
        noodles: !waiting,
        boiling: !waiting || item.nextTapAction() === "add_noodles",
      });
      break;
    }
    case "odeng":
      FoodArt.drawFood(g, item.menuId, c, s, col);
      break;
    default:
      // 그림 속 화구에 프라이팬이 / 그림 속에 냄비가 그려져 있으면 음식의 팬·냄비 물은 빼고 (noPan → bare)
      FoodArt.drawFood(g, item.menuId, c, FoodShapes.cookScale(item.menuId) * s, col, noPan ? { ...FoodShapes.cookOpts(item), pan: false, bare: true } : FoodShapes.cookOpts(item));
  }
}

/** 화구 4칸(2×2)을 한 덩어리 화로로 묶는 바탕 (화면 좌표 rect, 화구 칸들보다 먼저 그림) */
export class StoveFrame extends Node2D {
  rect = new R(0, 0, 0, 0);
  draw(g: Gfx): void {
    const r = this.rect.grow(6.0);
    FoodArt.roundedRect(g, r.moved(v(0, 5)), rgb(0, 0, 0, 0.3), 20.0);
    FoodArt.roundedRect(g, r, rgb(0.14, 0.14, 0.16), 20.0, rgb(0.5, 0.51, 0.55), 4);
    g.line(v(r.x + 18.0, r.y + 4.0), v(r.endX - 18.0, r.y + 4.0), rgb(1, 1, 1, 0.22), 3.0);
  }
}

export class StationView extends Node2D {
  session!: ShiftSession;
  station = D.STATION_BURNER;
  firstIndex = 0;
  slotCount = 1;
  gridCols = 0;
  size = v(330, 250);
  title = "";
  lockedNote = ""; // 비어 있지 않으면 잠긴 칸으로 표시
  hiddenSlot = -1; // 드래그 중이라 숨길 칸
  /**
   * 가게 그림 속 도구 (shop_art.ts, 이 노드 기준 좌표): 있으면 도구 틀을 안 그리고 그 자리에 음식·게이지·안내만.
   * cells = 어묵 사각틀 칸 / 튀김기 바구니 / 석쇠 칸 / 냄비 자리, pan = 떡볶이 철판 · 화구의 팬(음식 자리), pot = 순대 솥 [가운데, 반지름],
   * hasPan = 그림 속 화구에 프라이팬이 있음 (음식의 팬을 안 그림), hasPot = 그림 속에 냄비가 있음 (게임 냄비·물은 안 그리고 면만)
   */
  art: { cells: R[] | null; pan: R | null; pot: [V, V] | null; hasPan: boolean; hasPot?: boolean } | null = null;

  private pops: number[] = [];
  private steam: Steam[] = [];
  private t = 0.0;

  setup(session: ShiftSession, station: string, first: number, count: number, size: V, title: string, grid = 0): void {
    this.session = session;
    this.station = station;
    this.firstIndex = first;
    this.slotCount = count;
    this.size = size;
    this.title = title;
    this.gridCols = grid > 0 && grid < count ? grid : 0;
    this.pops = new Array(count).fill(0.0);
  }

  enterTree(): void {
    for (let k = 0; k < this.slotCount; k++) {
      const p = new Steam();
      p.amount = this.isBig() ? 18 : 10;
      p.extents = v(this.isBig() || this.gridCols > 0 ? this.slotRect(k).w * 0.3 : 30.0, 6.0);
      p.position = this.slotCenter(k).add(v(0, this.gridCols === 0 ? -36 : -10));
      this.add(p);
      this.steam.push(p);
    }
  }

  /** 김 나는 자리를 칸 자리에 다시 맞춤 (그림 속 도구 자리를 정한 뒤) */
  refreshSteam(): void {
    for (let k = 0; k < this.steam.length; k++) {
      const p = this.steam[k];
      p.extents = v(this.isBig() || this.gridCols > 0 || this.art?.cells ? this.slotRect(k).w * 0.3 : 30.0, 6.0);
      p.position = this.slotCenter(k).add(v(0, this.gridCols === 0 ? -36 : -10));
    }
  }

  isLocked(): boolean {
    return this.lockedNote !== "";
  }

  /** 떡볶이 판·순대 솥처럼 한 칸짜리 큰 도구 */
  private isBig(): boolean {
    return D.stationIsBatch(this.station);
  }

  slotWidth(): number {
    const cells = this.art?.cells;
    if (cells && this.gridCols === 0) return cells.reduce((n, c) => n + c.w, 0) / cells.length;
    return this.size.x / this.slotCount;
  }

  private rows(): number {
    return this.gridCols > 0 ? Math.ceil(this.slotCount / this.gridCols) : 1;
  }

  /** 사각틀 안쪽 (칸들이 들어가는 자리) */
  private frameRect(): R {
    return new R(-this.size.x * 0.5 + 14.0, -this.size.y * 0.5 + FRAME_TOP, this.size.x - 28.0, this.size.y - FRAME_TOP - 10.0);
  }

  private cellRect(k: number): R {
    const art = this.art?.cells;
    if (art && art[k]) return art[k];
    const inner = this.frameRect().grow(-9.0);
    const gap = 9.0;
    const rows = this.rows();
    const w = (inner.w - gap * (this.gridCols - 1)) / this.gridCols;
    const h = (inner.h - gap * (rows - 1)) / rows;
    const col = k % this.gridCols;
    const row = Math.trunc(k / this.gridCols);
    return new R(inner.x + col * (w + gap), inner.y + row * (h + gap), w, h);
  }

  /** 2×2 화로의 납작한 화구 한 칸 (위 2 · 아래 2) */
  private isFlat(): boolean {
    return this.size.y < 200.0;
  }

  slotCenter(k: number): V {
    if (this.gridCols > 0) return this.cellRect(k).center();
    if (this.slotCount === 1) {
      const ap = this.artBurnerPan();
      if (ap !== null) return ap.center();
      return v(0, this.isFlat() ? 2 : -6);
    }
    const cells = this.art?.cells;
    if (cells && cells[k]) return cells[k].center();
    return v(-this.size.x * 0.5 + this.slotWidth() * (k + 0.5), 4);
  }

  /** 그림 속 화구: 팬(음식) 자리 */
  private artBurnerPan(): R | null {
    return this.station === D.STATION_BURNER && this.art?.pan ? this.art.pan : null;
  }

  slotRect(k: number): R {
    if (this.gridCols > 0) return this.cellRect(k).grow(4.0);
    const cells = this.art?.cells;
    if (cells && cells[k]) return new R(cells[k].x - 6.0, -this.size.y * 0.5, cells[k].w + 12.0, this.size.y);
    const w = this.slotWidth();
    return new R(-this.size.x * 0.5 + w * k, -this.size.y * 0.5, w, this.size.y);
  }

  hitSlot(globalPos: V): number {
    const local = this.toLocal(globalPos);
    for (let k = 0; k < this.slotCount; k++) if (this.slotRect(k).hasPoint(local)) return k;
    return -1;
  }

  itemAt(k: number): CookItem | null {
    return this.session.stationItem(this.station, this.firstIndex + k);
  }

  pop(k: number): void {
    if (k >= 0 && k < this.pops.length) this.pops[k] = 1.0;
  }

  process(dt: number): void {
    this.t += dt;
    for (let k = 0; k < this.slotCount; k++) {
      this.pops[k] = Math.max(0.0, this.pops[k] - dt * 4.0);
      const item = this.itemAt(k);
      const on = item !== null && k !== this.hiddenSlot && !this.isLocked() && (item.stepElapsed > 0.4 || item.stepIndex > 0);
      this.steam[k].emitting = on;
      if (item !== null) this.steam[k].color = item.burnt ? rgb(0.35, 0.33, 0.32) : WHITE;
    }
  }

  private sparkT = 0.0;

  draw(g: Gfx): void {
    this.sparkT = performance.now() / 1000;
    const sz = this.size;
    const r = new R(-sz.x * 0.5, -sz.y * 0.5, sz.x, sz.y);
    if (this.art !== null) this.drawArtBase(g);
    else this.drawBase(g, r);
    let anyItem = false;
    for (let k = 0; k < this.slotCount; k++) {
      const item = this.itemAt(k);
      if (item === null || k === this.hiddenSlot || this.isLocked()) continue;
      anyItem = true;
      const popS = 1.0 + 0.14 * this.pops[k];
      if (this.gridCols > 0) {
        this.drawCellItem(g, k, item, popS);
        continue;
      }
      const c = this.slotCenter(k);
      if (this.isBig()) this.drawBigItem(g, item, popS);
      else drawCookItem(g, item, c, popS * this.itemScale(), (this.art?.hasPan ?? false) || (this.art?.hasPot ?? false));
      if (item.magic) FoodArt.magicSparkles(g, this.isBig() ? v(0, -6) : c, this.isBig() ? sz.x * 0.36 : 62.0 * this.itemScale(), this.sparkT, this.isBig() ? 8 : 5);
      const w = this.slotWidth();
      const ap = this.artBurnerPan();
      if (ap !== null) {
        // 그림 속 화구: 게이지는 팬 아래, 안내는 팬 위
        const gw = Math.max(110.0, ap.w * 0.8);
        this.drawGauge(g, item, new R(c.x - gw * 0.5, ap.endY - 4.0, gw, 13.0));
        this.drawHint(g, item, v(c.x, ap.y + 2.0), Math.max(ap.w, w * 0.8), 22);
        continue;
      }
      const gw = this.isFlat() ? w * 0.6 : w * 0.84;
      this.drawGauge(g, item, new R(c.x - gw * 0.5, sz.y * 0.5 - (this.isFlat() ? 24.0 : 30.0), gw, 16.0));
      // 한 칸짜리는 이름 자리에 안내 문구를, 여러 칸짜리는 이름 아래에 칸별 문구를 쓴다
      const hintY = -sz.y * 0.5 + (this.slotCount === 1 ? 28.0 : 54.0);
      this.drawHint(g, item, v(c.x, hintY), w);
    }
    if (this.art !== null) {
      // 그림 속 도구는 보면 알아서 이름을 안 씀
    } else if (this.isFlat()) {
      // 납작한 화구 칸: 이름은 왼쪽 위 구석 (가운데는 불판)
      if (!anyItem) FoodArt.text(g, this.title, v(-sz.x * 0.5 + 52.0, -sz.y * 0.5 + 20.0), 20, rgb(1, 1, 1, 0.55), 90.0);
    } else if (this.slotCount > 1 || !anyItem) FoodArt.text(g, this.title, v(0, -sz.y * 0.5 + (this.gridCols > 0 ? 18.0 : 22.0)), 22, rgb(1, 1, 1, 0.55), sz.x);
    if (this.isBig() && !anyItem && !this.isLocked()) {
      const what = this.station === "pan" ? "떡볶이 재료를 탭하면\n한 판 끓여요" : "순대 재료를 탭하면\n솥에 쪄요";
      FoodArt.textOutlined(g, what, v(0, 8), 24, rgb(1, 1, 1, 0.75), rgb(0, 0, 0, 0.55), 6, sz.x);
    }
    if (this.isLocked()) {
      if (this.isFlat()) {
        // 납작한 화구 칸: 자물쇠 왼쪽 · 글 오른쪽
        FoodArt.roundedRect(g, r.grow(-3.0), rgb(0, 0, 0, 0.62), 14.0);
        if (sz.x < 230.0 && sz.y > 110.0) {
          // 좁고 높은 칸 (가게 그림 속 작은 화구): 자물쇠 위 · 글 아래
          FoodArt.lockIcon(g, v(0, -sz.y * 0.2), 0.9, rgb(0.85, 0.82, 0.78));
          FoodArt.text(g, this.lockedNote, v(0, sz.y * 0.22), 20, rgb(0.9, 0.87, 0.82), sz.x - 12.0);
          return;
        }
        FoodArt.lockIcon(g, v(-sz.x * 0.27, -4), 1.1, rgb(0.85, 0.82, 0.78));
        FoodArt.text(g, this.lockedNote, v(sz.x * 0.12, 0), 24, rgb(0.9, 0.87, 0.82), sz.x * 0.6);
        return;
      }
      FoodArt.roundedRect(g, r.grow(-8.0), rgb(0, 0, 0, 0.62), 22.0);
      FoodArt.lockIcon(g, v(0, -24), 1.3, rgb(0.85, 0.82, 0.78));
      FoodArt.text(g, this.lockedNote, v(0, 52), 26, rgb(0.9, 0.87, 0.82), sz.x - 20.0);
    }
  }

  /**
   * 조리 중인 음식 크기 = 칸 크기에 맞춰 (2026-11-16 사용자 "음식 크기도 너무 작아, 커야 해").
   * 한 칸짜리 화구는 칸 높이를 꽉 채우고, 여러 칸 도구(튀김기·석쇠·냄비)는 한 칸 너비에 맞춰 (칸이 넓어지면 같이 커짐).
   */
  private itemScale(): number {
    if (this.station === "broth") return 0.86;
    const ap = this.artBurnerPan();
    if (ap !== null) return clamp(ap.w / 170.0, 0.55, 1.15);
    if (this.slotCount === 1) return Math.min(1.15, this.size.y / 130.0);
    return clamp(0.4 + this.slotWidth() * 0.0031, 0.6, 1.1);
  }

  private drawBase(g: Gfx, r: R): void {
    switch (this.station) {
      case "fryer":
        return this.drawFryer(g, r);
      case "grill":
        return this.drawGrill(g, r);
      case "pot":
        return this.drawPots(g, r);
      case "broth":
        return this.drawOdengFrame(g, r);
      case "pan":
        return this.drawPan(g, r);
      case "steamer":
        return this.drawSteamer(g, r);
    }
    if (this.station === D.STATION_BURNER) {
      const flat = this.isFlat();
      FoodArt.roundedRect(g, r.grow(flat ? -3.0 : -8.0), rgb(0.2, 0.2, 0.23), flat ? 14.0 : 22.0, rgb(0.33, 0.33, 0.37), 3);
      const c = this.slotCenter(0);
      // 불판 고리 크기는 칸에 맞춰 (예전 한 줄 화구 = 반지름 84)
      const k84 = (Math.min(this.size.x, this.size.y) * 0.5 - (flat ? 8.0 : 36.0)) / 84.0;
      const cooking = this.itemAt(0) !== null && !this.isLocked();
      if (cooking) g.circle(c, 96.0 * k84, rgb(1.0, 0.45, 0.12, 0.16 + 0.05 * Math.sin(this.t * 12.0)));
      g.circle(c, 84.0 * k84, rgb(0.1, 0.1, 0.11));
      g.arc(c, 62.0 * k84, 0.0, TAU, rgb(0.36, 0.36, 0.4), 5.0);
      g.arc(c, 40.0 * k84, 0.0, TAU, rgb(0.3, 0.3, 0.33), 4.0);
      if (cooking) {
        const heat = 1.0 / Math.max(this.session.heatScale, 0.5);
        for (let k = 0; k < 12; k++) {
          const a = (TAU * k) / 12.0 + this.t * 0.6;
          const dir = v(Math.cos(a), Math.sin(a));
          const base = c.add(dir.mul(74.0 * k84));
          const tip = c.add(dir.mul((84.0 + (6.0 + 4.0 * Math.sin(this.t * 20.0 + k)) * heat) * k84));
          const side = v(-Math.sin(a), Math.cos(a)).mul(6.0 * k84);
          g.polygon([base.add(side), tip, base.sub(side)], rgb(0.35, 0.6, 1.0, 0.85));
        }
      }
    }
  }

  /** 그림 속 도구: 틀은 그림이 그렸으니 끓는 기름 방울·국물 거품만 (조리 중일 때) */
  private drawArtBase(g: Gfx): void {
    const cells = this.art?.cells ?? [];
    // 냄비 자리: 그림에 화로만 있으면 냄비는 게임이 그림 (실내 포차 찌개 냄비). 그림에 냄비가 있으면(분식집) 그대로
    if (this.station === "pot" && !this.art?.hasPot) {
      for (let k = 0; k < cells.length; k++) this.drawArtPot(g, cells[k], this.itemAt(k) !== null && !this.isLocked());
    }
    if (!this.anyCooking()) return;
    const ap = this.artBurnerPan();
    if (ap !== null) {
      // 팬 밑 불꽃 + 달아오른 빛
      const pc = ap.center();
      FoodArt.ellipse(g, pc.add(v(0, ap.h * 0.38)), ap.w * 0.56, ap.h * 0.42, rgb(1.0, 0.45, 0.12, 0.2 + 0.06 * Math.sin(this.t * 11.0)));
      for (let k = 0; k < 7; k++) {
        const x = pc.x + (k / 6 - 0.5) * ap.w * 0.78;
        const y = ap.endY + 3.0 - Math.abs(k / 6 - 0.5) * ap.h * 0.3;
        const fl = 10.0 + 4.0 * Math.sin(this.t * 20.0 + k * 1.7);
        g.polygon([v(x - 5.0, y), v(x, y - fl), v(x + 5.0, y)], rgb(0.35, 0.6, 1.0, 0.85));
      }
      return;
    }
    if (this.station === "grill") {
      for (let k = 0; k < cells.length; k++) {
        if (this.itemAt(k) === null) continue;
        const cell = cells[k];
        FoodArt.ellipse(g, cell.center().add(v(0, cell.h * 0.15)), cell.w * 0.46, cell.h * 0.42, rgb(1.0, 0.4, 0.1, 0.16 + 0.06 * Math.sin(this.t * 9.0 + k)));
      }
      return;
    }
    if (this.station === "fryer") {
      for (let k = 0; k < cells.length; k++) {
        if (this.itemAt(k) === null) continue;
        const oil = cells[k];
        for (let j = 0; j < 8; j++) {
          const bx = oil.x + fmod(j * 37.0 + this.t * 23.0, oil.w);
          const by = oil.y + 8.0 + fmod(j * 19.0 + this.t * 31.0, oil.h - 16.0);
          g.circle(v(bx, by), 2.5 + 1.5 * Math.abs(Math.sin(this.t * 9.0 + j)), rgb(1.0, 0.92, 0.6, 0.7));
        }
      }
    } else if (this.station === "broth") {
      for (let k = 0; k < cells.length; k++) {
        if (this.itemAt(k) === null) continue;
        const cell = cells[k];
        for (let b = 0; b < 3; b++) {
          const bx = cell.x + cell.w * (0.2 + 0.3 * b) + Math.sin(this.t * 1.7 + b * 2.0 + k) * 8.0;
          const by = cell.y + cell.h * 0.45 + Math.sin(this.t * 2.3 + b + k * 1.3) * 5.0;
          g.circle(v(bx, by), 3.0, rgb(1.0, 0.92, 0.7, 0.55));
        }
      }
    }
  }

  /** 그림 속 화로 위 양은 냄비 (칸 가운데 = 냄비 입구) */
  private drawArtPot(g: Gfx, cell: R, cooking: boolean): void {
    const c = cell.center().add(v(0, -2));
    const rx = cell.w * 0.42;
    const ry = 18.0;
    const bodyH = 46.0;
    const gold = rgb(0.86, 0.7, 0.36);
    if (cooking) FoodArt.ellipse(g, c.add(v(0, bodyH + 8.0)), rx * 1.02, 20.0, rgb(1.0, 0.45, 0.12, 0.25 + 0.06 * Math.sin(this.t * 12.0)));
    for (const sx of [-1.0, 1.0]) Ink.rrect(g, new R(sx < 0 ? c.x - rx - 20.0 : c.x + rx - 2.0, c.y + 6.0, 22.0, 11.0), rgb(0.32, 0.26, 0.22), 4.0, 2.5);
    const side = Ink.ellipsePoints(c.add(v(0, bodyH)), rx * 0.95, ry * 0.9, 16, 0.0, PI).concat(Ink.ellipsePoints(c, rx, ry, 16, PI, TAU));
    Ink.poly(g, side, gold.darkened(0.08), 3.5);
    g.line(v(c.x - rx * 0.96, c.y + bodyH * 0.45), v(c.x + rx * 0.96, c.y + bodyH * 0.45), gold.darkened(0.2), 3.0);
    Ink.ellipse(g, c, rx, ry, gold.lightened(0.12), 3.5);
    FoodArt.ellipse(g, c.add(v(0, 2)), rx * 0.86, ry * 0.7, rgb(0.3, 0.3, 0.33));
  }

  private anyCooking(): boolean {
    if (this.isLocked()) return false;
    for (let k = 0; k < this.slotCount; k++) if (this.itemAt(k) !== null) return true;
    return false;
  }

  // ---------------------------------------------------------------- 어묵 사각틀 (2×2)

  /** 스테인리스 사각틀을 칸막이로 4칸으로 나누고, 칸마다 어묵 국물 */
  private drawOdengFrame(g: Gfx, r: R): void {
    FoodArt.roundedRect(g, r.grow(-8.0), rgb(0.2, 0.2, 0.23), 22.0, rgb(0.33, 0.33, 0.37), 3);
    const frame = this.frameRect();
    if (this.anyCooking()) FoodArt.roundedRect(g, frame.grow(6.0), rgb(1.0, 0.5, 0.15, 0.14 + 0.04 * Math.sin(this.t * 9.0)), 16.0);
    Ink.rrect(g, frame, STEEL, 12.0, 4.0);
    g.line(frame.pos.add(v(10, 5)), v(frame.endX - 10.0, frame.y + 5.0), rgb(1, 1, 1, 0.55), 3.0);
    for (let k = 0; k < this.slotCount; k++) {
      const cell = this.cellRect(k);
      const cooking = this.itemAt(k) !== null && !this.isLocked();
      Ink.rrect(g, cell, BROTH.darkened(0.25), 6.0, 2.5);
      FoodArt.roundedRect(g, new R(cell.x + 3, cell.y + 3, cell.w - 6.0, cell.h * 0.45), BROTH.lightened(0.12), 5.0);
      // 국물 위 기름 반짝임·거품
      for (let b = 0; b < 3; b++) {
        const bx = cell.x + cell.w * (0.2 + 0.3 * b) + Math.sin(this.t * 1.7 + b * 2.0 + k) * 8.0;
        const by = cell.y + cell.h * 0.3 + Math.sin(this.t * 2.3 + b + k * 1.3) * 5.0;
        g.circle(v(bx, by), cooking ? 3.0 : 2.0, rgb(1.0, 0.92, 0.7, cooking ? 0.55 : 0.3));
      }
    }
    // 칸막이 윗면 하이라이트
    const inner = frame.grow(-9.0);
    for (let c = 1; c < this.gridCols; c++) {
      const x = this.cellRect(c).x - 4.5;
      g.line(v(x, inner.y), v(x, inner.endY), rgb(0.86, 0.88, 0.92), 3.0);
    }
    for (let row = 1; row < this.rows(); row++) {
      const y = this.cellRect(row * this.gridCols).y - 4.5;
      g.line(v(inner.x, y), v(inner.endX, y), rgb(0.86, 0.88, 0.92), 3.0);
    }
  }

  /** 사각틀 한 칸: 국물에 담근 어묵 꼬치 2개 + 게이지 + 칸별 안내 */
  private drawCellItem(g: Gfx, k: number, item: CookItem, popS: number): void {
    const cell = this.cellRect(k);
    const col = FoodArt.itemColor(item);
    const s = Math.min(cell.w / 260.0, cell.h / 92.0) * popS;
    const c = cell.center().add(v(cell.w * 0.12, 4.0));
    FoodArt.odengSkewer(g, c.add(v(-34, -6).mul(s)), -0.3, s, col);
    FoodArt.odengSkewer(g, c.add(v(26, 6).mul(s)), -0.3, s, col.darkened(0.04));
    this.drawGauge(g, item, new R(cell.x + 10.0, cell.endY - 12.0, cell.w - 20.0, 8.0));
    this.drawHint(g, item, v(cell.x + cell.w * 0.27, cell.y + 16.0), cell.w * 0.54, 20);
  }

  // ---------------------------------------------------------------- 떡볶이 판

  private panRect(): R {
    if (this.art?.pan) return this.art.pan;
    return new R(-this.size.x * 0.5 + 34.0, -this.size.y * 0.5 + 50.0, this.size.x - 68.0, this.size.y - 104.0);
  }

  /** 커다란 사각 철판 (양쪽 손잡이). 불이 켜져 있으면 아래가 붉게 달아오름 */
  private drawPan(g: Gfx, r: R): void {
    FoodArt.roundedRect(g, r.grow(-8.0), rgb(0.2, 0.2, 0.23), 22.0, rgb(0.33, 0.33, 0.37), 3);
    const pan = this.panRect();
    if (this.anyCooking()) FoodArt.roundedRect(g, pan.grow(10.0), rgb(1.0, 0.42, 0.12, 0.2 + 0.06 * Math.sin(this.t * 11.0)), 24.0);
    for (const sx of [-1.0, 1.0]) {
      const hx = sx < 0.0 ? pan.x - 26.0 : pan.endX - 4.0;
      Ink.rrect(g, new R(hx, -14.0 + pan.center().y, 30.0, 28.0), IRON, 8.0, 3.0);
    }
    Ink.rrect(g, pan, IRON, 20.0, 4.0);
    FoodArt.roundedRect(g, pan.grow(-12.0), rgb(0.27, 0.27, 0.3), 12.0);
    g.line(pan.pos.add(v(18, 6)), v(pan.endX - 18.0, pan.y + 6.0), rgb(1, 1, 1, 0.18), 3.0);
  }

  /** 판 가득 떡볶이 (남은 그릇 수만큼 떡이 줄어듦) / 솥 가득 순대·내장 */
  private drawBigItem(g: Gfx, item: CookItem, popS: number): void {
    if (this.station === "pan") this.drawPanFood(g, item, popS);
    else this.drawSteamerFood(g, item, popS);
    // 남은 그릇 수
    const badge = v(this.size.x * 0.5 - 70.0, -this.size.y * 0.5 + 64.0);
    FoodArt.roundedRect(g, R.of(badge.sub(v(46, 17)), v(92, 34)), rgb(0, 0, 0, 0.62), 17.0);
    FoodArt.text(g, `${item.portions}그릇`, badge, 22, WHITE, 90.0);
  }

  private drawPanFood(g: Gfx, item: CookItem, popS: number): void {
    const inner = this.panRect().grow(-16.0);
    const sauce = FoodArt.itemColor(item);
    FoodArt.roundedRect(g, inner, sauce.darkened(0.12), 10.0);
    FoodArt.roundedRect(g, new R(inner.x + 6, inner.y + 4, inner.w - 12.0, inner.h * 0.4), sauce.lightened(0.08), 8.0);
    const cake = item.burnt ? D.BURNT_COLOR.lightened(0.15) : rgb(0.99, 0.95, 0.9).lerp(sauce, 0.38);
    const fishcake = item.burnt ? D.BURNT_COLOR.lightened(0.1) : rgb(0.98, 0.72, 0.38).lerp(sauce, 0.25);
    const w = FoodArt.inkW(0.8);
    const frac = item.portions / Math.max(1, item.portionsMax);
    const cols = clamp(Math.trunc(inner.w / 44.0), 6, 11);
    const rows = 3;
    const shown = Math.ceil(cols * rows * frac);
    let n = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (n >= shown) break;
        const x = inner.x + inner.w * (0.06 + (0.88 * (col + 0.5 * (row % 2))) / cols);
        const y = inner.y + inner.h * (0.22 + 0.3 * row) + Math.sin(col * 2.1 + row) * 4.0;
        const a = 0.5 * Math.sin(col * 1.7 + row * 2.3);
        const pts = capsulePts(v(x, y), v(44, 16).mul(popS), a);
        g.polygon(pts, cake);
        g.line(v(x, y).add(v(-12, -3).rotated(a)), v(x, y).add(v(12, -3).rotated(a)), rgb(1, 1, 1, 0.5), 2.5);
        Ink.outline(g, pts, w);
        n += 1;
      }
    }
    // 어묵 세모·파
    const triN = Math.ceil(6.0 * frac);
    for (let k = 0; k < triN; k++) {
      const tc = v(inner.x + inner.w * (0.12 + 0.15 * k), inner.y + inner.h * (0.35 + 0.3 * (k % 2)));
      const a = k * 1.3;
      Ink.poly(g, [tc.add(v(-16, 10).rotated(a)), tc.add(v(16, 10).rotated(a)), tc.add(v(0, -16).rotated(a))], fishcake, w * 0.8);
    }
    for (let k = 0; k < Math.ceil(8.0 * frac); k++) {
      const gp = v(inner.x + inner.w * (0.08 + 0.115 * k), inner.y + inner.h * (0.15 + (0.7 * ((k * 3) % 4)) / 3.0));
      Ink.circle(g, gp, 5.0, rgb(0.45, 0.75, 0.32), w * 0.5);
    }
    if (!item.burnt && item.stepElapsed > 1.0) {
      for (let k = 0; k < 7; k++) {
        const bx = inner.x + fmod(k * 83.0 + this.t * 19.0, inner.w);
        const by = inner.y + 10.0 + fmod(k * 41.0 + this.t * 13.0, inner.h - 20.0);
        g.arc(v(bx, by), 3.0 + 2.0 * Math.abs(Math.sin(this.t * 6.0 + k)), 0.0, TAU, rgb(1, 0.85, 0.75, 0.6), 2.0);
      }
    }
  }

  // ---------------------------------------------------------------- 순대 솥

  private potCenter(): V {
    if (this.art?.pot) return this.art.pot[0];
    return v(0, -2);
  }

  private potRadii(): V {
    if (this.art?.pot) return this.art.pot[1];
    return v(Math.min(this.size.x * 0.42, 170.0), 54.0);
  }

  /** 커다란 무쇠 솥: 옆면 + 테두리 + 김이 오르는 물 + 면포 깐 찜판 */
  private drawSteamer(g: Gfx, r: R): void {
    FoodArt.roundedRect(g, r.grow(-8.0), rgb(0.2, 0.2, 0.23), 22.0, rgb(0.33, 0.33, 0.37), 3);
    const c = this.potCenter();
    const rr = this.potRadii();
    if (this.anyCooking()) FoodArt.ellipse(g, c.add(v(0, 50)), rr.x + 14.0, 40.0, rgb(1.0, 0.42, 0.12, 0.2 + 0.06 * Math.sin(this.t * 11.0)));
    Ink.poly(g, potSide(c, rr, 62.0), IRON, 4.0);
    Ink.ellipse(g, c, rr.x, rr.y, rgb(0.3, 0.3, 0.33), 4.0);
    FoodArt.ellipse(g, c.add(v(0, 4)), rr.x - 14.0, rr.y - 10.0, rgb(0.62, 0.66, 0.68));
    FoodArt.ellipse(g, c.add(v(0, 6)), rr.x - 26.0, rr.y - 18.0, rgb(0.93, 0.89, 0.8));
    for (let k = 0; k < 5; k++) {
      const x = c.x - rr.x + 40.0 + (k * (rr.x * 2.0 - 80.0)) / 4.0;
      g.line(v(x, c.y - rr.y + 22.0), v(x + 6.0, c.y + rr.y - 14.0), rgb(0.82, 0.78, 0.68), 1.5);
    }
  }

  private drawSteamerFood(g: Gfx, item: CookItem, popS: number): void {
    const c = this.potCenter().add(v(0, 4));
    const rr = this.potRadii();
    const col = FoodArt.itemColor(item);
    const n = clamp(item.portions, 0, 6);
    // 순대: 면포 위에 나란히 누운 긴 순대 줄 (남은 그릇 수만큼, 위에서부터 덜어 냄)
    const x0 = c.x - rr.x * 0.62;
    const x1 = c.x + rr.x * 0.3;
    for (let k = 0; k < n; k++) {
      const y = c.y - 22.0 + k * (44.0 / Math.max(1, item.portionsMax - 1)) + (k % 2 === 0 ? 0.0 : 3.0);
      let pts: V[] = [];
      for (let j = 0; j < 11; j++) {
        const f = j / 10.0;
        pts.push(v(lerp(x0 + 8.0 * (k % 2), x1 - 6.0 * (k % 3), f), y + Math.sin(f * PI * 2.0 + k) * 4.0));
      }
      pts = pts.map((p) => c.add(p.sub(c).mul(popS)));
      g.polyline(pts, Ink.LINE, 19.0);
      g.polyline(pts, col, 14.0);
      const hi: V[] = [];
      for (let j = 1; j < pts.length - 1; j++) hi.push(pts[j].add(v(0, -3.5)));
      g.polyline(hi, col.lightened(0.38), 2.5);
      // 순대 묶은 끝 (실 매듭)
      g.circle(pts[0], 6.0, Ink.LINE);
      g.circle(pts[0], 4.0, col.lightened(0.15));
    }
    if (n > 0) {
      // 내장: 간(진한 갈색) · 허파(분홍)
      FoodArt.lung(g, c.add(v(rr.x * 0.7, 4)), 0.75 * popS, item.burnt);
      FoodArt.liver(g, c.add(v(rr.x * 0.48, -10)), 0.75 * popS, 0.3, item.burnt);
      FoodArt.liver(g, c.add(v(rr.x * 0.46, 18)), 0.65 * popS, -0.4, item.burnt);
    }
  }

  // ---------------------------------------------------------------- 튀김기 · 석쇠 · 냄비

  /** 튀김기: 기름이 담긴 통 하나를 칸막이로 나눔 */
  private drawFryer(g: Gfx, r: R): void {
    FoodArt.roundedRect(g, r.grow(-8.0), rgb(0.2, 0.2, 0.23), 22.0, rgb(0.33, 0.33, 0.37), 3);
    const vat = new R(r.x + 16.0, r.y + 58.0, r.w - 32.0, r.h - 100.0);
    FoodArt.roundedRect(g, vat, rgb(0.62, 0.64, 0.68), 18.0);
    const oil = vat.grow(-10.0);
    FoodArt.roundedRect(g, oil, rgb(0.86, 0.6, 0.18), 12.0);
    FoodArt.roundedRect(g, new R(oil.x, oil.y, oil.w, oil.h * 0.35), rgb(0.95, 0.75, 0.32, 0.6), 12.0);
    for (let k = 1; k < this.slotCount; k++) {
      const x = r.x + this.slotWidth() * k;
      g.line(v(x, vat.y), v(x, vat.endY), rgb(0.45, 0.46, 0.5), 5.0);
    }
    if (this.anyCooking()) {
      for (let k = 0; k < 10; k++) {
        const bx = oil.x + fmod(k * 37.0 + this.t * 23.0, oil.w);
        const by = oil.y + 10.0 + fmod(k * 19.0 + this.t * 31.0, oil.h - 20.0);
        g.circle(v(bx, by), 2.5 + 1.5 * Math.abs(Math.sin(this.t * 9.0 + k)), rgb(1.0, 0.92, 0.6, 0.7));
      }
    }
  }

  /** 석쇠: 숯불 위 철망 */
  private drawGrill(g: Gfx, r: R): void {
    FoodArt.roundedRect(g, r.grow(-8.0), rgb(0.2, 0.2, 0.23), 22.0, rgb(0.33, 0.33, 0.37), 3);
    const box = new R(r.x + 16.0, r.y + 58.0, r.w - 32.0, r.h - 100.0);
    FoodArt.roundedRect(g, box, rgb(0.12, 0.1, 0.1), 14.0);
    const glow = 0.5 + 0.2 * Math.sin(this.t * 3.0);
    const on = this.anyCooking();
    for (let k = 0; k < 9; k++) {
      const p = v(box.x + 18.0 + (k * (box.w - 36.0)) / 8.0, box.endY - 22.0 + (k % 2) * 8.0);
      g.circle(p, 14.0, rgb(0.9, 0.3, 0.08, on ? glow : 0.25));
      g.circle(p, 7.0, rgb(1.0, 0.65, 0.2, on ? glow : 0.2));
    }
    for (let k = 0; k < 6; k++) {
      const y = box.y + 14.0 + (k * (box.h - 28.0)) / 5.0;
      g.line(v(box.x + 6.0, y), v(box.endX - 6.0, y), rgb(0.55, 0.55, 0.58), 3.0);
    }
    for (let k = 1; k < this.slotCount; k++) {
      const x = r.x + this.slotWidth() * k;
      g.line(v(x, box.y), v(x, box.endY), rgb(0.4, 0.4, 0.44), 3.0);
    }
  }

  /** 냄비: 칸마다 양은 냄비 하나 (면 삶는 냄비·찌개 냄비) */
  private drawPots(g: Gfx, r: R): void {
    FoodArt.roundedRect(g, r.grow(-8.0), rgb(0.2, 0.2, 0.23), 22.0, rgb(0.33, 0.33, 0.37), 3);
    const w = this.slotWidth();
    for (let k = 0; k < this.slotCount; k++) {
      const rim = this.slotCenter(k).add(v(0, -2));
      const rx = w * 0.42;
      const cooking = this.itemAt(k) !== null && !this.isLocked();
      if (cooking) g.circle(rim.add(v(0, 56)), rx * 0.9, rgb(1.0, 0.45, 0.12, 0.18 + 0.05 * Math.sin(this.t * 12.0)));
      FoodArt.roundedRect(g, new R(rim.x - rx * 0.92, rim.y, rx * 1.84, 66.0), rgb(0.72, 0.66, 0.5), 18.0);
      g.line(v(rim.x - rx * 0.86, rim.y + 30.0), v(rim.x + rx * 0.86, rim.y + 30.0), rgb(0.6, 0.54, 0.4), 3.0);
      g.rect(new R(rim.x - rx - 16.0, rim.y + 6.0, 18.0, 10.0), rgb(0.3, 0.28, 0.26));
      g.rect(new R(rim.x + rx - 2.0, rim.y + 6.0, 18.0, 10.0), rgb(0.3, 0.28, 0.26));
      FoodArt.ellipse(g, rim, rx, 18.0, rgb(0.84, 0.78, 0.6));
      FoodArt.ellipse(g, rim, rx * 0.86, 13.0, rgb(0.3, 0.32, 0.36));
    }
  }

  // ---------------------------------------------------------------- 게이지 · 안내

  private drawGauge(g: Gfx, item: CookItem, rect: R): void {
    FoodArt.roundedRect(g, rect.grow(3.0), rgb(0, 0, 0, 0.6), 8.0);
    const span = item.stepSpan();
    if (item.isWaitStep()) {
      const f = clamp(item.stepElapsed / Math.max(span, 0.01), 0.0, 1.0);
      g.rect(new R(rect.x, rect.y, rect.w * f, rect.h), rgb(0.45, 0.72, 1.0));
      return;
    }
    const ripe = item.stepTime("ripe");
    const ps = item.stepTime("perfect_start");
    const pe = item.stepTime("perfect_end");
    this.seg(g, rect, span, 0.0, ripe, rgb(0.55, 0.55, 0.58));
    this.seg(g, rect, span, ripe, ps, rgb(0.95, 0.78, 0.3));
    this.seg(g, rect, span, ps, pe, rgb(0.35, 0.85, 0.42));
    this.seg(g, rect, span, pe, span, item.burns() ? rgb(0.85, 0.25, 0.2) : rgb(0.8, 0.62, 0.3));
    const x = rect.x + rect.w * clamp(item.stepElapsed / span, 0.0, 1.0);
    g.line(v(x, rect.y - 6.0), v(x, rect.endY + 6.0), WHITE, 4.0);
  }

  private seg(g: Gfx, rect: R, span: number, t0: number, t1: number, col: Color): void {
    if (t1 <= t0) return;
    const x0 = rect.x + rect.w * clamp(t0 / span, 0.0, 1.0);
    const x1 = rect.x + rect.w * clamp(t1 / span, 0.0, 1.0);
    if (x1 <= x0) return;
    g.rect(new R(x0, rect.y, x1 - x0, rect.h), col);
  }

  private drawHint(g: Gfx, item: CookItem, pos: V, width: number, fontSize = 0): void {
    const hint = hintFor(item, this.slotCount > 1);
    let col = hint[1];
    if (hint[2]) col = col.withA(0.55 + 0.45 * Math.abs(Math.sin(this.t * 8.0)));
    if (fontSize <= 0) fontSize = this.slotCount === 1 ? 28 : 21;
    FoodArt.textOutlined(g, hint[0], pos, fontSize, col, rgb(0, 0, 0, 0.8), 6, width);
  }
}

function capsulePts(c: V, sz: V, angle: number): V[] {
  const r = sz.y * 0.5;
  const half = sz.x * 0.5 - r;
  const pts: V[] = [];
  for (let k = 0; k < 7; k++) {
    const a = -PI * 0.5 + (PI * k) / 6.0;
    pts.push(c.add(v(half, 0).add(v(Math.cos(a), Math.sin(a)).mul(r)).rotated(angle)));
  }
  for (let k = 0; k < 7; k++) {
    const a = PI * 0.5 + (PI * k) / 6.0;
    pts.push(c.add(v(-half, 0).add(v(Math.cos(a), Math.sin(a)).mul(r)).rotated(angle)));
  }
  return pts;
}

/** 솥 옆면 (테두리 아래로 내려오는 반달 띠) */
function potSide(c: V, rr: V, depth: number): V[] {
  const pts: V[] = [];
  for (let k = 0; k < 17; k++) {
    const a = (PI * k) / 16.0;
    pts.push(c.add(v(Math.cos(a) * rr.x, Math.sin(a) * rr.y + depth)));
  }
  for (let k = 0; k < 17; k++) {
    const a = PI - (PI * k) / 16.0;
    pts.push(c.add(v(Math.cos(a) * rr.x, Math.sin(a) * rr.y * 0.2)));
  }
  return pts;
}
