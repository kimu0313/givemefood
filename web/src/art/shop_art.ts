// 가게 영업 화면 그림 (2026-11-17 사용자 그림 "이거 첫 번째 / 두 번째 가게에 적용해 줘", 2026-11-18 다섯 가게 모두 새 그림):
// 그림은 두 층 (원본 art_src/shop_<id>.png → tools/shop_art.mjs): 뒤층 <id>.webp = 그림 전체 (손님 뒤, StreetArt),
// 앞층 <id>_front.webp = 카운터·조리대와 카운터 위 물건만 (손님 앞, KitchenView) — 사용자 "조리대와 배경을 분리해 줘, 손님은 그 사이에".
// 게임은 그 위에 움직이는 것만 그린다.
// 아래 자리 값은 모두 "그림 좌표" = 그림을 1920 폭으로 키웠을 때의 픽셀 [x0, y0, x1, y1]. 화면에서는 세 띠로 나눠 세로로 늘이고 줄임
// (2026-11-17 사용자 "손님이 너무 안 보여, 조리대 비율을 낮춰 줘" — 카운터를 내리고 조리대를 줄임, mapY):
//   그림 0 ~ cut (거리·카운터·완성 칸 선반)  → 화면 0 ~ ART_BANDS.kitchenTop  (늘어남)
//   그림 cut ~ kitchenBottom (조리대)       → 화면 kitchenTop ~ shelfTop       (줄어듦)
//   그림 kitchenBottom ~ 1080 (재료 카드 줄) → 화면 shelfTop ~ 1080 (게임이 바닥 띠로 덮음)
//   board     = 그림 속 도마 자리 (게임은 도마 판을 안 그리고 손질 중인 음식·안내만)
//   trayDy    = 완성 칸 그릇을 그림 속 선반 높이에 맞춰 내림 (화면 px)
//   kitchen   = 그림 속 조리 도구 자리, D.shopLayout 순서대로 (게임은 도구 틀을 안 그리고 음식·게이지·안내만).
//               그림에 없던 도구는 tools/shop_art.mjs patch 로 같은 그림의 도구를 잘라 붙여 만듦 (야시장 튀김기 2, 바다 작은 화구, 실내 포차 오른쪽 화로)
//               (동네 분식집: 어묵 칸 → 튀김기 3칸, 튀김기 → 큰 냄비 하나 더 — 2026-11-20 사용자 "조리대 내가 보낸 일러스트로 써 줘")
//               null 이면 게임이 조리대 띠와 도구를 그대로 그림 (지금은 모든 가게가 그림 속 도구를 씀)
//   floor     = 아래 재료 카드 줄 바닥 색 (그림의 아래 띠 색, tools/shop_art.mjs 가 잼)
//   counterLine = 손님이 이 선 아래로는 카운터에 가려짐 (그림 속 손님 쪽 카운터 윗면 조금 아래)
//   rain      = 비 오는 가게: 비가 내리는 곳 (그림 속 바깥이 보이는 곳만)

export type Rect4 = [number, number, number, number];

/**
 * 영업 화면의 띠 (화면 좌표): ShiftView COUNTER_Y(590) + 완성 칸 = 조리대 위 kitchenTop,
 * KitchenView 재료 카드 줄 위 = shelfTop (binsY 1004, BIN_SCALE 0.7). 셋이 맞는지 tests/view_tests.ts 가 확인
 */
export const ART_BANDS = { kitchenTop: 715, shelfTop: 930 };

export interface ArtStation {
  /** D.shopLayout 의 도구 종류 (순서대로 짝지음) */
  kind: string;
  /** 도구 전체 자리 (누르는 곳·잠금 덮개·게이지 줄) */
  rect: Rect4;
  /** 칸 자리: 어묵 사각틀 4칸, 튀김기 바구니, 석쇠 칸, 냄비 자리 (화로 위 — 냄비는 게임이 그림) */
  cells?: Rect4[];
  /** 떡볶이 판 철판 / 화구: 음식(팬) 자리 */
  pan?: Rect4;
  /** 화구: 그림에 프라이팬이 있음 (음식의 팬은 안 그림) */
  hasPan?: boolean;
  /** 냄비: 그림에 냄비가 있음 (게임 냄비·물은 안 그리고 면만, 분식집 큰 냄비) */
  hasPot?: boolean;
  /** 순대 솥: 가운데 x, y, 반지름 x, y */
  pot?: [number, number, number, number];
}

export interface ShopArt {
  file: string;
  /** 앞층 (카운터·조리대, 나머지 투명) */
  front: string;
  /** 그림 속 완성 칸 선반 앞 모서리 (이 아래가 조리대) */
  cut: number;
  /** 그림 속 조리대가 끝나는 곳 (이 아래가 재료 카드 줄) */
  kitchenBottom: number;
  board: Rect4;
  trayDy: number;
  kitchen: ArtStation[] | null;
  floor: [number, number, number];
  counterLine: number;
  rain?: Rect4;
}

export const SHOP_ART: Record<string, ShopArt> = {
  pocha: {
    file: "shops/pocha.webp",
    front: "shops/pocha_front.webp",
    cut: 705,
    kitchenBottom: 912,
    board: [1355, 598, 1597, 686],
    trayDy: 2,
    kitchen: [
      { kind: "broth", rect: [45, 718, 598, 905], cells: [[92, 748, 330, 792], [342, 748, 560, 792], [92, 802, 330, 852], [342, 802, 560, 852]] },
      { kind: "pan", rect: [618, 718, 1085, 905], pan: [642, 735, 1060, 868] },
      { kind: "steamer", rect: [1095, 718, 1475, 905], pot: [1283, 790, 162, 58] },
      { kind: "fryer", rect: [1488, 718, 1885, 905], cells: [[1505, 748, 1662, 838], [1672, 748, 1852, 838]] },
    ],
    floor: [101, 53, 33],
    counterLine: 556,
    rain: [100, 100, 1640, 548],
  },
  bunsik: {
    file: "shops/bunsik.webp",
    front: "shops/bunsik_front.webp",
    cut: 645,
    kitchenBottom: 905,
    board: [1343, 550, 1617, 630],
    trayDy: 1,
    // 2026-11-20 사용자 "조리대 내가 보낸 일러스트로 써 줘": 그림 속 도구를 tools/shop_art.mjs patch 로 분식집 도구로 바꿔 씀
    //   왼쪽 = 튀김기 3칸 (오른쪽 튀김기를 잘라 붙임) · 철판 = 화구 4칸 (2×2, 냄비는 게임이 그림) · 큰 냄비 2개 = 면 삶는 냄비 2칸
    kitchen: [
      { kind: "fryer", rect: [50, 650, 560, 885], cells: [[85, 700, 225, 780], [240, 700, 385, 780], [405, 700, 535, 780]] },
      { kind: "burner", rect: [630, 688, 840, 757], pan: [650, 694, 822, 752], hasPan: false },
      { kind: "burner", rect: [842, 688, 1052, 757], pan: [862, 694, 1034, 752], hasPan: false },
      { kind: "burner", rect: [630, 759, 840, 828], pan: [650, 765, 822, 823], hasPan: false },
      { kind: "burner", rect: [842, 759, 1052, 828], pan: [862, 765, 1034, 823], hasPan: false },
      { kind: "pot", rect: [1100, 650, 1880, 885], cells: [[1160, 732, 1400, 802], [1556, 732, 1810, 802]], hasPot: true },
    ],
    floor: [113, 56, 31],
    counterLine: 556,
  },
  market: {
    file: "shops/market.webp",
    front: "shops/market_front.webp",
    cut: 715,
    kitchenBottom: 905,
    board: [1335, 618, 1627, 692],
    trayDy: 3,
    kitchen: [
      { kind: "fryer", rect: [50, 715, 805, 905], cells: [[100, 750, 330, 858], [345, 750, 550, 858], [562, 750, 765, 858]] },
      { kind: "fryer", rect: [818, 715, 1350, 905], cells: [[868, 750, 1098, 858], [1112, 750, 1315, 858]] },
      { kind: "burner", rect: [1372, 722, 1582, 790], pan: [1416, 728, 1556, 772], hasPan: false },
      { kind: "burner", rect: [1586, 722, 1800, 790], pan: [1620, 728, 1760, 772], hasPan: false },
      { kind: "burner", rect: [1396, 792, 1612, 860], pan: [1452, 796, 1592, 840], hasPan: false },
      { kind: "burner", rect: [1620, 790, 1860, 860], pan: [1652, 792, 1792, 836], hasPan: false },
    ],
    floor: [128, 58, 32],
    counterLine: 512,
  },
  beach: {
    file: "shops/beach.webp",
    front: "shops/beach_front.webp",
    cut: 700,
    kitchenBottom: 918,
    board: [1330, 618, 1612, 697],
    trayDy: 18,
    kitchen: [
      { kind: "grill", rect: [40, 718, 518, 915], cells: [[78, 752, 222, 878], [224, 752, 370, 878], [372, 752, 516, 878]] },
      { kind: "grill", rect: [518, 718, 865, 915], cells: [[520, 752, 664, 878], [666, 752, 810, 878]] },
      { kind: "burner", rect: [1368, 705, 1605, 905], pan: [1402, 726, 1570, 796], hasPan: true },
      { kind: "burner", rect: [1610, 705, 1882, 905], pan: [1634, 726, 1802, 796], hasPan: true },
      { kind: "burner", rect: [925, 760, 1088, 905], pan: [940, 776, 1066, 826], hasPan: true },
      { kind: "burner", rect: [1090, 760, 1258, 905], pan: [1111, 776, 1237, 826], hasPan: true },
    ],
    floor: [120, 52, 28],
    counterLine: 606,
  },
  suljip: {
    file: "shops/suljip.webp",
    front: "shops/suljip_front.webp",
    cut: 622,
    kitchenBottom: 912,
    board: [1328, 516, 1592, 620],
    trayDy: -6,
    kitchen: [
      { kind: "pot", rect: [85, 640, 812, 890], cells: [[100, 720, 318, 772], [340, 720, 560, 772], [580, 720, 800, 772]] },
      { kind: "burner", rect: [830, 620, 1100, 714], pan: [892, 634, 1044, 690], hasPan: true },
      { kind: "burner", rect: [1100, 620, 1395, 714], pan: [1139, 634, 1290, 690], hasPan: true },
      { kind: "burner", rect: [830, 714, 1100, 820], pan: [892, 734, 1047, 794], hasPan: true },
      { kind: "burner", rect: [1100, 714, 1395, 820], pan: [1153, 737, 1304, 798], hasPan: true },
      { kind: "grill", rect: [1405, 640, 1890, 890], cells: [[1420, 705, 1638, 785], [1660, 705, 1880, 785]] },
    ],
    floor: [115, 52, 29],
    counterLine: 522,
  },
};

export function shopArt(shopId: string): ShopArt | null {
  return SHOP_ART[shopId] ?? null;
}

/** 그림 좌표 y → 화면 y (세 띠) */
export function mapY(a: ShopArt, y: number): number {
  const { kitchenTop: kt, shelfTop: st } = ART_BANDS;
  if (y <= a.cut) return (y * kt) / a.cut;
  if (y <= a.kitchenBottom) return kt + ((y - a.cut) * (st - kt)) / (a.kitchenBottom - a.cut);
  return st + ((y - a.kitchenBottom) * (1080 - st)) / (1080 - a.kitchenBottom);
}

/** 조리대 띠의 세로 줄임 비율 (솥 반지름 등) */
export function kitchenScaleY(a: ShopArt): number {
  return (ART_BANDS.shelfTop - ART_BANDS.kitchenTop) / (a.kitchenBottom - a.cut);
}

/** 그림 좌표 네모 → 화면 네모 [x0, y0, x1, y1] */
export function mapRect(a: ShopArt, r: Rect4): Rect4 {
  return [r[0], mapY(a, r[1]), r[2], mapY(a, r[3])];
}

/** 가게 그림을 세 띠로 나눠 화면에 (clipY0 ~ clipY1 만, x0 = 가운데 맞춤 왼쪽 여백) */
export function drawShopArt(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, a: ShopArt, clipY0 = 0, clipY1 = 1080, x0 = 0): void {
  const k = img.width / 1920; // 그림 좌표 → 그림 픽셀
  const bands: [number, number][] = [
    [0, a.cut],
    [a.cut, a.kitchenBottom],
    [a.kitchenBottom, 1080],
  ];
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, clipY0, 1920, clipY1 - clipY0);
  ctx.clip();
  for (const [y0, y1] of bands) {
    const sy0 = y0 * k;
    const sy1 = Math.min(img.height, y1 * k);
    if (sy1 <= sy0) continue;
    ctx.drawImage(img, 0, sy0, img.width, sy1 - sy0, x0, mapY(a, y0), 1920, mapY(a, y1) - mapY(a, y0));
  }
  ctx.restore();
}
