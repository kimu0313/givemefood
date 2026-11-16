// 손님 그림 (참고 일러스트 그림체: 굵은 먹선 + 평평한 셀 채색 + 겨울 옷차림). 캐릭터 그림 파일이 없는 손님에 쓴다.
//   normal  더플코트 + 체크 목도리      hurry   패딩 + 후드 + 식은땀
//   regular 집업 점퍼 + 야구 모자       jinsang 가죽 재킷 + 선글라스 + 금목걸이
//   drunk   정장 + 풀린 넥타이 + 넥타이 머리띠
//   gourmet 미식가 황 선생 (이벤트): 베레모 + 동그란 안경 + 회색 콧수염 + 자주색 재킷 + 나비넥타이
// 표정 m: normal / happy / angry / yuck / shock / confused

import { Color, PI, R, TAU, V, WHITE, fmod, lerp, rgb, v } from "../engine/geom.ts";
import type { Gfx } from "../engine/gfx.ts";
import * as Ink from "../art/ink.ts";
import * as FoodArt from "../art/food_art.ts";

const SKIN = rgb(0.98, 0.85, 0.73);
const SKIN_SHADE = rgb(0.9, 0.7, 0.6);
const LW = 5.0; // 몸 외곽선
const FW = 4.0; // 얼굴 선
// 일반 손님은 사람마다 옷·머리색·목도리·머리 모양이 다르다 (look 번호로 고름)
const COATS = [
  rgb(0.27, 0.38, 0.58), rgb(0.58, 0.44, 0.3), rgb(0.42, 0.44, 0.48), rgb(0.3, 0.4, 0.34), rgb(0.5, 0.3, 0.32),
  rgb(0.62, 0.52, 0.36), rgb(0.22, 0.24, 0.3), rgb(0.55, 0.36, 0.5), rgb(0.72, 0.62, 0.5), rgb(0.26, 0.48, 0.52),
];
const HAIRS = [rgb(0.16, 0.12, 0.12), rgb(0.36, 0.23, 0.15), rgb(0.52, 0.33, 0.2), rgb(0.24, 0.18, 0.16), rgb(0.62, 0.42, 0.24), rgb(0.1, 0.09, 0.1)];
// 2026-11-16 사용자 "같은 손님이 하루에 여러 번·동시에 나옴 → 사람 종류를 두 배로": 그림 손님(도형)마다 피부색·모자·안경·머리 모양을 달리한다
const SKINS = [rgb(0.98, 0.85, 0.73), rgb(0.95, 0.79, 0.65), rgb(0.86, 0.66, 0.5), rgb(1.0, 0.89, 0.8)];
const HAT_COLORS = [rgb(0.85, 0.3, 0.28), rgb(0.25, 0.45, 0.75), rgb(0.95, 0.75, 0.25), rgb(0.35, 0.6, 0.4), rgb(0.55, 0.4, 0.7), rgb(0.9, 0.9, 0.88)];
const HURRY_BODIES = [rgb(0.92, 0.56, 0.2), rgb(0.85, 0.28, 0.25), rgb(0.2, 0.55, 0.6), rgb(0.95, 0.78, 0.25)];
const JINSANG_BODIES = [rgb(0.5, 0.3, 0.56), rgb(0.18, 0.18, 0.2), rgb(0.45, 0.16, 0.2)];
const DRUNK_BODIES = [rgb(0.58, 0.26, 0.26), rgb(0.25, 0.27, 0.35), rgb(0.4, 0.38, 0.36)];

/** 도형 손님 한 명의 생김새 (look 번호에서): 피부색, 모자(없음·비니·야구 모자·귀마개), 안경, 앞머리 모양, 똥머리 */
interface Variety {
  skin: Color;
  hat: string;
  hatColor: Color;
  glasses: boolean;
  bangs: string;
  bun: boolean;
}

function variety(typeId: string, look: number): Variety {
  let h = (Math.imul(look + 1, 2654435761) >>> 0) ^ (look * 7919);
  const pick = (n: number) => {
    const r = h % n;
    h = Math.floor(h / n) + 1013904223 * (r + 1);
    h >>>= 0;
    return r;
  };
  const hats = ["none", "none", "beanie", "cap", "earmuff"];
  const v: Variety = {
    skin: SKINS[pick(SKINS.length)],
    hat: hats[pick(hats.length)],
    hatColor: HAT_COLORS[pick(HAT_COLORS.length)],
    glasses: pick(4) === 0,
    bangs: ["default", "part", "regular", "drunk"][pick(4)],
    bun: pick(4) === 0,
  };
  // 종류마다 이미 있는 차림과 겹치지 않게 (급한 손님 = 후드, 진상 = 선글라스, 취객 = 넥타이 머리띠)
  if (typeId === "hurry" || typeId === "drunk") v.hat = "none";
  if (typeId !== "normal") {
    v.bangs = typeId;
    v.bun = false;
  }
  if (typeId === "jinsang") v.glasses = false;
  if (v.hat === "beanie" || v.hat === "cap") v.bun = false;
  return v;
}
const SCARVES: [Color, Color][] = [
  [rgb(0.84, 0.72, 0.52), rgb(0.58, 0.4, 0.28)],
  [rgb(0.8, 0.28, 0.24), rgb(0.5, 0.14, 0.14)],
  [rgb(0.62, 0.64, 0.68), rgb(0.36, 0.38, 0.44)],
];
const IRIS: Record<string, Color> = {
  normal: rgb(0.36, 0.23, 0.15),
  hurry: rgb(0.24, 0.3, 0.46),
  regular: rgb(0.3, 0.24, 0.18),
  jinsang: rgb(0.2, 0.18, 0.18),
  drunk: rgb(0.38, 0.22, 0.18),
};

/**
 * 단골마다 다른 모습 (2026-11-15 단골 도감에 얼굴을 넣으면서: 전에는 대학생 말고는 모두 같은 초록 모자 차림이었다).
 * 대학생은 사용자 캐릭터 그림(ArtAssets.CUSTOMER_SPRITES)이라 여기 없음.
 */
interface RegularLook {
  body?: Color; // 옷 색 (없으면 손님 종류 기본색)
  hair?: Color;
  cap?: Color; // 야구 모자
  tie?: Color; // 정장 + 흰 셔츠 + 넥타이
  cardigan?: boolean; // 단추 가디건
  perm?: boolean; // 뽀글 파마
  part?: boolean; // 가르마 앞머리
  glasses?: boolean;
  mustache?: boolean;
  beret?: Color; // 베레모
  bowtie?: Color; // 흰 셔츠 + 나비넥타이
}
const REGULAR_LOOKS: Record<string, RegularLook> = {
  guard: { cap: rgb(0.2, 0.38, 0.32) }, // 경비 아저씨: 초록 모자 + 초록 점퍼 (원래 모습)
  taxi: { body: rgb(0.56, 0.43, 0.3), hair: rgb(0.5, 0.48, 0.47), cap: rgb(0.2, 0.27, 0.47), mustache: true }, // 택시 기사: 남색 모자 + 회색 머리 + 콧수염
  office: { body: rgb(0.22, 0.25, 0.34), hair: rgb(0.12, 0.1, 0.1), tie: rgb(0.25, 0.42, 0.78), glasses: true, part: true }, // 야근 김 대리: 정장 + 안경
  grandma: { body: rgb(0.74, 0.44, 0.56), hair: rgb(0.88, 0.87, 0.86), cardigan: true, perm: true }, // 할머니: 분홍 가디건 + 흰 파마
};

/** 미식가 황 선생 (이벤트 보스 손님) — 단골 그림 틀에 베레모·나비넥타이 */
const GOURMET_LOOK: RegularLook = {
  body: rgb(0.45, 0.16, 0.2), hair: rgb(0.86, 0.85, 0.84), beret: rgb(0.18, 0.16, 0.2), bowtie: rgb(0.86, 0.66, 0.18),
  glasses: true, mustache: true, part: true,
};

/**
 * outfit (가게마다 특별한 차림, 2026-11-16 사용자): "hawaiian" = 하와이안 셔츠 · "bikini" = 비키니 + 어깨에 수건 (해변 가게의 어른 손님만),
 * "student" = 가방 멘 어린 학생 (동네 분식집, 교복 + 책가방). 빈 문자열이면 손님 종류 기본 차림.
 */
export function draw(g: Gfx, typeId: string, body: Color, hair: Color, head: V, m: string, t: number, seat: number, look = 0, regularId = "", outfit = ""): void {
  let scarf = SCARVES[0];
  let longHair = false;
  let vr: Variety | undefined;
  if (typeId === "normal") {
    body = COATS[look % COATS.length];
    hair = HAIRS[Math.floor(look / 10.0) % HAIRS.length];
    scarf = SCARVES[Math.floor(look / 60.0) % SCARVES.length];
    longHair = Math.floor(look / 7.0) % 3 === 0;
  }
  if (["normal", "hurry", "jinsang", "drunk"].includes(typeId)) {
    vr = variety(typeId, look);
    if (typeId === "hurry") body = HURRY_BODIES[look % HURRY_BODIES.length];
    if (typeId === "jinsang") body = JINSANG_BODIES[look % JINSANG_BODIES.length];
    if (typeId === "drunk") body = DRUNK_BODIES[look % DRUNK_BODIES.length];
    if (typeId !== "normal") hair = HAIRS[Math.floor(look / 5.0) % HAIRS.length];
    // 차림에 맞는 모자: 해변 = 밀짚모자·머리 위 선글라스, 학생 = 노란 학생 모자
    if (outfit === "hawaiian" || outfit === "bikini") vr.hat = ["none", "straw", "sunnies"][look % 3];
    if (outfit === "student") {
      vr.hat = look % 3 === 0 ? "yellow" : "none";
      vr.glasses = look % 9 === 0;
      vr.bangs = "default";
    }
    if (outfit === "bikini") longHair = true;
  }
  let rl = typeId === "regular" ? (REGULAR_LOOKS[regularId] ?? REGULAR_LOOKS.guard) : undefined;
  if (typeId === "gourmet") {
    rl = GOURMET_LOOK;
    typeId = "regular";
  }
  if (rl !== undefined) {
    body = rl.body ?? body;
    hair = rl.hair ?? hair;
  }
  if (outfit !== "") drawOutfit(g, outfit, look, vr?.skin ?? SKIN);
  else drawBody(g, typeId, body, scarf, rl);
  drawHead(g, typeId, hair, head, m, t, seat, longHair, rl, vr);
}

// ---------------------------------------------------------------- 몸·옷

function drawBody(g: Gfx, typeId: string, col: Color, scarf: [Color, Color], rl?: RegularLook): void {
  if (typeId === "hurry") Ink.ellipse(g, v(0, 66), 80.0, 30.0, col.darkened(0.14), LW); // 목 뒤 후드
  // 목
  Ink.rect(g, new R(-19, 28, 38, 40), SKIN, Ink.W);
  g.rect(new R(-17, 30, 34, 12), SKIN_SHADE);
  const coat = [v(-30, 52), v(-74, 64), v(-104, 96), v(-116, 150), v(-130, 320), v(130, 320), v(116, 150), v(104, 96), v(74, 64), v(30, 52)];
  g.polygon(coat, col);
  Ink.shade(g, coat, v(-30, 0), col.darkened(0.2));
  switch (typeId) {
    case "normal":
      g.line(v(0, 100), v(0, 320), Ink.LINE, 3.0);
      for (const y of [150.0, 200.0, 250.0]) {
        g.line(v(-20, y), v(20, y), Ink.LINE, 2.5);
        Ink.rrect(g, new R(-8, y - 6.0, 16, 12), rgb(0.86, 0.76, 0.56), 6.0, 2.5);
      }
      drawScarf(g, scarf[0], scarf[1]);
      break;
    case "hurry":
      for (let k = 0; k < 5; k++) {
        const y = 116.0 + k * 44.0;
        const half = lerp(108.0, 128.0, (y - 96.0) / 224.0);
        const pts: V[] = [];
        for (let j = 0; j < 9; j++) {
          const x = -half + (2.0 * half * j) / 8.0;
          pts.push(v(x, y + Math.sin((j / 8.0) * PI) * 6.0));
        }
        g.polyline(pts, col.darkened(0.3), 3.0);
      }
      g.line(v(0, 70), v(0, 320), Ink.LINE, 4.0);
      Ink.rrect(g, new R(-6, 96, 12, 22), rgb(0.8, 0.8, 0.82), 4.0, 2.5);
      Ink.rrect(g, new R(-42, 44, 84, 28), col.lightened(0.12), 12.0, LW);
      break;
    case "regular":
      if (rl?.tie !== undefined || rl?.bowtie !== undefined) {
        // 단정한 정장: 흰 셔츠 + 반듯한 넥타이(또는 나비넥타이) + 옷깃
        Ink.poly(g, [v(-30, 52), v(30, 52), v(0, 160)], rgb(0.96, 0.96, 0.94), 3.0);
        if (rl.tie !== undefined) {
          Ink.poly(g, [v(-8, 56), v(8, 56), v(10, 72), v(-10, 72)], rl.tie, 3.0);
          Ink.poly(g, [v(-9, 72), v(9, 72), v(15, 138), v(0, 156), v(-15, 138)], rl.tie, 3.0);
        }
        Ink.poly(g, [v(-30, 52), v(0, 160), v(-22, 210), v(-72, 72)], col.darkened(0.16), 3.0);
        Ink.poly(g, [v(30, 52), v(0, 160), v(22, 210), v(72, 72)], col.darkened(0.16), 3.0);
        if (rl.bowtie !== undefined) {
          Ink.poly(g, [v(-2, 66), v(-34, 50), v(-36, 84), v(-2, 70)], rl.bowtie, 3.0);
          Ink.poly(g, [v(2, 66), v(34, 50), v(36, 84), v(2, 70)], rl.bowtie, 3.0);
          Ink.rrect(g, new R(-9, 58, 18, 20), rl.bowtie.darkened(0.2), 5.0, 3.0);
          // 가슴 주머니 손수건
          Ink.poly(g, [v(58, 128), v(90, 128), v(84, 112), v(76, 120), v(68, 110)], rl.bowtie.lightened(0.25), 2.5);
          g.line(v(54, 130), v(94, 130), Ink.LINE, 3.0);
        }
      } else if (rl?.cardigan) {
        // 가디건: V 목 안에 블라우스, 가운데 단추, 밑단 니트 줄
        Ink.poly(g, [v(-32, 52), v(32, 52), v(0, 136)], rgb(0.98, 0.95, 0.88), 3.0);
        g.line(v(0, 136), v(0, 320), Ink.LINE, 3.0);
        for (const y of [168.0, 214.0, 260.0]) Ink.circle(g, v(0, y), 7.0, col.lightened(0.35), 2.5);
        for (const y of [292.0, 304.0]) g.line(v(-126, y), v(126, y), col.darkened(0.22), 3.0);
      } else {
        g.line(v(0, 70), v(0, 320), Ink.LINE, 4.0);
        Ink.rect(g, new R(40, 140, 40, 30), col.darkened(0.08), 3.0);
        Ink.rrect(g, new R(-38, 42, 76, 30), col.darkened(0.12), 10.0, LW);
      }
      break;
    case "jinsang":
      Ink.poly(g, [v(-28, 54), v(28, 54), v(0, 150)], rgb(0.14, 0.14, 0.17), 3.0);
      Ink.poly(g, [v(-30, 52), v(-4, 130), v(-28, 190), v(-70, 70)], col.darkened(0.15), 3.0);
      Ink.poly(g, [v(30, 52), v(4, 130), v(28, 190), v(70, 70)], col.darkened(0.15), 3.0);
      for (let k = 0; k < 9; k++) {
        const a = PI * 0.15 + (PI * 0.7 * k) / 8.0;
        Ink.circle(g, v(Math.cos(a) * 26.0, 62.0 + Math.sin(a) * 36.0), 4.0, rgb(0.96, 0.78, 0.3), 1.5);
      }
      break;
    case "drunk":
      Ink.poly(g, [v(-30, 52), v(30, 52), v(0, 160)], rgb(0.96, 0.96, 0.94), 3.0);
      Ink.poly(g, [v(-8, 70), v(10, 66), v(14, 80), v(-4, 84)], rgb(0.78, 0.18, 0.18), 3.0);
      Ink.poly(g, [v(-4, 82), v(12, 79), v(26, 160), v(12, 178), v(2, 160)], rgb(0.82, 0.2, 0.2), 3.0);
      Ink.poly(g, [v(-30, 52), v(0, 160), v(-22, 200), v(-72, 72)], col.darkened(0.16), 3.0);
      Ink.poly(g, [v(30, 52), v(0, 160), v(22, 200), v(72, 72)], col.darkened(0.16), 3.0);
      break;
  }
  Ink.outline(g, coat, LW);
}

/** 체크무늬 목도리 (목에 두르고 한쪽 끝이 늘어짐) */
function drawScarf(g: Gfx, col: Color, check: Color): void {
  const wrap = [v(-50, 46), v(50, 46), v(56, 80), v(-56, 82)];
  g.polygon(wrap, col);
  for (const x of [-34.0, -14.0, 6.0, 26.0, 44.0]) g.line(v(x, 47), v(x + 2.0, 80), check, 3.0);
  g.line(v(-54, 64), v(54, 63), check, 3.0);
  Ink.outline(g, wrap, LW);
  const tail = [v(16, 76), v(50, 76), v(48, 176), v(18, 172)];
  g.polygon(tail, col);
  Ink.shade(g, tail, v(-8, 0), col.darkened(0.15));
  for (const x of [26.0, 38.0]) g.line(v(x, 78), v(x, 172), check, 3.0);
  for (const y of [104.0, 138.0]) g.line(v(17, y), v(49, y), check, 3.0);
  Ink.outline(g, tail, LW);
  for (let k = 0; k < 5; k++) {
    const x = 20.0 + k * 6.5;
    g.line(v(x, 173), v(x, 186), Ink.LINE, 2.5);
  }
}

// ---------------------------------------------------------------- 머리·얼굴

function drawHead(g: Gfx, typeId: string, hair: Color, head: V, m: string, t: number, seat: number, longHair = false, rl?: RegularLook, vr?: Variety): void {
  let skin = vr?.skin ?? SKIN;
  if (typeId === "drunk") skin = skin.lerp(rgb(1.0, 0.62, 0.56), 0.25);
  // 뒷머리 (긴 머리는 어깨까지)
  let back = FoodArt.ellipsePoints(head.add(v(0, -6)), 68.0, 64.0, 24, PI * 0.92, TAU + PI * 0.08);
  if (longHair) {
    back = FoodArt.ellipsePoints(head.add(v(0, -6)), 70.0, 66.0, 24, PI, TAU);
    for (const p of [v(72, 30), v(66, 66), v(40, 74), v(-40, 74), v(-66, 66), v(-72, 30)]) back.push(head.add(p));
  }
  Ink.poly(g, back, hair.darkened(0.14), FW);
  // 귀
  for (const side of [-1.0, 1.0]) {
    Ink.ellipse(g, head.add(v(side * 57.0, 10)), 11.0, 14.0, skin, FW);
    const a0 = side > 0.0 ? -PI * 0.5 : PI * 0.5;
    g.arc(head.add(v(side * 58.0, 10)), 6.0, a0, a0 + PI, SKIN_SHADE, 2.5);
  }
  // 얼굴 (턱으로 갈수록 좁아짐)
  const face: V[] = [];
  for (let k = 0; k < 32; k++) {
    const a = (TAU * k) / 32.0;
    let x = Math.cos(a) * 58.0;
    let y = Math.sin(a) * 60.0;
    if (y > 0.0) {
      const tt = Math.sin(a);
      x *= 1.0 - 0.2 * tt * tt;
      y *= 1.06;
    }
    face.push(head.add(v(x, y)));
  }
  g.polygon(face, skin);
  Ink.shade(g, face, v(-15, 0), skin.lerp(SKIN_SHADE, 0.75));
  Ink.outline(g, face, FW);
  if (typeId !== "regular") bangs(g, vr?.bangs ?? typeId, hair, head);
  drawFace(g, typeId, hair, skin, head, m, t, seat);
  if (vr !== undefined) accessories(g, vr, hair, head);
  switch (typeId) {
    case "regular": {
      if (rl?.perm) perm(g, hair, head);
      else bangs(g, rl?.part ? "part" : typeId, hair, head);
      if (rl?.mustache) {
        const ms = [v(-26, 37), v(-12, 29), v(0, 33), v(12, 29), v(26, 37), v(14, 41), v(0, 37), v(-14, 41)].map((p) => head.add(p));
        Ink.poly(g, ms, hair.darkened(0.25), 3.0);
      }
      if (rl?.glasses) {
        // 동그란 안경 + 피곤한 눈 밑 그늘
        for (const side of [-1.0, 1.0]) {
          const e = head.add(v(side * 23.0, 8));
          g.arc(e.add(v(0, 16)), 10.0, PI * 0.2, PI * 0.8, SKIN_SHADE, 3.0);
          Ink.rrect(g, R.of(e.add(v(-19, -15)), v(38, 30)), rgb(1, 1, 1, 0.18), 12.0, FW);
        }
        g.line(head.add(v(-4, 4)), head.add(v(4, 4)), Ink.LINE, FW);
      }
      if (rl?.beret !== undefined) {
        // 베레모 (한쪽으로 살짝 기울여 씀) + 꼭지
        const bc = head.add(v(-8, -52));
        const ber = FoodArt.ellipsePoints(bc, 76.0, 30.0, 24, 0.0, TAU);
        g.polygon(ber, rl.beret);
        Ink.shade(g, ber, v(-10, 8), rl.beret.lightened(0.18));
        Ink.outline(g, ber, FW);
        g.arc(bc.add(v(-10, -6)), 44.0, PI * 1.15, PI * 1.5, rl.beret.lightened(0.4), 5.0);
        Ink.rrect(g, R.of(bc.add(v(4, -40)), v(12, 14)), rl.beret, 5.0, 3.0);
      }
      if (rl?.cap !== undefined) {
        // 야구 모자
        const capCol = rl.cap;
        const crown = FoodArt.ellipsePoints(head.add(v(0, -28)), 66.0, 46.0, 18, PI, TAU);
        g.polygon(crown, capCol);
        Ink.shade(g, crown, v(-14, 8), capCol.darkened(0.3));
        Ink.outline(g, crown, FW);
        Ink.poly(g, [head.add(v(-12, -34)), head.add(v(94, -36)), head.add(v(98, -22)), head.add(v(-10, -22))], capCol.darkened(0.22), FW);
        Ink.circle(g, head.add(v(0, -74)), 6.0, capCol.darkened(0.22), 3.0);
      }
      break;
    }
    case "drunk":
      // 넥타이 머리띠
      Ink.rrect(g, R.of(head.add(v(-60, -44)), v(120, 16)), rgb(0.96, 0.96, 0.95), 8.0, FW);
      Ink.poly(g, [head.add(v(54, -40)), head.add(v(86, -30)), head.add(v(80, -16))], rgb(0.96, 0.96, 0.95), 3.0);
      Ink.poly(g, [head.add(v(54, -36)), head.add(v(76, -8)), head.add(v(64, -2))], rgb(0.96, 0.96, 0.95), 3.0);
      break;
    case "hurry": {
      const drip = fmod(t * 1.5, 1.0);
      const p = head.add(v(64.0, -18.0 + drip * 30.0));
      const drop = [p.add(v(-8, 0)), p.add(v(0, -18)), p.add(v(8, 0))];
      for (let k = 0; k < 7; k++) {
        const a = (k / 6.0) * PI;
        drop.push(p.add(v(Math.cos(a) * 8.0, Math.sin(a) * 8.0)));
      }
      Ink.poly(g, drop, rgb(0.6, 0.84, 1.0, 1.0 - drip * 0.7), 2.5, Ink.LINE.withA(1.0 - drip * 0.7));
      break;
    }
  }
}

const ALOHA = [rgb(0.15, 0.6, 0.7), rgb(0.9, 0.35, 0.3), rgb(0.98, 0.75, 0.2), rgb(0.35, 0.3, 0.75)];
const SWIM = [rgb(0.95, 0.35, 0.45), rgb(0.2, 0.6, 0.9), rgb(0.98, 0.78, 0.2), rgb(0.35, 0.75, 0.5)];
const BAGS = [rgb(0.9, 0.3, 0.3), rgb(0.25, 0.5, 0.85), rgb(0.95, 0.7, 0.2), rgb(0.4, 0.7, 0.45), rgb(0.95, 0.55, 0.7)];

/** 가게마다 특별한 차림 (목 + 몸통). 어깨 모양은 기본 외투와 같은 틀 */
function drawOutfit(g: Gfx, outfit: string, look: number, skin: Color): void {
  const torso = [v(-30, 52), v(-74, 64), v(-104, 96), v(-116, 150), v(-130, 320), v(130, 320), v(116, 150), v(104, 96), v(74, 64), v(30, 52)];
  if (outfit === "student") {
    // 등에 멘 책가방 (어깨 뒤로 삐죽) → 목 → 교복 (남색 재킷 + 흰 셔츠 + 리본) → 가방끈
    const bag = BAGS[look % BAGS.length];
    Ink.rrect(g, new R(-128, 40, 256, 150), bag, 34.0, LW);
    g.rect(new R(-112, 52, 224, 14), bag.lightened(0.2));
    Ink.rect(g, new R(-19, 28, 38, 40), skin, Ink.W);
    const jacket = rgb(0.2, 0.26, 0.42);
    g.polygon(torso, jacket);
    Ink.shade(g, torso, v(-30, 0), jacket.darkened(0.2));
    Ink.poly(g, [v(-30, 52), v(30, 52), v(0, 150)], rgb(0.97, 0.97, 0.95), 3.0);
    const rib = look % 2 === 0 ? rgb(0.85, 0.2, 0.25) : rgb(0.2, 0.45, 0.8);
    Ink.poly(g, [v(-2, 70), v(-26, 60), v(-24, 84), v(-2, 76)], rib, 2.5);
    Ink.poly(g, [v(2, 70), v(26, 60), v(24, 84), v(2, 76)], rib, 2.5);
    Ink.circle(g, v(0, 73), 6.0, rib.darkened(0.2), 2.5);
    Ink.poly(g, [v(-30, 52), v(0, 150), v(-20, 200), v(-70, 70)], jacket.darkened(0.12), 3.0);
    Ink.poly(g, [v(30, 52), v(0, 150), v(20, 200), v(70, 70)], jacket.darkened(0.12), 3.0);
    // 가방끈 두 줄
    for (const side of [-1.0, 1.0]) Ink.poly(g, [v(side * 52, 56), v(side * 76, 60), v(side * 92, 320), v(side * 66, 320)], bag.darkened(0.15), 3.0);
    Ink.rrect(g, new R(26, 120, 50, 18), rgb(0.98, 0.98, 0.95), 4.0, 2.5); // 이름표
    Ink.outline(g, torso, LW);
    return;
  }
  // 해변: 목·어깨는 맨살
  Ink.rect(g, new R(-19, 28, 38, 40), skin, Ink.W);
  if (outfit === "bikini") {
    g.polygon(torso, skin);
    Ink.shade(g, torso, v(-30, 0), skin.lerp(SKIN_SHADE, 0.7));
    const sw = SWIM[look % SWIM.length];
    // 쇄골 선 + 비키니 윗도리 (목에 묶는 끈)
    g.arc(v(-34, 70), 18, PI * 1.6, PI * 1.95, SKIN_SHADE.darkened(0.15), 3.0);
    g.arc(v(34, 70), 18, PI * 1.05, PI * 1.4, SKIN_SHADE.darkened(0.15), 3.0);
    g.line(v(-12, 40), v(-40, 140), sw.darkened(0.2), 4.0);
    g.line(v(12, 40), v(40, 140), sw.darkened(0.2), 4.0);
    for (const side of [-1.0, 1.0]) Ink.poly(g, [v(side * 6, 176), v(side * 66, 168), v(side * 40, 132)], sw, 3.0);
    g.line(v(-96, 172), v(96, 172), sw.darkened(0.2), 6.0);
    // 어깨에 걸친 줄무늬 수건
    const towel = [v(60, 54), v(96, 70), v(118, 140), v(126, 320), v(78, 320), v(70, 150), v(48, 72)];
    g.polygon(towel, rgb(0.98, 0.97, 0.94));
    for (const y of [150.0, 200.0, 250.0]) g.line(v(72, y), v(124, y - 4), sw.lightened(0.15), 8.0);
    Ink.outline(g, towel, 3.0);
    Ink.outline(g, torso, LW);
    return;
  }
  // 하와이안 셔츠: 화려한 바탕 + 꽃무늬 + 열린 깃 사이 흰 티
  const base = ALOHA[look % ALOHA.length];
  g.polygon(torso, base);
  Ink.shade(g, torso, v(-30, 0), base.darkened(0.2));
  const petal = [rgb(1.0, 0.95, 0.85), rgb(1.0, 0.55, 0.65), rgb(1.0, 0.85, 0.3)];
  const spots = [v(-80, 120), v(-40, 210), v(-96, 270), v(60, 110), v(88, 200), v(40, 280), v(-10, 300)];
  spots.forEach((p, k) => {
    const pc = petal[(k + look) % petal.length];
    for (let j = 0; j < 5; j++) {
      const a = (j / 5) * TAU + k;
      g.circle(p.add(v(Math.cos(a) * 11, Math.sin(a) * 11)), 9, pc);
    }
    g.circle(p, 6, rgb(0.98, 0.8, 0.25));
    g.polygon([p.add(v(14, 4)), p.add(v(36, -6)), p.add(v(22, 14))], rgb(0.2, 0.55, 0.3));
  });
  Ink.poly(g, [v(-28, 52), v(28, 52), v(0, 120)], rgb(0.98, 0.98, 0.96), 3.0);
  Ink.poly(g, [v(-30, 52), v(0, 120), v(-26, 140), v(-62, 66)], base.lightened(0.12), 3.0);
  Ink.poly(g, [v(30, 52), v(0, 120), v(26, 140), v(62, 66)], base.lightened(0.12), 3.0);
  g.line(v(0, 120), v(0, 320), Ink.LINE, 3.0);
  for (const y of [170.0, 230.0, 290.0]) Ink.circle(g, v(0, y), 5.0, rgb(0.98, 0.95, 0.85), 2.0);
  Ink.outline(g, torso, LW);
}

/** 도형 손님 꾸밈: 똥머리 · 안경 · 모자(비니 / 야구 모자 / 귀마개) */
function accessories(g: Gfx, vr: Variety, hair: Color, head: V): void {
  if (vr.bun) {
    Ink.circle(g, head.add(v(0, -72)), 22.0, hair, FW);
    g.arc(head.add(v(-4, -76)), 12.0, PI * 1.1, PI * 1.6, hair.lightened(0.3), 4.0);
  }
  if (vr.glasses) {
    for (const side of [-1.0, 1.0]) {
      const e = head.add(v(side * 23.0, 8));
      Ink.rrect(g, R.of(e.add(v(-18, -14)), v(36, 28)), rgb(1, 1, 1, 0.16), 13.0, FW);
    }
    g.line(head.add(v(-5, 4)), head.add(v(5, 4)), Ink.LINE, FW);
  }
  const c = vr.hatColor;
  switch (vr.hat) {
    case "beanie": {
      const crown = FoodArt.ellipsePoints(head.add(v(0, -26)), 67.0, 52.0, 20, PI, TAU);
      g.polygon(crown, c);
      Ink.shade(g, crown, v(-12, 8), c.darkened(0.25));
      for (const x of [-36.0, -12.0, 12.0, 36.0]) g.line(head.add(v(x, -70 + Math.abs(x) * 0.5)), head.add(v(x * 1.05, -32)), c.darkened(0.18), 3.0);
      Ink.outline(g, crown, FW);
      Ink.rrect(g, R.of(head.add(v(-68, -36)), v(136, 24)), c.lightened(0.15), 11.0, FW);
      Ink.circle(g, head.add(v(0, -82)), 13.0, c.lightened(0.35), FW);
      break;
    }
    case "cap": {
      const crown = FoodArt.ellipsePoints(head.add(v(0, -28)), 66.0, 46.0, 18, PI, TAU);
      g.polygon(crown, c);
      Ink.shade(g, crown, v(-14, 8), c.darkened(0.3));
      Ink.outline(g, crown, FW);
      Ink.poly(g, [head.add(v(-94, -36)), head.add(v(12, -34)), head.add(v(10, -22)), head.add(v(-98, -22))], c.darkened(0.22), FW);
      Ink.circle(g, head.add(v(0, -74)), 6.0, c.darkened(0.22), 3.0);
      break;
    }
    case "straw": {
      // 밀짚모자: 넓은 챙 + 리본 띠
      const straw = rgb(0.93, 0.8, 0.5);
      Ink.ellipse(g, head.add(v(0, -36)), 104.0, 26.0, straw, FW);
      const crown = FoodArt.ellipsePoints(head.add(v(0, -40)), 58.0, 44.0, 18, PI, TAU);
      g.polygon(crown, straw.lightened(0.05));
      Ink.outline(g, crown, FW);
      g.rect(new R(head.x - 57, head.y - 52, 114, 12), c);
      for (let k = 0; k < 6; k++) g.line(head.add(v(-90 + k * 36, -40)), head.add(v(-84 + k * 36, -30)), straw.darkened(0.2), 2.0);
      break;
    }
    case "sunnies": {
      // 머리 위에 올린 선글라스
      for (const side of [-1.0, 1.0]) Ink.rrect(g, R.of(head.add(v(side * 24.0 - 19.0, -52)), v(38, 22)), rgb(0.12, 0.12, 0.16), 9.0, 3.0);
      g.line(head.add(v(-6, -42)), head.add(v(6, -42)), rgb(0.12, 0.12, 0.16), 4.0);
      break;
    }
    case "yellow": {
      // 초등학생 노란 모자
      const yc = rgb(1.0, 0.82, 0.18);
      const crown = FoodArt.ellipsePoints(head.add(v(0, -30)), 66.0, 48.0, 18, PI, TAU);
      g.polygon(crown, yc);
      Ink.shade(g, crown, v(-14, 8), yc.darkened(0.25));
      Ink.outline(g, crown, FW);
      Ink.ellipse(g, head.add(v(0, -30)), 80.0, 16.0, yc.darkened(0.08), FW);
      g.polygon(FoodArt.ellipsePoints(head.add(v(0, -30)), 64.0, 10.0, 12, PI, TAU), yc);
      Ink.circle(g, head.add(v(0, -76)), 7.0, yc.lightened(0.3), 3.0);
      break;
    }
    case "earmuff": {
      g.arc(head.add(v(0, -10)), 64.0, PI * 1.05, PI * 1.95, Ink.LINE, 9.0);
      g.arc(head.add(v(0, -10)), 64.0, PI * 1.05, PI * 1.95, c.darkened(0.2), 5.0);
      for (const side of [-1.0, 1.0]) {
        const p = head.add(v(side * 60.0, 8));
        Ink.circle(g, p, 21.0, c, FW);
        g.circle(p.add(v(-5, -6)), 7.0, c.lightened(0.35));
      }
      break;
    }
  }
}

/** 뽀글뽀글 파마 (머리 둘레 동그란 컬 + 정수리 컬) */
function perm(g: Gfx, hair: Color, head: V): void {
  const c = head.add(v(0, -8));
  for (let k = 0; k <= 8; k++) {
    const a = PI * 1.02 + (PI * 0.96 * k) / 8.0;
    Ink.circle(g, c.add(v(Math.cos(a) * 58.0, Math.sin(a) * 54.0)), 19.0, k % 2 === 0 ? hair : hair.darkened(0.08), FW);
  }
  for (const x of [-22.0, 0.0, 22.0]) Ink.circle(g, c.add(v(x, -50 - (x === 0 ? 8 : 0))), 18.0, hair.lightened(0.04), FW);
  for (const x of [-36.0, -12.0, 12.0, 36.0]) g.arc(c.add(v(x, -34)), 8.0, PI * 1.1, PI * 1.9, hair.darkened(0.2), 3.0);
}

/** 앞머리: 정수리 둥근 선 + 이마 쪽 뾰족한 끝 (part = 한쪽으로 넘긴 가르마) */
function bangs(g: Gfx, typeId: string, hair: Color, head: V): void {
  let tips: V[];
  switch (typeId) {
    case "hurry":
      tips = [v(64, -6), v(50, -34), v(42, -12), v(28, -38), v(16, -14), v(0, -36), v(-14, -13), v(-28, -34), v(-42, -14), v(-54, -30), v(-64, -6)];
      break;
    case "drunk":
      tips = [v(64, -10), v(40, -40), v(18, -16), v(-6, -40), v(-30, -18), v(-50, -34), v(-64, -10)];
      break;
    case "jinsang":
      tips = [v(62, -22), v(34, -46), v(0, -52), v(-34, -46), v(-62, -22)];
      break;
    case "regular":
      tips = [v(64, -10), v(34, -30), v(6, -22), v(-26, -30), v(-64, -10)];
      break;
    case "part":
      tips = [v(64, -12), v(48, -30), v(22, -40), v(-4, -30), v(-34, -22), v(-64, -6)];
      break;
    default:
      tips = [v(64, -8), v(52, -30), v(40, -12), v(24, -34), v(8, -12), v(-8, -32), v(-22, -13), v(-38, -30), v(-52, -12), v(-64, -10)];
  }
  const pts = FoodArt.ellipsePoints(head.add(v(0, -8)), 65.0, 63.0, 18, PI, TAU);
  for (const p of tips) pts.push(head.add(p));
  g.polygon(pts, hair);
  Ink.shade(g, pts, v(-16, 8), hair.darkened(0.28));
  g.arc(head.add(v(-6, -16)), 44.0, PI * 1.18, PI * 1.45, hair.lightened(0.32), 6.0);
  Ink.outline(g, pts, FW);
}

function drawFace(g: Gfx, typeId: string, hair: Color, skin: Color, head: V, m: string, t: number, seat: number): void {
  const el = head.add(v(-23, 8));
  const er = head.add(v(23, 8));
  const brow = hair.darkened(0.4);
  const iris = IRIS[typeId] ?? IRIS.normal;
  // 추운 날 빨개진 볼
  let blush = m === "happy" ? 0.55 : 0.3;
  if (typeId === "drunk") blush = 0.6;
  FoodArt.ellipse(g, head.add(v(-33, 28)), 12.0, 6.5, rgb(1.0, 0.45, 0.42, blush));
  FoodArt.ellipse(g, head.add(v(33, 28)), 12.0, 6.5, rgb(1.0, 0.45, 0.42, blush));
  if (m === "yuck") {
    // 얼굴 아래쪽이 질림 + 이마 그늘 선
    FoodArt.ellipse(g, head.add(v(0, 30)), 46.0, 24.0, rgb(0.45, 0.75, 0.35, 0.35));
    for (let k = 0; k < 4; k++) {
      const x = -24.0 + k * 16.0;
      g.line(head.add(v(x, -34)), head.add(v(x, -16)), rgb(0.35, 0.4, 0.75, 0.6), 4.0);
    }
  }
  // 눈
  if (typeId === "jinsang") {
    const lift = m === "shock" ? v(0, -8) : v();
    for (const side of [-1.0, 1.0]) {
      const gr = R.of(head.add(v(side * 24.0 - 21.0, -4)).add(lift), v(42, 26));
      Ink.rrect(g, gr, rgb(0.08, 0.08, 0.1), 9.0, FW);
      g.line(gr.pos.add(v(8, 18)), gr.pos.add(v(20, 6)), rgb(1, 1, 1, 0.5), 3.0);
    }
    g.line(head.add(v(-4, 4)).add(lift), head.add(v(4, 4)).add(lift), Ink.LINE, 4.0);
  } else {
    switch (m) {
      case "happy":
        for (const e of [el, er]) g.arc(e.add(v(0, 6)), 11.0, PI * 1.12, PI * 1.88, Ink.LINE, 5.0);
        break;
      case "yuck":
        g.polyline([el.add(v(-10, -9)), el.add(v(7, 0)), el.add(v(-10, 9))], Ink.LINE, 5.0);
        g.polyline([er.add(v(10, -9)), er.add(v(-7, 0)), er.add(v(10, 9))], Ink.LINE, 5.0);
        break;
      case "shock":
        for (const e of [el, er]) {
          Ink.circle(g, e, 14.0, WHITE, FW);
          g.circle(e, 4.0, Ink.LINE);
        }
        break;
      default: {
        const blink = fmod(t + seat * 1.7, 4.3) < 0.12;
        for (const side of [-1.0, 1.0]) {
          const e = side < 0.0 ? el : er;
          if (blink) g.arc(e.add(v(0, -2)), 12.0, PI * 0.15, PI * 0.85, Ink.LINE, 4.5);
          else eye(g, e, side, iris, skin, m === "angry", typeId === "drunk");
        }
      }
    }
  }
  // 눈썹
  const by = -16.0;
  switch (m) {
    case "angry":
      g.line(head.add(v(-40, by - 6)), head.add(v(-10, by + 4)), brow, 6.0);
      g.line(head.add(v(40, by - 6)), head.add(v(10, by + 4)), brow, 6.0);
      break;
    case "shock":
      g.arc(el.add(v(0, -16)), 14.0, PI * 1.15, PI * 1.85, brow, 4.5);
      g.arc(er.add(v(0, -16)), 14.0, PI * 1.15, PI * 1.85, brow, 4.5);
      break;
    case "confused":
      g.arc(el.add(v(0, -14)), 14.0, PI * 1.15, PI * 1.85, brow, 4.5);
      g.line(head.add(v(12, by + 2)), head.add(v(36, by + 2)), brow, 4.5);
      break;
    case "yuck":
      g.line(head.add(v(-38, by + 2)), head.add(v(-12, by - 6)), brow, 4.5);
      g.line(head.add(v(38, by + 2)), head.add(v(12, by - 6)), brow, 4.5);
      break;
    default:
      if (typeId !== "jinsang") {
        g.polyline([head.add(v(-36, by + 2)), head.add(v(-24, by - 3)), head.add(v(-11, by - 1))], brow, 4.5);
        g.polyline([head.add(v(36, by + 2)), head.add(v(24, by - 3)), head.add(v(11, by - 1))], brow, 4.5);
      }
  }
  // 코
  g.polyline([head.add(v(3, 18)), head.add(v(6, 27)), head.add(v(0, 29))], skin.lerp(Ink.LINE, 0.55), 3.0);
  // 입
  const mouth = head.add(v(0, 40));
  switch (m) {
    case "angry":
      g.arc(mouth.add(v(0, 12)), 13.0, PI * 1.15, PI * 1.85, Ink.LINE, 4.5);
      break;
    case "happy": {
      const smile = FoodArt.ellipsePoints(mouth.add(v(0, -6)), 15.0, 13.0, 12, 0.0, PI);
      g.polygon(smile, rgb(0.6, 0.2, 0.2));
      FoodArt.ellipse(g, mouth.add(v(0, 3)), 7.0, 3.5, rgb(0.95, 0.5, 0.52));
      Ink.outline(g, smile, 3.5);
      break;
    }
    case "yuck": {
      const pts: V[] = [];
      for (let k = 0; k < 9; k++) pts.push(mouth.add(v(-20.0 + k * 5.0, -4.0 + (k % 2 === 0 ? 4.0 : -4.0))));
      Ink.ellipse(g, mouth.add(v(8, 6)), 8.0, 10.0, rgb(0.92, 0.42, 0.45), 3.0);
      g.polyline(pts, Ink.LINE, 4.5);
      break;
    }
    case "shock":
      Ink.ellipse(g, mouth, 11.0, 14.0, rgb(0.35, 0.12, 0.12), 3.5);
      FoodArt.ellipse(g, mouth.add(v(0, 7)), 6.0, 4.0, rgb(0.9, 0.45, 0.45));
      break;
    case "confused":
      g.line(mouth.add(v(-12, 0)), mouth.add(v(10, -6)), Ink.LINE, 4.0);
      break;
    default:
      if (typeId === "drunk") g.arc(mouth.add(v(0, -12)), 14.0, PI * 0.22, PI * 0.78, Ink.LINE, 4.0);
      else g.line(mouth.add(v(-8, 0)), mouth.add(v(8, -1)), Ink.LINE, 3.5);
  }
}

/** 만화 눈: 흰자 + 홍채 + 동공 + 반짝임 + 굵은 윗눈꺼풀. narrow = 화난 눈, sleepy = 반쯤 감긴 눈(취객) */
function eye(g: Gfx, c: V, side: number, iris: Color, skin: Color, narrow: boolean, sleepy: boolean): void {
  const ry = narrow ? 9.0 : 13.0;
  g.polygon(FoodArt.ellipsePoints(c, 11.0, ry, 18), WHITE);
  g.polygon(FoodArt.ellipsePoints(c.add(v(-side * 1.0, 1.0)), 8.5, ry - 2.0, 16), iris);
  g.polygon(FoodArt.ellipsePoints(c.add(v(-side * 1.0, 2.0)), 4.5, (ry - 2.0) * 0.55, 12), iris.darkened(0.55));
  g.circle(c.add(v(-3.5, -ry * 0.4)), 3.2, WHITE);
  g.circle(c.add(v(3.0, ry * 0.4)), 1.6, rgb(1, 1, 1, 0.85));
  if (sleepy) {
    g.rect(new R(c.x - 14.0, c.y - ry - 3.0, 28.0, ry + 1.0), skin);
    g.line(c.add(v(-14, -2)), c.add(v(14, -2)), Ink.LINE, 5.0);
  } else {
    const lid = FoodArt.ellipsePoints(c, 13.0, ry + 1.0, 10, PI * 1.04, PI * 1.96);
    g.polyline(lid, Ink.LINE, 5.0);
    // 바깥 눈꼬리
    const outer = side < 0.0 ? lid[0] : lid[lid.length - 1];
    g.line(outer, outer.add(v(side * 5.0, 3.0)), Ink.LINE, 4.0);
  }
  if (narrow) {
    // 안쪽이 내려간 눈꺼풀
    const innerX = c.x - side * 13.0;
    g.line(v(c.x + side * 13.0, c.y - ry - 1.0), v(innerX, c.y - 2.0), Ink.LINE, 5.0);
  }
  g.arc(c.add(v(0, 1)), 9.0, PI * 0.3, PI * 0.7, Ink.LINE.withA(0.6), 2.0);
}
