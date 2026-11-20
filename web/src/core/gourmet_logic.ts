// 미식가 (이벤트 보스 손님) 1명의 코스 주문·점수 (순수 로직).
// 한 번에 perRound 가지씩 rounds 번 주문한다. 지금 코스를 다 받으면 바로 다음 코스, 인내심이 다 떨어지면
// 못 받은 요리는 0점으로 넘기고 다음 코스 (화내며 떠나지 않음 — 코스를 끝까지 본다).
// 덜 익은 요리도 받기는 한다 (0점, 돈 없음). 마지막 코스가 끝나면 finished.

import { Q, MAGIC_PRICE_MULT, GOURMET_PATIENCE_DECAY, GOURMET_PATIENCE_MIN, GOURMET_POINTS, burntPrice, menuPrice, tipFor } from "./defs.ts";
import { CState, CustomerLogic, type ServeResult } from "./customer_logic.ts";
import type { Rng } from "../engine/rng.ts";

export class GourmetLogic extends CustomerLogic {
  rounds: string[][];
  basePatience: number; // 첫 코스 인내심 (코스마다 조금씩 줄어듦)
  round = 0; // 지금 코스 번호 (0부터)
  finished = false;
  score = 0;
  resolved = 0; // 점수가 매겨진 요리 수 (받았거나 놓친 요리)
  perfect = 0;
  cooked = 0;
  bad = 0; // 탐 / 덜 익음
  missed = 0; // 늦어서 놓침

  constructor(rounds: string[][], patience: number) {
    super("gourmet", rounds[0], 1.0);
    this.rounds = rounds;
    this.basePatience = patience;
    this.patienceMax = patience;
    this.patience = patience;
  }

  /** 전체 요리 수 */
  total(): number {
    return this.rounds.reduce((n, r) => n + r.length, 0);
  }

  /** 지금까지의 만족도 (점수 / 받을 수 있었던 최고 점수). 아직 아무것도 안 받았으면 1 */
  satisfaction(): number {
    return this.resolved > 0 ? this.score / (3 * this.resolved) : 1.0;
  }

  /** 코스 전체 기준 만족도 (끝까지 못 본 요리는 0점) */
  finalSatisfaction(): number {
    return this.score / (3 * Math.max(1, this.total()));
  }

  /** 반환 이벤트: "" / "late"(늦어서 다음 코스로) / "done"(늦은 채로 코스가 끝남) */
  tick(delta: number, _rng: Rng, _menuPool: string[]): string {
    if (this.state !== CState.WAITING) return "";
    this.elapsed += delta;
    this.patience -= delta;
    if (this.patience > 0.0) return "";
    const left = this.unservedMenus().length;
    this.missed += left;
    this.resolved += left;
    this.nextRound();
    return this.finished ? "done" : "late";
  }

  /** ok + reason(g_perfect / g_cooked / g_burnt / g_raw) + next(다음 코스로 넘어감) + done(코스 끝) */
  serve(menuId: string, quality: number, magic = false): ServeResult {
    if (this.state !== CState.WAITING) return { result: "reject", reason: "busy" };
    const idx = this.items.findIndex((it) => !it.served && it.menu === menuId);
    if (idx < 0) return { result: "reject", reason: "wrong" };
    this.items[idx].served = true;
    this.items[idx].quality = quality;
    let paid = 0;
    let tip = 0;
    let reason = "g_raw";
    if (quality === Q.PERFECT) {
      paid = menuPrice(menuId);
      tip = tipFor(menuId, this.tipMult);
      reason = "g_perfect";
      this.perfect += 1;
    } else if (quality === Q.COOKED) {
      paid = menuPrice(menuId);
      reason = "g_cooked";
      this.cooked += 1;
    } else if (quality === Q.BURNT) {
      paid = burntPrice(menuId);
      reason = "g_burnt";
      this.bad += 1;
    } else {
      this.bad += 1;
    }
    // 미식가는 늘 보통 값 (가격 단계·마법의 가루로 더 내지 않음 — 대신 리뷰로 가게가 유명해짐)
    void magic;
    void MAGIC_PRICE_MULT;
    this.score += GOURMET_POINTS[quality] ?? 0;
    this.resolved += 1;
    this.earned += paid + tip;
    let next = false;
    if (this.unservedMenus().length === 0) {
      this.nextRound();
      next = !this.finished;
    }
    return { result: "ok", reason, paid, tip, done: this.finished, next };
  }

  private nextRound(): void {
    this.round += 1;
    if (this.round >= this.rounds.length) {
      this.finished = true;
      this.state = CState.HAPPY;
      return;
    }
    this.items = this.rounds[this.round].map((m) => ({ menu: m, served: false, quality: -1 }));
    this.patienceMax = this.basePatience * Math.max(GOURMET_PATIENCE_MIN, 1.0 - GOURMET_PATIENCE_DECAY * this.round);
    this.patience = this.patienceMax;
    this.elapsed = 0.0;
  }
}
