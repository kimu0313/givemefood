// 포장마차 타이쿤 — 콘텐츠·밸런스 정의.
// 가게 5곳 × 스테이지 7개 = 스테이지 1~35 (레벨 번호 = 화면의 스테이지 번호, 가게와 상관없이 이어짐).
// 스테이지 지도에서 하나씩 깨고, 가게의 마지막 스테이지(7·14·21·28)를 깨면 무한 영업이 열리고 다음 가게를 돈으로 살 수 있다.
// 가게마다 메뉴는 최대 4가지: 가게 안 1~4번째 스테이지에 하나씩 열리고, 5~7번째는 네 가지 전부로.
// 수치는 플레이 테스트로 조정할 것 (tests/run_tests.ts 의 봇 밸런스 리포트 참고).

import { Color, rgb, clamp } from "../engine/geom.ts";

export const Q = { RAW: 0, COOKED: 1, PERFECT: 2, BURNT: 3 } as const;

export const QUALITY_NAMES = ["덜 익음", "익음", "완벽", "탐"];

// --- 영업 ---
// 하루(레벨)는 시간 제한이 없다. 그날 손님을 모두 받으면 끝나고, 매출이 할당량 이상이면 통과.
export const LEVELS_PER_SHOP = 7; // 2026-11-12 사용자 요청: 가게마다 7스테이지 (예전 5)
export const TOTAL_LEVELS = 35;
export const MAX_MENUS = 4; // 가게 하나의 메뉴 수 (최대)
// 가게 안 몇 번째 스테이지에 메뉴가 열리는지 (가게 메뉴 순서대로). 1~4번째에 하나씩, 5~7번째는 총정리
export const MENU_UNLOCK_LEVELS = [1, 2, 3, 4];
export const SEATS = 3;
export const BASE_BURNERS = 2;
export const MAX_BURNERS = 4;
// 완성 칸은 메뉴마다 그 메뉴 전용 그릇 2개 (사용자 요청: 덜 수 있는 그릇 메뉴당 2개). 칸 순서 = 가게 메뉴 순서
export const TRAY_PER_MENU = 2;
export const FIRST_SPAWN_DELAY = 1.5;
export const SECOND_ITEM_CHANCE = 0.45;
export const NEW_MENU_WEIGHT = 2.0; // 그날 새로 해금된 메뉴는 주문 확률 2배

// --- 돈 / 평가 ---
export const TIP_RATE = 0.3; // 완벽 서빙 시 가격 대비 기본 팁
export const WASTE_RATE = 0.3; // 폐기 시 재료비 손해(가격 대비)
export const BURNT_PAY_RATE = 0.5; // 탄 음식을 그대로 주면 손님이 투덜대며 받고 값은 이만큼만 (팁 없음)
// 별점은 5개 만점. 레벨마다 완벽 서빙 비율로 별 1~5개, 가게 별점 = 그 가게 레벨 별의 평균 (안 깬 레벨은 0개)
export const MAX_STARS = 5;
export const STAR_RATIOS = [0.3, 0.5, 0.7, 0.85]; // 완벽 서빙 비율이 이 값 이상이면 별 2 / 3 / 4 / 5개

// --- 손님 ---
export const DRUNK_REVEAL_TIME = 3.0;
export const JINSANG_SWAP_MIN = 3.0;
export const JINSANG_SWAP_MAX = 8.0;

// --- 무한 영업 ---
export const ENDLESS_LIVES = 3;
export const ENDLESS_START_INTERVAL = 9.0;
export const ENDLESS_MIN_INTERVAL = 5.0;
export const ENDLESS_RAMP_EVERY = 30.0;
export const ENDLESS_RAMP_STEP = 0.5;

export const STATION_BURNER = "burner";
export const STATION_BOARD = "board";

export interface StationKindDef {
  name: string;
  heat: boolean;
  batch?: boolean;
  busy?: string;
}

// 조리도구 종류. heat = 화력 강화 업그레이드가 적용되는 도구(불을 쓰는 도구)
// batch = 한 번에 여러 그릇을 만드는 큰 도구 (재료 한 번 → 여러 그릇, 탭할 때마다 한 그릇씩 덜어 냄). busy = 차 있을 때 안내
export const STATIONS: Record<string, StationKindDef> = {
  burner: { name: "화구", heat: true },
  broth: { name: "국물통", heat: false },
  pan: { name: "떡볶이 판", heat: true, batch: true, busy: "떡볶이 판이 비면 새로 끓일 수 있어요" },
  steamer: { name: "순대 솥", heat: true, batch: true, busy: "순대 솥이 비면 새로 찔 수 있어요" },
  fryer: { name: "튀김기", heat: true },
  grill: { name: "석쇠", heat: true },
  pot: { name: "냄비", heat: false },
  board: { name: "도마", heat: false },
};

export const BURNT_COLOR = rgb(0.16, 0.11, 0.09);

// 떡볶이 판·순대 솥 한 번에 만드는 그릇 수. 떡볶이 판은 "판 키우기" 업그레이드(화구 추가 자리)로 1그릇씩 늘어난다
export const PAN_PORTIONS = 3; // 떡볶이 한 판 (2026-11-16 사용자 "떡볶이 한 번 조리할 때 3인분", 판 키우기로 4 → 5)
export const STEAMER_PORTIONS = 4;

export interface StationSpot {
  kind: string;
  slots: number;
  title: string;
  width?: number;
  grid?: number;
}

export interface LayoutEntry extends StationSpot {
  first: number;
}

export interface ShopDef {
  id: string;
  name: string;
  first_level: number;
  last_level: number;
  short: string;
  theme: string;
  rain: boolean;
  desc: string;
  stations?: StationSpot[];
  sides?: StationSpot[];
  burner_upgrade?: string;
  burner_upgrade_desc?: string;
  menus: string[];
  open_cost?: number;
  upgrade_mult: number;
  comfort: string;
  comfort_none: string;
  color: Color;
  sky: Color;
}

// 가게 = 스테이지. first_level~last_level 레벨을 깨고, 마지막 레벨을 깨면 다음 가게를 살 수 있다. short = 간판 글자
// sides = 화구 1~4 왼쪽·오른쪽 조리도구. 같은 종류를 양쪽에 두면 한 도구의 칸을 나눠 그린다 (튀김기 3칸 + 2칸 = 5칸)
// stations = 화구 없이 조리대를 직접 짜는 가게 (왼쪽부터). width = 조리 칸 몇 개 너비, grid = 칸을 몇 열로 (어묵 사각틀 2×2)
//   이런 가게의 "화구 추가" 업그레이드는 burner_upgrade(이름) / burner_upgrade_desc(효과) 로 바뀐다
// menus = 재료통 순서(= 해금 순, 최대 4개), upgrade_mult = 이 가게 업그레이드 가격 배수, comfort = 손님 인내심 업그레이드 이름
// open_cost = 가게를 여는 값. 앞 가게의 마지막 스테이지를 깨면 살 수 있고, 그 전까지는 무한 영업으로 돈을 모은다 (2026-11-12 사용자 요청)
export const SHOPS: ShopDef[] = [
  {
    id: "pocha", name: "골목 포장마차", first_level: 1, last_level: 7, short: "포장마차", theme: "alley", rain: true,
    desc: "비 오는 밤 골목, 작은 포장마차에서 첫 장사를 시작해요.",
    stations: [
      { kind: "broth", slots: 4, title: "어묵 사각틀", width: 1.45, grid: 2 },
      { kind: "pan", slots: 1, title: "떡볶이 판", width: 1.35 },
      { kind: "steamer", slots: 1, title: "순대 솥", width: 1.1 },
      { kind: "fryer", slots: 2, title: "튀김기", width: 0.9 },
    ],
    burner_upgrade: "떡볶이 판 키우기", burner_upgrade_desc: "떡볶이 한 판 %d그릇",
    menus: ["tteokbokki", "sundae", "odeng", "twigim"],
    upgrade_mult: 1.0, comfort: "난로 설치", comfort_none: "난로 없음",
    color: rgb(0.84, 0.29, 0.19), sky: rgb(0.05, 0.06, 0.12),
  },
  {
    id: "bunsik", name: "동네 분식집", first_level: 8, last_level: 14, short: "분식", theme: "bunsik", rain: false,
    desc: "포장마차로 모은 돈으로 낸 첫 가게. 학생들과 동네 사람들이 몰려와요.",
    sides: [{ kind: "fryer", slots: 3, title: "튀김기" }, { kind: "pot", slots: 2, title: "면 삶는 냄비" }],
    menus: ["ramen", "gimbap", "donkatsu", "jjolmyeon"],
    open_cost: 100000, upgrade_mult: 2.5, comfort: "만화책 책장", comfort_none: "책장 없음",
    color: rgb(0.95, 0.68, 0.16), sky: rgb(0.93, 0.86, 0.72),
  },
  {
    id: "market", name: "야시장 푸드트럭", first_level: 15, last_level: 21, short: "야시장", theme: "market", rain: false,
    desc: "불빛 가득한 야시장에 푸드트럭을 몰고 나왔어요. 튀김기가 쉴 틈이 없어요.",
    sides: [{ kind: "fryer", slots: 3, title: "튀김기 1" }, { kind: "fryer", slots: 2, title: "튀김기 2" }],
    menus: ["tornado", "hotteok", "dakgangjeong", "hotdog"],
    open_cost: 250000, upgrade_mult: 4.0, comfort: "스피커 설치", comfort_none: "음악 없음",
    color: rgb(0.2, 0.62, 0.62), sky: rgb(0.1, 0.06, 0.16),
  },
  {
    id: "beach", name: "해변 포장마차", first_level: 22, last_level: 28, short: "바다포차", theme: "beach", rain: false,
    desc: "파도 소리 들리는 바닷가 포장마차. 숯불 석쇠에서 해산물을 구워요.",
    sides: [{ kind: "grill", slots: 3, title: "석쇠 1" }, { kind: "grill", slots: 2, title: "석쇠 2" }],
    menus: ["clam", "shrimp", "squid", "pajeon"],
    open_cost: 500000, upgrade_mult: 6.0, comfort: "모닥불 피우기", comfort_none: "모닥불 없음",
    color: rgb(0.22, 0.5, 0.84), sky: rgb(0.04, 0.07, 0.18),
  },
  {
    id: "suljip", name: "실내 포차", first_level: 29, last_level: 35, short: "실내포차", theme: "suljip", rain: true,
    desc: "드디어 내 이름을 건 실내 포차. 주황 천막 아래 밤새 손님이 끊이지 않아요.",
    sides: [{ kind: "pot", slots: 3, title: "찌개 냄비" }, { kind: "grill", slots: 2, title: "닭발 석쇠" }],
    menus: ["budae", "dakbal", "egg_roll", "golbaengi"],
    open_cost: 1000000, upgrade_mult: 9.0, comfort: "TV 설치", comfort_none: "TV 없음",
    color: rgb(0.95, 0.45, 0.12), sky: rgb(0.12, 0.06, 0.04),
  },
];

export interface StepDef {
  kind: "cook" | "wait";
  label: string;
  ripe?: number;
  perfect_start?: number;
  perfect_end?: number;
  duration?: number;
  burns?: boolean;
  hold?: boolean;
  over_label?: string;
  tap: string;
  tap_label?: string;
}

export interface BoardDef {
  taps: number;
  verb: string;
  steps?: string[];
}

export interface MenuDef {
  name: string;
  label: string;
  price: number;
  station: string;
  board?: BoardDef;
  raw_color: Color;
  cooked_color: Color;
  tip: string;
  steps: StepDef[];
}

// steps:
//   cook: ripe 전 = 덜 익음, perfect_start 전 = 익음, perfect_end 까지 = 완벽,
//         그 뒤 = 탐(burns) 또는 익음(타지 않는 메뉴: over_label = 불음·졸음, 팁 없음)
//         골목 포장마차에서 타는 메뉴는 튀김뿐 (사용자 요청: 떡볶이는 안 탐)
//         hold = 다 익으면 계속 완벽 (솥에서 쪄 두는 순대)
//   wait: duration 이 지나야 탭이 먹힌다 (라면 물 끓이기)
//   tap: take_out = 꺼내기, 그 밖의 값(flip / add_noodles / ...) = 다음 단계로. tap_label 은 안내 문구
// station: board = 불 없이 재료통에서 바로 도마로 (도마에서 탭해서 손질)
//          pan / steamer = 큰 판·솥에 여러 그릇을 한 번에 (STATIONS 의 batch)
// board: {taps, verb} = 꺼낸 뒤(또는 바로) 도마에서 손질하는 횟수와 동사
export const MENUS: Record<string, MenuDef> = {
  // ---------------------------------------------------------------- 골목 포장마차
  tteokbokki: {
    name: "떡볶이", label: "떡볶이", price: 3000, station: "pan",
    raw_color: rgb(0.97, 0.62, 0.52), cooked_color: rgb(0.86, 0.16, 0.1),
    tip: "재료를 탭하면 큰 떡볶이 판에 여러 그릇을 한 번에 끓여요. 7초부터 초록 구간 — 판을 탭할 때마다 한 그릇씩 덜어요. 오래 두면 졸아서 '완벽'이 아니게 돼요(타지는 않아요).",
    steps: [
      { kind: "cook", label: "끓이는 중", ripe: 5.0, perfect_start: 7.0, perfect_end: 16.0, burns: false, over_label: "졸음", tap: "take_out", tap_label: "덜기" },
    ],
  },
  sundae: {
    name: "순대", label: "순대", price: 3500, station: "steamer",
    board: { taps: 3, verb: "썰기" },
    raw_color: rgb(0.5, 0.36, 0.42), cooked_color: rgb(0.3, 0.13, 0.2),
    tip: "재료를 탭하면 큰 솥에 순대와 내장을 여러 그릇 쪄요. 5초 뒤 다 쪄지면 솥을 탭해 도마로 꺼내고, 도마를 3번 탭해서 썰어요.",
    steps: [
      { kind: "cook", label: "찌는 중", ripe: 5.0, perfect_start: 5.0, perfect_end: 999.0, hold: true, burns: false, tap: "take_out" },
    ],
  },
  odeng: {
    name: "어묵", label: "어묵", price: 1500, station: "broth",
    raw_color: rgb(0.95, 0.89, 0.74), cooked_color: rgb(0.83, 0.61, 0.34),
    tip: "어묵 사각틀 4칸에 꼬치를 넣고 4초면 완성. 10초가 지나면 불어서 '완벽'이 아니에요.",
    steps: [
      { kind: "cook", label: "국물", ripe: 4.0, perfect_start: 4.0, perfect_end: 10.0, burns: false, tap: "take_out" },
    ],
  },
  twigim: {
    name: "튀김", label: "튀김", price: 2500, station: "fryer",
    raw_color: rgb(0.97, 0.92, 0.74), cooked_color: rgb(0.9, 0.62, 0.22),
    tip: "튀김기에 넣고 5~8초(초록 구간)에 건져요.",
    steps: [
      { kind: "cook", label: "튀기는 중", ripe: 3.0, perfect_start: 5.0, perfect_end: 8.0, burns: true, tap: "take_out" },
    ],
  },
  // ---------------------------------------------------------------- 동네 분식집
  ramen: {
    name: "라면", label: "라면", price: 4000, station: "burner",
    raw_color: rgb(0.96, 0.91, 0.62), cooked_color: rgb(0.98, 0.78, 0.36),
    tip: "물이 3초 끓으면 탭해서 면을 넣고 4~9초에 꺼내요. 화구를 오래 써요.",
    steps: [
      { kind: "wait", label: "물 끓이는 중", duration: 3.0, tap: "add_noodles", tap_label: "면 넣기" },
      { kind: "cook", label: "면 삶는 중", ripe: 2.5, perfect_start: 4.0, perfect_end: 9.0, burns: true, tap: "take_out" },
    ],
  },
  gimbap: {
    name: "김밥", label: "김밥", price: 3000, station: "board",
    // 도마에서 탭할 때마다 한 단계씩 (사용자 요청: 김에 밥 올리기 → 재료 올리기 → 말기 → 썰기)
    board: { taps: 4, verb: "말기", steps: ["밥 올리기", "재료 올리기", "말기", "썰기"] },
    raw_color: rgb(0.14, 0.2, 0.14), cooked_color: rgb(0.14, 0.2, 0.14),
    tip: "재료통을 탭하면 김이 도마에 올라가요. 도마를 탭할 때마다 밥 올리기 → 재료 올리기 → 말기 → 썰기. 불은 필요 없어요!",
    steps: [],
  },
  donkatsu: {
    name: "돈까스", label: "돈까스", price: 6000, station: "fryer",
    raw_color: rgb(0.97, 0.9, 0.72), cooked_color: rgb(0.8, 0.48, 0.16),
    tip: "튀김기에서 6~9초(초록 구간)에 건져요. 오래 걸리지만 비싸요.",
    steps: [
      { kind: "cook", label: "튀기는 중", ripe: 4.0, perfect_start: 6.0, perfect_end: 9.0, burns: true, tap: "take_out" },
    ],
  },
  jjolmyeon: {
    name: "쫄면", label: "쫄면", price: 5000, station: "pot",
    board: { taps: 3, verb: "비비기" },
    raw_color: rgb(0.98, 0.95, 0.84), cooked_color: rgb(0.97, 0.86, 0.58),
    tip: "냄비에서 면을 4~8초 삶아 건진 뒤, 도마를 3번 탭해서 양념에 비벼요.",
    steps: [
      { kind: "cook", label: "면 삶는 중", ripe: 2.5, perfect_start: 4.0, perfect_end: 8.0, burns: false, tap: "take_out" },
    ],
  },
  // ---------------------------------------------------------------- 야시장 푸드트럭
  tornado: {
    name: "회오리감자", label: "회오리감자", price: 4500, station: "fryer",
    raw_color: rgb(0.98, 0.93, 0.7), cooked_color: rgb(0.93, 0.66, 0.2),
    tip: "튀김기에서 5.5~8초에 건져요.",
    steps: [
      { kind: "cook", label: "튀기는 중", ripe: 3.5, perfect_start: 5.5, perfect_end: 8.0, burns: true, tap: "take_out" },
    ],
  },
  hotteok: {
    name: "호떡", label: "호떡", price: 3500, station: "burner",
    raw_color: rgb(0.97, 0.91, 0.76), cooked_color: rgb(0.84, 0.54, 0.24),
    tip: "화구에서 3~4.5초에 뒤집고, 다시 3~4.5초에 꺼내요.",
    steps: [
      { kind: "cook", label: "앞면", ripe: 2.0, perfect_start: 3.0, perfect_end: 4.5, burns: true, tap: "flip" },
      { kind: "cook", label: "뒷면", ripe: 2.0, perfect_start: 3.0, perfect_end: 4.5, burns: true, tap: "take_out" },
    ],
  },
  dakgangjeong: {
    name: "닭강정", label: "닭강정", price: 6000, station: "fryer",
    board: { taps: 3, verb: "버무리기" },
    raw_color: rgb(0.97, 0.9, 0.76), cooked_color: rgb(0.86, 0.56, 0.22),
    tip: "튀김기에서 6~9초에 건진 뒤, 도마를 3번 탭해서 양념에 버무려요.",
    steps: [
      { kind: "cook", label: "튀기는 중", ripe: 4.0, perfect_start: 6.0, perfect_end: 9.0, burns: true, tap: "take_out" },
    ],
  },
  hotdog: {
    name: "핫도그", label: "핫도그", price: 4000, station: "fryer",
    raw_color: rgb(0.97, 0.9, 0.68), cooked_color: rgb(0.82, 0.5, 0.18),
    tip: "한쪽이 완벽할 때 탭해서 굴리고, 반대쪽도 완벽할 때 건져요. 구간이 짧아요!",
    steps: [
      { kind: "cook", label: "한쪽", ripe: 2.0, perfect_start: 3.0, perfect_end: 4.5, burns: true, tap: "flip", tap_label: "굴리기" },
      { kind: "cook", label: "반대쪽", ripe: 2.0, perfect_start: 3.0, perfect_end: 4.5, burns: true, tap: "take_out" },
    ],
  },
  // ---------------------------------------------------------------- 해변 포장마차
  clam: {
    name: "조개구이", label: "조개구이", price: 8000, station: "grill",
    raw_color: rgb(0.86, 0.82, 0.76), cooked_color: rgb(0.98, 0.78, 0.5),
    tip: "석쇠에서 5~7.5초에 꺼내요. 입을 벌리면 다 익은 거예요.",
    steps: [
      { kind: "cook", label: "굽는 중", ripe: 3.0, perfect_start: 5.0, perfect_end: 7.5, burns: true, tap: "take_out" },
    ],
  },
  shrimp: {
    name: "새우구이", label: "새우구이", price: 9000, station: "grill",
    raw_color: rgb(0.62, 0.62, 0.68), cooked_color: rgb(0.98, 0.45, 0.25),
    tip: "석쇠에서 3.5~5.5초에 뒤집고, 다시 3.5~5.5초에 꺼내요.",
    steps: [
      { kind: "cook", label: "앞면", ripe: 2.5, perfect_start: 3.5, perfect_end: 5.5, burns: true, tap: "flip" },
      { kind: "cook", label: "뒷면", ripe: 2.5, perfect_start: 3.5, perfect_end: 5.5, burns: true, tap: "take_out" },
    ],
  },
  squid: {
    name: "오징어구이", label: "오징어구이", price: 10000, station: "grill",
    board: { taps: 3, verb: "썰기" },
    raw_color: rgb(0.96, 0.92, 0.88), cooked_color: rgb(0.9, 0.58, 0.32),
    tip: "석쇠에서 4.5~7초에 꺼낸 뒤, 도마를 3번 탭해서 썰어요.",
    steps: [
      { kind: "cook", label: "굽는 중", ripe: 3.0, perfect_start: 4.5, perfect_end: 7.0, burns: true, tap: "take_out" },
    ],
  },
  pajeon: {
    name: "해물파전", label: "해물파전", price: 12000, station: "burner",
    raw_color: rgb(0.97, 0.9, 0.7), cooked_color: rgb(0.86, 0.6, 0.26),
    tip: "화구에서 4.5~6.5초에 뒤집고, 다시 4.5~6.5초에 꺼내요. 비싼 메뉴예요!",
    steps: [
      { kind: "cook", label: "앞면", ripe: 3.0, perfect_start: 4.5, perfect_end: 6.5, burns: true, tap: "flip" },
      { kind: "cook", label: "뒷면", ripe: 3.0, perfect_start: 4.5, perfect_end: 6.5, burns: true, tap: "take_out" },
    ],
  },
  // ---------------------------------------------------------------- 실내 포차
  budae: {
    name: "부대찌개", label: "부대찌개", price: 15000, station: "pot",
    raw_color: rgb(0.95, 0.56, 0.42), cooked_color: rgb(0.85, 0.24, 0.12),
    tip: "찌개 냄비에서 5~10초 끓으면 탭해서 사리를 넣고, 3~7초에 꺼내요. 타지 않아요.",
    steps: [
      { kind: "cook", label: "끓이는 중", ripe: 3.5, perfect_start: 5.0, perfect_end: 10.0, burns: false, tap: "add_noodles", tap_label: "사리 넣기" },
      { kind: "cook", label: "사리 익는 중", ripe: 2.0, perfect_start: 3.0, perfect_end: 7.0, burns: false, tap: "take_out" },
    ],
  },
  dakbal: {
    name: "닭발", label: "닭발", price: 12000, station: "grill",
    raw_color: rgb(0.95, 0.74, 0.62), cooked_color: rgb(0.74, 0.12, 0.08),
    tip: "닭발 석쇠에서 4~5.5초. 구간이 짧고 매워요!",
    steps: [
      { kind: "cook", label: "굽는 중", ripe: 3.0, perfect_start: 4.0, perfect_end: 5.5, burns: true, tap: "take_out" },
    ],
  },
  egg_roll: {
    name: "계란말이", label: "계란말이", price: 10000, station: "burner",
    raw_color: rgb(1.0, 0.95, 0.62), cooked_color: rgb(0.98, 0.8, 0.3),
    tip: "계란이 익을 때마다 탭해서 두 번 말고, 마지막에 꺼내요. 3단계!",
    steps: [
      { kind: "cook", label: "계란 익는 중", ripe: 1.5, perfect_start: 2.5, perfect_end: 4.0, burns: true, tap: "roll", tap_label: "말기" },
      { kind: "cook", label: "한 번 만 계란", ripe: 1.5, perfect_start: 2.5, perfect_end: 4.0, burns: true, tap: "roll", tap_label: "한 번 더 말기" },
      { kind: "cook", label: "속까지 익히는 중", ripe: 1.0, perfect_start: 2.0, perfect_end: 3.5, burns: true, tap: "take_out" },
    ],
  },
  golbaengi: {
    name: "골뱅이무침", label: "골뱅이무침", price: 13000, station: "board",
    board: { taps: 4, verb: "무치기" },
    raw_color: rgb(0.86, 0.3, 0.2), cooked_color: rgb(0.86, 0.3, 0.2),
    tip: "재료통을 탭하면 도마에 바로 올라가요. 4번 탭해서 무쳐요.",
    steps: [],
  },
};

export const CUSTOMER_ORDER = ["normal", "hurry", "regular", "jinsang", "drunk"];

export interface CustomerDef {
  name: string;
  patience: number;
  tip_mult: number;
  unlock_level: number;
  weight: number;
  max_items: number;
  body: Color;
  hair: Color;
  desc: string;
}

export const CUSTOMERS: Record<string, CustomerDef> = {
  // 인내심 (2026-11-12 한 번 1.5배로 늘렸다가 사용자 요청으로 원래대로: 20/10/30/15/25)
  // 팁은 단골만 준다 (2026-11-16 사용자 "단골손님만 팁 주고 일반 손님들은 팁 안주는걸로", 팁 줄 때 한마디 = REACTION_LINES.tip).
  // 이벤트 미식가는 따로 (보스 손님, 팁 3배)
  normal: {
    name: "손님", patience: 20.0, tip_mult: 0.0, unlock_level: 1, weight: 50.0, max_items: 2,
    body: rgb(0.33, 0.45, 0.62), hair: rgb(0.15, 0.12, 0.1),
    desc: "인내심 20초",
  },
  hurry: {
    name: "급한 손님", patience: 10.0, tip_mult: 0.0, unlock_level: 1, weight: 22.0, max_items: 1,
    body: rgb(0.92, 0.56, 0.2), hair: rgb(0.25, 0.16, 0.1),
    desc: "인내심 10초 · 메뉴는 항상 1개",
  },
  regular: {
    name: "단골", patience: 30.0, tip_mult: 2.0, unlock_level: 2, weight: 16.0, max_items: 2,
    body: rgb(0.3, 0.56, 0.4), hair: rgb(0.36, 0.36, 0.4),
    desc: "인내심 30초 · 단골만 팁을 줘요 (완벽한 요리에 값의 60%) · 서빙하면 단골 도감에 기록",
  },
  jinsang: {
    name: "진상", patience: 15.0, tip_mult: 0.0, unlock_level: 4, weight: 13.0, max_items: 2,
    body: rgb(0.5, 0.3, 0.56), hair: rgb(0.08, 0.08, 0.1),
    desc: "인내심 15초 · 조리 중에 주문을 한 번 바꿔요",
  },
  drunk: {
    name: "취객", patience: 25.0, tip_mult: 0.0, unlock_level: 5, weight: 13.0, max_items: 2,
    body: rgb(0.58, 0.26, 0.26), hair: rgb(0.2, 0.15, 0.12),
    desc: "인내심 25초 · 주문이 흐릿해요. 탭하면 다시 말해요",
  },
  // 미식가 이벤트에만 나오는 손님 (인내심은 이벤트마다 EVENTS[].patience)
  gourmet: {
    name: "미식가 황 선생", patience: 40.0, tip_mult: 3.0, unlock_level: 999, weight: 0.0, max_items: 3,
    body: rgb(0.45, 0.16, 0.2), hair: rgb(0.86, 0.85, 0.84),
    desc: "한 번에 여러 가지를 코스로 주문 · 완벽한 요리만 좋아해요",
  },
};

// 하루 손님 수 (스테이지 1~35): 첫날 5명 → 마지막 15명. 날이 갈수록 늘어난다 (줄지 않음).
export const LEVEL_CUSTOMERS = [
  5, 5, 6, 6, 7, 7, 8, // 골목 포장마차
  8, 8, 9, 9, 10, 10, 10, // 동네 분식집
  10, 11, 11, 11, 12, 12, 12, // 야시장 푸드트럭
  12, 13, 13, 13, 14, 14, 14, // 해변 포장마차
  14, 14, 15, 15, 15, 15, 15, // 실내 포차
];
// 손님이 오는 간격(초): 가게 안 스테이지 순서로 정하고, 뒤 가게일수록 0.4초씩 빨리 온다.
export const LEVEL_INTERVALS = [15.0, 13.5, 12.0, 11.0, 10.0, 9.5, 9.0];

// 하루 할당량 = 그날 채워야 하는 매출 (스테이지 1~35). 날이 갈수록 커진다 (앞 스테이지보다 항상 큼).
// 봇(완벽만 노림)이 그날 손님을 다 받았을 때 매출의 약 40~70% (봇의 가장 낮은 매출보다도 낮게).
// 2026-11-16 팁을 단골만 주게 바꾸면서 봇 매출이 약 19% 줄어 스테이지마다 같은 비율로 낮춤 (봇 매출 / 할당량 비는 그대로).
export const LEVEL_TARGETS = [
  // 골목 포장마차 (스테이지 1~7)
  9500, 12000, 12500, 13500, 14500, 15500, 17000,
  // 동네 분식집 (8~14)
  19000, 20000, 24500, 27500, 31000, 33000, 35500,
  // 야시장 푸드트럭 (15~21)
  36500, 37500, 38500, 39500, 40000, 41000, 42500,
  // 해변 포장마차 (22~28)
  80500, 88500, 95500, 103000, 110000, 116500, 122500,
  // 실내 포차 (29~35)
  136000, 144000, 154000, 161000, 169500, 177500, 185500,
];

export const UPGRADE_ORDER = ["burners", "heat", "stove"];

export interface UpgradeLevel {
  cost: number;
  value: number;
  desc: string;
}

// 가게마다 따로 산다(새 가게는 장비를 새로 갖춤). cost 는 골목 포장마차 기준, 가게의 upgrade_mult 배.
// value: burners = 화구 칸 수, heat = 불 쓰는 조리 시간 감소율, stove = 인내심 증가율
export const UPGRADES: Record<string, { name: string; levels: UpgradeLevel[] }> = {
  burners: {
    name: "화구 추가",
    levels: [
      { cost: 5000, value: 3.0, desc: "화구 3칸" },
      { cost: 12000, value: 4.0, desc: "화구 4칸" },
    ],
  },
  heat: {
    name: "화력 강화",
    levels: [
      { cost: 4000, value: 0.15, desc: "불 쓰는 조리 시간 -15%" },
      { cost: 9000, value: 0.3, desc: "불 쓰는 조리 시간 -30%" },
    ],
  },
  stove: {
    name: "", // 가게의 comfort 이름을 쓴다
    levels: [{ cost: 6000, value: 0.2, desc: "손님 인내심 +20%" }],
  },
};

export interface RegularDef {
  id: string;
  name: string;
  lines: string[];
  shop: string; // 이 가게에서 처음 단골이 됨 (그 가게부터 찾아오고, 뒤 가게로도 따라옴)
}

// 단골 6명 (2026-11-16 사용자: "단골 6명, 젊은 여자도 추가. 첫 번째 가게에 1명, 두 번째에 2명, 세 번째에 3명 확보,
// 네 번째·다섯 번째 가게엔 왔던 단골들이 오는 식"). 순서 = 처음 만나는 순서 (도감 순서).
export const REGULARS: RegularDef[] = [
  { id: "taxi", name: "택시 기사 박씨", shop: "pocha", lines: ["오늘도 고생했어요.", "비 오는 날엔 역시 여기지.", "한 바퀴 돌고 또 올게요."] },
  { id: "student", name: "시험 끝난 대학생", shop: "bunsik", lines: ["시험 끝났어요!", "여기가 제일 맛있어요.", "다음엔 친구들도 데려올게요."] },
  { id: "cafe", name: "카페 알바생 수아", shop: "bunsik", lines: ["사장님, 저 왔어요~", "알바 끝나고 바로 왔어요!", "오늘도 여기서 힐링해요."] },
  { id: "office", name: "야근하는 김 대리", shop: "market", lines: ["오늘도 야근이에요…", "여기 오면 좀 살 것 같아요.", "사장님 덕에 버팁니다."] },
  { id: "grandma", name: "동네 할머니", shop: "market", lines: ["아이고, 장사는 잘 되고?", "우리 손주도 이거 좋아해.", "많이 팔어, 응?"] },
  { id: "guard", name: "경비 아저씨", shop: "market", lines: ["순찰 돌다 왔소.", "따뜻한 국물이 최고지.", "오늘 밤도 무사히."] },
];

/** 이 가게에 찾아오는 단골 (그 가게까지 만난 단골 전부) */
export function regularsFor(shopId: string): RegularDef[] {
  const i = shopIndex(shopId);
  return REGULARS.filter((r) => shopIndex(r.shop) <= i);
}

/** 이 가게에서 새로 만나는 단골 */
export function regularsNewAt(shopId: string): RegularDef[] {
  return REGULARS.filter((r) => r.shop === shopId);
}

// ---------------------------------------------------------------- 재료 (2026-11-16 사용자 "가게 재료도 사고")
// 메뉴마다 재료를 인분 단위로 사서 쌓아 둔다 (가게마다 따로, 남은 재료는 다음 날로). 재료통을 탭하면 그만큼 줄고
// (큰 판·솥은 한 판 = 그릇 수만큼), 다 떨어진 메뉴는 손님이 주문하지 않는다 (품절).
// 재료값은 미리 내므로 버린 음식은 그 재료를 잃는 것으로 끝 (재료가 무한인 테스트·봇에서만 폐기 손실을 돈으로 뺀다).
export const INGREDIENT_RATE = 0.25; // 1인분 재료값 = 메뉴 값의 25% (50원 단위)
export const STOCK_PACK = 5; // 장보기에서 한 번에 사는 양 (인분)
export const STOCK_MAX = 40; // 메뉴마다 쌓아 둘 수 있는 최대 (인분)
export const START_MONEY = 20000; // 처음 시작할 때 개업 자금
export const NEW_SHOP_STOCK = 10;
// 효과는 게임 안 어디에도 설명하지 않는다 — 써 봐야 안다 (2026-11-16 사용자 "설명 쓰지 마, 플레이어가 모르게, 뭘지 궁금하게").
// 마법의 가루 (2026-11-16 사용자 "재료 사는 곳에 마법의 가루, 10000원, 음식 넣을 때 사용, 효과는 임의로"):
// 가루 통을 탭해 준비 → 다음에 올리는 음식에 뿌림 (큰 판·솥은 한 판 전체). 뿌린 음식은 MAGIC_SPEED 배 빨리 익고,
// 완벽해지면 끝까지 완벽 (타거나 불지 않음), 손님이 감동해서 값을 MAGIC_PRICE_MULT 배로 낸다. 가루는 모든 가게에서 같이 씀.
export const POWDER_PRICE = 10000;
export const POWDER_MAX = 9;
export const MAGIC_SPEED = 2.5;
export const MAGIC_PRICE_MULT = 2; // 새 가게를 열면 첫 메뉴 재료를 이만큼 선물 (돈을 다 써서 가게를 사도 막히지 않게)

/** 1인분 재료값 */
export function ingredientCost(menuId: string): number {
  return Math.max(50, Math.round((menuPrice(menuId) * INGREDIENT_RATE) / 50) * 50);
}

/**
 * 그 스테이지 하루에 필요한 재료 어림 (메뉴 → 인분): 손님 수 × 평균 주문 수 × 메뉴 비율 (새 메뉴 2배) × 1.3 여유.
 */
export function stockNeed(level: number): Record<string, number> {
  const menus = unlockedMenus(level);
  const news = menusUnlockedOn(level);
  const cfg = levelConfig(level);
  let total = 0;
  for (const m of menus) total += news.includes(m) ? NEW_MENU_WEIGHT : 1.0;
  const dishes = cfg.customers * (1.0 + SECOND_ITEM_CHANCE * 0.75);
  const out: Record<string, number> = {};
  for (const m of menus) {
    const share = (news.includes(m) ? NEW_MENU_WEIGHT : 1.0) / total;
    out[m] = Math.min(STOCK_MAX, Math.ceil(dishes * share * 1.3) + 1);
  }
  return out;
}

// 손님 반응 대사 (말풍선). 상황 → 손님 종류(단골은 "regular:<단골 id>" 가 먼저) → 대사들 (없으면 normal). "\n" = 줄바꿈 (한 줄 11자 안팎)
//   raw   = 덜 익은 음식을 받아 먹어 봄 → 표정 yuck, 화내며 떠남 (돈 없음)
//   burnt = 탄 음식을 그대로 줌 → 표정 shock, 투덜대며 받고 값은 반만 (팁 없음)
//   wrong = 주문 안 한 메뉴를 내밂 → 표정 confused, 안 받고 계속 기다림
export const REACTION_LINES: Record<string, Record<string, string[]>> = {
  raw: {
    normal: [
      "윽! 속이 하나도\n안 익었잖아요!", "이거 아직\n날것인데요?!", "씹다가 이 나갈 뻔했어요!",
      "덜 익은 걸 주시면\n어떡해요!", "배탈 나겠어요…\n그냥 갈게요.", "이건 좀 아니죠.\n다신 안 와요!",
    ],
    hurry: ["바빠 죽겠는데\n덜 익은 걸 주다니!", "기다릴 시간 없어요!\n그냥 갈래요!", "아 진짜,\n시간만 버렸네!"],
    regular: ["사장님,\n오늘 왜 이래요…", "늘 맛있었는데…\n이건 덜 익었어요.", "실망이에요, 사장님.\n오늘은 갈게요."],
    "regular:grandma": ["아이고, 이거\n덜 익었구먼!", "할미 이 다 나가겄어…\n오늘은 그만 갈랴.", "설익은 걸 주면\n쓰나, 응?"],
    jinsang: ["이걸 돈 받고 팔아요?\n사장 나와!", "리뷰에 다 쓸 거예요!\n별 하나!", "날것을 주다니,\n어이가 없네!"],
    drunk: ["어… 딸꾹…\n이거 차갑잖아~", "으으… 덜 익었어…\n집에 갈래…", "사장님~ 이거\n아직 살아 있어요~"],
  },
  burnt: {
    // 탄 음식은 투덜대며 받는다 (값은 반만) — 다시 해 달라는 대사는 쓰지 않음
    normal: [
      "으악, 새까맣게\n탔잖아요!", "이건 숯이에요,\n음식이 아니라!", "탄 냄새가 나요…\n그냥 먹을게요.",
      "쓴맛밖에\n안 나요…", "까맣게 탔네요.\n반값만 낼게요.",
    ],
    hurry: ["탄 거라도 줘요!\n바빠 죽겠어요!", "급하니까 먹지만…\n이건 너무해요!", "탔잖아요!\n반값만 낼게요!"],
    regular: ["사장님~ 이거\n다 탔어요.", "어이쿠, 불 조심\n하셔야겠네.", "오늘은 봐줄게요.\n반값만 받아요."],
    "regular:grandma": ["아이고, 다 탔네!\n그래도 먹어야지.", "불 좀 줄여,\n이 사람아!", "까맣게 탔구먼.\n천천히 혀."],
    jinsang: ["숯불 냄새가 아니라\n숯이잖아!", "이걸 돈 다 받으려고?\n반값만 내요!", "탄 걸 내밀어?\n리뷰 각오해요!"],
    drunk: ["어? 왜 까매…\n딸꾹…", "이거 숯이야~?\n딸꾹!", "까만 떡… 아니\n까만 뭐야 이거…"],
  },
  wrong: {
    normal: ["이거 시킨 거\n아닌데요?", "제가 주문한 건\n이게 아니에요.", "다른 손님 거\n아니에요?"],
    hurry: ["이거 말고요!\n빨리요!", "주문 확인 좀\n해 주세요!"],
    regular: ["사장님, 저 이거\n안 시켰어요~", "제 거는 이게\n아닌데요?"],
    "regular:grandma": ["이거 내 거\n아닌디?", "할미는 이거\n안 시켰어~"],
    jinsang: ["주문도 제대로\n못 받아요?", "내가 언제\n이걸 시켰어요?"],
    drunk: ["이거… 내가\n시켰나…? 딸꾹", "음~ 이건\n내 거 아닌 듯~"],
  },
  // 단골이 완벽한 요리를 받고 팁을 줄 때 한마디: 단골인 게 티 나는 말만, 팁·돈 얘기는 직접 하지 않음
  // (2026-11-16 사용자 "팁을 준다는 말은 직접적으로 안 했으면, 단골이라는 티만 나게")
  tip: {
    regular: ["역시 늘 먹던\n그 맛이에요!", "이 집 아니면\n안 된다니까요.", "오늘도 단골집\n오길 잘했다!"],
    "regular:taxi": ["역시 이 맛이지!\n또 올게요.", "기사 생활 십 년,\n여기만 한 데 없어.", "손님 내려 주고\n바로 달려왔지!"],
    "regular:office": ["이 맛에\n야근 버텨요…", "사장님 요리가\n제 비타민이에요.", "오늘도 여기서\n충전하고 가요!"],
    "regular:grandma": ["아이고 맛나다~\n역시 여기여.", "우리 단골집이\n최고여, 응?", "할미는 여기 아니면\n안 와~"],
    "regular:student": ["역시 단골집은\n못 바꿔요!", "친구들한테\n또 자랑해야지!", "시험 끝나면\n무조건 여기죠!"],
    "regular:cafe": ["역시 여기 오길\n잘했다~", "이 맛 때문에\n또 와요!", "친구들한텐 비밀인\n저만의 맛집이에요!"],
    "regular:guard": ["순찰 끝엔\n역시 여기요.", "늘 먹던 맛이\n제일이오.", "오늘 밤도\n든든하구먼!"],
  },
  // 마법의 가루를 뿌린 요리를 받았을 때 (감동, 값 2배)
  magic: {
    normal: ["우와!! 이게 무슨\n맛이에요?!", "입에서 별이\n터지는 맛!", "이건… 마법이야!"],
    regular: ["사장님, 오늘 비법이\n뭐예요?!", "단골인 저도\n처음 먹는 맛!", "와… 또 반했어요!"],
    "regular:grandma": ["아이고, 이게 웬\n신선놀음이여!", "할미 평생\n이런 맛 처음이여!"],
    drunk: ["딸꾹… 별이\n보여요~ 반짝반짝~", "이 맛에 술이\n다 깨네!"],
    jinsang: ["…인정. 맛있네요.", "이건 리뷰에\n별 다섯 개!"],
  },
  // 미식가 (이벤트): 요리 하나 받을 때마다 평가 한마디
  g_perfect: { normal: ["음…! 훌륭해!", "바로 이 맛이야!", "불 조절이\n완벽하군.", "이건 수첩에\n적어 둬야겠어."] },
  g_cooked: { normal: ["흠… 평범하군.", "먹을 만은 하네.\n그뿐이야.", "조금만 더\n신경 쓰지 그랬나."] },
  g_burnt: { normal: ["탄 맛이…\n입에 남는군.", "이건 숯인가,\n요리인가?", "불 앞을 떠나면\n안 되지!"] },
  g_raw: { normal: ["덜 익었잖나!\n0점일세.", "날것을 내놓다니…\n실망이군.", "이건 아직\n요리가 아니야."] },
  g_late: { normal: ["너무 늦는군…\n다음 요리 주게.", "기다리다\n식욕이 떨어졌어.", "시간도 맛의\n일부라네."] },
  g_wrong: { normal: ["내가 시킨 건\n이게 아닐세.", "주문을 다시\n보게나."] },
};
export const REACTION_MOODS: Record<string, string> = {
  raw: "yuck", burnt: "shock", wrong: "confused", tip: "happy", magic: "happy",
  g_perfect: "happy", g_cooked: "confused", g_burnt: "shock", g_raw: "yuck", g_late: "angry", g_wrong: "confused",
};
export const SAY_TIME = 2.6; // 말풍선이 떠 있는 시간 (초)
export const REACTION_TIME = 2.0; // 반응 표정을 짓는 시간 (초)
export const SEAT_REFILL_DELAY = 0.9; // 떠나는 모습이 끝나기까지 (이 전엔 그 자리에 아무도 못 앉음, 무한 영업 기준)
// 스토리: 손님이 떠나면 그 자리에 SEAT_REFILL_MIN~MAX초(매번 다르게) 뒤 다음 손님. 손님 사이 최소 간격 ARRIVAL_GAP초.
// 지금 = 원래대로 (떠나는 모습이 끝나는 0.9초 뒤 바로, 최소 간격 없음).
// 기록: 2026-11-11 "손님이 가면 바로" → 0.9초 → 2026-11-12 "너무 자주 와" 3.5~6초 → "한번에 많이 와" 5~8초 + 간격 5초
//       → 같은 날 "오는 템포는 원래대로, 대신 그릇 탭 자동 서빙" → 다시 0.9초, 간격 없음
export const SEAT_REFILL_MIN = 0.9;
export const SEAT_REFILL_MAX = 0.9;
export const ARRIVAL_GAP = 0.0;
export const RAW_LEAVE_DELAY = 2.4; // 덜 익은 음식에 반응(표정·대사)하고 떠나는 손님의 자리가 비기까지 (최소)

// ---------------------------------------------------------------- 미식가 이벤트 (가게와 가게 사이)
// 2026-11-16 사용자: "가게랑 가게 사이 스테이지(7과 8 사이, 14와 15 사이 …)에 숫자가 아닌 이벤트 스테이지.
//   보스몹처럼 주문 많이 하고 까다로운 미식가가 다녀가고 보상. 한 번밖에 플레이 못함."
// 가게의 마지막 스테이지를 깨면 그 가게와 다음 가게 사이 길에 열린다. 영업은 그 가게 부엌(메뉴 4가지 전부)에서.
// 미식가 혼자 가운데 자리에 앉아, 한 번에 perRound 가지씩 rounds 번 코스로 주문한다 (한 번 주문마다 인내심 patience 초).
// 요리마다 점수: 완벽 3 · 익음 1 · 탐 / 덜 익음 / 늦어서 놓침 0 → 만족도 = 점수 / (3 × 요리 수) → 별 1~5개 (GOURMET_GRADES).
// 보상 = reward × 별 / 5 (요리 값·팁은 따로 받음). "영업 시작"을 누르는 순간 기회를 쓴다 (중간에 나가면 보상 없음).

export interface EventDef {
  shop: string; // 이 가게의 마지막 스테이지를 깨면 열리고, 이 가게에서 영업한다
  rounds: number; // 코스 수
  perRound: number; // 한 번에 시키는 요리 수
  patience: number; // 한 번 주문(코스 하나)의 인내심 (초)
  reward: number; // 별 5개일 때 보상
  hello: string; // 들어올 때 한마디
}

// 인내심은 봇(완벽 구간만 노림)으로 맞춤 (tests/run_tests.ts 이벤트 리포트: 0.35~0.9초마다 한 동작 = 별 5개, 느릴수록 줄어듦)
export const EVENTS: EventDef[] = [
  { shop: "pocha", rounds: 5, perRound: 3, patience: 20.0, reward: 60000, hello: "포장마차라…\n어디 한번 볼까." },
  { shop: "bunsik", rounds: 5, perRound: 3, patience: 22.0, reward: 150000, hello: "분식은 기본이\n제일 어렵지." },
  { shop: "market", rounds: 6, perRound: 3, patience: 22.0, reward: 300000, hello: "야시장 맛,\n기대해도 되겠지?" },
  { shop: "beach", rounds: 6, perRound: 3, patience: 20.0, reward: 600000, hello: "바다 앞이라고\n봐주진 않네." },
];
export const GOURMET_PATIENCE_DECAY = 0.05; // 코스가 하나 지날 때마다 인내심이 이만큼(비율) 줄어든다 (갈수록 까다로워짐)
export const GOURMET_PATIENCE_MIN = 0.7; // 줄어도 처음의 이 비율까지만

export const GOURMET_SEAT = 1; // 가운데 자리
export const GOURMET_POINTS = [0, 1, 3, 0]; // 품질(Q) → 점수: 덜 익음 0 · 익음 1 · 완벽 3 · 탐 0
export const GOURMET_GRADES = [0.35, 0.55, 0.75, 0.9]; // 만족도가 이 값 이상이면 별 2 / 3 / 4 / 5개
export const GOURMET_VERDICTS = ["", "실망이야", "아쉽군", "나쁘지 않군", "훌륭하군!", "극찬!"];
// 별 수마다 미식가의 한줄평 (정산 화면 · 도감)
export const GOURMET_REVIEWS = [
  "중간에 문을 닫다니… 다음 기회는 없네.",
  "이건 요리가 아니라 연습이군.",
  "가능성은 보이네. 불 조절부터 다시 하게.",
  "평범하지만 정직한 맛이야.",
  "다시 오고 싶은 집이군. 칭찬하지.",
  "내 인생 최고의 한 끼였네. 이 집은 꼭 기록해 두지!",
];

export function eventFor(shopId: string): EventDef | null {
  return EVENTS.find((e) => e.shop === shopId) ?? null;
}

export function eventDishes(e: EventDef): number {
  return e.rounds * e.perRound;
}

/** 만족도(0~1) → 별 1~5개 */
export function gourmetGrade(satisfaction: number): number {
  let n = 1;
  for (const r of GOURMET_GRADES) if (satisfaction >= r - 1e-9) n += 1;
  return n;
}

/** 별 수에 따른 보상 (0개 = 중간에 나감 = 없음) */
export function eventReward(e: EventDef, grade: number): number {
  return roundHalfAway((e.reward * clamp(grade, 0, MAX_STARS)) / MAX_STARS);
}


export function reactionLines(kind: string, typeId: string, regularId = ""): string[] {
  const byType = REACTION_LINES[kind] ?? {};
  const key = `${typeId}:${regularId}`;
  if (regularId !== "" && key in byType) return byType[key];
  return byType[typeId] ?? byType["normal"] ?? [];
}

// ---------------------------------------------------------------- 가게(스테이지)

/** 전체 레벨 번호(1~35) → 가게 순번 */
export function shopIndexForLevel(level: number): number {
  const lv = clamp(level, 1, TOTAL_LEVELS);
  for (let i = 0; i < SHOPS.length; i++) {
    if (lv <= SHOPS[i].last_level) return i;
  }
  return SHOPS.length - 1;
}

export function shopForLevel(level: number): ShopDef {
  return SHOPS[shopIndexForLevel(level)];
}

export function shopIndex(id: string): number {
  const i = SHOPS.findIndex((s) => s.id === id);
  return i >= 0 ? i : 0;
}

export function shopDef(id: string): ShopDef {
  return SHOPS[shopIndex(id)];
}

export function shopMenus(id: string): string[] {
  return [...shopDef(id).menus];
}

export function shopLevelCount(shop: ShopDef): number {
  return shop.last_level - shop.first_level + 1;
}

/** 가게 안 레벨 번호 (1~7) */
export function levelInShop(level: number): number {
  return level - shopForLevel(level).first_level + 1;
}

/** 화면에 쓰는 이름: 스테이지 번호는 가게와 상관없이 1, 2, 3 … 35 로 이어진다 (2026-11-12 사용자 요청) */
export function levelName(level: number): string {
  return `스테이지 ${level}`;
}

/** 가게를 여는 값 (첫 가게는 0) */
export function shopOpenCost(id: string): number {
  return shopDef(id).open_cost ?? 0;
}

/**
 * 조리대 칸 배치 (왼쪽부터): {kind, slots, title, first, width, grid}.
 * sides 가게 = [왼쪽 도구, 화구 1, 화구 2, 화구 3, 화구 4, 오른쪽 도구], stations 가게 = 그 목록 그대로.
 * first = 그 도구 안에서 이 칸이 맡는 첫 번호 (같은 종류가 여러 곳이면 앞 칸 다음부터: 야시장 튀김기 3칸 + 2칸)
 */
export function shopLayout(shop: ShopDef): LayoutEntry[] {
  let src: StationSpot[] = [];
  if (shop.stations) {
    src = shop.stations;
  } else {
    const sides = shop.sides!;
    src.push(sides[0]);
    for (let k = 0; k < MAX_BURNERS; k++) src.push({ kind: STATION_BURNER, slots: 1, title: `화구 ${k + 1}` });
    src.push(sides[1]);
  }
  const out: LayoutEntry[] = [];
  const used: Record<string, number> = {};
  for (const st of src) {
    const first = used[st.kind] ?? 0;
    used[st.kind] = first + st.slots;
    out.push({ ...st, first });
  }
  return out;
}

/** 화구가 있는 가게인지 (골목 포장마차는 화구 대신 떡볶이 판·순대 솥) */
export function shopHasBurners(shop: ShopDef): boolean {
  return shopStationKinds(shop).includes(STATION_BURNER);
}

/** 오늘 가게에서 쓸 수 있는 조리도구 종류 (화구가 있으면 맨 앞, 겹치는 종류는 한 번) */
export function shopStationKinds(shop: ShopDef): string[] {
  const out: string[] = [];
  if (!shop.stations) out.push(STATION_BURNER);
  for (const e of shopLayout(shop)) {
    if (!out.includes(e.kind)) out.push(e.kind);
  }
  return out;
}

/** 이 가게에 있는 그 도구의 칸 수 (여러 곳에 있으면 합친 수) */
export function shopStationSlots(shop: ShopDef, kind: string): number {
  let n = 0;
  for (const e of shopLayout(shop)) if (e.kind === kind) n += e.slots;
  return n;
}

/** 가게 안에서 부르는 조리도구 이름 (예: 분식집의 냄비 = "면 삶는 냄비", 여러 곳에 나뉜 도구는 원래 이름) */
export function stationTitle(shop: ShopDef, kind: string): string {
  const found = shopLayout(shop).filter((e) => e.kind === kind);
  if (found.length === 1) return found[0].title;
  return STATIONS[kind]?.name ?? kind;
}

/** 새 가게 안내용 조리도구 목록 (예: "화구 · 튀김기 3칸 · 도마", "어묵 사각틀 4칸 · 떡볶이 판 · …") */
export function shopToolsText(shop: ShopDef): string {
  const parts: string[] = [];
  for (const kind of shopStationKinds(shop)) {
    if (kind === STATION_BURNER) {
      parts.push("화구");
      continue;
    }
    const n = shopStationSlots(shop, kind);
    parts.push(stationTitle(shop, kind) + (n > 1 ? ` ${n}칸` : ""));
  }
  parts.push("도마");
  return parts.join(" · ");
}

export function stationUsesHeat(kind: string): boolean {
  return STATIONS[kind]?.heat ?? false;
}

/** 큰 판·솥처럼 재료 한 번에 여러 그릇을 만드는 도구인지 */
export function stationIsBatch(kind: string): boolean {
  return STATIONS[kind]?.batch ?? false;
}

/** 떡볶이 판 한 판 그릇 수 (화구 추가 자리의 "판 키우기" 업그레이드 단계 = burners - 2) */
export function panPortions(burners: number): number {
  return PAN_PORTIONS + Math.max(0, burners - BASE_BURNERS);
}

// ---------------------------------------------------------------- 레벨

export interface LevelConfig {
  customers: number;
  interval: number;
  target: number;
}

export function levelConfig(level: number): LevelConfig {
  const lv = clamp(level, 1, TOTAL_LEVELS);
  const k = shopIndexForLevel(lv);
  const n = levelInShop(lv) - 1;
  const interval = LEVEL_INTERVALS[n] - 0.4 * k;
  return { customers: LEVEL_CUSTOMERS[lv - 1], interval: Math.max(interval, 8.0), target: LEVEL_TARGETS[lv - 1] };
}

/** 메뉴가 열리는 전체 레벨 번호 */
export function menuUnlockLevel(id: string): number {
  for (const shop of SHOPS) {
    const i = shop.menus.indexOf(id);
    if (i >= 0) return shop.first_level - 1 + MENU_UNLOCK_LEVELS[i];
  }
  return 1;
}

/** 그 레벨의 가게에서 열린 메뉴 (가게가 바뀌면 이전 가게 메뉴는 쓰지 않는다) */
export function unlockedMenus(level: number): string[] {
  return shopForLevel(level).menus.filter((id) => menuUnlockLevel(id) <= level);
}

export function menusUnlockedOn(level: number): string[] {
  return shopForLevel(level).menus.filter((id) => menuUnlockLevel(id) === level);
}

export function customerTypesFor(level: number): string[] {
  return CUSTOMER_ORDER.filter((id) => CUSTOMERS[id].unlock_level <= level);
}

export function customersUnlockedOn(level: number): string[] {
  return CUSTOMER_ORDER.filter((id) => CUSTOMERS[id].unlock_level === level);
}

// ---------------------------------------------------------------- 메뉴

export function menuName(id: string): string {
  return MENUS[id].name;
}

export function menuLabel(id: string): string {
  return MENUS[id].label;
}

export function menuPrice(id: string): number {
  return MENUS[id].price;
}

export function menuStation(id: string): string {
  return MENUS[id].station;
}

/** 도마에서 손질하는 메뉴인지 (조리 후 도마로 가거나, 처음부터 도마에서 만드는 메뉴) */
export function usesBoard(id: string): boolean {
  return MENUS[id].board !== undefined;
}

export function boardTaps(id: string): number {
  return MENUS[id].board?.taps ?? 3;
}

export function boardVerb(id: string): string {
  return MENUS[id].board?.verb ?? "썰기";
}

/** 도마 손질 단계 이름들 (김밥: 밥 올리기 → 재료 올리기 → 말기 → 썰기). 단계가 따로 없으면 빈 배열 */
export function boardSteps(id: string): string[] {
  return MENUS[id].board?.steps ?? [];
}

/** 도마에서 taps 번 손질한 뒤 다음 탭에 하는 일 (단계가 없으면 동사 그대로) */
export function boardStepVerb(id: string, taps: number): string {
  const steps = boardSteps(id);
  if (steps.length === 0) return boardVerb(id);
  return steps[clamp(taps, 0, steps.length - 1)];
}

/** GDScript round(): 0.5 는 0 에서 먼 쪽으로 */
export function roundHalfAway(x: number): number {
  return x < 0 ? -Math.round(-x) : Math.round(x);
}

export function tipFor(menuId: string, tipMult: number): number {
  return roundHalfAway(menuPrice(menuId) * TIP_RATE * tipMult);
}

export function wasteCost(menuId: string): number {
  return roundHalfAway(menuPrice(menuId) * WASTE_RATE);
}

/** 탄 음식을 그대로 주면 손님이 내는 값 (팁 없음) */
export function burntPrice(menuId: string): number {
  return roundHalfAway((menuPrice(menuId) * BURNT_PAY_RATE) / 100.0) * 100;
}

/** 완벽 서빙 비율 → 별 1~5개 */
export function starsFor(ratio: number): number {
  let n = 1;
  for (const r of STAR_RATIOS) if (ratio >= r) n += 1;
  return n;
}

// ---------------------------------------------------------------- 업그레이드

export function upgradeCost(id: string, levelIndex: number, shopId: string): number {
  const base = UPGRADES[id].levels[levelIndex].cost;
  const mult = shopDef(shopId).upgrade_mult;
  return roundHalfAway((base * mult) / 1000.0) * 1000;
}

export function upgradeName(id: string, shopId: string): string {
  const shop = shopDef(shopId);
  if (id === "stove") return shop.comfort;
  if (id === "burners" && shop.burner_upgrade) return shop.burner_upgrade;
  return UPGRADES[id].name;
}

/** 업그레이드 단계 설명 (화구가 없는 가게의 "화구 추가" 자리는 떡볶이 판 키우기) */
export function upgradeDesc(id: string, levelIndex: number, shopId: string): string {
  const shop = shopDef(shopId);
  if (id === "burners" && shop.burner_upgrade_desc) {
    const burners = UPGRADES[id].levels[levelIndex].value;
    return shop.burner_upgrade_desc.replace("%d", String(panPortions(burners)));
  }
  return UPGRADES[id].levels[levelIndex].desc;
}

export function regularDef(id: string): RegularDef | undefined {
  return REGULARS.find((r) => r.id === id);
}

// ---------------------------------------------------------------- 표시

export function formatNum(v: number): string {
  const digits = String(Math.abs(Math.trunc(v)));
  let out = "";
  let count = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    out = digits[i] + out;
    count += 1;
    if (count % 3 === 0 && i > 0) out = "," + out;
  }
  return (v < 0 ? "-" : "") + out;
}

/** 받침에 맞는 조사 (예: josa("야시장 푸드트럭", "을", "를") → "을", josa("해변 포장마차", "을", "를") → "를") */
export function josa(word: string, withBatchim: string, without: string): string {
  if (word.length === 0) return without;
  const code = word.charCodeAt(word.length - 1);
  if (code >= 0x30 && code <= 0x39) {
    // 숫자는 읽는 소리로: 0(십)·1(일)·3(삼)·6(육)·7(칠)·8(팔) = 받침 있음
    return [0, 1, 3, 6, 7, 8].includes(code - 0x30) ? withBatchim : without;
  }
  if (code < 0xac00 || code > 0xd7a3) return without;
  return (code - 0xac00) % 28 !== 0 ? withBatchim : without;
}

export function formatWon(v: number): string {
  return formatNum(v) + "원";
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
