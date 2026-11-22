// 테스트·밸런스 확인용 자동 플레이어.
// 사람처럼 react초마다 한 동작만 하고, 완벽 구간에서만 뒤집기/꺼내기를 한다.

import * as D from "../src/core/defs.ts";
import { ShiftSession, type ShiftResult } from "../src/core/shift_session.ts";

export class ShiftBot {
  react = 0.35;
  private think = 0.0;

  step(s: ShiftSession, delta: number): void {
    this.think -= delta;
    if (this.think > 0.0) return;
    this.think = this.react;
    this.act(s);
  }

  act(s: ShiftSession): boolean {
    if (this.handleStations(s)) return true;
    if (s.cutting !== null) {
      // 그 메뉴 그릇이 다 차서 못 담으면(blocked) 서빙부터
      if (s.tapCutting().action !== "blocked") return true;
    }
    if (this.serve(s)) return true;
    return this.cook(s);
  }

  private handleStations(s: ShiftSession): boolean {
    for (const station of s.stationKinds()) {
      for (let i = 0; i < s.stationCapacity(station); i++) {
        const item = s.stationItem(station, i);
        if (item === null) continue;
        const action = item.nextTapAction();
        if (item.burnt) {
          s.discardStation(station, i); // 봇은 탄 음식을 쓰레기통에 버린다 (사람은 그대로 손님에게 줄 수도 있음)
          return true;
        }
        if (action === "wait") continue;
        if (item.isWaitStep()) {
          s.tapStation(station, i); // 물이 끓었으면 바로 면 넣기
          return true;
        }
        const overcooked = item.isOvercooked();
        if (item.isBatch()) {
          // 큰 판·솥: 기다리는 손님 몫만큼만 한 그릇씩 덜어 낸다 (완성 칸을 다 채우지 않게)
          if ((item.stepQuality() === D.Q.PERFECT || overcooked) && this.unmet(s, item.menuId) > 0) {
            const rb = s.tapStation(station, i);
            if (rb.action !== "blocked") return true;
          }
          continue;
        }
        if (item.stepQuality() === D.Q.PERFECT || overcooked) {
          const res = s.tapStation(station, i);
          if (res.action !== "blocked") return true;
        }
      }
    }
    return false;
  }

  private serve(s: ShiftSession): boolean {
    // 그릇 탭 = 자동 서빙 (그 메뉴를 기다리는 손님 중 인내심이 가장 적게 남은 손님)
    for (let slot = 0; slot < s.tray.length; slot++) {
      if (s.tray[slot] !== null && s.bestSeatFor(slot) >= 0) {
        s.autoServe(slot);
        return true;
      }
    }
    return false;
  }

  private cook(s: ShiftSession): boolean {
    const need = this.need(s);
    for (const m of Object.keys(need)) {
      if (need[m] > 0 && this.room(s, m) > 0 && s.addIngredient(m) >= 0) return true;
    }
    return false;
  }

  /** 그 메뉴를 더 올려도 꺼낼 그릇이 있는지 (큰 판·솥은 다 익어도 그대로 두면 되니 따지지 않는다) */
  private room(s: ShiftSession, menu: string): number {
    if (D.stationIsBatch(D.menuStation(menu))) return 1;
    let n = 0;
    for (let i = 0; i < s.tray.length; i++) if (s.tray[i] === null && s.trayMenu(i) === menu) n += 1;
    for (const station of s.stationKinds()) {
      for (const item of s.stationArray(station)) {
        if (item !== null && item.menuId === menu && !item.burnt) n -= 1;
      }
    }
    if (s.cutting !== null && s.cutting.menu === menu) n -= 1;
    for (const q of s.boardQueue) if (q.menu === menu) n -= 1;
    return n;
  }

  /** Godot Dictionary 처럼 넣은 순서를 지킨다 */
  private need(s: ShiftSession): Record<string, number> {
    const need: Record<string, number> = {};
    for (let seat = 0; seat < D.SEATS; seat++) {
      const c = s.seats[seat];
      if (c === null || !c.isWaiting()) continue;
      for (const m of c.unservedMenus()) need[m] = (need[m] ?? 0) + 1;
    }
    const supply = s.supplyCounts();
    for (const m of Object.keys(supply)) need[m] = (need[m] ?? 0) - supply[m];
    return need;
  }

  /** 기다리는 손님이 원하는 그 메뉴 수 - 이미 완성 칸·도마에 있는 수 */
  private unmet(s: ShiftSession, menu: string): number {
    let n = 0;
    for (let seat = 0; seat < D.SEATS; seat++) {
      const c = s.seats[seat];
      if (c !== null && c.isWaiting()) n += c.unservedMenus().filter((m) => m === menu).length;
    }
    for (const bowl of s.tray) if (bowl !== null && bowl.menu === menu) n -= 1;
    if (s.cutting !== null && s.cutting.menu === menu) n -= 1;
    for (const q of s.boardQueue) if (q.menu === menu) n -= 1;
    return n;
  }

  /** 하루를 끝까지 자동으로 돌려 결과를 돌려준다. endless 이면 그 레벨이 속한 가게에서 무한 영업 */
  static playLevel(level: number, burners: number, heatScale: number, patienceMult: number, seed: number, endless = false): ShiftResult {
    const s = new ShiftSession();
    if (endless) s.setupEndless(D.shopForLevel(level).id, burners, heatScale, patienceMult, seed);
    else s.setupStory(level, burners, heatScale, patienceMult, seed);
    const bot = new ShiftBot();
    const dt = 0.05;
    let guard = 0;
    while (!s.isOver && guard < 200000) {
      s.update(dt);
      bot.step(s, dt);
      guard += 1;
    }
    return s.result();
  }

  /** 미식가 이벤트를 끝까지 (react = 한 동작 사이 시간: 느린 사람 흉내) */
  static playEvent(shopId: string, burners: number, heatScale: number, patienceMult: number, seed: number, react = 0.35): ShiftResult {
    const s = new ShiftSession();
    s.setupEvent(shopId, burners, heatScale, patienceMult, seed);
    const bot = new ShiftBot();
    bot.react = react;
    const dt = 0.05;
    let guard = 0;
    while (!s.isOver && guard < 200000) {
      s.update(dt);
      bot.step(s, dt);
      guard += 1;
    }
    return s.result();
  }
}
