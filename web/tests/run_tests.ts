// 로직 테스트 + 밸런스 리포트 (Godot 판 tests/run_tests.gd 를 그대로 옮김).
// 실행: npm test   (= node tests/run_tests.ts)

import * as D from "../src/core/defs.ts";
import { CookItem } from "../src/core/cook_item.ts";
import { CustomerLogic, CState } from "../src/core/customer_logic.ts";
import { ShiftSession } from "../src/core/shift_session.ts";
import { GourmetLogic } from "../src/core/gourmet_logic.ts";
import { nextRating, reviewOf } from "../src/core/review.ts";
import { GameStateClass, SAVE_KEY, ACCOUNTS_KEY, nameError } from "../src/state/game_state.ts";
import { Rng } from "../src/engine/rng.ts";
import { ShiftBot } from "./shift_bot.ts";
import { viewTests } from "./view_tests.ts";

declare const process: { argv: string[]; exit(code: number): never };

let checks = 0;
let fails = 0;

export function ok(cond: boolean, msg: string): void {
  checks += 1;
  if (!cond) {
    fails += 1;
    console.error("FAIL: " + msg);
  }
}

const Q = D.Q;
const approx = (a: number, b: number) => Math.abs(a - b) < 1e-5;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function run(item: CookItem, seconds: number): void {
  let t = 0.0;
  while (t < seconds - 0.0001) {
    const d = Math.min(0.05, seconds - t);
    item.tick(d);
    t += d;
  }
}

function cookFor(s: ShiftSession, seconds: number): void {
  let t = 0.0;
  while (t < seconds - 0.0001) {
    s.update(Math.min(0.05, seconds - t));
    t += 0.05;
  }
}

function testCookItems(): void {
  const tb = new CookItem("tteokbokki");
  run(tb, 3.0);
  ok(tb.stepQuality() === Q.RAW, "떡볶이 판 3초 = 덜 익음");
  run(tb, 3.0);
  ok(tb.stepQuality() === Q.COOKED, "떡볶이 판 6초 = 익음");
  run(tb, 2.0);
  ok(tb.stepQuality() === Q.PERFECT && tb.tapLabel() === "덜기", "떡볶이 판 8초 = 완벽, 탭 = 덜기");
  const r = tb.tap();
  ok(r.action === "take_out" && r.quality === Q.PERFECT, "떡볶이 완벽 구간에 꺼내기");

  const over = new CookItem("tteokbokki");
  run(over, 17.0);
  ok(!over.burnt && over.isOvercooked() && over.stepQuality() === Q.COOKED && over.overLabel() === "졸음", "떡볶이 16초 넘으면 졸음(익음, 팁 없음)");
  run(over, 200.0);
  ok(!over.burnt && over.stepQuality() === Q.COOKED && over.nextTapAction() === "take_out", "떡볶이는 오래 둬도 타지 않음");

  // 골목 포장마차에서 타는 음식은 튀김뿐
  const pochaBurns: string[] = [];
  for (const m of D.shopMenus("pocha")) {
    for (const stp of D.MENUS[m].steps) if (stp.burns && !pochaBurns.includes(m)) pochaBurns.push(m);
  }
  ok(same(pochaBurns, ["twigim"]), `골목 포장마차에서 타는 메뉴는 튀김뿐 (${pochaBurns})`);
  const burn = new CookItem("twigim");
  run(burn, 8.5);
  ok(burn.burnt && burn.nextTapAction() === "take_out", "튀김 8초 넘으면 탐 → 그래도 꺼낼 수 있음 (손님에게 주거나 버림)");
  const bk = new CookItem("hotteok");
  run(bk, 5.0);
  ok(bk.burnt && bk.nextTapAction() === "take_out" && bk.tap().quality === Q.BURNT, "뒤집기 전에 탄 호떡은 뒤집지 않고 바로 탄 채로 꺼냄");

  const batch = new CookItem("tteokbokki");
  batch.setBatch(4);
  run(batch, 8.0);
  ok(batch.takePortion() === Q.PERFECT && batch.portions === 3 && batch.sideQualities.length === 0, "큰 판: 한 그릇씩 덜어도 판은 계속 익음");
  run(batch, 9.0);
  ok(batch.takePortion() === Q.COOKED && batch.portions === 2, "판에 오래 둔 그릇은 졸아서 익음");

  const sd = new CookItem("sundae");
  run(sd, 3.0);
  ok(sd.stepQuality() === Q.RAW, "순대 솥 3초 = 덜 익음");
  run(sd, 3.0);
  ok(sd.stepQuality() === Q.PERFECT, "순대 솥 6초 = 다 쪄짐(완벽)");
  run(sd, 200.0);
  ok(sd.stepQuality() === Q.PERFECT && !sd.burnt && !sd.isOvercooked(), "순대는 솥에 계속 둬도 완벽");

  const k = new CookItem("hotteok");
  run(k, 3.5);
  ok(k.nextTapAction() === "flip" && k.stepQuality() === Q.PERFECT, "호떡 앞면 3.5초 = 완벽, 뒤집기");
  ok(k.tap().action === "flip" && k.stepIndex === 1, "호떡 뒤집기 후 뒷면 단계");
  ok(k.stepQuality() === Q.RAW, "뒤집은 직후 뒷면은 덜 익음");
  run(k, 3.5);
  ok(k.tap().quality === Q.PERFECT, "호떡 양면 완벽 = 완벽");

  const k2 = new CookItem("hotteok");
  run(k2, 3.5);
  k2.tap();
  run(k2, 1.0);
  ok(k2.tap().quality === Q.RAW, "호떡 뒷면 덜 익으면 최종 덜 익음");

  const k3 = new CookItem("hotteok");
  run(k3, 5.0);
  ok(k3.burnt, "호떡 앞면 4.5초 넘으면 탐");

  const rm = new CookItem("ramen");
  run(rm, 1.0);
  ok(rm.tap().action === "wait", "라면 물 끓기 전 탭은 무시");
  run(rm, 2.5);
  ok(rm.tap().action === "add_noodles", "라면 3초 후 면 넣기");
  run(rm, 5.0);
  ok(rm.tap().quality === Q.PERFECT, "라면 면 5초 = 완벽");
  const rm2 = new CookItem("ramen");
  run(rm2, 3.5);
  rm2.tap();
  run(rm2, 8.5);
  ok(rm2.stepQuality() === Q.PERFECT && !rm2.burnt, "라면 완벽 구간이 넓어짐: 면 8.5초도 완벽 (4~9초)");

  const od = new CookItem("odeng");
  run(od, 2.0);
  ok(od.stepQuality() === Q.RAW, "어묵 2초 = 덜 익음");
  run(od, 3.0);
  ok(od.stepQuality() === Q.PERFECT, "어묵 5초 = 완벽");
  run(od, 6.0);
  ok(od.stepQuality() === Q.COOKED, "어묵 11초 = 불어서 익음(팁 없음)");
  run(od, 100.0);
  ok(!od.burnt, "어묵은 타지 않음");

  const hs = new CookItem("tteokbokki", 0.85);
  run(hs, 6.2);
  ok(hs.stepQuality() === Q.PERFECT, "화력 -15%: 떡볶이 완벽 구간이 5.95초부터");

  const jm = new CookItem("jjolmyeon");
  run(jm, 5.0);
  ok(jm.stepQuality() === Q.PERFECT, "쫄면 면 5초 = 완벽");
  run(jm, 20.0);
  ok(!jm.burnt && jm.stepQuality() === Q.COOKED, "쫄면은 타지 않고 불어서 익음으로");

  const sh = new CookItem("shrimp");
  run(sh, 4.5);
  sh.tap();
  run(sh, 4.5);
  ok(sh.tap().quality === Q.PERFECT, "새우구이 4.5초/4.5초 = 완벽");
}

function testCustomers(): void {
  const rng = new Rng(1);
  const pool = ["odeng", "tteokbokki"];
  const one = ["tteokbokki"];

  const c = new CustomerLogic("normal", one);
  const wrong = c.serve("odeng", Q.PERFECT);
  ok(wrong.result === "reject" && wrong.reason === "wrong", "주문 안 한 메뉴는 거절 (이유: wrong)");
  const res = c.serve("tteokbokki", Q.PERFECT);
  ok(res.paid === 3000 && res.tip === 0 && res.done === true, "일반 손님 완벽 떡볶이 = 3,000, 팁 없음 (팁은 단골만)");
  ok(c.state === CState.HAPPY, "주문을 다 받으면 만족");

  for (const t of ["hurry", "jinsang", "drunk"]) ok(new CustomerLogic(t, one).serve("tteokbokki", Q.PERFECT).tip === 0, `${t}: 팁 없음`);
  ok(new CustomerLogic("regular", one).serve("tteokbokki", Q.PERFECT).tip === 1800, "단골만 팁 (완벽 떡볶이 3,000원 → 팁 1,800)");
  ok(new CustomerLogic("regular", one).serve("tteokbokki", Q.COOKED).tip === 0, "단골도 완벽이 아니면 팁 없음");
  ok(new CustomerLogic("regular", one).serve("tteokbokki", Q.PERFECT).tip === 1800, "단골 팁 2배");
  ok(new CustomerLogic("normal", one).serve("tteokbokki", Q.COOKED).tip === 0, "익음 = 팁 없음");

  const rr = new CustomerLogic("normal", one).serve("tteokbokki", Q.RAW);
  ok(rr.result === "angry" && rr.reason === "raw" && rr.paid === 0, "덜 익음 서빙 = 화내고 돈 없음 (이유: raw)");
  const bt = new CustomerLogic("normal", one).serve("tteokbokki", Q.BURNT);
  ok(bt.result === "ok" && bt.reason === "burnt" && bt.paid === 1500 && bt.tip === 0 && bt.done === true, "탄 음식은 투덜대며 받고 값은 반만 (3,000 → 1,500, 팁 없음)");

  const p = new CustomerLogic("normal", one);
  p.tick(19.9, rng, pool);
  ok(p.isWaiting(), "일반 손님 19.9초까지 대기 (인내심 20초)");
  ok(p.tick(0.2, rng, pool) === "angry", "인내심 0 → 화남");
  ok(approx(new CustomerLogic("normal", one, 1.2).patienceMax, 24.0), "난로 +20% → 인내심 24초");
  const pat: Record<string, number> = {};
  for (const t of D.CUSTOMER_ORDER) pat[t] = D.CUSTOMERS[t].patience;
  ok(same(pat, { normal: 20, hurry: 10, regular: 30, jinsang: 15, drunk: 25 }), `손님 인내심 원래대로 20·10·30·15·25초 (${JSON.stringify(pat)})`);

  const j = new CustomerLogic("jinsang", ["odeng", "odeng"]);
  j.swapAt = 1.0;
  ok(j.tick(1.1, rng, pool) === "swapped" && j.unservedMenus().includes("tteokbokki"), "진상 주문 변경");
  ok(j.tick(5.0, rng, pool) === "", "진상은 한 번만 바꿈");

  const d = new CustomerLogic("drunk", one);
  ok(d.isOrderReadable(), "취객 처음 3초는 주문이 보임");
  d.tick(3.1, rng, pool);
  ok(!d.isOrderReadable(), "취객 3초 뒤 흐릿");
  d.reveal();
  ok(d.isOrderReadable(), "취객 탭하면 다시 보임");
}

function testSessionCapacity(): void {
  const s = new ShiftSession();
  s.setupStory(1, 2, 1.0, 1.0, 42);
  ok(!("burner" in s.stations) && s.stationCapacity("burner") === 0, "골목 포장마차엔 화구가 없음");
  ok(s.addIngredient("tteokbokki") === 0 && s.stationItem("pan", 0)!.portions === D.PAN_PORTIONS, `떡볶이 재료 → 떡볶이 판에 ${D.PAN_PORTIONS}그릇`);
  ok(s.addIngredient("tteokbokki") === -1, "떡볶이 판이 비기 전엔 새로 못 끓임");
  ok((s.supplyCounts()["tteokbokki"] ?? 0) === D.PAN_PORTIONS, "판에 있는 떡볶이 = 남은 그릇 수");
  ok(s.addIngredient("sundae") === -1 && s.addIngredient("odeng") === -1, "레벨 1엔 떡볶이만 (순대·어묵 잠김)");
  ok(s.stationInUse("pan") && !s.stationInUse("broth") && !s.stationInUse("fryer") && !s.stationInUse("steamer"), "레벨 1엔 사각틀·솥·튀김기 안 씀");
  const s3 = new ShiftSession();
  s3.setupStory(3, 2, 1.0, 1.0, 42);
  for (let i = 0; i < 4; i++) ok(s3.addIngredient("odeng") === i, `레벨 3 어묵: 사각틀 ${i + 1}번 칸`);
  ok(s3.addIngredient("odeng") === -1, "어묵 사각틀은 4칸");
  ok(s3.addIngredient("twigim") === -1, "튀김은 레벨 4부터");
  const big = new ShiftSession();
  big.setupStory(2, 4, 1.0, 1.0, 42);
  big.addIngredient("tteokbokki");
  ok(big.stationItem("pan", 0)!.portions === D.PAN_PORTIONS && approx(big.stationItem("pan", 0)!.perfectBonus, 0.3), "포장마차 불 조절 2단계: 판은 그대로 2그릇, 완벽 구간 +30%");
  const big5 = new ShiftSession();
  big5.setupStory(2, 7, 1.0, 1.0, 42);
  big5.addIngredient("tteokbokki");
  ok(big5.stationItem("pan", 0)!.portions === 2 && approx(big5.stationItem("pan", 0)!.perfectBonus, 0.75), "불 조절 5단계: 떡볶이 판은 늘 2그릇, 완벽 구간 +75%");
  {
    const fr = new ShiftSession();
    fr.setupStory(4, 5, 1.0, 1.0, 42);
    ok(fr.addIngredient("twigim") === 0 && approx(fr.stationItem("fryer", 0)!.perfectBonus, 0.45), "포장마차 불 조절은 모든 음식 (튀김기 +45%)");
    const bu = new ShiftSession();
    bu.setupStory(11, 5, 1.0, 1.0, 42);
    bu.addIngredient("ramen");
    ok(approx(bu.stationItem("burner", 0)!.perfectBonus, 0.25), "화구 있는 가게는 그대로 (화구 위만 +25%)");
  }
  // 화구 불 조절 (5단계 값 7): 화구 위 음식만 완벽 구간 +75%, 화구 칸은 4칸
  const ctl = new ShiftSession();
  ctl.setupStory(11, 7, 1.0, 1.0, 42);
  const plain = new ShiftSession();
  plain.setupStory(11, 4, 1.0, 1.0, 42);
  ok(ctl.burnerCount === 4 && ctl.addIngredient("ramen") === 0 && plain.addIngredient("ramen") === 0, "불 조절 단계도 화구는 4칸");
  {
    const a = ctl.stationItem("burner", 0)!;
    const b = plain.stationItem("burner", 0)!;
    while (a.isWaitStep()) { a.stepElapsed = a.stepTime("duration"); a.tap(); }
    while (b.isWaitStep()) { b.stepElapsed = b.stepTime("duration"); b.tap(); }
    const wa = a.stepTime("perfect_end") - a.stepTime("perfect_start");
    const wb = b.stepTime("perfect_end") - b.stepTime("perfect_start");
    ok(approx(wa, wb * 1.75) && approx(a.stepTime("perfect_start"), b.stepTime("perfect_start")), `불 조절 +75%: 라면 완벽 구간 ${wb.toFixed(1)}초 → ${wa.toFixed(1)}초 (시작은 그대로)`);
  }

  const s5 = new ShiftSession();
  s5.setupStory(11, 4, 0.7, 1.0, 42);
  for (let i = 0; i < 4; i++) ok(s5.addIngredient("ramen") === i, `화구 4칸 업그레이드 시 ${i}번 칸`);
  ok(approx(s5.stationItem("burner", 0)!.stepTime("duration"), 2.1), "화력 -30%: 물 끓이기 2.1초");
}

function testSessionServeFlow(): void {
  const s = new ShiftSession();
  s.setupStory(1, 2, 1.0, 1.0, 7);
  let arrivals = 0;
  s.customerArrived.connect(() => (arrivals += 1));
  s.update(1.0);
  ok(arrivals === 0, "첫 손님은 1.5초 뒤");
  s.update(0.6);
  ok(arrivals === 1 && s.seatedCount() === 1, "첫 손님 입장");

  const seat = s.freeSeatIndex();
  const c = new CustomerLogic("normal", ["tteokbokki"]);
  s.debugSeatCustomer(seat, c);
  const pan = s.addIngredient("tteokbokki");
  for (let i = 0; i < 160; i++) s.update(0.05); // 8초
  const res = s.tapStation("pan", pan);
  ok(res.action === "take_out" && res.quality === Q.PERFECT && res.left === D.PAN_PORTIONS - 1, "세션: 떡볶이 판에서 완벽한 한 그릇 덜기");
  ok(s.stationItem("pan", pan) !== null && s.stationItem("pan", pan)!.portions === D.PAN_PORTIONS - 1, "덜고 남은 떡볶이는 판에 그대로");
  const slot = res.slot!;
  const other = (seat + 1) % D.SEATS;
  if (s.seats[other] === null || !s.seats[other]!.unservedMenus().includes("tteokbokki")) {
    ok(s.serve(slot, other).result === "reject", "엉뚱한 자리에 서빙하면 거절");
  }
  const sv = s.serve(slot, seat);
  ok(sv.result === "ok" && s.sales === 3000 && s.tips === 0, "세션: 서빙 매출 3,000 (일반 손님은 팁 없음)");
  // 단골은 완벽한 요리에 팁을 주며 한마디 (customerReacted "tip"), 대사를 다 하도록 자리는 조금 늦게 빈다
  {
    const st = new ShiftSession();
    st.setupStory(2, 2, 1.0, 1.0, 5);
    const reg = new CustomerLogic("regular", ["tteokbokki"]);
    reg.regularId = "grandma";
    st.debugSeatCustomer(0, reg);
    const said: string[] = [];
    st.customerReacted.connect((_seat, kind) => said.push(kind));
    const sl = st.freeTraySlot("tteokbokki");
    st.tray[sl] = { menu: "tteokbokki", quality: Q.PERFECT };
    const rs = st.serve(sl, 0);
    ok(rs.result === "ok" && st.tips === 1800 && said.join() === "tip" && st.seatWait[0] >= D.RAW_LEAVE_DELAY, "단골 팁 + 한마디, 대사 동안 자리 비워 둠");
    ok(D.reactionLines("tip", "regular", "grandma").length > 0 && D.reactionLines("tip", "regular", "nobody").length > 0, "단골마다 팁 대사 (없으면 공통)");
    // 팁 대사는 단골인 티만 내고 팁·돈 얘기는 직접 안 함 (2026-11-16 사용자 요청)
    const tipLines = Object.values(D.REACTION_LINES.tip).flat();
    ok(tipLines.every((l) => !/팁|용돈|잔돈|돈|받아|넣어 둬/.test(l)), "팁 대사에 팁·돈 얘기 없음");
  }
  ok(s.seats[seat] === null && s.happyCount === 1 && s.itemsPerfect === 1, "만족 손님 퇴장 + 완벽 카운트");
}

/** 덜 익음·탐·다른 메뉴를 받은 손님: 반응 신호, 대사, 떠난 자리 비워 두기 */
function testReactions(): void {
  for (const kind of ["raw", "burnt", "wrong"]) {
    ok(D.reactionLines(kind, "normal").length >= 3, `${kind} 일반 손님 대사 3개 이상`);
    let longRows = 0;
    for (const t of D.CUSTOMER_ORDER) {
      const lines = D.reactionLines(kind, t);
      ok(lines.length >= 2, `${kind} / ${t} 대사 2개 이상`);
      for (const l of lines) {
        const rows = l.split("\n");
        for (const r of rows) if (rows.length > 2 || r.length > 14) longRows += 1;
      }
    }
    ok(longRows === 0, `${kind} 대사는 두 줄, 한 줄 14자 이하 (넘는 줄 ${longRows}개)`);
  }

  const s = new ShiftSession();
  s.setupStory(1, 2, 1.0, 1.0, 11);
  const got: string[] = [];
  s.customerReacted.connect((seat, kind) => got.push(`${seat}:${kind}`));
  s.debugSeatCustomer(0, new CustomerLogic("normal", ["tteokbokki", "sundae"]));
  s.debugSeatCustomer(1, new CustomerLogic("hurry", ["tteokbokki"]));
  s.tray[0] = { menu: "tteokbokki", quality: Q.BURNT }; // 반응 규칙 확인용 (실제로 탈 수 있는 건 튀김뿐)
  const r1 = s.serve(0, 0);
  ok(r1.result === "ok" && r1.paid === 1500 && s.tray[0] === null && s.seats[0] !== null && s.sales === 1500, "탄 음식: 손님이 투덜대며 받고 값은 반만, 남은 주문은 계속 기다림");
  const od = s.freeTraySlot("odeng");
  s.tray[od] = { menu: "odeng", quality: Q.PERFECT };
  s.serve(od, 0);
  s.tray[1] = { menu: "tteokbokki", quality: Q.RAW };
  const r3 = s.serve(1, 1);
  ok(r3.result === "angry" && s.seats[1] === null && s.angryCount === 1, "덜 익음: 손님이 화나서 떠남");
  ok(same(got, ["0:burnt", "0:wrong", "1:raw"]), `반응 신호 burnt / wrong / raw (${got})`);
  ok(s.seatWait[1] >= D.RAW_LEAVE_DELAY && s.freeSeatIndex() === 2, `덜 익음에 반응하고 떠난 자리는 ${D.RAW_LEAVE_DELAY}초 넘게 비워 둠 (${s.seatWait[1].toFixed(1)}초)`);
  s.update(Math.max(D.RAW_LEAVE_DELAY, D.SEAT_REFILL_MAX) + 0.1);
  ok(s.seatWait[1] === 0.0, "기다린 뒤엔 다시 앉을 수 있음");
  ok(D.reactionLines("burnt", "regular", "grandma").includes("불 좀 줄여,\n이 사람아!") && same(D.reactionLines("burnt", "regular", "taxi"), D.reactionLines("burnt", "regular")), "동네 할머니는 전용 대사, 다른 단골은 단골 대사");
}

function testSessionCuttingAndWaste(): void {
  const s = new ShiftSession();
  s.setupStory(5, 2, 1.0, 1.0, 9);
  ok(s.addIngredient("sundae") === 0 && s.cutting === null && s.stationItem("steamer", 0)!.portions === D.STEAMER_PORTIONS, `순대 재료 → 큰 솥에 ${D.STEAMER_PORTIONS}그릇 (도마는 비어 있음)`);
  ok(s.addIngredient("sundae") === -1, "순대 솥이 비기 전엔 새로 못 넣음");
  cookFor(s, 5.5);
  const out = s.tapStation("steamer", 0);
  ok(out.action === "to_board" && out.quality === Q.PERFECT && s.cutting!.menu === "sundae", "다 쪄진 순대·내장을 솥에서 꺼내 도마로");
  ok(s.tapCutting().action === "cut" && s.tapCutting().action === "cut", "도마 1, 2번째 탭 = 썰기");
  const plated = s.tapCutting();
  ok(plated.action === "plated" && s.cutting === null, "3번째 탭에 그릇에 담김");
  ok(s.tray[plated.slot!]!.quality === Q.PERFECT, "다 쪄진 순대는 완벽");
  ok(s.stationItem("steamer", 0)!.portions === D.STEAMER_PORTIONS - 1, `솥에 순대 ${D.STEAMER_PORTIONS - 1}그릇 남음`);
  s.tray[plated.slot!] = null;
  s.discardStation("steamer", 0);
  s.waste = 0;

  const j = new ShiftSession();
  j.setupStory(12, 2, 1.0, 1.0, 9);
  const ji = j.addIngredient("jjolmyeon");
  for (let i = 0; i < 120; i++) j.update(0.05); // 6초
  const jr = j.tapStation("pot", ji);
  ok(jr.action === "to_board" && jr.quality === Q.PERFECT, "쫄면: 냄비 → 도마");
  j.tapCutting();
  j.tapCutting();
  ok(j.tapCutting().action === "plated", "쫄면: 도마 3번 비비면 완성");

  const b = s.addIngredient("tteokbokki");
  const f = s.addIngredient("twigim");
  cookFor(s, 30.0);
  ok(!s.stationItem("pan", b)!.burnt && s.stationItem("fryer", f)!.burnt, "방치하면 튀김은 타고 떡볶이 판은 안 탐");
  const fcost = s.discardStation("fryer", f);
  ok(fcost === 750 && s.stationItem("fryer", f) === null, "탄 튀김 폐기 = 재료비 750원 손해");
  const cost = s.discardStation("pan", b);
  ok(cost === 900 * D.PAN_PORTIONS && s.waste === fcost + cost && s.stationItem("pan", b) === null, `떡볶이 한 판을 통째로 버리면 그릇당 재료비 900원 × ${D.PAN_PORTIONS}`);

  ok(s.tray.length === 4 * D.TRAY_PER_MENU && s.trayMenu(0) === "tteokbokki" && s.trayMenu(3) === "sundae" && s.trayMenu(4) === "odeng" && s.trayMenu(7) === "twigim", "완성 칸 = 메뉴마다 그 메뉴 그릇 2칸 (떡볶이·순대·어묵·튀김 순)");
  for (let i = 0; i < s.tray.length; i++) if (s.trayMenu(i) === "odeng") s.tray[i] = { menu: "odeng", quality: Q.COOKED };
  const o = s.addIngredient("odeng");
  for (let i = 0; i < 120; i++) s.update(0.05);
  const blocked = s.tapStation("broth", o);
  ok(blocked.action === "blocked" && blocked.menu === "odeng", "어묵 그릇 2개가 차면 어묵을 더 못 꺼냄");
  ok(s.freeTraySlot("tteokbokki") === 0 && s.freeTraySlot("twigim") === 6, "다른 메뉴 그릇은 그대로 비어 있음");

  // 떡볶이 판 2그릇을 다 덜어 완성 칸 2개가 차면, 다음 판은 못 덞
  const tp = new ShiftSession();
  tp.setupStory(1, 2, 1.0, 1.0, 3);
  tp.addIngredient("tteokbokki");
  cookFor(tp, 8.0);
  ok(tp.tapStation("pan", 0).action === "take_out" && tp.tapStation("pan", 0).action === "take_out" && tp.stationItem("pan", 0) === null, "떡볶이 판에서 2그릇 덜면 판이 빔");
  tp.addIngredient("tteokbokki");
  cookFor(tp, 8.0);
  const third = tp.tapStation("pan", 0);
  ok(third.action === "blocked" && tp.stationItem("pan", 0)!.portions === D.PAN_PORTIONS, `떡볶이 그릇 2개가 차면 새 판의 ${D.PAN_PORTIONS}그릇은 그대로`);
}

function testSessionTimeout(): void {
  const s = new ShiftSession();
  s.setupStory(1, 2, 1.0, 1.0, 3);
  let guard = 0;
  while (!s.isOver && guard < 10000) {
    s.update(0.1);
    guard += 1;
  }
  const r = s.result();
  const n = D.levelConfig(1).customers;
  ok(s.isOver, "아무것도 안 하면 손님이 다 화나서 떠나고 하루가 끝남");
  ok(r.angry === n && r.customers === n && r.revenue === 0 && !r.passed, `손님 ${n}명 전부 화남, 매출 0, 실패`);
  ok(s.elapsed < 200.0, `아무도 안 받아도 하루는 끝남 (${s.elapsed.toFixed(0)}초)`);
  ok(r.stars === 1, "별점 최소 1개");
}

/** 하루 할당량: 매출이 처음 할당량을 넘을 때 한 번 알림, 손님을 다 받기 전엔 안 끝남 */
function testQuota(): void {
  const s = new ShiftSession();
  s.setupStory(1, 2, 1.0, 1.0, 5);
  let hits = 0;
  s.quotaReached.connect(() => (hits += 1));
  ok(s.customersLeft() === 5, "첫날 남은 손님 5명");
  let served = 0;
  for (let i = 0; i < 12; i++) {
    if (s.target <= s.revenue()) break;
    s.seats[0] = new CustomerLogic("normal", ["tteokbokki"]);
    s.tray[0] = { menu: "tteokbokki", quality: Q.PERFECT };
    s.serve(0, 0);
    served += 1;
  }
  ok(s.revenue() >= s.target && hits === 1, `할당량 ${D.formatWon(s.target)} 채우면 알림 한 번 (${served}그릇)`);
  s.update(0.01);
  ok(!s.isOver, "할당량을 채워도 손님이 남았으면 계속 영업");
  s.seats[0] = new CustomerLogic("normal", ["tteokbokki"]);
  s.tray[0] = { menu: "tteokbokki", quality: Q.PERFECT };
  s.serve(0, 0);
  ok(hits === 1, "할당량 알림은 하루에 한 번");
}

/** 완성 그릇 탭 = 그 메뉴를 기다리는 손님 중 인내심이 가장 적게 남은 손님에게 자동 서빙 */
function testAutoServe(): void {
  const s = new ShiftSession();
  s.setupStory(5, 2, 1.0, 1.0, 13);
  s.debugSeatCustomer(0, new CustomerLogic("normal", ["tteokbokki"]));
  s.debugSeatCustomer(1, new CustomerLogic("normal", ["sundae", "tteokbokki"]));
  s.debugSeatCustomer(2, new CustomerLogic("normal", ["odeng"]));
  s.seats[0]!.patience = 15.0;
  s.seats[1]!.patience = 6.0;
  s.seats[2]!.patience = 2.0;
  s.tray[0] = { menu: "tteokbokki", quality: Q.PERFECT };
  ok(s.bestSeatFor(0) === 1, "떡볶이 그릇 → 떡볶이 시킨 손님 중 인내심이 가장 적은 2번 자리 (어묵 손님은 제외)");
  const r = s.autoServe(0);
  ok(r.result === "ok" && r.seat === 1 && s.tray[0] === null && same(s.seats[1]!.unservedMenus(), ["sundae"]), "그릇 탭 한 번에 그 손님에게 서빙");
  s.tray[0] = { menu: "tteokbokki", quality: Q.PERFECT };
  ok(s.autoServe(0).seat === 0, "다음 떡볶이는 남은 떡볶이 손님(1번 자리)에게");
  s.tray[1] = { menu: "tteokbokki", quality: Q.PERFECT };
  ok(s.autoServe(1).result === "none" && s.tray[1] !== null, "떡볶이 기다리는 손님이 없으면 그릇은 그대로");
  const t = new ShiftSession();
  t.setupStory(5, 2, 1.0, 1.0, 13);
  t.debugSeatCustomer(0, new CustomerLogic("normal", ["twigim"]));
  t.tray[6] = { menu: "twigim", quality: Q.BURNT };
  const rb = t.autoServe(6);
  ok(rb.result === "ok" && rb.reason === "burnt" && rb.paid === D.burntPrice("twigim") && t.tray[6] === null, `탄 튀김을 탭하면 손님이 투덜대며 받고 값은 반만 (${D.formatWon(D.burntPrice("twigim"))})`);
  t.debugSeatCustomer(1, new CustomerLogic("normal", ["twigim"]));
  t.tray[7] = { menu: "twigim", quality: Q.RAW };
  ok(t.autoServe(7).result === "angry", "덜 익은 튀김을 탭하면 손님이 화남");
}

/** 손님이 떠나면 손님 간격과 상관없이 다음 손님이 바로 온다 */
function testRefill(): void {
  const s = new ShiftSession();
  s.setupStory(1, 2, 1.0, 1.0, 9);
  s.update(D.FIRST_SPAWN_DELAY + 0.1);
  let seat = -1;
  for (let i = 0; i < D.SEATS; i++) if (s.seats[i] !== null) seat = i;
  ok(seat >= 0 && s.spawned === 1, "첫 손님 입장");
  const c = s.seats[seat]!;
  for (const it of c.items.map((x) => ({ ...x }))) {
    const slot = s.freeTraySlot(it.menu);
    s.tray[slot] = { menu: it.menu, quality: Q.PERFECT };
    s.serve(slot, seat);
  }
  ok(s.seats[seat] === null, "주문을 다 받은 손님은 떠남");
  let waited = 0.0;
  while (s.seats[seat] === null && waited < 20.0) {
    s.update(0.05);
    waited += 0.05;
  }
  ok(s.seats[seat] !== null && s.spawned === 2, "떠난 자리에 다음 손님이 옴");
  ok(waited >= D.SEAT_REFILL_MIN - 0.01 && waited <= D.SEAT_REFILL_MAX + 0.1 && waited < s.spawnInterval, `다음 손님은 ${D.SEAT_REFILL_MIN}~${D.SEAT_REFILL_MAX}초 뒤 (${waited.toFixed(1)}초)`);
  ok(approx(D.SEAT_REFILL_MIN, 0.9) && approx(D.SEAT_REFILL_MAX, 0.9) && D.ARRIVAL_GAP === 0.0, "손님 오는 템포는 원래대로 (떠나면 0.9초 뒤 바로, 최소 간격 없음)");

  for (const lv of [1, 5, 35]) {
    const day = new ShiftSession();
    day.setupStory(lv, 2, 1.0, 1.0, 21);
    const times: number[] = [];
    day.customerArrived.connect(() => times.push(day.elapsed));
    const bot = new ShiftBot();
    let g = 0;
    while (!day.isOver && g < 100000) {
      day.update(0.05);
      bot.step(day, 0.05);
      g += 1;
    }
    let minGap = Infinity;
    for (let i = 1; i < times.length; i++) minGap = Math.min(minGap, times[i] - times[i - 1]);
    ok(times.length === day.customersTotal && minGap >= D.ARRIVAL_GAP - 0.06, `레벨 ${lv}: 손님 ${times.length}명 (가장 짧은 간격 ${minGap.toFixed(1)}초, 하루 ${day.elapsed.toFixed(0)}초)`);
  }
}

function testEndless(): void {
  const s = new ShiftSession();
  s.setupEndless("pocha", 2, 1.0, 1.0, 5);
  let guard = 0;
  while (!s.isOver && guard < 20000) {
    s.update(0.1);
    guard += 1;
  }
  ok(s.isOver && s.lives === 0, "무한 영업: 화난 손님 3명이면 끝");
  ok(s.menuPool.length === D.MAX_MENUS && s.customerTypes.length === 5, "무한 영업은 전체 메뉴(4개)·손님");
  const b = new ShiftSession();
  b.setupEndless("beach", 2, 1.0, 1.0, 5);
  ok(b.menuPool.includes("clam") && !b.menuPool.includes("odeng") && b.stationCapacity("grill") === 5 && !("pot" in b.stations), "해변 무한 영업 = 해변 메뉴, 석쇠 3칸 + 2칸");
}

function testFormat(): void {
  ok(D.formatWon(15000) === "15,000원", "금액 포맷");
  ok(D.formatWon(-900) === "-900원", "음수 포맷");
  ok(D.formatTime(180.0) === "3:00" && D.formatTime(5.2) === "0:06", "시간 포맷");
  ok(D.josa("스테이지 10", "을", "를") === "을" && D.josa("스테이지 15", "을", "를") === "를" && D.josa("야시장 푸드트럭", "을", "를") === "을" && D.josa("해변 포장마차", "을", "를") === "를", "조사 (스테이지 10을 / 15를)");
}

function testShops(): void {
  ok(D.LEVEL_TARGETS.length === D.TOTAL_LEVELS, "목표 표 길이 = 전체 레벨 수");
  ok(D.SHOPS[0].first_level === 1, "첫 가게는 레벨 1부터");
  ok(D.SHOPS[D.SHOPS.length - 1].last_level === D.TOTAL_LEVELS, "마지막 가게가 마지막 레벨까지");
  const opens: number[] = [];
  D.SHOPS.forEach((shop, i) => {
    const sid = shop.id;
    if (i > 0) {
      ok(shop.first_level === D.SHOPS[i - 1].last_level + 1, `${sid}: 앞 가게 마지막 레벨 바로 다음에 오픈`);
      opens.push(shop.first_level);
    }
    ok(D.shopLevelCount(shop) === D.LEVELS_PER_SHOP, `${sid}: 레벨 ${D.LEVELS_PER_SHOP}개`);
    const menus = D.shopMenus(sid);
    ok(menus.length >= 2 && menus.length <= D.MAX_MENUS, `${sid}: 메뉴 ${menus.length}개`);
    const kinds = D.shopStationKinds(shop);
    let firstMenus = 0;
    const used: Record<string, boolean> = {};
    for (const m of menus) {
      const def = D.MENUS[m];
      const ud = D.menuUnlockLevel(m);
      ok(ud >= shop.first_level && ud <= shop.last_level - 1, `${m}: 가게 레벨 안에서 열림`);
      if (ud === shop.first_level) firstMenus += 1;
      const st = def.station;
      used[st] = true;
      ok(kinds.includes(st) || st === D.STATION_BOARD, `${m}: 이 가게에 있는 조리도구(${st})`);
      const steps = def.steps;
      if (st === D.STATION_BOARD) {
        ok(steps.length === 0 && D.usesBoard(m), `${m}: 도마 메뉴는 조리 단계 없이 도마 손질만`);
        continue;
      }
      ok(steps.length > 0 && steps[steps.length - 1].tap === "take_out", `${m}: 마지막 단계는 꺼내기`);
      steps.forEach((stp, k) => {
        if (k < steps.length - 1) ok(stp.tap !== "take_out", `${m}: 중간 단계 탭은 다음 단계로`);
        if (stp.kind === "cook") ok(stp.ripe! <= stp.perfect_start! && stp.perfect_start! < stp.perfect_end!, `${m}: 단계 ${k} 시간 순서`);
      });
    }
    ok(firstMenus >= 1, `${sid}: 첫 레벨부터 메뉴가 있음`);
    for (const e of D.shopLayout(shop)) {
      if (e.kind !== D.STATION_BURNER) ok(used[e.kind] === true, `${sid}: ${e.title}를 쓰는 메뉴가 있음`);
    }
  });
  ok(same(opens, [8, 15, 22, 29]) && D.LEVELS_PER_SHOP === 7 && D.TOTAL_LEVELS === 35, "가게마다 스테이지 7개, 새 가게는 8·15·22·29부터");
  ok(D.shopForLevel(7).id === "pocha" && D.shopForLevel(8).id === "bunsik", "스테이지 7 포장마차 → 8 분식집");
  ok(D.shopForLevel(35).id === "suljip" && D.levelInShop(29) === 1 && D.levelName(23) === "스테이지 23", "29 = 실내 포차 첫 스테이지, 이름은 이어지는 번호");
  const expect: Record<string, string[]> = {
    pocha: ["떡볶이", "순대", "어묵", "튀김"],
    bunsik: ["라면", "김밥", "돈까스", "쫄면"],
    market: ["회오리감자", "호떡", "닭강정", "핫도그"],
    beach: ["조개구이", "새우구이", "오징어구이", "해물파전"],
  };
  for (const sid of Object.keys(expect)) {
    ok(same(D.shopMenus(sid).map(D.menuName), expect[sid]), `${sid} 메뉴 = ${expect[sid]}`);
  }
  const market = D.shopDef("market");
  const ms = D.shopLayout(market);
  ok(
    ms.length === 6 && D.shopStationSlots(market, "fryer") === 5 &&
      ms.map((e) => e.kind).join() === "fryer,fryer,burner,burner,burner,burner" && ms[0].first === 0 && ms[1].first === 3 && ms[4].first === 2,
    "야시장 = 튀김기 3칸 · 튀김기 2칸 붙여서 / 화구 1~4 (같은 도구끼리 붙임)",
  );
  ok(D.shopLayout(D.shopDef("beach")).map((e) => e.kind).join() === "grill,grill,burner,burner,burner,burner", "해변 = 석쇠 1·2 붙여서 / 화구 1~4");
  ok(D.shopLayout(D.shopDef("bunsik")).map((e) => e.kind).join() === "fryer,burner,burner,burner,burner,pot", "분식집 = 튀김기 / 화구 1~4 / 냄비 (다른 도구는 양옆 그대로)");
  ok(D.shopStationKinds(market).length === 2 && D.stationTitle(market, "fryer") === "튀김기", "같은 도구는 한 종류로");
  const pocha = D.shopDef("pocha");
  const pl = D.shopLayout(pocha);
  ok(same(pl.map((e) => e.kind), ["broth", "pan", "steamer", "fryer"]) && pl[0].grid === 2 && !D.shopHasBurners(pocha), "골목 포장마차 조리대 = 어묵 사각틀(2×2) / 떡볶이 판 / 순대 솥 / 튀김기, 화구 없음");
  ok(D.shopToolsText(pocha) === "어묵 사각틀 4칸 · 떡볶이 판 · 순대 솥 · 튀김기 2칸 · 도마", `새 가게 조리도구 안내 문구 (${D.shopToolsText(pocha)})`);
  ok(D.shopToolsText(D.shopDef("bunsik")) === "화구 · 튀김기 3칸 · 면 삶는 냄비 2칸 · 도마", "화구 있는 가게 안내 문구");
  ok(D.upgradeName("burners", "pocha") === "불 조절" && D.upgradeDesc("burners", 1, "pocha") === "모든 음식 완벽 구간 +30%", "포장마차의 화구 추가 자리 = 불 조절 (모든 음식 완벽 구간)");
  ok(D.upgradeName("burners", "bunsik") === "화구 추가" && D.upgradeDesc("burners", 0, "bunsik") === "화구 3칸", "다른 가게는 화구 추가 그대로");
  ok(D.starsFor(0.0) === 1 && D.starsFor(0.5) === 3 && D.starsFor(0.75) === 4 && D.starsFor(1.0) === D.MAX_STARS && D.MAX_STARS === 5, "별점 1~5개 (5개 만점)");
  ok(D.LEVEL_CUSTOMERS.length === D.TOTAL_LEVELS, "손님 수 표 길이 = 전체 레벨 수");
  ok(D.levelConfig(1).customers === 5 && D.levelConfig(D.TOTAL_LEVELS).customers === 15, "첫날 손님 5명 → 마지막 15명");
  for (let lv = 2; lv <= D.TOTAL_LEVELS; lv++) {
    const cfg = D.levelConfig(lv);
    const prev = D.levelConfig(lv - 1);
    ok(cfg.target > prev.target, `레벨 ${lv}: 할당량이 앞 레벨보다 큼`);
    ok(cfg.customers >= prev.customers, `레벨 ${lv}: 손님 수가 앞 레벨보다 적지 않음`);
  }
  ok(D.SHOPS.reduce((n, s) => n + s.menus.length, 0) === Object.keys(D.MENUS).length, "모든 메뉴는 가게 하나에만 속함");
  ok(D.upgradeCost("burners", 0, "pocha") === 5000 && D.upgradeCost("burners", 0, "suljip") > 5000 * 5, "업그레이드 가격은 가게가 바뀔수록 비쌈");
  // 2026-11-18 사용자 "항목별로 업그레이드 5번, 가격은 점점 비싸지고"
  for (const id of D.UPGRADE_ORDER) {
    const lv = D.UPGRADES[id].levels;
    ok(lv.length === 5, `${id} 업그레이드 5단계`);
    for (const shop of D.SHOPS) {
      const c = lv.map((_, i) => D.upgradeCost(id, i, shop.id));
      ok(c.every((x, i) => i === 0 || x > c[i - 1]), `${shop.id} ${id} 단계마다 더 비쌈 (${c})`);
    }
    ok(lv.every((e, i) => i === 0 || e.value > lv[i - 1].value), `${id} 단계마다 효과가 커짐`);
  }
  ok([1, 2, 3, 4, 5].map((n) => D.burnersFor(D.UPGRADES.burners.levels[n - 1].value)).join() === "3,4,4,4,4", "화구 칸은 4칸까지 (그 뒤 단계는 불 조절)");
  ok([3, 4, 5].map((n) => D.burnerPerfectBonus(D.UPGRADES.burners.levels[n - 1].value)).join() === "0.25,0.5,0.75", "3~5단계 불 조절 = 완벽 구간 +25% / +50% / +75%");
  ok(D.upgradeDesc("burners", 4, "pocha") === "모든 음식 완벽 구간 +75%" && D.upgradeDesc("burners", 4, "bunsik") === "불 조절: 완벽 구간 +75%", "5단계: 포장마차 모든 음식 +75% / 화구 불 조절 +75%");
  ok(D.migrateUpgradeLevel("heat", 1) === 2 && D.migrateUpgradeLevel("heat", 2) === 4 && D.migrateUpgradeLevel("stove", 1) === 3 && D.migrateUpgradeLevel("burners", 2) === 2, "옛 단계 → 같은 효과 단계");
  ok(approx(D.UPGRADES.heat.levels[1].value, 0.15) && approx(D.UPGRADES.heat.levels[3].value, 0.3) && approx(D.UPGRADES.stove.levels[2].value, 0.2), "옛 효과(-15%·-30%·+20%)가 새 표에 그대로");
}

function testNewMenus(): void {
  const s = new ShiftSession();
  s.setupStory(8, 2, 0.7, 1.0, 1);
  ok(same(s.menuPool, ["ramen"]), "분식집 레벨 1 메뉴 = 라면");
  ok(s.stationCapacity("fryer") === 3 && s.stationCapacity("pot") === 2 && s.stationCapacity("broth") === 0, "분식집 = 튀김기 3칸 + 냄비 2칸, 국물통 없음");
  ok(s.addIngredient("odeng") === -1 && s.addIngredient("donkatsu") === -1, "분식집 레벨 1: 어묵 없음, 돈까스 잠김");

  const dn = new ShiftSession();
  dn.setupStory(10, 2, 0.7, 1.0, 1);
  ok(dn.addIngredient("donkatsu") === 0 && dn.addIngredient("donkatsu") === 1 && dn.addIngredient("donkatsu") === 2 && dn.addIngredient("donkatsu") === -1, "돈까스: 튀김기 3칸");
  ok(approx(dn.stationItem("fryer", 0)!.timeScale, 0.7), "화력 강화는 튀김기에도 적용");
  const dt = new CookItem("donkatsu");
  run(dt, 7.0);
  ok(dt.tap().quality === Q.PERFECT, "돈까스 7초 = 완벽");

  const g = new ShiftSession();
  g.setupStory(9, 2, 1.0, 1.0, 1);
  ok(g.addIngredient("gimbap") === 0 && g.cutting!.menu === "gimbap", "김밥은 재료통에서 바로 도마로");
  ok(g.addIngredient("gimbap") === -1, "도마가 차 있으면 김밥을 더 못 올림");
  const gsteps = [0, 1, 2, 3].map((k) => D.boardStepVerb("gimbap", k));
  ok(same(gsteps, ["밥 올리기", "재료 올리기", "말기", "썰기"]) && D.boardTaps("gimbap") === 4, "김밥 도마 단계 = 밥 올리기 → 재료 올리기 → 말기 → 썰기");
  ok(D.boardStepVerb("sundae", 1) === "썰기" && D.boardSteps("sundae").length === 0, "단계 없는 도마 메뉴는 동사 그대로");
  ok(g.tapCutting().action === "cut" && g.cutting!.taps === 1, "김밥 1번째 탭 = 밥 올리기");
  ok(g.tapCutting().action === "cut" && g.tapCutting().action === "cut" && g.cutting!.taps === 3, "김밥 2·3번째 탭 = 재료 올리기, 말기");
  const gp = g.tapCutting();
  ok(gp.action === "plated" && g.tray[gp.slot!]!.quality === Q.PERFECT, "김밥 4번째 탭에 완성(불 없이 항상 완벽)");

  const mk = new ShiftSession();
  mk.setupStory(15, 2, 1.0, 1.0, 1);
  ok(same(mk.menuPool, ["tornado"]) && !mk.stationInUse("burner"), "야시장 레벨 1 = 회오리감자만, 화구는 아직 안 씀");
  for (let i = 0; i < 5; i++) ok(mk.addIngredient("tornado") === i, `야시장 튀김기 ${i}번 칸`);
  ok(mk.addIngredient("tornado") === -1, "야시장 튀김기는 5칸");

  const dk = new ShiftSession();
  dk.setupStory(17, 2, 1.0, 1.0, 1);
  const di = dk.addIngredient("dakgangjeong");
  cookFor(dk, 7.0);
  const dko = dk.tapStation("fryer", di);
  ok(dko.action === "take_out" && dk.cutting === null && dk.tray[dko.slot!]!.menu === "dakgangjeong", "닭강정: 다 튀기면 도마 없이 바로 완성 칸으로 (2026-11-22)");
  ok(!D.usesBoard("dakgangjeong"), "닭강정은 도마를 안 씀");

  const bc = new ShiftSession();
  bc.setupStory(25, 2, 1.0, 1.0, 1);
  ok(bc.stationCapacity("grill") === 5 && bc.addIngredient("pajeon") === 0 && bc.stationInUse("burner"), "해변 레벨 4: 석쇠 5칸 + 해물파전은 화구");

  const sj = new ShiftSession();
  sj.setupStory(30, 2, 1.0, 1.0, 1);
  ok(sj.addIngredient("dakbal") === 0 && sj.stationCapacity("grill") === 2 && sj.stationCapacity("pot") === 3, "실내 포차: 닭발은 석쇠 2칸, 찌개 냄비 3칸");

  const eg = new CookItem("egg_roll");
  for (let k = 0; k < 2; k++) {
    run(eg, 3.0);
    ok(eg.tap().action === "roll", `계란말이 ${k + 1}번째 말기`);
  }
  run(eg, 2.5);
  ok(eg.tap().quality === Q.PERFECT && eg.sideQualities.length === 3, "계란말이 3단계 완벽");

  const bd = new CookItem("budae");
  run(bd, 30.0);
  ok(!bd.burnt && bd.stepQuality() === Q.COOKED, "부대찌개는 타지 않음");
  bd.tap();
  run(bd, 4.0);
  ok(bd.tap().quality === Q.COOKED, "부대찌개 오래 끓이면 익음(팁 없음)");
}

function result(lv: number, passed: boolean, revenue = 50000, stars = 2, endless = false) {
  return {
    level: lv, shop: D.shopForLevel(lv).id, endless, revenue, passed, stars, regulars: [] as string[],
    sales: revenue, tips: 0, waste: 0, target: 0, perfect_ratio: 0, items_ordered: 0, items_perfect: 0, happy: 0, angry: 0, customers: 0, elapsed: 0,
  };
}

function newState(): GameStateClass {
  const g = new GameStateClass();
  g.saveEnabled = false;
  return g;
}

function testGameState(): void {
  const gs = newState();
  gs.level = 7;
  gs.wallet = 100000;
  ok(gs.buyUpgrade("burners", "pocha") && gs.burnerCount("pocha") === 3, "포장마차 떡볶이 판 키우기 (화구 추가 자리)");
  ok(gs.nextUpgrade("burners", "pocha")!.desc === "모든 음식 완벽 구간 +30%", "다음 불 조절 설명");
  gs.recordResult(result(7, true, 80000, 2));
  gs.settle(false, false);
  ok(gs.level === 7 && gs.justOpened === "" && gs.justShopCleared === "pocha" && !gs.shopOpened("bunsik"), "스테이지 7 클리어해도 분식집은 저절로 안 열림");
  ok(gs.shopCleared("pocha") && gs.canBuyShop("bunsik") && gs.nextBuyableShop() === "bunsik" && !gs.canBuyShop("market"), "포장마차를 다 깨면 무한 영업이 열리고 분식집을 살 수 있음 (야시장은 아직)");
  const cost = D.shopOpenCost("bunsik");
  gs.wallet = cost - 1000;
  ok(!gs.buyShop("bunsik") && gs.level === 7 && gs.wallet === cost - 1000, "돈이 모자라면 못 삼");
  gs.wallet = cost + 30000;
  ok(gs.buyShop("bunsik") && gs.wallet === 30000 && gs.level === 8 && gs.justOpened === "bunsik" && gs.currentMapShop() === "bunsik", `분식집 ${D.formatWon(cost)}에 사면 스테이지 8이 열림`);
  ok(!gs.buyShop("bunsik") && gs.wallet === 30000, "이미 연 가게는 다시 안 삼");
  const costs = D.SHOPS.map((sh) => D.shopOpenCost(sh.id));
  let rising = true;
  for (let i = 1; i < costs.length; i++) rising = rising && costs[i] > costs[i - 1];
  ok(rising && costs[0] === 0, `가게 여는 값은 뒤 가게일수록 비쌈 (${costs})`);
  gs.wallet = 100000;
  ok(gs.burnerCount("bunsik") === 2, "새 가게는 화구 2칸부터 (장비는 가게마다 따로)");
  ok(gs.nextUpgrade("burners", "bunsik")!.cost === D.upgradeCost("burners", 0, "bunsik"), "분식집 업그레이드 가격");
  ok(gs.shopCleared("pocha") && !gs.shopCleared("bunsik") && !gs.shopOpened("market"), "포장마차 클리어, 분식집 영업 중, 야시장 잠김");
  ok(gs.starsOf(7) === 2 && gs.levelCleared(7) && !gs.levelCleared(8) && gs.levelOpen(8) && !gs.levelOpen(9), "별·깬 스테이지·열린 스테이지");
  gs.recordResult(result(8, false, 10000, 1));
  gs.settle(false, false);
  ok(gs.level === 8 && gs.justOpened === "" && !gs.levelCleared(8), "목표 미달이면 다음 스테이지가 안 열림");
  gs.recordResult(result(8, false, 10000, 1));
  gs.settle(false, true);
  ok(gs.level === 9 && gs.starsOf(8) === 1 && gs.justUnlocked === 9, "광고로 통과하면 별 1개 + 다음 스테이지");
  gs.recordResult(result(3, true, 60000, 3));
  gs.settle(false, false);
  ok(gs.level === 9 && gs.starsOf(3) === 3 && gs.justUnlocked === 0, "이미 깬 스테이지를 다시 하면 별만 갱신");
  gs.recordResult(result(10, true, 77000, 1, true));
  ok(gs.bestEndlessFor("bunsik") === 77000 && gs.bestEndlessFor("pocha") === 0, "무한 영업 최고 기록은 가게별");
  gs.level = D.TOTAL_LEVELS;
  gs.recordResult(result(D.TOTAL_LEVELS, true, 400000, 3));
  gs.settle(false, false);
  ok(gs.storyCleared && gs.justCleared && gs.level === D.TOTAL_LEVELS, "마지막 레벨 클리어 = 완주");

  const v1 = newState();
  v1.applySave({ day: 5, story_cleared: true, wallet: 1234, upgrades: { burners: 2, heat: 1, stove: 0 }, best_endless: 50000, day_stars: { "1": 3 } });
  ok(v1.level === 8 && !v1.storyCleared && v1.starsOf(1) === 5, "옛 저장(5일 완주) → 분식집 스테이지 8부터, 별 3개 → 5개");
  ok(v1.upgradeLevel("burners", "pocha") === 2 && v1.bestEndlessFor("pocha") === 50000 && v1.wallet === 1234, "옛 업그레이드·기록은 포장마차 것으로");
  const v2 = newState();
  v2.applySave({ version: 2, day: 9, wallet: 5, day_stars: { "7": 3, "8": 2 }, upgrades: { bunsik: { burners: 1 } }, best_endless: { pocha: 9 } });
  ok(v2.level === 10 && v2.starsOf(8) === 5 && v2.starsOf(9) === 3, "버전 2(분식집 3일차) → 분식집 3번째(스테이지 10), 별 3·2개 → 5·3개");
  ok(v2.burnerCount("bunsik") === 3 && v2.bestEndlessFor("pocha") === 9, "버전 2 업그레이드·기록 유지");
  const v3 = newState();
  v3.applySave({ version: 3, level: 14, wallet: 7, level_stars: { "1": 2, "2": 3, "11": 3, "12": 1, "13": 2 }, upgrades: { pocha: { heat: 2 } } });
  ok(v3.level === 11 && v3.starsOf(1) === 3 && v3.starsOf(2) === 5 && v3.starsOf(8) === 5 && v3.starsOf(9) === 1 && v3.starsOf(10) === 3, "버전 3(레벨 10개씩) → 7개로 줄여 옮김, 별은 5개 만점으로");
  ok(v3.upgradeLevel("heat", "pocha") === 4 && approx(v3.heatScale("pocha"), 0.7) && v3.wallet === 7, "버전 3 업그레이드(화력 -30%)·지갑 유지 → 5단계 표의 같은 효과 단계(4)");
  const v3b = newState();
  v3b.applySave({ version: 3, level: 10, level_stars: { "8": 2, "9": 3 } });
  ok(v3b.level === 7 && !v3b.levelCleared(7) && v3b.starsOf(6) === 3, "버전 3 포장마차 레벨 10 도전 중 → 스테이지 7 도전");
  const v3c = newState();
  v3c.applySave({ version: 3, level: 50, story_cleared: true, level_stars: { "50": 3 } });
  ok(v3c.storyCleared && v3c.level === D.TOTAL_LEVELS && v3c.starsOf(35) === 5, "버전 3 완주 → 완주 유지");
  const v4 = newState();
  v4.applySave({ version: 4, level: 6, level_stars: { "1": 3, "2": 2, "3": 1, "4": 3, "5": 3 } });
  ok(v4.level === 8 && v4.starsOf(1) === 5 && v4.starsOf(2) === 3 && v4.starsOf(3) === 1, "버전 4 (별 3개 만점, 가게마다 5스테이지) → 1·3·5개, 분식집 첫 스테이지 = 8");
  ok(approx(v4.shopRating("pocha"), 19.0 / 7.0) && v4.shopRating("bunsik") === 0.0, "가게 별점 = 스테이지 7개 별 평균, 안 깬 가게 0");
  const v5 = newState();
  v5.applySave({ version: 5, level: 3, level_stars: { "1": 4, "2": 2 } });
  ok(v5.starsOf(1) === 4 && v5.starsOf(2) === 2 && v5.level === 3 && approx(v5.shopRating("pocha"), 6.0 / 7.0), "버전 5 별점·스테이지는 가게 안 순서 그대로");
  const v5b = newState();
  const st10: Record<string, number> = {};
  for (let k = 1; k <= 10; k++) st10[String(k)] = 5;
  v5b.applySave({ version: 5, level: 10, wallet: 424875, level_stars: st10 });
  ok(v5b.level === 13 && v5b.starsOf(12) === 5 && v5b.starsOf(8) === 5 && !v5b.levelCleared(13) && !v5b.levelCleared(6) && v5b.levelOpen(6) && v5b.shopOpened("bunsik") && v5b.shopCleared("pocha") && !v5b.shopOpened("market"), "버전 5에서 스테이지 10까지 깬 저장 → 12까지 깸, 13 도전");
  const v6 = newState();
  v6.applySave({ version: 6, level: 13, level_stars: { "12": 4 } });
  ok(v6.level === 13 && v6.starsOf(12) === 4, "버전 6은 그대로");
}

/** 로그인 / 로그아웃: 이름마다 저장 칸이 따로, 처음 만드는 계정은 게스트 기록을 가져감 */
function testAccounts(): void {
  const mem: Record<string, string> = {};
  const store = {
    getItem: (k: string) => (k in mem ? mem[k] : null),
    setItem: (k: string, v: string) => void (mem[k] = v),
    removeItem: (k: string) => void delete mem[k],
  };
  const g = new GameStateClass();
  g.store = store;
  g.loadGame();
  ok(g.account === "" && g.accounts.length === 0 && g.saveKey() === SAVE_KEY, "처음엔 게스트, 저장 칸은 예전 그대로");
  ok(nameError("") !== "" && nameError(" a ") !== "" && nameError("가나다라마바사아자차카") !== "" && nameError(" 김  사장 ") === "", "이름 길이 2~10글자, 공백은 다듬음");
  ok(!g.signUp("a", "1234").ok && g.account === "", "짧은 아이디는 가입 안 됨");
  ok(!g.login("없는사람", "1234").ok && g.account === "", "없는 아이디는 로그인 안 됨 (회원가입으로)");
  ok(!g.signUp("김사장님", "12").ok, "비밀번호는 4글자 이상");
  g.wallet = 5000;
  g.level = 3;
  g.saveGame();
  const r1 = g.signUp("  김  사장 ", "pass1");
  ok(r1.ok && r1.created && r1.carried && g.account === "김 사장" && g.level === 3 && g.wallet === 5000, "새 계정 = 게스트 기록을 옮겨 감");
  ok(!(SAVE_KEY in mem) && `${SAVE_KEY}@김 사장` in mem, "옮긴 뒤 게스트 칸은 비움");
  g.wallet = 9000;
  g.saveGame();
  g.logout();
  ok(g.account === "" && g.level === 1 && g.wallet === D.START_MONEY, "로그아웃하면 빈 게스트 (개업 자금만)");
  ok(!g.signUp("김 사장", "zzzz").ok, "이미 있는 아이디는 다시 가입 안 됨");
  const r2 = g.signUp("Lee", "leepw", false);
  ok(r2.ok && r2.created && !r2.carried && g.level === 1 && g.wallet === D.START_MONEY && g.tutorial === "start", "게스트 기록이 없으면 새 계정은 처음부터 (튜토리얼부터)");
  g.wallet = 70;
  g.logout();
  ok(!g.login("김 사장", "wrong").ok && g.account === "", "비밀번호가 틀리면 로그인 안 됨");
  const r3 = g.login("김 사장", "pass1");
  ok(r3.ok && !r3.created && g.wallet === 9000 && g.level === 3, "다시 로그인하면 그 계정 기록을 불러옴");
  ok(!JSON.stringify(JSON.parse(mem[ACCOUNTS_KEY])).includes("pass1"), "비밀번호는 그대로 저장하지 않음 (해시)");
  const g2 = new GameStateClass();
  g2.store = store;
  g2.loadGame();
  ok(g2.account === "김 사장" && g2.wallet === 9000 && g2.accounts.length === 2, "새로 켜도 로그인 상태·기록 유지");
  ok(g2.findAccount("lee") === "Lee" && g2.login("LEE", "leepw", false).ok && g2.account === "Lee" && g2.wallet === 70, "영문 대소문자는 같은 계정");
  ok(JSON.parse(mem[ACCOUNTS_KEY]).current === "Lee", "계정 목록에 지금 계정 기록");
  const g3 = new GameStateClass();
  g3.store = store;
  g3.loadGame();
  ok(g3.account === "" && g3.lastAccount === "Lee" && !g3.autoLogin, "자동 로그인을 끄고 로그인했으면 다음엔 게스트로 (아이디 칸엔 마지막 아이디)");
  ok(g3.resetPassword("lee", "newpw") === "" && !g3.login("Lee", "leepw").ok && g3.login("Lee", "newpw").ok, "비밀번호 다시 정하기 (이 기기 계정)");
  // 예전에 이름만으로 만든 계정 (비밀번호 없음): 처음 로그인할 때 적은 비밀번호가 그 계정 비밀번호
  const reg = JSON.parse(mem[ACCOUNTS_KEY]);
  reg.names.push("옛날손님");
  mem[ACCOUNTS_KEY] = JSON.stringify(reg);
  const g4 = new GameStateClass();
  g4.store = store;
  g4.loadGame();
  ok(!g4.hasPassword("옛날손님") && g4.login("옛날손님", "old1").ok && g4.hasPassword("옛날손님") && !g4.login("옛날손님", "zzzz").ok, "비밀번호 없던 예전 계정은 처음 적은 비밀번호로 정해짐");
  // 디버그 ?debug=clear 는 이 기기의 모든 저장 칸에 (게스트로 켜 놓고 나중에 로그인해도 다 깬 상태)
  const g5 = new GameStateClass();
  g5.store = store;
  g5.loadGame();
  const before = g5.account;
  g5.debugEverySlot(() => g5.debugClearAll());
  ok(g5.account === before && g5.storyCleared && g5.level === D.TOTAL_LEVELS, "디버그: 지금 계정이 다 깬 상태로 돌아옴");
  ok(["", ...g5.accounts].every((n) => JSON.parse(mem[g5.saveKey(n)]).level === D.TOTAL_LEVELS), "디버그: 게스트 + 모든 계정 저장 칸이 다 깬 상태");
  g5.logout();
  ok(g5.login("김 사장", "pass1").ok && g5.storyCleared && g5.wallet >= 1000000, "디버그 뒤 다른 계정으로 로그인해도 다 깬 상태");
}

/** 포장마차 이모: 두 번째 가게 첫 스테이지 첫 손님으로 딱 한 번 (축하 인사, 가격 무관, 완벽하면 팁 + 한마디) */
function testImo(): void {
  const bl = D.shopDef(D.IMO_SHOP).first_level;
  const s = new ShiftSession();
  s.setupStory(bl, D.BASE_BURNERS, 1.0, 1.0, 7);
  s.cameo = "imo";
  s.useMarket({ ramen: "pricey" }, 3.0);
  const said: string[] = [];
  s.customerReacted.connect((_seat, kind) => said.push(kind));
  for (let i = 0; i < 600 && s.seatedCount() < 1; i++) s.update(0.1);
  const seat = s.seats.findIndex((c) => c !== null);
  const imo = s.seats[seat]!;
  ok(imo.typeId === "imo" && imo.line === D.IMO_HELLO && !imo.priceSensitive(), "두 번째 가게 첫 손님 = 이모 (축하 인사, 가격 무관)");
  for (let i = 0; i < 400 && s.seatedCount() < 3; i++) s.update(0.1);
  ok(s.seats.filter((c) => c !== null && c.typeId === "imo").length === 1, "이모는 그날 한 번만");
  const g = new GameStateClass();
  ok(g.imoComesTo(bl) && !g.imoComesTo(bl + 1) && !g.imoComesTo(1), "이모는 두 번째 가게 첫 스테이지에만");
  g.markImoVisited();
  const g2 = new GameStateClass();
  g2.applySave(JSON.parse(JSON.stringify(g.saveData())));
  ok(!g.imoComesTo(bl) && g2.imoVisited && !g2.imoComesTo(bl), "한 번 다녀가면 다시 안 옴 (저장됨)");
  ok(D.reactionLines("tip", "imo").length > 0 && D.reactionLines("imo_bye", "imo").length > 0 && !D.CUSTOMER_ORDER.includes("imo"), "이모 대사 있음, 무작위 손님에는 없음");
  void said;
}

/** 미식가 이벤트: 코스 주문·점수·늦음, 영업 세션, 한 번만 도전, 보상, 저장 */
function testEvents(): void {
  ok(D.EVENTS.length === D.SHOPS.length && D.EVENTS.every((e, i) => e.shop === D.SHOPS[i].id), "가게마다 미식가 스테이지 하나 (마지막 가게 뒤에도, 2026-11-17)");
  ok(new Set(D.EVENTS.map((e) => e.critic)).size === D.EVENTS.length && D.EVENTS.every((e) => e.critic in D.CRITICS), "미식가 스테이지마다 다른 미식가");
  ok(D.gourmetGrade(1.0) === 5 && D.gourmetGrade(0.9) === 5 && D.gourmetGrade(0.89) === 4 && D.gourmetGrade(0.0) === 1, "만족도 → 별 1~5");
  const e0 = D.EVENTS[0];
  ok(D.eventReward(e0, 5) === e0.reward && D.eventReward(e0, 0) === 0 && D.eventReward(e0, 4) === e0.reward * 0.5 && D.eventReward(e0, 3) === 0 && D.eventReward(e0, 2) === -e0.reward * 0.2 && D.eventReward(e0, 1) === -e0.reward * 0.4, "유명세 매출: 별 5 = 전부, 4 = 50%, 3 = 없음, 2·1 = 적자 (−20%·−40%), 0 = 없음");
  ok(D.FAME_RATING[1] < 0 && D.FAME_RATING[2] < 0 && D.FAME_RATING[3] > 0 && D.FAME_HEADLINES[1].includes("휴업") && D.FAME_CROWD[1].includes("문을 닫"), "별 1·2개 = 혹평 (평점이 떨어짐), 별 1개 = 당분간 휴업");
  ok(D.EVENTS.every((e) => D.gourmetReview(e.critic, 5) !== D.gourmetReview("", 5) && ["g_perfect", "g_cooked", "g_burnt", "g_raw", "g_late", "g_wrong"].every((k) => D.reactionLines(k, "gourmet", e.critic).length >= 2 && D.reactionLines(k, "gourmet", e.critic) !== D.reactionLines(k, "gourmet"))), "미식가마다 말투 (요리 한마디 · 한줄평)");

  const g = new GourmetLogic([["tteokbokki", "eomuk"], ["twigim", "sundae"]], 10.0);
  ok(g.total() === 4 && g.unservedMenus().length === 2 && g.isWaiting(), "미식가 첫 코스 주문");
  ok(g.serve("twigim", Q.PERFECT).reason === "wrong", "지금 코스에 없는 요리는 안 받음");
  const r1 = g.serve("tteokbokki", Q.PERFECT);
  ok(r1.result === "ok" && r1.reason === "g_perfect" && !r1.next && (r1.tip ?? 0) === D.tipFor("tteokbokki", D.CUSTOMERS.gourmet.tip_mult) && g.score === 3, "완벽 = 3점 + 팁 3배");
  const r2 = g.serve("eomuk", Q.RAW);
  ok(r2.result === "ok" && r2.reason === "g_raw" && (r2.paid ?? 0) === 0 && r2.next === true && g.round === 1 && g.isWaiting(), "덜 익음 = 0점, 떠나지 않고 다음 코스");
  ok(approx(g.patienceMax, 10.0 * (1.0 - D.GOURMET_PATIENCE_DECAY)) && g.unservedMenus().join() === "twigim,sundae", "다음 코스는 인내심이 조금 줄어듦");
  const rng = new Rng(1);
  ok(g.tick(5.0, rng, []) === "" && g.serve("sundae", Q.COOKED).reason === "g_cooked" && g.score === 4, "익음 = 1점");
  ok(g.tick(10.0, rng, []) === "done" && g.finished && g.missed === 1 && approx(g.finalSatisfaction(), 4 / 12), "늦으면 못 받은 요리 0점, 마지막 코스면 끝");

  const s = new ShiftSession();
  s.setupEvent("bunsik", 2, 1.0, 1.0, 7);
  ok(s.event && s.menuPool.length === D.shopMenus("bunsik").length && s.customersTotal === 1, "이벤트 영업 = 그 가게 모든 메뉴 + 미식가 한 명");
  s.update(D.FIRST_SPAWN_DELAY + 0.1);
  const gm = s.gourmet;
  const eb = D.eventFor("bunsik")!;
  ok(gm !== null && s.seats[D.GOURMET_SEAT] === gm && s.seatedCount() === 1 && s.itemsOrdered === D.eventDishes(eb), "미식가는 가운데 자리에 혼자");
  ok(gm!.rounds.length === eb.rounds && gm!.rounds.every((r) => r.length === eb.perRound && new Set(r).size === r.length), "코스마다 서로 다른 메뉴");
  s.update(eb.patience + 0.1);
  ok(gm!.round === 1 && gm!.missed === eb.perRound && !s.isOver, "늦으면 다음 코스로 (미식가는 안 떠남)");
  for (let k = 0; k < 200 && !s.isOver; k++) s.update(1.0);
  const res = s.result();
  ok(s.isOver && res.event === true && res.passed && res.gourmet!.grade === 1 && res.gourmet!.missed === D.eventDishes(eb) && res.stars === 1, "아무것도 못 내면 코스가 끝나고 별 1개");

  const gs = newState();
  gs.level = 7;
  ok(!gs.eventOpen("pocha") && !gs.eventOpen("suljip"), "가게 마지막 스테이지를 깨기 전엔 잠김");
  gs.levelStars["7"] = 3;
  ok(gs.eventOpen("pocha") && !gs.eventPlayed("pocha"), "마지막 스테이지를 깨면 열림");
  gs.chooseEvent("pocha");
  gs.startEvent("pocha");
  ok(gs.mode === "event" && gs.eventPlayed("pocha") && !gs.eventOpen("pocha") && gs.eventGrade("pocha") === 0, "시작하는 순간 기회를 씀 (한 번만)");
  const gr = { grade: 4, satisfaction: 0.8, reward: D.eventReward(e0, 4), perfect: 10, cooked: 2, bad: 1, missed: 2, total: 15 };
  gs.wallet = 1000;
  gs.recordResult({ ...result(7, true, 30000, 4), event: true, gourmet: gr });
  gs.settle(false, false);
  ok(gs.eventGrade("pocha") === 4 && gs.wallet === 1000 + 30000 + gr.reward && gs.level === 7 && gs.justShopCleared === "", "결과: 별 기록 + 요리 값과 보상을 지갑에, 스테이지 진행은 그대로");
  const loaded = newState();
  loaded.applySave(JSON.parse(JSON.stringify(gs.saveData())));
  ok(loaded.eventPlayed("pocha") && loaded.eventGrade("pocha") === 4 && !loaded.eventPlayed("bunsik"), "저장해도 이벤트 기록 유지");
  loaded.debugResetEvents();
  ok(!loaded.eventPlayed("pocha") && loaded.eventOpen("pocha") && loaded.eventGrade("pocha") === 0, "디버그 ?debug=events: 미식가 스테이지를 안 한 걸로 (다시 열림)");

  // 봇: 빠르고 정확하면 별 4~5개, 아주 느리면 5개는 못 받음 (보스답게)
  for (const e of D.EVENTS) {
    let fast = 9;
    let slow = 0;
    for (const seed of [11, 22, 33]) {
      fast = Math.min(fast, ShiftBot.playEvent(e.shop, 2, 1.0, 1.0, seed, 0.35).gourmet!.grade);
      slow = Math.max(slow, ShiftBot.playEvent(e.shop, 2, 1.0, 1.0, seed, 1.5).gourmet!.grade);
    }
    ok(fast >= 4 && slow <= 4, `미식가 이벤트 ${e.shop}: 잘하면 별 4~5개 (${fast}), 느리면 5개는 어려움 (${slow})`);
  }
}

/** 도마 옆 대기 줄 (2026-11-22 "닭강정 다 튀겨지면 꺼내야 하는데 안 눌러짐"): 도마가 바빠도 튀김기에서 꺼낼 수 있음 */
function testBoardQueue(): void {
  const s = new ShiftSession();
  s.setupStory(5, 2, 1.0, 1.0, 5);
  ok(s.addIngredient("sundae") === 0, "순대 재료 → 큰 솥");
  for (let k = 0; k < 6 * 60; k++) s.update(1 / 60);
  const r0 = s.tapStation("steamer", 0);
  ok(r0.action === "to_board" && s.cutting !== null && s.boardQueue.length === 0, "첫 순대 → 도마");
  const r1 = s.tapStation("steamer", 0);
  ok(r1.action === "to_board" && s.boardQueue.length === 1, "도마가 써는 중이어도 다음 순대를 꺼낼 수 있음 (도마 옆에서 기다림)");
  s.tapStation("steamer", 0);
  s.tapStation("steamer", 0);
  ok(s.boardQueue.length === D.BOARD_QUEUE_MAX && s.stationItem("steamer", 0) === null, `도마 옆 대기는 ${D.BOARD_QUEUE_MAX}그릇까지 (솥 4그릇 다 꺼냄)`);
  ok((s.supplyCounts().sundae ?? 0) === 4, "대기 중인 그릇도 만들어 둔 수에 셈");
  s.addIngredient("sundae");
  for (let k = 0; k < 6 * 60; k++) s.update(1 / 60);
  const r4 = s.tapStation("steamer", 0);
  ok(r4.action === "blocked" && r4.reason === "board" && s.stationItem("steamer", 0)!.portions === D.STEAMER_PORTIONS, "대기 줄이 꽉 차면 그때만 못 꺼냄");
  for (let k = 0; k < D.boardTaps("sundae"); k++) s.tapCutting();
  ok(s.cutting !== null && s.boardQueue.length === D.BOARD_QUEUE_MAX - 1, "도마 일이 끝나면 기다리던 순대가 도마로 올라감");
  ok(s.discardCutting() >= 0 && s.cutting !== null && s.boardQueue.length === D.BOARD_QUEUE_MAX - 2, "도마 음식을 버려도 다음 차례가 올라감");
}

/** 단골 6명 (가게마다 새 단골 2·1·1·1·1명), 재료 (사기·쓰기·품절·외상·저장), 튜토리얼 상태 */
function testRegularsAndStock(): void {
  ok(D.REGULARS.length === 6 && D.REGULARS.some((r) => r.id === "cafe"), "단골 6명 (카페 알바생 수아 추가)");
  const counts = D.SHOPS.map((s) => D.regularsNewAt(s.id).length);
  ok(same(counts, [2, 1, 1, 1, 1]), `가게마다 새 단골 2·1·1·1·1명 (${counts})`);
  ok(same(D.SHOPS.map((s) => D.regularsFor(s.id).length), [2, 3, 4, 5, 6]), "뒤 가게엔 앞에서 만난 단골이 다 옴 (2·3·4·5·6명)");
  const pick = (sid: string, n: number): Set<string> => {
    const s = new ShiftSession();
    s.setupStory(D.shopDef(sid).first_level, 2, 1.0, 1.0, 3);
    const seen = new Set<string>();
    for (let i = 0; i < n; i++) seen.add(s.pickRegular()!.id);
    return seen;
  };
  ok(same([...pick("pocha", 80)].sort(), ["guard", "taxi"]), "첫 가게 단골은 택시 기사 + 경비 아저씨 두 명");
  const b = pick("bunsik", 300);
  ok(b.size === 3 && b.has("cafe") && b.has("guard") && b.has("taxi"), `두 번째 가게: 택시 기사 + 경비 아저씨 + 수아 (${[...b]})`);
  ok(pick("beach", 600).size === 5 && !pick("beach", 600).has("office"), "네 번째 가게엔 다섯 명 (김 대리는 아직)");
  ok(pick("suljip", 800).size === 6, "다섯 번째 가게엔 여섯 명 모두");
  // 단골은 하루에 한 번만 (같은 단골이 또 오거나 동시에 둘이 앉지 않음)
  {
    const s2 = new ShiftSession();
    s2.setupStory(D.shopDef("suljip").first_level, 2, 1.0, 1.0, 8); // 마지막 가게 = 단골 6명 모두
    s2.customerTypes = ["regular"];
    const spawn = (s2 as unknown as { spawnCustomer(seat: number): void }).spawnCustomer.bind(s2);
    const got: string[] = [];
    let normals = 0;
    for (let i = 0; i < 12; i++) {
      spawn(i % D.SEATS);
      const c = s2.seats[i % D.SEATS]!;
      if (c.typeId === "regular") got.push(c.regularId);
      else normals++;
      s2.seats[i % D.SEATS] = null;
    }
    ok(got.length === 6 && new Set(got).size === 6 && normals === 6, `단골 6명이 하루에 한 번씩만, 그다음은 보통 손님 (${got.join(",")})`);
  }

  // 재료: 1인분 값 = 메뉴 값의 25% (50원 단위)
  ok(D.ingredientCost("tteokbokki") === 750 && D.ingredientCost("odeng") === 400, "1인분 재료값");
  const need1 = D.stockNeed(1);
  ok(same(Object.keys(need1), ["tteokbokki"]) && need1.tteokbokki >= 8 && need1.tteokbokki <= D.STOCK_MAX, `스테이지 1 하루 재료 어림 (${need1.tteokbokki}인분)`);

  const s = new ShiftSession();
  s.setupStory(3, 2, 1.0, 1.0, 9);
  s.useStock({ tteokbokki: 6, sundae: 0, odeng: 2 });
  const pan = s.addIngredient("tteokbokki");
  ok(pan >= 0 && s.stockLeft("tteokbokki") === 6 - D.PAN_PORTIONS && s.stationItem("pan", pan)!.portions === D.PAN_PORTIONS, "떡볶이 한 판 = 그릇 수만큼 재료를 씀");
  ok(s.addIngredient("sundae") === -2, "재료가 없으면 못 올림 (-2)");
  s.addIngredient("odeng");
  s.addIngredient("odeng");
  ok(s.stockLeft("odeng") === 0 && s.addIngredient("odeng") === -2, "어묵 2인분 다 씀");
  ok(s.soldOut("sundae") && !s.soldOut("odeng"), "재료도 만든 것도 없으면 품절 (어묵은 칸에 있음)");
  for (let i = 0; i < 60; i++) {
    (s as unknown as { spawnCustomer(seat: number): void }).spawnCustomer(0);
    ok(!s.seats[0]!.unservedMenus().includes("sundae"), "품절 메뉴는 주문 안 함");
    s.seats[0] = null;
  }
  const disc = s.discardStation("pan", pan);
  ok(disc === 0 && s.waste === 0 && s.wasted === D.PAN_PORTIONS, "재료를 사서 쓰면 버려도 돈은 안 빠짐 (그릇 수만 셈)");
  ok(s.result().stock_left!.tteokbokki === 6 - D.PAN_PORTIONS, "결과에 남은 재료");

  const gs = newState();
  ok(gs.wallet === D.START_MONEY && gs.tutorial === "start" && gs.stockOf("pocha", "tteokbokki") === 0, "새 게임: 개업 자금 + 튜토리얼 + 재료 없음");
  ok(D.START_MONEY === 0 && gs.tutorialFreeTotal() === 10 && gs.stockCost("pocha", "tteokbokki", 5) === 0 && gs.stockCost("pocha", "sundae", 5) > 0, "처음 돈 0원, 튜토리얼 장보기의 떡볶이 하루치만 공짜");
  ok(gs.buyStock("pocha", "tteokbokki", 10) && gs.stockOf("pocha", "tteokbokki") === 10 && gs.wallet === 0, "튜토리얼 떡볶이 10인분은 0원으로 삼");
  ok(gs.stockCost("pocha", "tteokbokki", 5) === 5 * D.ingredientCost("tteokbokki") && !gs.buyStock("pocha", "tteokbokki", 5), "공짜는 하루치까지만 (그 뒤는 돈)");
  const skip = newState();
  skip.setTutorial("");
  ok(skip.stockOf("pocha", "tteokbokki") === 10 && skip.stockCost("pocha", "tteokbokki", 5) > 0, "장보기 전에 튜토리얼을 건너뛰어도 공짜 떡볶이는 받음");
  gs.wallet = 100000;
  ok(gs.buyStock("pocha", "tteokbokki", 100) && gs.stockOf("pocha", "tteokbokki") === D.STOCK_MAX && !gs.buyStock("pocha", "tteokbokki", 5), "창고 최대까지만, 가득 차면 못 삼");
  gs.wallet = 100;
  ok(!gs.buyStock("pocha", "sundae", 5), "돈이 모자라면 못 삼");
  gs.level = 3;
  const cost = gs.shortageCost(3);
  ok(cost > 0 && gs.buyShortage(3) === cost && gs.wallet === 100 - cost && Object.keys(gs.stockShortage(3)).length === 0, "모자란 재료는 외상으로 (지갑 마이너스)");
  gs.recordResult({ ...result(3, true, 30000, 3), stock_left: { tteokbokki: 7, sundae: 1, odeng: 0, twigim: 0 } });
  gs.settle(false, false);
  ok(gs.wallet === 100 - cost + 30000 && gs.stockOf("pocha", "tteokbokki") === 7, "정산에서 외상을 갚고 남은 재료 저장");
  gs.levelStars["7"] = 5;
  gs.level = 7;
  gs.wallet = D.shopOpenCost("bunsik");
  ok(gs.buyShop("bunsik") && gs.wallet === 0 && gs.stockOf("bunsik", D.shopDef("bunsik").menus[0]) === D.NEW_SHOP_STOCK, "새 가게를 열면 첫 메뉴 재료 선물 (돈을 다 써도 영업 가능)");
  const saved = newState();
  saved.applySave(JSON.parse(JSON.stringify(gs.saveData())));
  ok(saved.stockOf("pocha", "tteokbokki") === 7 && saved.tutorial === gs.tutorial, "재료·튜토리얼 저장");
  const old = newState();
  old.applySave({ version: 6, level: 10, wallet: 5000, level_stars: { "1": 3, "7": 4 } });
  ok(old.tutorial === "" && old.stockOf("pocha", "odeng") === D.STOCK_PACK * 2 && old.stockOf("bunsik", "ramen") === D.STOCK_PACK * 2 && old.stockOf("market", "tornado") === 0, "예전 저장: 튜토리얼 건너뜀 + 열린 메뉴마다 재료 10인분");
  const fresh = newState();
  fresh.applySave({ version: 6, level: 1, wallet: D.START_MONEY });
  ok(fresh.tutorial === "start", "아무것도 안 한 저장이면 튜토리얼부터");
}

/** 팻말 (문 열기 전엔 손님 없음, 미리 조리 가능), 영업 중 재료 더 사기, 마법의 가루 */
function testSignAndMagic(): void {
  const s = new ShiftSession();
  s.setupStory(1, 2, 1.0, 1.0, 4);
  s.useStock({ tteokbokki: 10 });
  s.closeShop();
  const pan = s.addIngredient("tteokbokki");
  for (let i = 0; i < 100; i++) s.update(0.1);
  ok(s.spawned === 0 && s.seatedCount() === 0 && s.elapsed === 0, "'준비 중' 팻말이면 손님이 안 오고 시간도 안 감");
  ok(s.stationItem("pan", pan)!.stepElapsed > 9.0, "문 열기 전에도 미리 조리됨");
  s.open();
  s.update(D.FIRST_SPAWN_DELAY + 0.05);
  ok(s.spawned === 1, "팻말을 '영업 중'으로 바꾸면 첫 손님");
  s.addStock("tteokbokki", 100);
  ok(s.stockLeft("tteokbokki") === D.STOCK_MAX, "영업 중 재료 더 사기 (창고 최대까지)");

  // 마법의 가루: 빨리 익고, 완벽해지면 끝까지 완벽 (타는 메뉴도 안 탐), 값 2배
  const it = new CookItem("twigim");
  it.magic = true;
  const ps = MENUS_STEP(it).perfect_start ?? 0;
  run(it, ps / D.MAGIC_SPEED + 0.05);
  ok(it.stepQuality() === Q.PERFECT, `가루 뿌린 튀김은 ${D.MAGIC_SPEED}배 빨리 완벽`);
  run(it, 600.0);
  ok(!it.burnt && it.stepQuality() === Q.PERFECT && !it.isOvercooked(), "가루 뿌린 튀김은 오래 둬도 안 탐");
  const plain = new CustomerLogic("normal", ["tteokbokki"]);
  ok(plain.serve("tteokbokki", Q.PERFECT, true).paid === 6000, "가루 뿌린 떡볶이는 값 2배 (6,000원)");
  const m = new ShiftSession();
  m.setupStory(3, 2, 1.0, 1.0, 4);
  ok(!m.armPowder(), "가루가 없으면 준비 안 됨");
  m.powder = 1;
  ok(m.armPowder() && m.powderArmed, "가루 통 탭 → 준비");
  const p2 = m.addIngredient("tteokbokki");
  ok(m.stationItem("pan", p2)!.magic && m.powder === 0 && m.powderUsed === 1 && !m.powderArmed, "다음에 올린 판 전체에 가루, 하나 씀");
  m.addIngredient("odeng");
  ok(!m.stationItem("broth", 0)!.magic, "그다음 재료엔 안 뿌림");
  for (let i = 0; i < 40; i++) m.update(0.1);
  const r = m.tapStation("pan", p2);
  ok(r.action === "take_out" && m.tray[r.slot!]!.magic === true, "가루 뿌린 판에서 덜어 낸 그릇도 마법");
  ok(m.result().powder_used === 1, "결과에 쓴 가루");

  const gs = newState();
  gs.wallet = 20000;
  ok(gs.buyPowder() && gs.powder === 1 && gs.wallet === 20000 - D.POWDER_PRICE, `마법의 가루 하나 ${D.POWDER_PRICE}원`);
  gs.wallet = 1000000;
  for (let i = 0; i < 20; i++) gs.buyPowder();
  ok(gs.powder === D.POWDER_MAX, `가루는 ${D.POWDER_MAX}개까지`);
  gs.recordResult({ ...result(1, true, 10000, 3), powder_used: 2 });
  ok(gs.powder === D.POWDER_MAX - 2, "영업에서 쓴 가루만큼 줄어듦");
  const back = newState();
  back.applySave(JSON.parse(JSON.stringify(gs.saveData())));
  ok(back.powder === D.POWDER_MAX - 2, "가루 저장");
}

function MENUS_STEP(item: CookItem): D.StepDef {
  return item.step();
}

/** 메뉴 가격 단계 (저렴·보통·비쌈), 손님 평가, 실시간 가게 평점, 미식가 유명세 */
function testPricesAndRating(): void {
  const perfect = reviewOf({ angry: false, qualities: [Q.PERFECT], priceLevels: ["normal"], priceSensitive: true, patienceRatio: 0.6, magic: false });
  const pricey = reviewOf({ angry: false, qualities: [Q.PERFECT], priceLevels: ["pricey"], priceSensitive: true, patienceRatio: 0.6, magic: false });
  const priceyBad = reviewOf({ angry: false, qualities: [Q.COOKED], priceLevels: ["pricey"], priceSensitive: true, patienceRatio: 0.6, magic: false });
  const cheapBad = reviewOf({ angry: false, qualities: [Q.COOKED], priceLevels: ["cheap"], priceSensitive: true, patienceRatio: 0.6, magic: false });
  const normalBad = reviewOf({ angry: false, qualities: [Q.COOKED], priceLevels: ["normal"], priceSensitive: true, patienceRatio: 0.6, magic: false });
  const regPricey = reviewOf({ angry: false, qualities: [Q.COOKED], priceLevels: ["pricey"], priceSensitive: false, patienceRatio: 0.6, magic: false });
  ok(perfect.score === 5 && pricey.score < perfect.score && pricey.tag === "pricey", "비싸면 완벽해도 평가가 깎이고 '비싸요'");
  ok(priceyBad.score < pricey.score && priceyBad.score < normalBad.score, "비싼데 덜 완벽하면 더 크게 깎임");
  ok(cheapBad.score > normalBad.score && cheapBad.tag === "cheap", "저렴하면 조금 실수해도 후함 ('가성비')");
  ok(regPricey.score === normalBad.score, "단골·미식가는 가격에 영향 없음");
  ok(reviewOf({ angry: true, qualities: [], priceLevels: [], priceSensitive: true, patienceRatio: 0, magic: false }).score === 1, "화나서 떠나면 1점");
  ok(nextRating(3.0, 5.0, D.RATING_ALPHA) > 3.0 && nextRating(3.0, 1.0, D.RATING_ALPHA) < 3.0, "평점은 평가 쪽으로 조금씩");

  const s = new ShiftSession();
  s.setupStory(2, 2, 1.0, 1.0, 6);
  s.useMarket({ tteokbokki: "pricey", sundae: "cheap" }, 3.0);
  ok(s.postedPrice("tteokbokki") === 6000 && s.postedPrice("sundae") === 1750 && s.postedPrice("odeng") === D.menuPrice("odeng"), "일반 손님에게 붙는 값: 비쌈 두 배 · 저렴 반값");
  const said: string[] = [];
  const reviews: number[] = [];
  s.customerReacted.connect((_seat, kind) => said.push(kind));
  s.reviewed.connect((_seat, rv) => reviews.push(rv.score));
  const norm = new CustomerLogic("normal", ["tteokbokki"]);
  const reg = new CustomerLogic("regular", ["tteokbokki"]);
  reg.regularId = "taxi";
  s.debugSeatCustomer(0, norm);
  s.debugSeatCustomer(1, reg);
  const sl0 = s.freeTraySlot("tteokbokki");
  s.tray[sl0] = { menu: "tteokbokki", quality: Q.COOKED };
  const r0 = s.serve(sl0, 0);
  ok(r0.paid === 6000 && said.includes("pricey"), "비싼 메뉴: 일반 손님은 두 배 내고 '너무 비싸요'");
  const sl1 = s.freeTraySlot("tteokbokki");
  s.tray[sl1] = { menu: "tteokbokki", quality: Q.PERFECT };
  const r1 = s.serve(sl1, 1);
  ok(r1.paid === 3000, "단골은 늘 보통 값");
  ok(reviews.length === 2 && reviews[0] < 4 && s.rating !== 3.0, `손님이 떠날 때마다 평점이 실시간으로 바뀜 (★${s.rating.toFixed(2)})`);
  const res = s.result();
  ok(res.rating_start === 3.0 && res.rating_end === s.rating && (res.review_tags?.pricey ?? 0) === 1, "결과에 평점 변화와 '비싸요' 평 수");
  // 영업 중 가격 바꾸기: 다음 그릇부터 새 값, 평가는 받을 때 낸 값으로
  const mid = new ShiftSession();
  mid.setupStory(2, 2, 1.0, 1.0, 6);
  mid.useMarket({ tteokbokki: "cheap" }, 3.0);
  const tags: string[] = [];
  mid.reviewed.connect((_seat, rv) => tags.push(rv.tag));
  const m1 = new CustomerLogic("normal", ["tteokbokki", "tteokbokki"]);
  mid.debugSeatCustomer(0, m1);
  const ms0 = mid.freeTraySlot("tteokbokki");
  mid.tray[ms0] = { menu: "tteokbokki", quality: Q.PERFECT };
  const mr0 = mid.serve(ms0, 0);
  mid.setPriceLevel("tteokbokki", "pricey");
  mid.setPriceLevel("tteokbokki", "bogus");
  const ms1 = mid.freeTraySlot("tteokbokki");
  mid.tray[ms1] = { menu: "tteokbokki", quality: Q.PERFECT };
  const mr1 = mid.serve(ms1, 0);
  ok(mr0.paid === 1500 && mr1.paid === 6000 && mid.priceLevel("tteokbokki") === "pricey", "영업 중에 가격을 바꾸면 다음 그릇부터 그 값 (이상한 단계는 무시)");
  ok(m1.items[0].priceLevel === "cheap" && m1.items[1].priceLevel === "pricey" && tags[0] === "pricey", "평가는 그릇마다 받을 때의 가격 단계로");
  const hi = new ShiftSession();
  hi.setupStory(2, 2, 1.0, 1.0, 6);
  hi.useMarket({}, 5.0);
  (hi as unknown as { spawnCustomer(seat: number): void }).spawnCustomer(0);
  const c5 = hi.seats[0]!;
  ok(c5.typeId === "regular" || approx(c5.patienceMax, D.CUSTOMERS[c5.typeId].patience * D.ratingPatience(5.0)), "평점이 높으면 일반 손님이 더 기다려 줌");

  const gs = newState();
  gs.setPrice("pocha", "tteokbokki", "cheap");
  ok(gs.priceOf("pocha", "tteokbokki") === "cheap" && gs.pricesFor("pocha").sundae === "normal", "가격 단계 저장 (안 정한 메뉴는 보통)");
  gs.recordResult({ ...result(2, true, 10000, 3), rating_start: 3.0, rating_end: 3.6 });
  ok(approx(gs.liveRating("pocha"), 3.6) && gs.liveRating("bunsik") === D.RATING_START, "영업이 끝나면 가게 평점 저장");
  gs.settle(false, false);
  gs.level = 7;
  gs.levelStars["7"] = 5;
  gs.startEvent("pocha");
  gs.recordResult({ ...result(7, true, 20000, 5), event: true, gourmet: { grade: 5, satisfaction: 0.95, reward: D.eventReward(D.EVENTS[0], 5), perfect: 14, cooked: 1, bad: 0, missed: 0, total: 15 } });
  const w0 = gs.wallet;
  gs.settle(false, false);
  ok(approx(gs.liveRating("pocha"), Math.min(5, 3.6 + D.FAME_RATING[5])) && gs.wallet === w0 + 20000 + D.EVENTS[0].reward, "미식가 극찬 → 가게가 유명해져 평점과 매출이 오름");
  const back = newState();
  back.applySave(JSON.parse(JSON.stringify(gs.saveData())));
  ok(back.priceOf("pocha", "tteokbokki") === "cheap" && approx(back.liveRating("pocha"), gs.liveRating("pocha")), "가격·평점 저장");
}

function balanceReport(): void {
  console.log("\n-- 밸런스 리포트 (봇: 0.35초마다 1동작, 완벽 구간만 노림, 시드 5개 평균) --");
  const setups = [
    { label: "업그레이드 없음", burners: 2, heat: 1.0, patience: 1.0 },
    { label: "업그레이드 전부", burners: 7, heat: 0.64, patience: 1.32 }, // 5단계 다 (2026-11-18)
  ];
  for (const setup of setups) {
    console.log(`[${setup.label}]`);
    for (let day = 1; day <= D.TOTAL_LEVELS; day++) {
      if (D.levelInShop(day) === 1) console.log(` < ${D.shopForLevel(day).name} >`);
      let total = 0;
      let passed = 0;
      let stars = 0;
      let angry = 0;
      for (const seed of [11, 22, 33, 44, 55]) {
        const r = ShiftBot.playLevel(day, setup.burners, setup.heat, setup.patience, seed);
        total += r.revenue;
        passed += r.passed ? 1 : 0;
        stars += r.stars;
        angry += r.angry;
      }
      const target = D.levelConfig(day).target;
      console.log(
        `  [${day}] 레벨 ${D.levelInShop(day)}  손님 ${D.levelConfig(day).customers}명  평균 매출 ${D.formatWon(Math.trunc(total / 5))} / 할당량 ${D.formatWon(target)} (${(total / 5 / target).toFixed(2)}배)  통과 ${passed}/5  평균 별 ${(stars / 5).toFixed(1)}  화난 손님 평균 ${(angry / 5).toFixed(1)}`,
      );
      if (D.levelInShop(day) === 1 && setup.burners === 2) ok(passed === 5, `숙련 플레이(봇)는 레벨 ${day}(가게 첫 레벨)를 업그레이드 없이 통과해야 함`);
      if (setup.burners === 7) ok(passed >= 4, `숙련 플레이(봇)는 업그레이드를 다 하면 레벨 ${day}를 통과해야 함`);
    }
  }
  for (const shop of D.SHOPS) {
    const e = ShiftBot.playLevel(shop.last_level, 7, 0.64, 1.32, 99, true);
    console.log(`[무한 영업 · ${shop.name}, 업그레이드 전부] 매출 ${D.formatWon(e.revenue)}, ${e.elapsed.toFixed(0)}초 버팀`);
  }
}

testCookItems();
testCustomers();
testSessionCapacity();
testSessionServeFlow();
testReactions();
testSessionCuttingAndWaste();
testSessionTimeout();
testQuota();
testRefill();
testAutoServe();
viewTests(ok);
testEndless();
testFormat();
testShops();
testNewMenus();
testGameState();
testAccounts();
testEvents();
testImo();
testBoardQueue();
  testRegularsAndStock();
testSignAndMagic();
testPricesAndRating();
if (!process.argv.includes("--quick")) balanceReport();
console.log(`\n== ${checks} checks, ${fails} failed ==`);
process.exit(fails > 0 ? 1 : 0);
