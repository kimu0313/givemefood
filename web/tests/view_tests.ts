// 화면 쪽 규칙 테스트 (안내 문구·손님 반응 표정·대사·캐릭터 그림 나누기). Godot 판 run_tests.gd 의 해당 부분.

import fs from "node:fs";
import * as D from "../src/core/defs.ts";
import { CookItem } from "../src/core/cook_item.ts";
import { CustomerLogic } from "../src/core/customer_logic.ts";
import { hintFor } from "../src/shift/station_view.ts";
import { CustomerView, pickLine } from "../src/shift/customer_view.ts";
import * as ArtAssets from "../src/art/art_assets.ts";
import { COUNTER_Y } from "../src/shift/shift_view.ts";
import { KitchenView } from "../src/shift/kitchen_view.ts";
import { ART_BANDS, SHOP_ART, mapY } from "../src/art/shop_art.ts";

function run(item: CookItem, seconds: number): void {
  let t = 0.0;
  while (t < seconds - 0.0001) {
    const d = Math.min(0.05, seconds - t);
    item.tick(d);
    t += d;
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function viewTests(ok: (cond: boolean, msg: string) => void): void {
  // 가게 그림 띠(shop_art.ts ART_BANDS)가 영업 화면 조리대 띠와 같음 (ShiftView: trayY = COUNTER_Y + 62, binsY 1004)
  {
    const kv = new KitchenView();
    kv.counterY = COUNTER_Y;
    kv.trayY = COUNTER_Y + 62.0;
    kv.binsY = 1004.0;
    ok(kv.kitchenTop() === ART_BANDS.kitchenTop && Math.abs(kv.shelfTop() - ART_BANDS.shelfTop) < 1.0, `가게 그림 띠 = 조리대 띠 (${kv.kitchenTop()}, ${kv.shelfTop()})`);
    for (const [id, a] of Object.entries(SHOP_ART)) ok(mapY(a, a.cut) === ART_BANDS.kitchenTop && mapY(a, 1080) === 1080 && mapY(a, a.counterLine) > COUNTER_Y - 100, `${id} 그림 띠 나눔`);
  }
  // 2026-11-18 사용자 메뉴 그림은 UI 아이콘에만 (손님에게 내는 그릇 음식은 그대로 = FOOD_FILES 에 없음)
  for (const m of ArtAssets.ICON_FILES) {
    ok(fs.existsSync(`public/assets/art/icons/${m}.png`) && D.MENUS[m] !== undefined && !ArtAssets.FOOD_FILES.includes(m), `${m} 메뉴 아이콘 그림 (UI 전용)`);
  }
  // 2026-11-18 지도 UI 조각 (사용자 예시 그림에서 오림, tools/map_ui_art.mjs)
  ok(ArtAssets.MAP_UI_FILES.every((n) => fs.existsSync(`public/assets/art/ui/map_${n}.webp`)), "지도 UI 조각 파일");
  // 2026-11-18 다섯 가게 모두 사용자 그림 (뒤층 + 앞층 파일), 그림 속 도구 자리는 가게 배치(D.shopLayout)와 종류·순서가 같음
  // (다르면 ShiftView.placeArtStations 가 몰래 보통 배치로 돌아가서 그림 위에 도구 틀이 겹침)
  for (const shop of D.SHOPS) {
    const a = SHOP_ART[shop.id];
    ok(a !== undefined && fs.existsSync(`public/assets/art/${a.file}`) && fs.existsSync(`public/assets/art/${a.front}`), `${shop.id} 가게 그림 뒤층·앞층 파일`);
    if (a === undefined || a.kitchen === null) continue;
    const kinds = D.shopLayout(shop).map((e) => e.kind);
    ok(same(kinds, a.kitchen.map((e) => e.kind)), `${shop.id} 그림 속 도구 = 가게 배치 (${kinds.join(",")})`);
    const cellsOk = D.shopLayout(shop).every((e, i) => e.slots === 1 || (a.kitchen![i].cells?.length ?? 0) === e.slots);
    ok(cellsOk, `${shop.id} 그림 속 도구 칸 수 = 가게 도구 칸 수`);
  }
  // 하루 동안 같은 얼굴이 두 번 안 나옴 (2026-11-16 사용자 "같은 손님이 하루에 여러 번·동시에")
  {
    // 2026-11-17 사용자 "도형 캐릭터는 단골 빼고 없애 줘": 보통 손님은 모두 캐릭터 그림
    const today = new Set<string>();
    const names: string[] = [];
    for (let i = 0; i < 15; i++) {
      for (const t of ArtAssets.GUEST_TYPES) {
        const cv = new CustomerView();
        cv.setup(new CustomerLogic(t, ["tteokbokki"]), i % 3, [], today);
        names.push(cv.spriteName);
        if (t === "drunk") ok(!ArtAssets.YOUNG_SPRITES.includes(cv.spriteName), `취객은 어린 손님 그림이 아님 (${cv.spriteName})`);
      }
    }
    ok(names.every((n) => n !== "" && ArtAssets.CUSTOMER_FILES.includes(n)), "보통 손님은 모두 캐릭터 그림 (도형 손님 없음)");
    // 하루 동안: 그림을 다 쓰기 전에는 같은 얼굴이 안 나오고, 다 쓰면 가장 오래전에 온 사람부터
    const day = new Set<string>();
    const seq: string[] = [];
    const P = ArtAssets.guestSpritePool("normal").length;
    for (let i = 0; i < P + 3; i++) {
      const cv = new CustomerView();
      cv.setup(new CustomerLogic("normal", ["tteokbokki"]), 0, [], day);
      seq.push(cv.spriteName);
    }
    ok(new Set(seq.slice(0, P)).size === P, `그림 ${P}명을 다 쓰기 전에는 하루에 같은 얼굴이 안 나옴`);
    ok(seq[P] === seq[0] && seq[P + 1] === seq[1], "다 쓰면 가장 오래전에 온 사람부터 다시");
    // 화면에 같이 있는 사람과는 절대 안 겹침
    const onScreen = ArtAssets.guestSpritePool("normal").slice(0, 2);
    let clash = 0;
    for (let i = 0; i < 40; i++) {
      const cv = new CustomerView();
      cv.setup(new CustomerLogic(["normal", "hurry", "jinsang", "drunk"][i % 4], ["tteokbokki"]), 1, onScreen, day);
      if (onScreen.includes(cv.spriteName)) clash++;
    }
    ok(clash === 0, "화면에 있는 사람과 같은 얼굴은 안 나옴");
    // 미식가 그림은 미식가 스테이지에만 (보통 손님 묶음에 없음), 스테이지마다 그 미식가 그림
    const guests = new Set(["normal", "hurry", "jinsang", "drunk"].flatMap((t) => ArtAssets.guestSpritePool(t)));
    ok([...guests].every((n) => !n.startsWith("guest_critic")), "미식가 그림은 보통 손님으로 안 나옴");
    ok(D.EVENTS.every((e) => ArtAssets.customerSpritePool("gourmet", e.critic)[0] === `guest_critic_${e.critic}`), "미식가 스테이지마다 그 미식가 그림");
    ok(ArtAssets.customerSpritePool("regular", "taxi")[0] === "guest_taxi", "단골 택시 기사 = 사용자 일러스트");
  }

  // 조리 칸 안내 문구
  const over = new CookItem("tteokbokki");
  run(over, 17.0);
  ok(hintFor(over)[0] === "졸음 (완벽 아님)", "떡볶이 졸음 안내 문구");
  const burn = new CookItem("twigim");
  run(burn, 8.5);
  ok(hintFor(burn)[0] === "탔어요!", "탄 튀김 안내 문구 = 탔어요!");

  // 손님 반응: 표정·말풍선
  const c = new CustomerLogic("jinsang", ["tteokbokki"]);
  const view = new CustomerView();
  view.setup(c, 0);
  const moods: Record<string, string> = {};
  for (const kind of ["raw", "burnt", "wrong"]) {
    view.react(kind);
    moods[kind] = view.currentMood();
    ok(D.reactionLines(kind, "jinsang").includes(view.saying()), `${kind} 반응: 진상 손님 대사를 말풍선으로 (${view.saying().replace("\n", " ")})`);
  }
  ok(same(moods, { raw: "yuck", burnt: "shock", wrong: "confused" }), "반응 표정 yuck / shock / confused");
  let repeats = 0;
  let prev = "";
  for (let i = 0; i < 30; i++) {
    const l = pickLine("burnt", "normal");
    if (l === prev) repeats += 1;
    prev = l;
  }
  ok(repeats === 0, "같은 대사가 연달아 나오지 않음");

  // 사용자 캐릭터 그림 6명: 손님 종류마다 나눠 쓰고, 한 화면에 같은 사람이 겹치지 않게
  const all = new Set<string>();
  for (const key of Object.keys(ArtAssets.CUSTOMER_SPRITES)) {
    for (const n of ArtAssets.CUSTOMER_SPRITES[key]) {
      all.add(n);
      ok(fs.existsSync(`public/${ArtAssets.ROOT}/customers/${n}.png`), `캐릭터 그림 ${n} 파일이 있음`);
    }
  }
  ok(all.size === ArtAssets.CUSTOMER_FILES.length && ArtAssets.CUSTOMER_FILES.every((n) => all.has(n)), `캐릭터 그림을 모두 씀 (${[...all]})`);
  ok(same(ArtAssets.customerSpritePool("normal"), ["guest_chef", "guest_kid", "guest_schoolgirl", "guest_twintail", "guest_longhair", "guest_apron", "guest_mechanic"]) && same(ArtAssets.customerSpritePool("hurry"), ["guest_rider", "guest_capboy", "guest_jacket"]) && same(ArtAssets.customerSpritePool("jinsang"), ["guest_punk", "guest_uniform"]), "일반 = 요리사·후드 소년·땋은 머리 여학생·양갈래 여자아이·긴 머리 교복 여학생·앞치마 청년·정비공 / 급한 손님 = 배달 기사·노란 모자 소년·트레이닝 재킷 청년 / 진상 = 담배 문 금발·턱 괸 교복 남학생");
  ok(ArtAssets.guestSpritePool("drunk").every((n) => !ArtAssets.YOUNG_SPRITES.includes(n)) && ArtAssets.guestSpritePool("drunk").length >= 4, "취객으로 빌려 쓰는 그림은 어른만");
  ok(same(ArtAssets.customerSpritePool("regular", "cafe"), ["guest_barista"]) && !ArtAssets.customerSpritePool("normal").includes("guest_barista"), "단골 수아 = 앞치마 카페 알바생 그림 (일반 손님으로는 안 나옴)");
  ok(same(ArtAssets.customerSpritePool("regular", "guard"), ["guest_guard"]) && D.REGULARS.every((r) => ArtAssets.customerSpritePool("regular", r.id).length === 1), "단골 6명 모두 캐릭터 그림 (경비 아저씨 = 초록 모자 그림)");
  // 2026-11-18 단골 그림은 보통 손님 묶음에 없음 (있으면 단골이 올 때 같은 얼굴이 화면에 둘)
  const guestAll = new Set(ArtAssets.GUEST_TYPES.flatMap((t) => ArtAssets.guestSpritePool(t)));
  ok(D.REGULARS.every((r) => ArtAssets.customerSpritePool("regular", r.id).every((n) => !guestAll.has(n))), "단골 그림은 보통 손님으로 안 나옴");
  ok(
    same(ArtAssets.customerSpritePool("regular", "student"), ["guest_student"]) &&
      same(ArtAssets.customerSpritePool("regular", "grandma"), ["guest_granny"]) &&
      same(ArtAssets.customerSpritePool("regular", "office"), ["guest_office"]) &&
      same(ArtAssets.customerSpritePool("drunk"), ["guest_mustache", "guest_worker"]),
    "단골 대학생 = 시험지 든 안경 대학생, 할머니 = 앞치마 할머니, 김 대리 = 넥타이 회사원, 취객 = 콧수염 아저씨·수건 두른 아저씨",
  );
  const seen = new Set<string>();
  const taken: string[] = [];
  for (let i = 0; i < 3; i++) {
    const v = new CustomerView();
    v.setup(new CustomerLogic("normal", ["tteokbokki"]), i % 3, taken);
    seen.add(v.spriteName);
    taken.push(v.spriteName);
  }
  ok(seen.size === 3, `다른 자리 손님과 겹치지 않는 그림을 고름 (${[...seen]})`);
  // 머리 크기: 모든 그림의 얼굴 크기(머리카락·모자 빼고, 2026-11-18)가 SPRITE_HEAD, 그림마다 잰 값이 있음
  const heads = ArtAssets.CUSTOMER_FILES.map((n) => {
    const h = ArtAssets.SPRITE_HEADS[n];
    if (h === undefined) return -1;
    const r = ArtAssets.customerSpriteRect(n, ArtAssets.SPRITE_SIZE, { x: 0, y: 0 } as never);
    return Math.round(((h[2] * r.w) / ArtAssets.SPRITE_SIZE.x / (ArtAssets.SPRITE_SIZE_K[n] ?? 1.0)) * 100) / 100;
  });
  ok(heads.every((c) => c === ArtAssets.SPRITE_HEAD), `캐릭터 머리 크기가 모두 같음 (${heads})`);
}
