// 스테이지 지도 위에 올라가는 캔버스 조각들: 레벨 버튼, 가게 이름표, 양쪽 큰 화살표, 지도 위 버튼.

import { Color, PI, R, TAU, V, WHITE, fmod, rgb, v } from "../engine/geom.ts";
import { DISPLAY, type Gfx } from "../engine/gfx.ts";
import { Node2D } from "../engine/node.ts";
import * as D from "../core/defs.ts";
import type { ShopDef } from "../core/defs.ts";
import * as Ui from "../engine/ui.ts";
import * as FoodArt from "../art/food_art.ts";
import { K } from "../art/map_geo.ts";
import { GameState } from "../state/game_state.ts";

const LN_R = 60.0; // 레벨 버튼 기본 반지름
// 2026-11-14 아이소메트릭 지도: 발판 = 길바닥에 박힌 납작한 원판 (땅에 누운 원 = 가로:세로 1:K), 숫자는 세워서 도톰하게
const DISC_DEPTH = 12.0; // 원판 두께 (px)

/** 땅에 누운 납작한 원판. base = 바닥 가운데 (윗면은 depth 만큼 위) */
export function isoDisc(g: Gfx, base: V, rx: number, top: Color, side: Color, ink: Color, depth = DISC_DEPTH): void {
  const ctx = g.ctx;
  const ry = rx * K;
  const c = base.add(v(0, -depth));
  FoodArt.ellipse(g, base.add(v(4, 3)), rx * 1.08, ry * 1.08, rgb(0, 0, 0, 0.3));
  ctx.save();
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(c.x - rx, c.y);
  ctx.lineTo(c.x - rx, c.y + depth);
  ctx.ellipse(c.x, c.y + depth, rx, ry, 0, PI, 0, true);
  ctx.lineTo(c.x + rx, c.y);
  ctx.closePath();
  const sg = ctx.createLinearGradient(c.x - rx, 0, c.x + rx, 0);
  sg.addColorStop(0, side.lightened(0.1).css());
  sg.addColorStop(0.45, side.css());
  sg.addColorStop(1, side.darkened(0.35).css());
  ctx.fillStyle = sg;
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = ink.css();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, rx, ry, 0, 0, TAU);
  const tg = ctx.createRadialGradient(c.x - rx * 0.3, c.y - ry * 0.4, 0, c.x, c.y, rx * 1.1);
  tg.addColorStop(0, top.lightened(0.35).css());
  tg.addColorStop(0.55, top.css());
  tg.addColorStop(1, top.darkened(0.12).css());
  ctx.fillStyle = tg;
  ctx.fill();
  ctx.stroke();
  // 안쪽 테 (살짝 파인 홈)
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = top.darkened(0.25).withA(0.7).css();
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - 1.0, rx * 0.78, ry * 0.78, 0, PI, TAU);
  ctx.stroke();
  ctx.strokeStyle = top.lightened(0.45).withA(0.8).css();
  ctx.beginPath();
  ctx.ellipse(c.x, c.y + 1.0, rx * 0.78, ry * 0.78, 0, 0, PI);
  ctx.stroke();
  ctx.restore();
  FoodArt.ellipse(g, c.add(v(-rx * 0.42, -ry * 0.42)), rx * 0.2, ry * 0.18, rgb(1, 1, 1, 0.45));
}

/** 도톰한 글자 (아래로 두께를 쌓고 위에 흰 글자) */
function thickText(g: Gfx, s: string, c: V, size: number, face: Color, ink: Color, depth: number): void {
  for (let k = depth; k >= 1; k--) FoodArt.textOutlined(g, s, c.add(v(0, k)), size, ink, ink, 9, 200, DISPLAY);
  FoodArt.textOutlined(g, s, c, size, face, ink, 9, 200, DISPLAY);
}

/** 어두운 나무 칩 (HTML Ui.chip 과 같은 모양): 아래 두께 + 먹선 테두리 + 위가 밝은 그라데이션 + 안쪽 윗줄 빛 */
export function woodChip(g: Gfx, r: R, rad: number): void {
  const ctx = g.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(r.x, r.y + 5, r.w, r.h, rad);
  ctx.fillStyle = "rgba(10,5,2,0.55)";
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, rad);
  const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  gr.addColorStop(0, "#5a3a26");
  gr.addColorStop(0.55, "#3a2416");
  gr.addColorStop(1, "#2c1a10");
  ctx.fillStyle = gr;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#1a0e07";
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(r.x + 5, r.y + 4, r.w - 10, r.h - 8, Math.max(0, rad - 4));
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,214,160,0.22)";
  ctx.stroke();
  ctx.restore();
}

/** 스테이지 지도의 레벨 발판 하나: 깬 레벨(금색 + 별), 지금 도전할 레벨(주황, 빛 고리), 잠긴 레벨(돌 회색). endless = 무한 영업.
 * position = 길바닥 위 발판 자리 (원판 바닥 가운데) */
export class LevelNode extends Node2D {
  radius = LN_R;
  number = 1;
  state = "locked"; // cleared / current / locked
  stars = 0;
  endless = false;
  event = false; // 미식가 이벤트 발판 (숫자 대신 요리 덮개 그림, 보라색) — state: locked / current(도전 가능) / cleared(다녀감)
  grade = 0; // 미식가 이벤트에서 받은 별
  menuId = ""; // 이 레벨에서 새로 열리는 메뉴
  badgeLeft = false; // 메뉴 배지를 왼쪽 위에 (오른쪽 위에 ∞ 발판이 있을 때)
  onPressed: () => void = () => {};
  private t = 0.0;
  private popT = 0.0;

  /** 새로 열린 레벨 연출 */
  pop(): void {
    this.popT = 1.0;
  }

  process(dt: number): void {
    this.t += dt;
    this.popT = Math.max(0.0, this.popT - dt * 1.2);
  }

  /** 노드 좌표(바닥 가운데 = 0,0)로 눌렸는지: 원판 + 그 위 숫자 */
  hit(local: V): boolean {
    const rx = this.radius + 16.0;
    const ry = this.radius * K + 22.0;
    const p = local.add(v(0, DISC_DEPTH + 18.0));
    return (p.x * p.x) / (rx * rx) + (p.y * p.y) / ((ry + 18.0) * (ry + 18.0)) <= 1.0;
  }

  draw(g: Gfx): void {
    const base = v();
    const s = 1.0 + 0.35 * Math.sin(this.popT * PI);
    const k = this.radius / LN_R; // 글자 크기 배수
    const r = this.radius * s;
    let top: Color;
    let side: Color;
    let ink: Color;
    if (this.state === "cleared") {
      top = rgb(1.0, 0.8, 0.28);
      side = rgb(0.86, 0.52, 0.12);
      ink = rgb(0.42, 0.22, 0.06);
    } else if (this.state === "current") {
      top = rgb(1.0, 0.48, 0.28);
      side = rgb(0.78, 0.24, 0.12);
      ink = rgb(0.4, 0.1, 0.05);
    } else {
      top = rgb(0.72, 0.71, 0.7);
      side = rgb(0.5, 0.49, 0.5);
      ink = rgb(0.26, 0.25, 0.27);
    }
    if (this.endless && this.state !== "locked") {
      top = rgb(0.42, 0.64, 0.98);
      side = rgb(0.2, 0.38, 0.74);
      ink = rgb(0.08, 0.16, 0.4);
    }
    if (this.event && this.state === "current") {
      top = rgb(0.74, 0.5, 0.98);
      side = rgb(0.46, 0.24, 0.72);
      ink = rgb(0.2, 0.06, 0.36);
    } else if (this.event && this.state === "cleared" && this.grade <= 0) {
      top = rgb(0.66, 0.6, 0.72);
      side = rgb(0.44, 0.4, 0.5);
      ink = rgb(0.22, 0.18, 0.28);
    }
    const ry = r * K;
    const depth = DISC_DEPTH * s;
    if (this.state === "current") {
      // 길바닥에 퍼지는 빛 고리 (미식가 이벤트는 보랏빛)
      const ring = fmod(this.t * 0.9, 1.0);
      const gr = r + 10.0 + ring * 30.0;
      g.ctx.save();
      g.ctx.strokeStyle = (this.event ? rgb(0.86, 0.66, 1.0, 0.95 * (1.0 - ring)) : rgb(1.0, 0.85, 0.4, 0.9 * (1.0 - ring))).css();
      g.ctx.lineWidth = 6.0;
      g.ctx.beginPath();
      g.ctx.ellipse(base.x, base.y, gr, gr * K, 0, 0, TAU);
      g.ctx.stroke();
      g.ctx.restore();
    }
    isoDisc(g, base, r, top, side, ink, depth);
    const c = base.add(v(0, -depth)); // 윗면 가운데
    const label = this.endless ? "∞" : String(this.number);
    const numC = c.add(v(0, -ry * 0.35 - 10.0 * k));
    if (this.event) {
      if (this.state === "locked") FoodArt.lockIcon(g, c.add(v(0, -12)), 1.0 * k, rgb(0.95, 0.95, 0.95));
      else cloche(g, c.add(v(0, -ry * 0.2 - 4.0)), 0.95 * k * s, ink);
    } else if (this.state === "locked" && this.endless) FoodArt.lockIcon(g, c.add(v(0, -12)), 1.0 * k, rgb(0.95, 0.95, 0.95));
    else thickText(g, label, numC, Math.trunc(48 * k * s), this.state === "locked" ? rgb(0.93, 0.93, 0.94) : WHITE, ink, Math.round(5 * k));
    if (this.menuId !== "") {
      // 새 메뉴 그림 배지
      const bc = c.add(v(r * 0.92 * (this.badgeLeft ? -1.0 : 1.0), -ry - 26.0));
      g.circle(bc.add(v(0, 3)), 25.0, rgb(0, 0, 0, 0.3));
      g.circle(bc, 25.0, rgb(0.99, 0.95, 0.86));
      g.arc(bc, 24.0, 0.0, TAU, rgb(0.62, 0.5, 0.36), 3.0);
      FoodArt.drawIcon(g, this.menuId, bc, 0.56, this.state !== "locked" ? 1.0 : 0.45);
    }
    const below = ry + 4.0; // 원판 앞 끝 (바닥 기준)
    if (this.event) {
      const purple = rgb(0.24, 0.08, 0.4);
      if (this.state === "cleared" && this.grade > 0) {
        for (let i = 0; i < D.MAX_STARS; i++) {
          const d = i - (D.MAX_STARS - 1) * 0.5;
          FoodArt.gameStar(g, base.add(v(d * 25.0, below + 14.0 - (2.0 - Math.abs(d)) * 3.0)), 12.5, i < this.grade);
        }
        FoodArt.textOutlined(g, "미식가", base.add(v(0, below + 46.0)), 22, WHITE, purple, 6, 170);
      } else {
        FoodArt.textOutlined(g, this.state === "cleared" ? "미식가 · 끝" : "미식가", base.add(v(0, below + 20.0)), 24, WHITE, purple, 7, 170);
      }
      if (this.state === "current") {
        const bob = Math.sin(this.t * 5.0) * 6.0;
        const tip = c.add(v(0, -ry - 62.0 * k + bob));
        g.polygon([tip.add(v(0, 3)), tip.add(v(-19, -24)), tip.add(v(19, -24))], purple);
        g.polygon([tip, tip.add(v(-14, -21)), tip.add(v(14, -21))], rgb(0.86, 0.66, 1.0));
        FoodArt.textOutlined(g, "이벤트!", tip.add(v(0, -38)), 27, WHITE, purple, 8, 170, DISPLAY);
      }
      return;
    }
    if (this.endless) {
      FoodArt.textOutlined(g, "무한 영업", base.add(v(0, below + 20.0)), 24, WHITE, rgb(0.06, 0.12, 0.32), 7, 170);
    } else if (this.state === "cleared") {
      // 별 5개를 발판 앞에 살짝 둥글게
      for (let i = 0; i < D.MAX_STARS; i++) {
        const d = i - (D.MAX_STARS - 1) * 0.5;
        const p = base.add(v(d * 25.0, below + 14.0 - (2.0 - Math.abs(d)) * 3.0));
        FoodArt.gameStar(g, p, 12.5, i < this.stars);
      }
    } else if (this.state === "current") {
      const bob = Math.sin(this.t * 5.0) * 6.0;
      const tip = numC.add(v(0, -40.0 * k + bob));
      g.polygon([tip.add(v(0, 3)), tip.add(v(-19, -24)), tip.add(v(19, -24))], rgb(0.5, 0.12, 0.06));
      g.polygon([tip, tip.add(v(-14, -21)), tip.add(v(14, -21))], rgb(1.0, 0.85, 0.3));
      FoodArt.textOutlined(g, "도전!", tip.add(v(0, -38)), 27, WHITE, rgb(0.5, 0.12, 0.06), 8, 170, DISPLAY);
    }
  }
}

/** 요리 덮개(클로슈) 그림: 반구 덮개 + 손잡이 + 받침 접시. c = 덮개 바닥 가운데 */
function cloche(g: Gfx, c: V, k: number, ink: Color): void {
  const ctx = g.ctx;
  const w = 44.0 * k;
  const h = 34.0 * k;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineWidth = 5.0 * k;
  ctx.strokeStyle = ink.css();
  // 받침 접시
  ctx.beginPath();
  ctx.ellipse(c.x, c.y + 4.0 * k, w + 10.0 * k, 9.0 * k, 0, 0, TAU);
  ctx.fillStyle = "#f4ead8";
  ctx.fill();
  ctx.stroke();
  // 덮개
  ctx.beginPath();
  ctx.moveTo(c.x - w, c.y);
  ctx.bezierCurveTo(c.x - w, c.y - h * 1.35, c.x + w, c.y - h * 1.35, c.x + w, c.y);
  ctx.closePath();
  const gr = ctx.createLinearGradient(c.x - w, c.y - h, c.x + w, c.y);
  gr.addColorStop(0, "#ffffff");
  gr.addColorStop(0.45, "#e9e4f2");
  gr.addColorStop(1, "#b8aecb");
  ctx.fillStyle = gr;
  ctx.fill();
  ctx.stroke();
  // 윤기
  ctx.beginPath();
  ctx.arc(c.x - w * 0.15, c.y - h * 0.1, w * 0.62, PI * 1.12, PI * 1.42);
  ctx.lineWidth = 4.0 * k;
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.stroke();
  // 손잡이
  ctx.beginPath();
  ctx.arc(c.x, c.y - h * 1.04, 7.0 * k, 0, TAU);
  ctx.fillStyle = "#ffd85a";
  ctx.fill();
  ctx.lineWidth = 4.0 * k;
  ctx.strokeStyle = ink.css();
  ctx.stroke();
  ctx.restore();
}

/** 가게 이름표: (번호) 가게 이름 ★ 가게 별점 (5점 만점, 스테이지 별의 평균) */
export class ShopPlate extends Node2D {
  shop!: ShopDef;
  number = 1;
  locked = false;
  size = v(420, 52);

  draw(g: Gfx): void {
    const sz = this.size;
    woodChip(g, R.of(v(), sz), sz.y * 0.5);
    // 번호 배지 (가게 색 동그라미)
    const bc = v(sz.y * 0.5 + 1.0, sz.y * 0.5);
    const br = sz.y * 0.5 + 3.0;
    g.circle(bc.add(v(0, 3)), br, rgb(0.1, 0.05, 0.02));
    g.circle(bc, br, rgb(0.1, 0.05, 0.02));
    g.circle(bc, br - 4.0, this.locked ? rgb(0.5, 0.47, 0.45) : this.shop.color);
    FoodArt.ellipse(g, bc.add(v(-br * 0.3, -br * 0.4)), br * 0.32, br * 0.16, rgb(1, 1, 1, 0.45));
    FoodArt.textOutlined(g, String(this.number), bc.add(v(0, 1)), 27, WHITE, rgb(0.1, 0.05, 0.02), 7, 60.0, DISPLAY);
    const x0 = sz.y + 8.0;
    if (this.locked) {
      FoodArt.text(g, this.shop.name, v((x0 + sz.x - 14.0) * 0.5, sz.y * 0.5), 27, Ui.CREAM.withA(0.6), sz.x - x0 - 14.0);
      return;
    }
    const starW = 118.0;
    FoodArt.textOutlined(g, this.shop.name, v(x0 + (sz.x - x0 - starW) * 0.5, sz.y * 0.5), 27, Ui.CREAM, rgb(0.1, 0.05, 0.02), 5, sz.x - x0 - starW);
    const sx = sz.x - starW + 6.0;
    FoodArt.gameStar(g, v(sx + 12.0, sz.y * 0.5), 14.0, true);
    FoodArt.textOutlined(g, `${GameState.shopRating(this.shop.id).toFixed(1)}/${D.MAX_STARS}`, v(sx + 30.0 + (starW - 44.0) * 0.5, sz.y * 0.5 + 1.0), 23, Ui.GOLD, rgb(0.1, 0.05, 0.02), 6, starW - 44.0, DISPLAY);
  }
}

/** 지도 위에 그리는 버튼 (밀기와 함께 움직이고, 밀다가 뗀 손가락은 누름으로 치지 않게 지도 화면이 직접 판정) */
export class MapButton extends Node2D {
  text = "";
  color: Color = Ui.GOOD;
  fontSize = 26;
  size = v(210, 56);
  disabled = false;
  badge = false;
  icon = ""; // "up" = 왼쪽에 위 화살표 (업그레이드)
  onPressed: () => void = () => {};
  private pressT = 0;

  /** position = 왼쪽 위 */
  hit(local: V): boolean {
    return !this.disabled && new R(0, 0, this.size.x, this.size.y).hasPoint(local);
  }

  press(): void {
    this.pressT = 0.15;
  }

  process(dt: number): void {
    this.pressT = Math.max(0, this.pressT - dt);
  }

  /** 볼록한 3D 버튼: 아래 두께(어두운 판) 위에 윗면(위가 밝은 그라데이션 + 윤기), 누르면 윗면이 내려앉음 */
  draw(g: Gfx): void {
    const sz = this.size;
    const ctx = g.ctx;
    const base = this.disabled ? Ui.DISABLED : this.color;
    const ink = base.darkened(0.55);
    const depth = 8.0;
    const dy = this.pressT > 0 ? depth - 2.0 : 0.0;
    const rad = sz.y * 0.5;
    const round = (y: number, h: number) => {
      ctx.beginPath();
      ctx.roundRect(0, y, sz.x, h, rad);
    };
    ctx.save();
    FoodArt.ellipse(g, v(sz.x * 0.5, sz.y + depth + 2.0), sz.x * 0.5, 9.0, rgb(0, 0, 0, 0.28));
    round(depth, sz.y);
    ctx.fillStyle = base.darkened(0.38).css();
    ctx.fill();
    ctx.lineWidth = 3.0;
    ctx.strokeStyle = ink.css();
    ctx.stroke();
    round(dy, sz.y);
    const gr = ctx.createLinearGradient(0, dy, 0, dy + sz.y);
    gr.addColorStop(0, base.lightened(0.28).css());
    gr.addColorStop(0.55, base.css());
    gr.addColorStop(1, base.darkened(0.1).css());
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(rad * 0.45, dy + 5.0, sz.x - rad * 0.9, sz.y * 0.36, sz.y * 0.18);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fill();
    ctx.restore();
    const textCol = this.disabled ? rgb(1, 1, 1, 0.8) : WHITE;
    let tc = v(sz.x * 0.5, sz.y * 0.5 + dy);
    if (this.icon === "up") {
      // 위 화살표 동그라미 + 글자는 오른쪽으로
      const ic = v(rad + 2.0, sz.y * 0.5 + dy);
      g.circle(ic, sz.y * 0.34, ink.withA(0.35));
      const a = sz.y * 0.2;
      const arrow = [v(0, -a * 1.15), v(a, 0), v(a * 0.42, 0), v(a * 0.42, a), v(-a * 0.42, a), v(-a * 0.42, 0), v(-a, 0)].map((p) => ic.add(p));
      g.polygon(arrow, WHITE);
      tc = tc.add(v(sz.y * 0.3, 0));
    }
    FoodArt.textOutlined(g, this.text, tc, this.fontSize, textCol, ink, 6, sz.x);
    if (this.badge) {
      const bp = v(sz.x - 6.0, 6.0 + dy);
      g.circle(bp.add(v(0, 3)), 21.0, rgb(0, 0, 0, 0.3));
      g.circle(bp, 21.0, rgb(0.5, 0.08, 0.05));
      g.circle(bp, 18.0, rgb(0.92, 0.22, 0.16));
      FoodArt.text(g, "!", bp, 28, WHITE, 40);
    }
  }
}

/** 큰 동그란 화살표 버튼 (밑에 갈 가게 이름) */
export class SideArrow extends Node2D {
  static readonly SIZE = v(156, 170);
  static readonly R = 54.0;
  dir = 1;
  enabled = true;
  locked = false;
  buyable = false; // 그 가게를 지금 살 수 있음 (금색 "!" 가 통통)
  caption = "";
  onPressed: () => void = () => {};
  private t = 0.0;
  private pressT = 0.0;

  center(): V {
    return v(SideArrow.SIZE.x * 0.5, SideArrow.R + 8.0);
  }

  hit(local: V): boolean {
    return this.enabled && local.distanceTo(this.center()) <= SideArrow.R + 26.0;
  }

  press(): void {
    this.pressT = 1.0;
  }

  process(dt: number): void {
    this.t += dt;
    this.pressT = Math.max(0.0, this.pressT - dt * 4.0);
  }

  draw(g: Gfx): void {
    if (!this.enabled) return;
    const c = this.center();
    const s = 1.0 - 0.12 * this.pressT;
    const r = SideArrow.R * s;
    const nudge = Math.sin(this.t * 3.2) * 5.0 * this.dir;
    // 도톰한 동그란 단추 (아래 두께 + 윗면)
    g.circle(c.add(v(0, 12)), r, rgb(0, 0, 0, 0.3));
    g.circle(c.add(v(0, 7)), r + 2.0, rgb(0.36, 0.26, 0.18));
    g.circle(c.add(v(0, 7)), r, rgb(0.74, 0.6, 0.44));
    g.circle(c, r + 2.0, rgb(0.36, 0.26, 0.18));
    g.circle(c, r, rgb(0.98, 0.93, 0.82));
    g.arc(c, r - 5.0, 0.0, TAU, rgb(0.62, 0.5, 0.36), 4.0);
    FoodArt.ellipse(g, c.add(v(-r * 0.35, -r * 0.45)), r * 0.28, r * 0.14, rgb(1, 1, 1, 0.6));
    const col = this.locked && !this.buyable ? rgb(0.55, 0.52, 0.5) : rgb(0.86, 0.3, 0.2);
    const x = this.dir * 8.0 + nudge;
    const d = this.dir;
    g.polyline([c.add(v(x - 14.0 * d, -26.0).mul(s)), c.add(v(x + 14.0 * d, 0.0).mul(s)), c.add(v(x - 14.0 * d, 26.0).mul(s))], col, 13.0 * s);
    const R0 = SideArrow.R;
    if (this.buyable) {
      const bc = c.add(v(R0 * 0.72, -R0 * 0.72 - Math.abs(Math.sin(this.t * 5.0)) * 6.0));
      g.circle(bc, 22.0, rgb(0.55, 0.32, 0.05));
      g.circle(bc, 19.0, rgb(1.0, 0.8, 0.2));
      FoodArt.text(g, "!", bc.add(v(0, 1)), 30, rgb(0.45, 0.2, 0.05), 40.0);
    } else if (this.locked) {
      const lc = c.add(v(R0 * 0.72, -R0 * 0.72));
      g.circle(lc, 20.0, rgb(0.36, 0.3, 0.27));
      FoodArt.lockIcon(g, lc.add(v(0, 3)), 0.5, rgb(0.95, 0.92, 0.86));
    }
    // 가게 이름은 두 줄로 (화면 끝에서 잘리지 않게)
    FoodArt.textOutlined(g, this.caption.replace(/ /g, "\n"), c.add(v(0, R0 + 40.0)), 22, WHITE, rgb(0, 0, 0, 0.75), 6, SideArrow.SIZE.x);
  }
}

/** 글자만 (먹선 테두리) */
export class MapNote extends Node2D {
  text = "";
  size = v(480, 90);

  draw(g: Gfx): void {
    // Godot Label 처럼 위쪽 정렬
    const lines = this.text.split("\n").length;
    FoodArt.textOutlined(g, this.text, v(this.size.x * 0.5, (lines * 28 * 1.25) * 0.5), 28, Ui.CREAM, rgb(0, 0, 0, 0.85), 8, this.size.x);
  }
}
