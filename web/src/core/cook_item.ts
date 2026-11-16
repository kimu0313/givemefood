// 조리도구 위에서 조리 중인 음식 (순수 로직, 화면과 무관).
// 단계(step)마다 탭하면 다음 단계로 넘어가고(뒤집기·면 넣기·말기…), 마지막 단계에서 탭하면 꺼낸다.
// 큰 판·솥(떡볶이 판, 순대 솥)은 한 번에 여러 그릇(portions)을 만들고, 탭할 때마다 한 그릇씩 덜어 낸다.

import { MAGIC_SPEED, MENUS, Q, type StepDef } from "./defs.ts";

export interface TapResult {
  action: string;
  quality?: number;
}

export class CookItem {
  menuId: string;
  timeScale: number; // 화력 강화 시 < 1.0 (모든 구간이 짧아짐)
  stepIndex = 0;
  stepElapsed = 0.0;
  sideQualities: number[] = []; // 조리 단계를 넘길 때·꺼낼 때마다 기록한 품질
  burnt = false;
  portions = 1; // 아직 덜어 내지 않은 그릇 수
  portionsMax = 1; // 처음 만든 그릇 수 (1이면 보통 음식)
  magic = false; // 마법의 가루를 뿌림: 빨리 익고, 완벽해지면 끝까지 완벽 (타거나 불지 않음)

  private steps: StepDef[];

  constructor(menuId: string, timeScale = 1.0) {
    this.menuId = menuId;
    this.timeScale = timeScale;
    this.steps = MENUS[menuId].steps;
  }

  /** 한 번에 n그릇 만드는 큰 판·솥 음식으로 */
  setBatch(n: number): void {
    this.portions = Math.max(1, n);
    this.portionsMax = this.portions;
  }

  isBatch(): boolean {
    return this.portionsMax > 1;
  }

  step(): StepDef {
    return this.steps[this.stepIndex];
  }

  stepCount(): number {
    return this.steps.length;
  }

  stepTime(key: "ripe" | "perfect_start" | "perfect_end" | "duration"): number {
    return (this.step()[key] ?? 0) * this.timeScale;
  }

  isWaitStep(): boolean {
    return this.step().kind === "wait";
  }

  burns(): boolean {
    return !this.magic && !this.isWaitStep() && Boolean(this.step().burns);
  }

  /** 다 익으면 계속 완벽 (솥에서 쪄 두는 순대) */
  holds(): boolean {
    return !this.isWaitStep() && Boolean(this.step().hold);
  }

  /** 타는 메뉴가 타는 시각 = 완벽 구간이 끝날 때 */
  burnTime(): number {
    return this.stepTime("perfect_end");
  }

  /** 완벽 구간이 지나 팁이 없는 상태 (불음·졸음). 탄 건 아님 */
  isOvercooked(): boolean {
    return !this.burnt && !this.magic && !this.isWaitStep() && !this.holds() && this.stepElapsed > this.stepTime("perfect_end");
  }

  /** 완벽 구간이 지난 상태의 이름 (어묵·면 = 불음, 떡볶이 = 졸음) */
  overLabel(): string {
    return this.step().over_label ?? "불음";
  }

  /** 지금 단계에서 탭하면 하는 일의 이름 (예: 뒤집기, 면 넣기, 덜기) */
  tapLabel(): string {
    const s = this.step();
    if (s.tap_label !== undefined) return s.tap_label;
    return s.tap === "flip" ? "뒤집기" : "꺼내기";
  }

  /** 반환값: 이번 tick에 막 타버렸으면 true */
  tick(delta: number): boolean {
    if (this.burnt) return false;
    this.stepElapsed += this.magic ? delta * MAGIC_SPEED : delta;
    if (this.burns() && this.stepElapsed > this.burnTime()) {
      this.burnt = true;
      return true;
    }
    return false;
  }

  stepQuality(): number {
    if (this.burnt) return Q.BURNT;
    if (this.isWaitStep()) return Q.RAW;
    if (this.stepElapsed < this.stepTime("ripe")) return Q.RAW;
    if (this.stepElapsed < this.stepTime("perfect_start")) return Q.COOKED;
    if (this.holds() || this.magic || this.stepElapsed <= this.stepTime("perfect_end")) return Q.PERFECT;
    return this.burns() && this.stepElapsed > this.burnTime() ? Q.BURNT : Q.COOKED;
  }

  /**
   * 지금 탭하면 일어날 일: wait / take_out / 다음 단계로 넘기는 동작(flip, add_noodles, …)
   * 탄 음식도 꺼낼 수 있다 (손님에게 그대로 주거나 쓰레기통에 버림 — 사용자 요청)
   */
  nextTapAction(): string {
    if (this.burnt) return "take_out";
    if (this.isWaitStep()) return this.stepElapsed < this.stepTime("duration") ? "wait" : this.step().tap;
    return this.step().tap;
  }

  /** 다음 단계로 넘기는 탭인지 (꺼내기·기다리기가 아닌 것) */
  isAdvanceAction(action: string): boolean {
    return action !== "wait" && action !== "take_out" && action !== "none";
  }

  tap(): TapResult {
    const action = this.nextTapAction();
    if (action === "wait") return { action };
    if (action === "take_out") {
      this.sideQualities.push(this.stepQuality());
      return { action: "take_out", quality: this.finalQuality() };
    }
    // 다음 단계로: 조리 단계였으면 그 단계의 품질을 기록 (기다리는 단계는 품질 없음)
    if (!this.isWaitStep()) this.sideQualities.push(this.stepQuality());
    this.advance();
    return { action };
  }

  /** 큰 판·솥에서 한 그릇 덜어 내기 → 그 그릇의 품질. 남은 그릇은 계속 익는다 */
  takePortion(): number {
    const q = CookItem.worse(this.finalQuality(), this.stepQuality());
    this.portions = Math.max(0, this.portions - 1);
    return q;
  }

  /** 여러 단계 중 가장 나쁜 품질이 최종 품질 (한 면이라도 타면 탄 음식) */
  finalQuality(): number {
    let q: number = Q.PERFECT;
    for (const sq of this.sideQualities) q = CookItem.worse(q, sq);
    return q;
  }

  /** 두 품질 중 나쁜 쪽. 탐(BURNT)은 번호가 가장 크지만 가장 나쁘다 */
  static worse(a: number, b: number): number {
    if (a === Q.BURNT || b === Q.BURNT) return Q.BURNT;
    return Math.min(a, b);
  }

  /** 게이지에 표시할 전체 길이(초) */
  stepSpan(): number {
    if (this.isWaitStep()) return this.stepTime("duration");
    if (this.holds() || this.magic) return this.stepTime("perfect_start") * 1.5;
    return this.stepTime("perfect_end") * 1.3;
  }

  private advance(): void {
    this.stepIndex = Math.min(this.stepIndex + 1, this.steps.length - 1);
    this.stepElapsed = 0.0;
  }
}
