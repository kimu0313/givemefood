// 손님 1명: 몸·표정(캐릭터 그림 또는 CustomerArt)·주문 말풍선·인내심 게이지·대사 말풍선.
// 주문 말풍선은 머리 위: 메뉴 그림만(글자 없이) 나란히, 말풍선 아래쪽에 인내심 게이지.
// 대사 말풍선은 머리 옆: 단골 인사, 덜 익음·탐·다른 메뉴를 받았을 때의 한마디 (REACTION_LINES).
// 표정: normal / happy / angry / yuck(덜 익은 걸 먹음) / shock(탄 음식) / confused(다른 메뉴)

import { PI, R, V, WHITE, clamp, fmod, rgb, snapped, v } from "../engine/geom.ts";
import { measureText, type Gfx } from "../engine/gfx.ts";
import { Node2D } from "../engine/node.ts";
import { randi } from "../engine/rng.ts";
import * as D from "../core/defs.ts";
import type { CustomerLogic } from "../core/customer_logic.ts";
import * as FoodArt from "../art/food_art.ts";
import * as ArtAssets from "../art/art_assets.ts";
import * as CustomerArt from "./customer_art.ts";

const HEAD_R = 62.0;
const INK = rgb(0.2, 0.13, 0.09);
const ICON_W = 112.0; // 말풍선 안 메뉴 하나의 폭
const BUBBLE_H = 132.0;
const BUBBLE_GAP = 34.0; // 머리 꼭대기와 말풍선 사이 (꼬리가 들어가는 자리)
const SAY_FONT = 27;
const SAY_LINE_H = 34.0;

/** 같은 상황에서 바로 앞과 같은 대사가 나오지 않게 (상황/손님 종류 → 마지막 번호) */
const lastLine: Record<string, number> = {};

export function pickLine(kind: string, typeId: string, regularId = ""): string {
  const lines = D.reactionLines(kind, typeId, regularId);
  if (lines.length === 0) return "";
  const key = `${kind}/${typeId}/${regularId}`;
  let i = randi() % lines.length;
  if (lines.length > 1 && i === (lastLine[key] ?? -1)) i = (i + 1 + (randi() % (lines.length - 1))) % lines.length;
  lastLine[key] = i;
  return lines[i];
}

export class CustomerView extends Node2D {
  customer!: CustomerLogic;
  seat = 0;
  mood = "normal";
  leaving = false;
  spriteName = ""; // 사용자 캐릭터 그림 (ArtAssets.CUSTOMER_SPRITES). 비어 있으면 도형 그림

  private t = 0.0;
  private flash = 0.0;
  private bumpT = 0.0;
  private sayText = "";
  private sayT = 0.0; // 대사 말풍선 남은 시간
  private sayDur = 0.0;
  private reactMood = "";
  private reactT = 0.0; // 반응 표정 남은 시간
  private jolt = 0.0; // 반응할 때 몸이 움찔
  private look = 0; // 일반 손님 생김새 (옷·머리색·목도리·머리 모양)

  /** avoid = 지금 다른 자리에 앉아 있는 손님들의 캐릭터 그림 (같은 사람이 한꺼번에 둘 나오지 않게) */
  setup(c: CustomerLogic, seat: number, avoid: string[] = []): void {
    this.customer = c;
    this.seat = seat;
    this.look = randi() % 600;
    const pool = ArtAssets.customerSpritePool(c.typeId, c.regularId);
    let free = pool.filter((n) => !avoid.includes(n));
    if (free.length === 0) free = pool;
    if (free.length > 0) this.spriteName = free[randi() % free.length];
    if (c.line !== "") this.say(c.line, 4.0);
  }

  playEnter(): void {
    const base = this.position;
    this.position = base.add(v(0, 150));
    this.alpha = 0.0;
    const tw = this.createTween();
    tw.prop(this, "position", base, 0.4).setTrans("back").setEase("out");
    tw.parallel().prop(this, "modulate:a", 1.0, 0.25);
  }

  playLeave(reason: string): void {
    this.leaving = true;
    this.mood = reason === "happy" ? "happy" : reason === "angry" ? "angry" : "normal";
    // 반응 중이면(덜 익은 음식) 표정·대사를 다 보여 준 뒤 떠난다
    const wait = Math.max(0.5, this.reactT);
    const tw = this.createTween();
    tw.interval(wait);
    tw.prop(this, "position:y", this.position.y + 170.0, 0.35).setEase("in");
    tw.parallel().prop(this, "modulate:a", 0.0, 0.35);
    tw.call(() => this.queueFree());
  }

  flashChange(): void {
    this.flash = 1.6;
  }

  bump(): void {
    this.bumpT = 0.9;
  }

  /** 머리 옆 말풍선으로 말하기. 손님끼리 가까워서 말풍선이 옆 손님에 걸칠 수 있으니 말하는 손님을 맨 앞에 그린다 */
  say(text: string, secs: number = D.SAY_TIME): void {
    this.sayText = text;
    this.sayDur = secs;
    this.sayT = secs;
    if (this.parent) queueMicrotask(() => this.moveToFront());
    else this.frontOnEnter = true;
  }

  private frontOnEnter = false;

  enterTree(): void {
    if (this.frontOnEnter) {
      this.frontOnEnter = false;
      queueMicrotask(() => this.moveToFront());
    }
  }

  /** 덜 익음(raw)·탐(burnt)·다른 메뉴(wrong)를 받았을 때 (미식가는 요리마다 g_*): 표정이 바뀌고 한마디 */
  react(kind: string): void {
    this.reactMood = D.REACTION_MOODS[kind] ?? "angry";
    this.reactT = kind === "raw" ? D.RAW_LEAVE_DELAY - 0.6 : D.REACTION_TIME;
    this.bumpT = 0.0;
    // 기분 좋은 반응(단골 팁, 미식가 칭찬)은 움찔 대신 폴짝
    const happy = this.reactMood === "happy";
    this.jolt = happy ? 0.0 : 1.0;
    if (happy) this.bumpT = 0.9;
    const line = pickLine(kind, this.customer.typeId, this.customer.regularId);
    if (line !== "") this.say(line);
  }

  /** 대사 말풍선의 반대쪽 (식은땀·물음표·연기는 이쪽에 그려서 말풍선과 겹치지 않게) */
  private away(): number {
    return this.seat === D.SEATS - 1 ? 1.0 : -1.0;
  }

  saying(): string {
    return this.sayT > 0.0 ? this.sayText : "";
  }

  bubbleRect(): R {
    const w = 36.0 + ICON_W * this.customer.items.length;
    return new R(-w * 0.5, -HEAD_R - BUBBLE_GAP - BUBBLE_H, w, BUBBLE_H);
  }

  process(dt: number): void {
    this.t += dt;
    this.flash = Math.max(0.0, this.flash - dt);
    this.bumpT = Math.max(0.0, this.bumpT - dt);
    this.sayT = Math.max(0.0, this.sayT - dt);
    this.reactT = Math.max(0.0, this.reactT - dt);
    this.jolt = Math.max(0.0, this.jolt - dt * 2.5);
  }

  currentMood(): string {
    if (this.reactT > 0.0) return this.reactMood;
    if (this.leaving) return this.mood;
    if (this.bumpT > 0.0) return "happy";
    if (this.customer.patienceRatio() < 0.25) return "angry";
    return "normal";
  }

  draw(g: Gfx): void {
    const def = D.CUSTOMERS[this.customer.typeId];
    const m = this.currentMood();
    const bob = Math.sin(this.t * 2.2 + this.seat * 1.3) * 3.0;
    const head = v(0, bob);
    // 반응할 때 움찔 (놀람은 옆으로 떨고, 나머지는 살짝 뒤로)
    const jolt = Math.min(this.jolt, 1.0);
    const shake = m === "shock" ? v(Math.sin(this.t * 55.0) * 7.0 * jolt, 0) : v(0, -Math.sin(jolt * PI) * 12.0);
    g.setTransform(shake);
    const sprite = this.spriteName !== "" ? ArtAssets.customerSprite(this.spriteName) : null;
    if (this.spriteName !== "") {
      // 사용자 캐릭터 그림: 얼굴 너비·눈 높이를 맞춰서, 기분 좋으면 살짝 폴짝
      const hop = -Math.sin((Math.min(this.bumpT, 0.9) / 0.9) * PI) * 10.0;
      if (sprite !== null) g.texture(sprite, ArtAssets.customerSpriteRect(this.spriteName, ArtAssets.SPRITE_SIZE, v(0, bob + hop)));
      g.resetTransform();
      this.drawOverlays(g, head.add(shake), m);
      return;
    }
    CustomerArt.draw(g, this.customer.typeId, def.body, def.hair, head, m, this.t, this.seat, this.look, this.customer.regularId);
    g.resetTransform();
    this.drawOverlays(g, head.add(shake), m);
  }

  private drawOverlays(g: Gfx, head: V, m: string): void {
    this.drawTag(g);
    if (!this.leaving) {
      this.drawBubble(g);
      this.drawPatience(g);
    }
    switch (m) {
      case "angry":
        FoodArt.angryMark(g, head.add(v(54, -54)), 1.2);
        break;
      case "yuck": {
        // 식은땀
        const drip = fmod(this.t * 1.2, 1.0);
        const p = head.add(v(this.away() * (HEAD_R + 4.0), -14.0 + drip * 22.0));
        g.circle(p, 9.0, rgb(0.55, 0.8, 1.0, 1.0 - drip * 0.6));
        g.polygon([p.add(v(-8, -2)), p.add(v(0, -18)), p.add(v(8, -2))], rgb(0.55, 0.8, 1.0, 1.0 - drip * 0.6));
        break;
      }
      case "shock":
        // 깜짝 선 + 탄 냄새 연기
        for (let k = 0; k < 3; k++) {
          const a = -PI * 0.5 + (k - 1.0) * 0.45;
          const d = v(Math.cos(a), Math.sin(a));
          g.line(head.add(d.mul(HEAD_R + 14.0)), head.add(d.mul(HEAD_R + 40.0)), rgb(0.95, 0.3, 0.2), 6.0);
        }
        for (let k = 0; k < 3; k++) {
          const ph = fmod(this.t * 0.8 + k * 0.33, 1.0);
          g.circle(head.add(v(this.away() * (HEAD_R + 16.0) + Math.sin(this.t * 3.0 + k) * 6.0, 10.0 - ph * 70.0)), 9.0 + ph * 10.0, rgb(0.25, 0.25, 0.28, 0.5 * (1.0 - ph)));
        }
        break;
      case "confused": {
        const q = head.add(v(this.away() * (HEAD_R + 14.0), -HEAD_R + 2.0 + Math.sin(this.t * 4.0) * 4.0));
        FoodArt.textOutlined(g, "?", q, 54, rgb(0.3, 0.45, 0.9), WHITE, 8, 80.0);
        break;
      }
    }
    if (this.sayT > 0.0) this.drawSay(g);
  }

  private drawTag(g: Gfx): void {
    let tag = "";
    if (this.customer.typeId === "regular") tag = D.regularDef(this.customer.regularId)?.name ?? "단골";
    else if (this.customer.typeId === "gourmet") {
      // 미식가: 금색 이름표
      tag = D.CUSTOMERS.gourmet.name;
      const gw = 40.0 + tag.length * 24.0;
      FoodArt.roundedRect(g, new R(-gw * 0.5, 84, gw, 42), rgb(0.98, 0.78, 0.26), 21.0, rgb(0.42, 0.24, 0.05), 4);
      FoodArt.text(g, tag, v(0, 105), 24, rgb(0.35, 0.18, 0.04), gw);
      return;
    }
    else if (this.customer.typeId !== "normal") tag = D.CUSTOMERS[this.customer.typeId].name;
    if (tag === "") return;
    const w = 40.0 + tag.length * 24.0;
    FoodArt.roundedRect(g, new R(-w * 0.5, 84, w, 40), rgb(0, 0, 0, 0.55), 20.0);
    FoodArt.text(g, tag, v(0, 104), 24, rgb(1, 0.95, 0.85), w);
  }

  private drawPatience(g: Gfx): void {
    const b = this.bubbleRect().moved(v(this.shake(), 0));
    const rect = new R(b.x + 22.0, b.endY - 30.0, b.w - 44.0, 14.0);
    FoodArt.roundedRect(g, rect.grow(3.0), rgb(0.12, 0.1, 0.1), 9.0);
    const ratio = this.customer.patienceRatio();
    let col = rgb(0.9, 0.25, 0.2).lerp(rgb(0.98, 0.82, 0.25), clamp(ratio * 2.0, 0.0, 1.0));
    if (ratio > 0.5) col = rgb(0.98, 0.82, 0.25).lerp(rgb(0.35, 0.85, 0.4), (ratio - 0.5) * 2.0);
    if (ratio > 0.0) FoodArt.roundedRect(g, new R(rect.x, rect.y, Math.max(rect.w * ratio, 10.0), rect.h), col, 7.0);
  }

  private shake(): number {
    return Math.sin(this.t * 45.0) * 7.0 * Math.min(this.flash, 1.0);
  }

  private drawBubble(g: Gfx): void {
    const rect = this.bubbleRect().moved(v(this.shake(), 0));
    const border = this.flash > 0.0 ? rgb(0.85, 0.25, 0.6) : rgb(0.3, 0.22, 0.16);
    const cx = rect.center().x;
    // 꼬리 (머리 쪽으로)
    const tip = v(cx * 0.4, -HEAD_R - 8.0);
    g.polygon([v(cx - 18.0, rect.endY - 4.0), v(cx + 18.0, rect.endY - 4.0), tip], border);
    FoodArt.roundedRect(g, rect, WHITE, 26.0, border, 4);
    g.polygon([v(cx - 13.0, rect.endY - 6.0), v(cx + 13.0, rect.endY - 6.0), tip.add(v(0, -6))], WHITE);
    const iconsY = rect.y + 52.0;
    if (!this.customer.isOrderReadable()) {
      // 취객: 주문 내용은 전혀 보여주지 않는다
      FoodArt.text(g, "? ? ?", v(cx, iconsY - 6.0), 44, rgb(0.5, 0.35, 0.3));
      FoodArt.text(g, "탭해서 다시 듣기", v(cx, iconsY + 34.0), 18, rgb(0.5, 0.35, 0.3), rect.w);
      return;
    }
    this.customer.items.forEach((it, i) => {
      const c = v(rect.x + 18.0 + ICON_W * (i + 0.5), iconsY);
      FoodArt.drawIcon(g, it.menu, c, 1.55);
      if (it.served) {
        FoodArt.roundedRect(g, R.of(c.sub(v(ICON_W * 0.5 - 4.0, 44.0)), v(ICON_W - 8.0, 88.0)), rgb(1, 1, 1, 0.7), 16.0);
        FoodArt.checkMark(g, c, 1.8, rgb(0.2, 0.65, 0.3));
      }
    });
  }

  /** 대사 말풍선: 머리 옆. 맨 오른쪽 손님은 왼쪽 아래, 나머지는 오른쪽 위에 띄워서 옆 손님 말풍선과 겹치지 않게 */
  private drawSay(g: Gfx): void {
    const side = this.seat === D.SEATS - 1 ? -1.0 : 1.0;
    const rows = this.sayText.split("\n");
    let tw = 0.0;
    for (const r of rows) tw = Math.max(tw, measureText(r, SAY_FONT));
    const w = tw + 44.0;
    const h = SAY_LINE_H * rows.length + 26.0;
    const cy = side > 0.0 ? -34.0 : 70.0;
    const xNear = HEAD_R + 30.0;
    let rect = new R(side > 0.0 ? xNear : -xNear - w, cy - h * 0.5, w, h);
    // 나타날 때 톡 튀어나오고, 끝날 때 흐려진다
    const shown = this.sayDur - this.sayT;
    const pop = clamp(shown / 0.15, 0.0, 1.0);
    const a = snapped(clamp(this.sayT / 0.3, 0.0, 1.0), 0.1);
    const k = 0.7 + 0.3 * pop;
    const anchor = v(side > 0.0 ? rect.x : rect.endX, cy);
    rect = R.of(anchor.add(rect.pos.sub(anchor).mul(k)), rect.size.mul(k));
    const border = rgb(0.3, 0.22, 0.16, a);
    const fill = rgb(1, 1, 1, a);
    const tip = v(side * (HEAD_R + 2.0), 18.0);
    const baseX = side > 0.0 ? rect.x : rect.endX;
    const baseY = clamp(tip.y, rect.y + 18.0, rect.endY - 18.0);
    g.polygon([v(baseX, baseY - 14.0), v(baseX, baseY + 14.0), tip], border);
    FoodArt.roundedRect(g, rect, fill, 22.0, border, 4);
    g.polygon([v(baseX + side * 4.0, baseY - 9.0), v(baseX + side * 4.0, baseY + 9.0), tip.add(v(side * 7.0, 0))], fill);
    FoodArt.text(g, this.sayText, rect.center(), Math.trunc(SAY_FONT * k), INK.withA(a), rect.w);
  }
}
