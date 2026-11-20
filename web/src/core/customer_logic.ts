// 손님 1명의 주문·인내심·특수 행동 (순수 로직).

import { CUSTOMERS, DRUNK_REVEAL_TIME, MAGIC_PRICE_MULT, Q, burntPrice, menuPrice, tipFor } from "./defs.ts";
import type { Rng } from "../engine/rng.ts";

export const CState = { WAITING: 0, HAPPY: 1, ANGRY: 2 } as const;

export interface OrderItem {
  menu: string;
  served: boolean;
  quality: number;
  priceLevel?: string; // 받을 때의 가격 단계 (영업 중에 가격을 바꿔도 평가는 그때 낸 값으로)
}

export interface ServeResult {
  result: string; // ok / angry / reject / none
  reason?: string; // raw (angry) / wrong·busy (reject) / burnt (ok: 투덜대며 받고 값은 반만)
  paid?: number;
  tip?: number;
  done?: boolean;
  seat?: number;
  next?: boolean; // 미식가: 지금 코스를 다 받아서 다음 코스로
  magic?: boolean; // 마법의 가루를 뿌린 요리 (값 2배)
}

export class CustomerLogic {
  typeId: string;
  patienceMax: number;
  patience: number;
  tipMult: number;
  items: OrderItem[] = [];
  state: number = CState.WAITING;
  elapsed = 0.0;
  regularId = "";
  line = "";
  swapAt = -1.0; // 진상: 이 시각(초)에 주문을 한 번 바꿈
  swapped = false;
  revealLeft = 0.0; // 취객: 주문이 또렷하게 보이는 남은 시간
  earned = 0;
  lastPatienceRatio = 1.0; // 마지막 음식을 받을 때 남은 인내심 (평가에 씀)
  gotMagic = false;
  critic = ""; // 미식가 이벤트 손님: 어느 미식가인지 (D.CRITICS)

  constructor(type: string, menus: string[], patienceMult = 1.0) {
    this.typeId = type;
    const def = CUSTOMERS[type];
    this.patienceMax = def.patience * patienceMult;
    this.patience = this.patienceMax;
    this.tipMult = def.tip_mult;
    for (const m of menus) this.items.push({ menu: m, served: false, quality: -1 });
    if (type === "drunk") this.revealLeft = DRUNK_REVEAL_TIME;
  }

  isWaiting(): boolean {
    return this.state === CState.WAITING;
  }

  patienceRatio(): number {
    return Math.min(1, Math.max(0, this.patience / Math.max(this.patienceMax, 0.001)));
  }

  unservedMenus(): string[] {
    return this.items.filter((it) => !it.served).map((it) => it.menu);
  }

  isOrderReadable(): boolean {
    return this.typeId !== "drunk" || this.revealLeft > 0.0;
  }

  reveal(): boolean {
    if (this.typeId !== "drunk" || this.state !== CState.WAITING) return false;
    this.revealLeft = DRUNK_REVEAL_TIME;
    return true;
  }

  /** 반환 이벤트: "" / "angry" / "swapped" */
  tick(delta: number, rng: Rng, menuPool: string[]): string {
    if (this.state !== CState.WAITING) return "";
    this.elapsed += delta;
    this.patience -= delta;
    if (this.revealLeft > 0.0) this.revealLeft = Math.max(0.0, this.revealLeft - delta);
    if (this.patience <= 0.0) {
      this.patience = 0.0;
      this.state = CState.ANGRY;
      return "angry";
    }
    if (this.swapAt >= 0.0 && !this.swapped && this.elapsed >= this.swapAt) {
      this.swapped = true;
      if (this.swapOne(rng, menuPool)) return "swapped";
    }
    return "";
  }

  /** 가격을 느끼는 손님 (일반·급한 손님·진상·취객). 단골·미식가는 아님 */
  priceSensitive(): boolean {
    return this.typeId !== "regular" && this.typeId !== "gourmet" && this.typeId !== "imo";
  }

  /** priceMult = 메뉴 가격 단계 배수 (가격을 느끼는 손님만 — 단골은 늘 1), priceLevel = 그 단계 이름 (평가용) */
  serve(menuId: string, quality: number, magic = false, priceMult = 1.0, priceLevel = "normal"): ServeResult {
    if (this.state !== CState.WAITING) return { result: "reject", reason: "busy" };
    const idx = this.items.findIndex((it) => !it.served && it.menu === menuId);
    if (idx < 0) return { result: "reject", reason: "wrong" };
    this.items[idx].served = true;
    this.items[idx].quality = quality;
    this.items[idx].priceLevel = priceLevel;
    if (quality === Q.RAW) {
      this.state = CState.ANGRY;
      return { result: "angry", reason: "raw", paid: 0, tip: 0, done: true };
    }
    let price = menuPrice(menuId);
    let tip = 0;
    if (quality === Q.PERFECT) tip = tipFor(menuId, this.tipMult);
    if (quality === Q.BURNT) price = burntPrice(menuId);
    if (magic) price *= MAGIC_PRICE_MULT; // 마법의 가루: 감동해서 값 2배
    if (this.priceSensitive()) price = Math.round((price * priceMult) / 10) * 10;
    this.lastPatienceRatio = this.patienceRatio();
    if (magic) this.gotMagic = true;
    this.earned += price + tip;
    const done = this.unservedMenus().length === 0;
    if (done) this.state = CState.HAPPY;
    const res: ServeResult = { result: "ok", paid: price, tip, done };
    if (quality === Q.BURNT) res.reason = "burnt";
    if (magic) res.magic = true;
    return res;
  }

  private swapOne(rng: Rng, menuPool: string[]): boolean {
    const open: number[] = [];
    this.items.forEach((it, i) => {
      if (!it.served) open.push(i);
    });
    if (open.length === 0) return false;
    const i = open[rng.randiRange(0, open.length - 1)];
    const current = this.items[i].menu;
    const options = menuPool.filter((m) => m !== current);
    if (options.length === 0) return false;
    this.items[i].menu = options[rng.randiRange(0, options.length - 1)];
    return true;
  }
}
