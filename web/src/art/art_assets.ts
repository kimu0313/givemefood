// 그림 파일을 넣는 자리. 아래 목록에 파일 이름을 적고 public/assets/art/... 에 PNG 를 넣으면 도형 그림 대신 그 그림을 쓴다.
//
//   public/assets/art/backgrounds/<가게 id>.png  영업 화면 위쪽 배경 (가로 1920 × 세로 580 기준). 가게 id: pocha / bunsik / market / beach / suljip
//   public/assets/art/food/<메뉴 id>.png         완성된 메뉴 그림 (정사각형, 투명 배경, 256×256 정도). 주문 말풍선·재료 카드·완성 그릇에 쓴다
//   public/assets/art/customers/guest_*.png      사용자 캐릭터 (아래 CUSTOMER_SPRITES 로 손님 종류에 나눔)
//   public/assets/art/map/<가게 id>.webp         스테이지 지도의 가게 건물 (투명 배경, MAP_BUILDING_FILES 에 적기)

import { R, V } from "../engine/geom.ts";
import { WORLD_FILE } from "./map_world.ts";
import type { Gfx, Img } from "../engine/gfx.ts";
import { SHOP_ART } from "./shop_art.ts";

export const ROOT = "assets/art";

/**
 * 시작(메인) 화면 그림 (2026-11-16 사용자 "이건 메인 화면으로": 포장마차 다섯 사람 + 제목 + 그림 속 버튼 4개
 * 게임 시작·이어하기·설정·종료, 원본 art_src/title_menu.png → tools/to_webp.mjs). 버튼 자리는 ui/title.ts MENU.
 * 예전 분식집 네 친구 그림(title/main.webp, art_src/title_main.png)은 더 안 씀.
 */
export const TITLE_IMAGE = `${ROOT}/title/menu.webp`;

/** 스테이지 지도의 가게 건물 그림 (가게 id → public/assets/art/map/ 파일). 없는 가게는 도형 그림.
 *  2026-11-13 사용자가 준 그림: pocha = 빨간 천막 포장마차 (원본 art_src/map_pocha.png, 검은 배경을 오려 냄),
 *  bunsik = 2층 동네분식 (원본 art_src/map_bunsik.png, 흰 배경을 오려 내고 난간 사이 구멍도 뚫고 바닥 그림자는 반투명 갈색으로) */
export const MAP_BUILDING_FILES: Record<string, string> = {
  pocha: "pocha.webp",
  bunsik: "bunsik.webp",
  market: "market.webp",
  beach: "beach.webp",
  suljip: "suljip.webp",
};

/** 있는 그림 파일 (없는 건 도형 그림). 새 그림을 넣으면 여기에도 적는다 */
export const BACKGROUND_FILES: string[] = [];
export const FOOD_FILES: string[] = [];
/**
 * 메뉴 UI 아이콘 그림 (public/assets/art/icons/<메뉴 id>.png, tools/food_icons.mjs): 주문 말풍선·재료 카드·지도·장보기·새 메뉴 안내에만.
 * 손님에게 내는 그릇 음식·조리 중인 음식은 그대로 (2026-11-18 사용자 "손님한테 주는 음식 말고 UI 에만")
 */
/** 지도 UI 조각 (ui/map_<이름>.webp, ui/map_widgets.ts mapUi) */
/** 미식가 스테이지 만화 칸 (ui/comic.ts COMICS, tools/comic_panels.mjs) — 미리 받아 둠 */
/**
 * 미식가가 다녀간 뒤 "다음 이야기"의 가게 앞 그림 (별 1~5개마다 한 장, 2026-11-20 사용자 그림 — 첫 번째 가게).
 * art_src/fame_<가게>_<별>.png → tools/to_webp.mjs → fame/<가게>_<별>.webp. 그림이 없는 가게는 settlement 가 직접 그림
 */
export const FAME_SHOPS = ["pocha"];
export function fameImagePath(shopId: string, grade: number): string | null {
  return FAME_SHOPS.includes(shopId) && grade >= 1 && grade <= 5 ? `${ROOT}/fame/${shopId}_${grade}.webp` : null;
}
export const FAME_PRELOAD = FAME_SHOPS.flatMap((sid) => [1, 2, 3, 4, 5].map((n) => `${ROOT}/fame/${sid}_${n}.webp`));
export const COMIC_PRELOAD = ["pocha", "bunsik"].flatMap((sid) => [1, 2, 3, 4, 5, 6].map((n) => `${ROOT}/comic/${sid}_${n}.webp`));
export const MAP_UI_FILES = [
  "btn_title", "btn_book", "btn_round", "title", "wallet", "plate", "btn_green", "btn_red", "btn_green_blank",
  "disc_red", "disc_gray", "disc_gold", "disc_blue", "disc_purple", "disc_dim", "tag_red", "tag_purple",
];
export const ICON_FILES: string[] = ["tteokbokki", "sundae", "odeng", "twigim", "ramen", "gimbap", "donkatsu", "jjolmyeon", "tornado", "hotteok", "dakgangjeong", "hotdog", "clam", "shrimp", "squid", "pajeon", "budae", "dakbal", "egg_roll", "golbaengi"];
export const CUSTOMER_FILES = [
  "guest_imo",
  // 2026-11-17 사용자 손님 그림 (art_src/customers/sheet_a·c.png → tools/customer_sheet.mjs)
  // (2026-11-18 사용자가 반다나·파란 셔츠·긴 머리 소녀·폴로·뾰족 머리·시계 소년·턱 괸 여자 그림 7장을 직접 지움 → 뺌)
  "guest_punk", "guest_office", "guest_rider", "guest_granny", "guest_chef",
  // 2026-11-18 사용자 손님 그림 5명 (art_src/customers/sheet_d.png): 콧수염 아저씨 · 안경 대학생(시험지) · 앞치마 카페 알바생 · 초록 모자 경비 · 후드 소년
  "guest_mustache", "guest_student", "guest_barista", "guest_guard", "guest_kid",
  // 2026-11-18 사용자 손님 그림 4명 (art_src/customers/sheet_e.png): 땋은 머리 여학생 · 노란 모자 소년 · 턱 괸 교복 남학생 · 양갈래 여자아이
  "guest_schoolgirl", "guest_capboy", "guest_uniform", "guest_twintail",
  // 2026-11-18 사용자 손님 그림 (art_src/customers/longhair.png): 긴 머리 · 귀걸이 · 넥타이 교복 여학생
  "guest_longhair",
  // 2026-11-18 사용자 그림 (art_src/customers/sheet_f.png 5명 중 1·3번째만): 반창고 붙인 트레이닝 재킷 청년 · 수건 두른 웃는 아저씨
  "guest_jacket", "guest_worker",
  // 미식가 5명 (art_src/customers/sheet_gourmets.png → tools/customer_sheet.mjs, 투명 바탕) — 미식가 스테이지에만 나옴
  "guest_critic_kang", "guest_critic_seo", "guest_critic_han", "guest_critic_hwang", "guest_critic_baek",
  // 단골 "택시 기사 박씨" (2026-11-17 사용자 일러스트 art_src/customers/taxi.png — 도형 그림 대신)
  "guest_taxi",
];

// 사용자가 준 캐릭터 그림 6명 (2026-11-12, 원본 두 장에서 한 명씩 잘라 상반신으로: assets/art/customers/guest_*.png)
// 손님 종류마다 쓸 그림 (여러 개면 손님마다 하나, 화면에 같은 사람이 겹치지 않게). 없는 종류는 도형 그림.
//   일반 손님 = 반다나 · 초록 줄무늬 폴로 · 긴 머리 소녀 · 파란 셔츠 / 급한 손님 = 손목시계 찬 무심한 소년 / 진상 = 노란 뾰족 머리
//   단골 중 "시험 끝난 대학생" = 파란 셔츠. 취객·다른 단골(할머니·택시 기사 등)은 어울리는 그림이 없어 도형 그림 그대로
// 2026-11-17 사용자 손님 그림 추가: 일반 = 두건 쓴 요리사 (땋은 머리 청년은 2026-11-17 사용자 요청으로 뺌) / 급한 손님 = 배달 기사 / 진상 = 담배 문 금발 /
//   취객 = 턱 괴고 볼 빨간 여자 (어른) / 단골 "야근하는 김 대리" = 넥타이·머그컵 회사원 · "동네 할머니" = 앞치마 할머니
export const CUSTOMER_SPRITES: Record<string, string[]> = {
  // 단골 그림은 보통 손님 묶음에 넣지 않음 (넣으면 단골이 올 때 같은 얼굴이 화면에 둘·하루에 두 번, 2026-11-18)
  // 2026-11-18 보통 손님 = 요리사 · 후드 소년 · 땋은 머리 여학생 · 양갈래 여자아이 / 급한 손님 = 배달 기사 · 노란 모자 소년 /
  //   진상 = 담배 문 금발 · 턱 괸 교복 남학생 / 취객 = 콧수염 아저씨 (종류 그림이 그날 다 왔으면 다른 종류 그림을 빌려 씀 — pickGuestSprite)
  normal: ["guest_chef", "guest_kid", "guest_schoolgirl", "guest_twintail", "guest_longhair"],
  hurry: ["guest_rider", "guest_capboy", "guest_jacket"],
  jinsang: ["guest_punk", "guest_uniform"],
  drunk: ["guest_mustache", "guest_worker"],
  // 미식가 (이벤트 손님) = 미식가 스테이지마다 다른 사람 (D.EVENTS[].critic). 보통 손님 그림 묶음에는 절대 넣지 않음
  "gourmet:kang": ["guest_critic_kang"],
  "gourmet:seo": ["guest_critic_seo"],
  "gourmet:han": ["guest_critic_han"],
  "gourmet:hwang": ["guest_critic_hwang"],
  "gourmet:baek": ["guest_critic_baek"],
  "regular:office": ["guest_office"],
  "regular:taxi": ["guest_taxi"],
  "regular:grandma": ["guest_granny"],
  "regular:student": ["guest_student"], // 2026-11-18 시험지 든 안경 대학생
  "regular:cafe": ["guest_barista"], // 2026-11-18 앞치마 카페 알바생 수아
  "regular:guard": ["guest_guard"], // 2026-11-18 초록 모자 · 무전기 경비 아저씨 (도형 그림 대신)
  // 포장마차 이모 = 튜토리얼 이모 그림 (2026-11-17, art_src/tutorial_imo.png → ui/imo.webp → 380×640 으로 customers/guest_imo.png)
  imo: ["guest_imo"],
};
// 머리 크기 맞추기 (2026-11-12 "머리 크기는 똑같게", 2026-11-17 "머리 크기 기준으로 스케일, 머리 작은 캐릭터는 캐릭터 자체를 키워",
// 2026-11-18 "손님들 머리 크기가 다 달라, 똑같게"): 머리카락·모자·두건은 빼고 얼굴만 잰다 — 전에는 머리카락까지 넣어서
// 머리숱이 많은 사람(할머니·이모·긴 머리 소녀)은 얼굴이 작아지고 짧은 머리(뾰족 머리·택시 기사)는 얼굴이 커졌음 (얼굴 크기 62~101).
//   얼굴 크기 = √(얼굴 폭 W × 눈~턱 E). W = 눈과 입 사이(눈 + 0.35E) 높이에서 양 볼 바깥 선 사이, E = 두 눈 가운데 높이 ~ 턱 끝
// 잘라 낸 그림(380×640)에서 잰 [얼굴 가운데 x, 눈 높이 y, 얼굴 크기] → 얼굴이 모두 SPRITE_HEAD 가 되게 키우고 줄여서,
// 눈은 SPRITE_EYE_Y + SPRITE_DY(키 차이) 높이에, 얼굴 가운데는 손님 자리 가운데에. 얼굴이 작게 그려진 그림은 몸까지 같이 커짐.
// 새 그림을 넣으면 얼굴을 확대 격자로 재서 여기에 (모두 같은 화면 배율로 나란히 놓고 확인)
export const SPRITE_HEADS: Record<string, [number, number, number]> = {
  guest_taxi: [188, 95, 100.7], // W 104 × E 97.5 (고개를 들고 웃음)
  guest_critic_kang: [199, 124, 91.9], // 97 × 87
  guest_critic_seo: [161, 131, 103.1], // 115 × 92.5
  guest_critic_han: [158, 128, 101.4], // 105 × 98
  guest_critic_hwang: [160, 122, 101.5], // 117 × 88 (고개 기울임)
  guest_critic_baek: [140, 127, 107.9], // 113 × 103
  guest_imo: [203, 196.7, 105.5], // 121 × 92
  guest_punk: [232, 122.8, 95.3], // 102 × 89
  guest_office: [176.5, 120, 81.3], // 87 × 76
  guest_rider: [135, 95, 81.5], // 83 × 80
  guest_granny: [207.5, 157, 110.5], // 113 × 108 (부푼 머리 뺌)
  guest_chef: [240, 88, 101.5], // 117 × 88 (두건 뺌)
  // 2026-11-18 sheet_d
  guest_mustache: [189, 90, 103.0], // 110 × 96.5
  guest_student: [186.8, 137, 95.5], // 102 × 89.5 (안경)
  guest_barista: [185, 149.4, 113.6], // 114.7 × 112.6 (긴 얼굴, 머리카락 뺌)
  guest_guard: [185, 104.7, 94.7], // 103 × 87 (모자 뺌)
  guest_kid: [189.1, 174, 128.6], // 144 × 114.8 (귀 뺌)
  // 2026-11-18 sheet_e (나란히 놓고 보니 두 여자아이 얼굴이 살짝 작아 보여 ~6% 키움)
  guest_schoolgirl: [177, 174, 112], // 145 × 98 (눈 감고 웃음) → 119 를 112 로
  guest_capboy: [186, 155, 130], // 170 × ~100 (고개 들고 입 벌림, 벌린 턱은 덜 셈)
  guest_uniform: [197, 176, 104], // 140 × 77 (턱 괸 손 뺌, 고개 기울임)
  guest_twintail: [196.5, 164, 110], // 161 × 85 (둥근 얼굴) → 117 을 110 으로
  guest_longhair: [155, 140.6, 89], // ~95 × 84 (고개를 크게 기울임, 기울어 넓어진 폭은 덜 셈)
  guest_jacket: [244.7, 120.6, 95], // 112 × 61 = 82.6 이지만 고개를 들어 턱이 짧게 보여서, 나란히 놓고 다른 얼굴에 맞춤
  guest_worker: [175, 103, 97.6], // 112 × ~85 (크게 웃어 벌린 턱은 덜 셈)
};
export const SPRITE_HEAD = 80.0; // 손님 노드 기준 얼굴 크기 √(폭 × 눈~턱) (2026-11-18 전 그림의 가운데값)
/** 그림마다 크기 보정 (눈 높이 기준). 2026-11-18 얼굴 크기로 맞추면서 요리사 0.84 는 뺌 (얼굴 기준이면 원래 그 크기) */
export const SPRITE_SIZE_K: Record<string, number> = {};
/** 그림 속 몸이 끝나는 높이 (잘라 낸 그림 px, 없으면 640 = 그림 끝까지). 손님을 위로 올릴 때 몸 끝이 카운터 위로 뜨지 않게 */
export const SPRITE_BOTTOM: Record<string, number> = {
  guest_granny: 555, guest_imo: 636, guest_office: 556, guest_punk: 568, guest_rider: 485,
  guest_mustache: 494, guest_student: 576, guest_guard: 492, guest_kid: 554, guest_uniform: 538, guest_twintail: 518, guest_longhair: 545, guest_jacket: 566, guest_worker: 504,
  guest_critic_kang: 541, guest_critic_seo: 579, guest_critic_han: 528, guest_critic_hwang: 560, guest_critic_baek: 562, guest_taxi: 615,
};
/** 키 차이 (눈 높이를 이만큼 아래로) */
export const SPRITE_DY: Record<string, number> = { guest_imo: 10, guest_granny: 18, guest_chef: -28, guest_critic_seo: 10, guest_critic_baek: 12, guest_barista: 12, guest_kid: 22, guest_schoolgirl: 16, guest_capboy: 18, guest_uniform: 6, guest_twintail: 24, guest_longhair: 14 };
export const SPRITE_EYE_Y = 10.0; // 손님 머리 자리(0,0) 기준 눈 높이
/** 도형 그림(단골 경비 아저씨) 크기: 얼굴(폭 100.8 × 눈 8 ~ 턱 63.6 = 55.6 → √ = 74.9)을 SPRITE_HEAD 에 맞춤 */
export const PROC_SCALE = SPRITE_HEAD / 74.9;
export const SPRITE_SIZE = new V(380, 640); // 잘라 낸 캐릭터 그림 크기

const cache = new Map<string, HTMLImageElement | null>();

/** 가게 영업 화면 그림 (사용자 그림, src/art/shop_art.ts SHOP_ART) — 뒤층 (손님 뒤, 그림 전체) */
export function shopImage(shopId: string): Img | null {
  const a = SHOP_ART[shopId];
  return a === undefined ? null : texture(`${ROOT}/${a.file}`);
}

/** 가게 그림 앞층 (카운터·조리대와 카운터 위 물건만, 나머지 투명) — 손님 앞 */
export function shopFrontImage(shopId: string): Img | null {
  const a = SHOP_ART[shopId];
  return a === undefined ? null : texture(`${ROOT}/${a.front}`);
}

/** 그림 불러오기 (브라우저에서만, 다 받기 전엔 null) */
export function texture(path: string): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  let img = cache.get(path);
  if (img === undefined) {
    const im = new Image();
    im.decoding = "async";
    im.src = path;
    cache.set(path, im);
    img = im;
  }
  return img !== null && img.complete && img.naturalWidth > 0 ? img : null;
}

/** 시작할 때 미리 받아 둠. onProgress(받은 수, 전체 수) */
export function preload(onProgress: (done: number, total: number) => void = () => {}): Promise<void> {
  const paths = [TITLE_IMAGE, `${ROOT}/${WORLD_FILE}`, ...COMIC_PRELOAD, ...FAME_PRELOAD] // 지도 배경 그림 (map_art.SHOW_WORLD_IMAGE)
    .concat(Object.values(MAP_BUILDING_FILES).map((f) => `${ROOT}/map/${f}`))
    .concat(CUSTOMER_FILES.map((n) => `${ROOT}/customers/${n}.png`))
    .concat(BACKGROUND_FILES.map((n) => `${ROOT}/backgrounds/${n}.png`))
    .concat(Object.values(SHOP_ART).flatMap((a) => [`${ROOT}/${a.file}`, `${ROOT}/${a.front}`]))
    .concat(FOOD_FILES.map((n) => `${ROOT}/food/${n}.png`))
    .concat(ICON_FILES.map((n) => `${ROOT}/icons/${n}.png`))
    .concat(["tut_panel", "tut_tag", "tut_ok", "tut_skip"].map((n) => `${ROOT}/ui/${n}.webp`)) // 튜토리얼 말풍선 (CSS 그림, 처음 뜰 때 깜빡이지 않게)
    .concat(MAP_UI_FILES.map((n) => `${ROOT}/ui/map_${n}.webp`)); // 지도 UI 조각 (사용자 예시 그림, tools/map_ui_art.mjs)
  let done = 0;
  const one = () => {
    done += 1;
    onProgress(done, paths.length);
  };
  return Promise.all(
    paths.map(
      (p) =>
        new Promise<void>((res) => {
          texture(p);
          const im = cache.get(p);
          const fin = () => {
            one();
            res();
          };
          if (!im || im.complete) return fin();
          im.onload = fin;
          im.onerror = fin;
        }),
    ),
  ).then(() => undefined);
}

export function titleImage(): Img | null {
  return texture(TITLE_IMAGE);
}

/** 스테이지 지도 배경 그림 한 장 (사용자 그림, tools/world_map.mjs 로 잘라 냄) */
export function worldMap(): Img | null {
  return texture(`${ROOT}/${WORLD_FILE}`);
}

export function mapBuilding(shopId: string): Img | null {
  const f = MAP_BUILDING_FILES[shopId];
  return f === undefined ? null : texture(`${ROOT}/map/${f}`);
}

export function background(shopId: string): Img | null {
  return BACKGROUND_FILES.includes(shopId) ? texture(`${ROOT}/backgrounds/${shopId}.png`) : null;
}

export function food(menuId: string): Img | null {
  return FOOD_FILES.includes(menuId) ? texture(`${ROOT}/food/${menuId}.png`) : null;
}

/** 메뉴 UI 아이콘 그림 (ICON_FILES, 없으면 null = 도형 아이콘) */
export function menuIcon(menuId: string): Img | null {
  return ICON_FILES.includes(menuId) ? texture(`${ROOT}/icons/${menuId}.png`) : null;
}

/** 그 손님이 쓸 수 있는 캐릭터 그림 이름들 (그림 파일이 있는 것만) */
export function customerSpritePool(typeId: string, regularId = ""): string[] {
  // 단골은 regular:<id>, 미식가는 gourmet:<미식가 id> (regularId 자리에 미식가 id)
  const key = typeId === "regular" ? `regular:${regularId}` : typeId === "gourmet" ? `gourmet:${regularId}` : typeId;
  return (CUSTOMER_SPRITES[key] ?? []).filter((n) => CUSTOMER_FILES.includes(n));
}

export function customerSprite(name: string): Img | null {
  return CUSTOMER_FILES.includes(name) ? texture(`${ROOT}/customers/${name}.png`) : null;
}

/** 캐릭터 그림을 놓을 자리: 얼굴 너비·눈 높이·얼굴 가운데를 맞춘 사각형 (손님 머리 자리 head 기준) */
/** 캐릭터 그림을 그릴 네모: head = 손님 머리 자리. withHeight = 키 차이(SPRITE_DY)도 (단골 도감 얼굴은 빼고) */
export function customerSpriteRect(name: string, size: V, head: V, withHeight = true): R {
  const [cx, eyeY, headSize] = SPRITE_HEADS[name] ?? [190.0, 110.0, SPRITE_HEAD];
  const k = (SPRITE_HEAD / Math.max(1.0, headSize)) * (SPRITE_SIZE_K[name] ?? 1.0);
  const dy = withHeight ? (SPRITE_DY[name] ?? 0.0) : 0.0;
  return new R(head.x - cx * k, head.y + SPRITE_EYE_Y + dy - eyeY * k, size.x * k, size.y * k);
}

/** 머리 자리(0,0) 아래로 그림 몸이 이어지는 길이 (손님 노드 기준, 키 차이 포함) */
export function spriteBodyBelow(name: string): number {
  const [, eyeY, headSize] = SPRITE_HEADS[name] ?? [190.0, 110.0, SPRITE_HEAD];
  const k = (SPRITE_HEAD / Math.max(1.0, headSize)) * (SPRITE_SIZE_K[name] ?? 1.0);
  return SPRITE_EYE_Y + (SPRITE_DY[name] ?? 0.0) + ((SPRITE_BOTTOM[name] ?? 640) - eyeY) * k;
}

/** 보통 손님 종류 (그림 캐릭터만 씀 — 2026-11-17 사용자 "도형 캐릭터는 단골 빼고 없애 줘") */
export const GUEST_TYPES = ["normal", "hurry", "jinsang", "drunk"];
/** 어린 손님 그림 (취객은 안 됨) */
export const YOUNG_SPRITES = ["guest_kid", "guest_schoolgirl", "guest_capboy", "guest_uniform", "guest_twintail", "guest_longhair", "guest_jacket"];

/** 보통 손님이 쓸 수 있는 그림 전부 (종류 그림이 모자라면 다른 종류 그림을 빌려 씀) */
export function guestSpritePool(typeId: string): string[] {
  const all: string[] = [];
  for (const t of GUEST_TYPES) for (const n of customerSpritePool(t)) if (!all.includes(n)) all.push(n);
  return typeId === "drunk" ? all.filter((n) => !YOUNG_SPRITES.includes(n)) : all;
}

/**
 * 보통 손님 얼굴 고르기: 화면에 지금 있는 사람(onScreen)은 절대 안 겹치고,
 * 그 종류 그림 중 오늘 안 온 사람 → 다른 종류 그림 중 오늘 안 온 사람 → (다 왔으면) 가장 오래전에 온 사람.
 * usedToday 는 온 순서대로 (Set 순서 = 오래된 것부터). rnd = 0 이상 정수 난수
 */
export function pickGuestSprite(typeId: string, onScreen: string[], usedToday: Set<string> | null, rnd: () => number): string {
  const own = customerSpritePool(typeId);
  const all = guestSpritePool(typeId);
  const free = (list: string[]) => list.filter((n) => !onScreen.includes(n) && !(usedToday?.has(n) ?? false));
  for (const list of [own, all]) {
    const f = free(list);
    if (f.length > 0) return f[rnd() % f.length];
  }
  const order = usedToday ? [...usedToday] : [];
  for (const list of [own, all]) {
    const old = order.find((n) => list.includes(n) && !onScreen.includes(n));
    if (old !== undefined) return old;
  }
  return own[0] ?? all[0] ?? "";
}

/** 텍스처를 c 를 중심으로, 긴 변이 box 가 되게 그린다 */
export function drawCentered(g: Gfx, tex: Img, c: V, box: number, alpha = 1.0): void {
  const tw = tex.width;
  const th = tex.height;
  const k = box / Math.max(tw, th);
  g.texture(tex, new R(c.x - tw * k * 0.5, c.y - th * k * 0.5, tw * k, th * k), alpha);
}
