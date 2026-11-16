// 그림 파일을 넣는 자리. 아래 목록에 파일 이름을 적고 public/assets/art/... 에 PNG 를 넣으면 도형 그림 대신 그 그림을 쓴다.
//
//   public/assets/art/backgrounds/<가게 id>.png  영업 화면 위쪽 배경 (가로 1920 × 세로 580 기준). 가게 id: pocha / bunsik / market / beach / suljip
//   public/assets/art/food/<메뉴 id>.png         완성된 메뉴 그림 (정사각형, 투명 배경, 256×256 정도). 주문 말풍선·재료 카드·완성 그릇에 쓴다
//   public/assets/art/customers/guest_*.png      사용자 캐릭터 (아래 CUSTOMER_SPRITES 로 손님 종류에 나눔)
//   public/assets/art/map/<가게 id>.webp         스테이지 지도의 가게 건물 (투명 배경, MAP_BUILDING_FILES 에 적기)

import { R, V } from "../engine/geom.ts";
import type { Gfx, Img } from "../engine/gfx.ts";

export const ROOT = "assets/art";

/** 로딩·시작 화면 그림 (2026-11-12 사용자가 준 분식집 네 친구 일러스트, 원본 PNG = art_src/title_main.png) */
export const TITLE_IMAGE = `${ROOT}/title/main.webp`;

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
export const CUSTOMER_FILES = ["guest_spiky", "guest_blueshirt", "guest_bandana", "guest_polo", "guest_watch", "guest_girl"];

// 사용자가 준 캐릭터 그림 6명 (2026-11-12, 원본 두 장에서 한 명씩 잘라 상반신으로: assets/art/customers/guest_*.png)
// 손님 종류마다 쓸 그림 (여러 개면 손님마다 하나, 화면에 같은 사람이 겹치지 않게). 없는 종류는 도형 그림.
//   일반 손님 = 반다나 · 초록 줄무늬 폴로 · 긴 머리 소녀 · 파란 셔츠 / 급한 손님 = 손목시계 찬 무심한 소년 / 진상 = 노란 뾰족 머리
//   단골 중 "시험 끝난 대학생" = 파란 셔츠. 취객·다른 단골(할머니·택시 기사 등)은 어울리는 그림이 없어 도형 그림 그대로
export const CUSTOMER_SPRITES: Record<string, string[]> = {
  normal: ["guest_bandana", "guest_polo", "guest_girl", "guest_blueshirt"],
  hurry: ["guest_watch"],
  jinsang: ["guest_spiky"],
  "regular:student": ["guest_blueshirt"],
};
// 캐릭터마다 그림 속 얼굴 크기가 달라서 (2026-11-12 사용자 요청 "머리 크기는 똑같게") 얼굴로 맞춘다:
// 잘라 낸 그림(380×640)에서 잰 [얼굴 왼쪽 x, 얼굴 오른쪽 x (볼~볼, 귀·머리카락 빼고), 눈 높이 y]
// → 얼굴 너비가 모두 SPRITE_FACE_W 가 되게 키우고 줄여서, 눈은 SPRITE_EYE_Y 높이에, 얼굴 가운데는 손님 자리 가운데에 맞춘다
export const SPRITE_FACES: Record<string, [number, number, number]> = {
  guest_spiky: [160.0, 240.0, 110.0],
  guest_blueshirt: [140.0, 228.0, 107.0],
  guest_bandana: [145.0, 232.0, 102.0],
  guest_polo: [160.0, 242.0, 112.0],
  guest_watch: [152.0, 245.0, 117.0],
  guest_girl: [150.0, 235.0, 142.0],
};
export const SPRITE_FACE_W = 80.0; // 화면(손님 노드 기준)에서 얼굴 너비
export const SPRITE_EYE_Y = 4.0; // 손님 머리 자리(0,0) 기준 눈 높이
export const SPRITE_SIZE = new V(380, 640); // 잘라 낸 캐릭터 그림 크기

const cache = new Map<string, HTMLImageElement | null>();

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
  const paths = [TITLE_IMAGE]
    .concat(Object.values(MAP_BUILDING_FILES).map((f) => `${ROOT}/map/${f}`))
    .concat(CUSTOMER_FILES.map((n) => `${ROOT}/customers/${n}.png`))
    .concat(BACKGROUND_FILES.map((n) => `${ROOT}/backgrounds/${n}.png`))
    .concat(FOOD_FILES.map((n) => `${ROOT}/food/${n}.png`));
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

/** 그 손님이 쓸 수 있는 캐릭터 그림 이름들 (그림 파일이 있는 것만) */
export function customerSpritePool(typeId: string, regularId = ""): string[] {
  const key = typeId === "regular" ? `regular:${regularId}` : typeId;
  return (CUSTOMER_SPRITES[key] ?? []).filter((n) => CUSTOMER_FILES.includes(n));
}

export function customerSprite(name: string): Img | null {
  return CUSTOMER_FILES.includes(name) ? texture(`${ROOT}/customers/${name}.png`) : null;
}

/** 캐릭터 그림을 놓을 자리: 얼굴 너비·눈 높이·얼굴 가운데를 맞춘 사각형 (손님 머리 자리 head 기준) */
export function customerSpriteRect(name: string, size: V, head: V): R {
  const f = SPRITE_FACES[name] ?? [150.0, 230.0, 110.0];
  const k = SPRITE_FACE_W / Math.max(1.0, f[1] - f[0]);
  const faceCx = (f[0] + f[1]) * 0.5;
  return new R(head.x - faceCx * k, head.y + SPRITE_EYE_Y - f[2] * k, size.x * k, size.y * k);
}

/** 텍스처를 c 를 중심으로, 긴 변이 box 가 되게 그린다 */
export function drawCentered(g: Gfx, tex: Img, c: V, box: number, alpha = 1.0): void {
  const tw = tex.width;
  const th = tex.height;
  const k = box / Math.max(tw, th);
  g.texture(tex, new R(c.x - tw * k * 0.5, c.y - th * k * 0.5, tw * k, th * k), alpha);
}
