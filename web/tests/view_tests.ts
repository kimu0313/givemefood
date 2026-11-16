// 화면 쪽 규칙 테스트 (안내 문구·손님 반응 표정·대사·캐릭터 그림 나누기). Godot 판 run_tests.gd 의 해당 부분.

import fs from "node:fs";
import * as D from "../src/core/defs.ts";
import { CookItem } from "../src/core/cook_item.ts";
import { CustomerLogic } from "../src/core/customer_logic.ts";
import { hintFor } from "../src/shift/station_view.ts";
import { CustomerView, pickLine } from "../src/shift/customer_view.ts";
import * as ArtAssets from "../src/art/art_assets.ts";

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
  // 하루 동안 같은 얼굴이 두 번 안 나옴 (2026-11-16 사용자 "같은 손님이 하루에 여러 번·동시에")
  {
    const today = new Set<string>();
    const ids: string[] = [];
    for (let i = 0; i < 15; i++) {
      for (const t of ["normal", "hurry", "jinsang", "drunk"]) {
        const cv = new CustomerView();
        cv.setup(new CustomerLogic(t, ["tteokbokki"]), i % 3, [], today);
        ids.push(cv.identity);
      }
    }
    ok(new Set(ids).size === ids.length, `손님 60명 (종류마다 15명)이 와도 하루 동안 얼굴이 안 겹침 (${new Set(ids).size}/${ids.length})`);
    const sprites = ids.filter((x) => !x.includes(":"));
    ok(sprites.length <= ArtAssets.customerSpritePool("normal").length + 2, "캐릭터 그림은 하루에 한 번씩만 (다 쓰면 도형 생김새로)");
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
  ok(all.size === 6, `캐릭터 6명을 모두 씀 (${[...all]})`);
  ok(ArtAssets.customerSpritePool("normal").length === 3 && same(ArtAssets.customerSpritePool("hurry"), ["guest_watch"]) && same(ArtAssets.customerSpritePool("jinsang"), ["guest_spiky"]), "일반 3명 / 급한 손님 = 시계 찬 소년 / 진상 = 뾰족 머리");
  ok(same(ArtAssets.customerSpritePool("regular", "cafe"), ["guest_girl"]) && !ArtAssets.customerSpritePool("normal").includes("guest_girl"), "단골 수아 = 긴 머리 여자 그림 (일반 손님으로는 안 나옴)");
  ok(same(ArtAssets.customerSpritePool("regular", "student"), ["guest_blueshirt"]) && ArtAssets.customerSpritePool("regular", "grandma").length === 0 && ArtAssets.customerSpritePool("drunk").length === 0, "단골 대학생 = 파란 셔츠, 할머니·취객은 도형 그림 그대로");
  const seen = new Set<string>();
  const taken: string[] = [];
  for (let i = 0; i < 3; i++) {
    const v = new CustomerView();
    v.setup(new CustomerLogic("normal", ["tteokbokki"]), i % 3, taken);
    seen.add(v.spriteName);
    taken.push(v.spriteName);
  }
  ok(seen.size === 3, `다른 자리 손님과 겹치지 않는 그림을 고름 (${[...seen]})`);
  // 머리 크기 맞추기: 얼굴 너비가 모두 같게
  const widths = Object.keys(ArtAssets.SPRITE_FACES).map((n) => {
    const r = ArtAssets.customerSpriteRect(n, ArtAssets.SPRITE_SIZE, { x: 0, y: 0 } as never);
    const f = ArtAssets.SPRITE_FACES[n];
    return Math.round(((f[1] - f[0]) * r.w) / ArtAssets.SPRITE_SIZE.x);
  });
  ok(widths.every((w) => w === ArtAssets.SPRITE_FACE_W), `캐릭터 얼굴 너비가 모두 ${ArtAssets.SPRITE_FACE_W} (${widths})`);
}
