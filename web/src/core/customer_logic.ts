// 손님 1명의 주문·인내심·특수 행동 (순수 로직).

import { CUSTOMERS, DRUNK_REVEAL_TIME, Q, burntPrice, menuPrice, tipFor } from "./defs.ts";
import type { Rng } from "../engine/rng.ts";

export const CState = { WAITING: 0, HAPPY: 1, ANGRY: 2 } as const;

export interface OrderItem {
  menu: string;
  served: boolean;
  quality: number;
}

export interface ServeResult {
  result: string; // ok / angry / reject / none
  reason?: string; // raw (angry) / wrong·busy (reject) / burnt (ok: 투덜대며 받고 값은 반만)
  paid?: number;
  tip?: number;
  done?: boolean;
  seat?: number;
  next?: boolean; // 미식가: 지금 코스를 다 받아서 다음 코스로
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

  serve(menuId: string, quality: number): ServeResult {
    if (this.state !== CState.WAITING) return { result: "reject", reason: "busy" };
    const idx = this.items.findIndex((it) => !it.served && it.menu === menuId);
    if (idx < 0) return { result: "reject", reason: "wrong" };
    this.items[idx].served = true;
    this.items[idx].quality = quality;
    if (quality === Q.RAW) {
      this.state = CState.ANGRY;
      return { result: "angry", reason: "raw", paid: 0, tip: 0, done: true };
    }
    let price = menuPrice(menuId);
    let tip = 0;
    if (quality === Q.PERFECT) tip = tipFor(menuId, this.tipMult);
    if (quality === Q.BURNT) price = burntPrice(menuId);
    this.earned += price + tip;
    const done = this.unservedMenus().length === 0;
    if (done) this.state = CState.HAPPY;
    const res: ServeResult = { result: "ok", paid: price, tip, done };
    if (quality === Q.BURNT) res.reason = "burnt";
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
