// 하루 영업 1판의 규칙과 상태 (순수 로직).
// 화면(ShiftView)은 이 객체를 읽어서 그리고, 플레이어 입력을 아래 액션 함수로 넘긴다.
// 조리도구는 가게마다 다르다 (shopLayout): 화구(burner) + 가게의 왼쪽·오른쪽 도구 + 도마,
// 골목 포장마차는 화구 대신 어묵 사각틀·떡볶이 판·순대 솥·튀김기 + 도마.

import * as D from "./defs.ts";
import { CookItem, type TapResult } from "./cook_item.ts";
import { CustomerLogic, type ServeResult } from "./customer_logic.ts";
import { GourmetLogic } from "./gourmet_logic.ts";
import { nextRating, priceMult, reviewOf, type Review } from "./review.ts";
import { Signal } from "./signal.ts";
import { Rng } from "../engine/rng.ts";
import { clamp } from "../engine/geom.ts";

export interface Bowl {
  menu: string;
  quality: number;
  magic?: boolean; // 마법의 가루를 뿌린 요리
}

export interface Cutting {
  menu: string;
  quality: number;
  taps: number;
  magic?: boolean;
}

export interface StationTapResult extends TapResult {
  reason?: string;
  menu?: string;
  slot?: number;
  left?: number;
}

/** 미식가 이벤트 결과 */
export interface GourmetResult {
  grade: number; // 별 0~5 (0 = 코스를 끝까지 못 봄)
  satisfaction: number; // 0~1
  reward: number;
  perfect: number;
  cooked: number;
  bad: number;
  missed: number;
  total: number;
}

export interface ShiftResult {
  level: number;
  shop: string;
  endless: boolean;
  event?: boolean; // 미식가 이벤트
  gourmet?: GourmetResult;
  sales: number;
  tips: number;
  waste: number;
  revenue: number;
  target: number;
  passed: boolean;
  stars: number;
  perfect_ratio: number;
  items_ordered: number;
  items_perfect: number;
  happy: number;
  angry: number;
  customers: number;
  regulars: string[];
  elapsed: number;
  settled?: boolean;
  stock_left?: Record<string, number>; // 영업이 끝났을 때 남은 재료 (재료를 쓴 영업만)
  wasted?: number; // 버린 음식 (그릇 수)
  powder_used?: number; // 쓴 마법의 가루
  rating_start?: number; // 영업 시작 때 가게 평점 (평점을 쓰는 영업만)
  rating_end?: number;
  review_tags?: Record<string, number>; // 평가 한마디 종류별 손님 수 (good / cheap / pricey / slow / bad)
}

export class ShiftSession {
  readonly customerArrived = new Signal<[number]>();
  readonly customerLeft = new Signal<[number, CustomerLogic, string]>(); // reason: happy / angry / closing
  readonly orderChanged = new Signal<[number]>();
  readonly customerReacted = new Signal<[number, string]>(); // kind: raw / burnt / wrong (손님 표정·말풍선)
  readonly itemBurnt = new Signal<[string, number]>();
  readonly moneyEarned = new Signal<[number, number, number, number]>(); // seat, paid, tip, quality
  readonly ended = new Signal();
  readonly quotaReached = new Signal(); // 오늘 매출이 처음으로 할당량을 넘음 (스토리)
  readonly reviewed = new Signal<[number, Review, number]>(); // 손님이 떠나며 평가: seat, 평가, 바뀐 평점

  level = 1; // 스테이지 번호 (1~35)
  endless = false;
  event = false; // 미식가 이벤트 (가게와 가게 사이, 한 번만)
  eventDef: D.EventDef | null = null;
  gourmet: GourmetLogic | null = null;
  shop: D.ShopDef = D.SHOPS[0];
  shopId = "pocha";
  rng = new Rng(1);

  burnerCount = D.BASE_BURNERS;
  burnerValue = D.BASE_BURNERS; // 화구 업그레이드 단계 값 (칸 수는 4까지, 떡볶이 판 크기·불 조절은 이 값으로)
  burnerPerfectBonus = 0.0; // 화구 "불 조절": 화구 위 음식 완벽 구간이 늘어나는 비율
  heatScale = 1.0;
  patienceMult = 1.0;
  menuPool: string[] = [];
  newMenus: string[] = [];
  customerTypes: string[] = [];

  elapsed = 0.0;
  isOver = false;

  stations: Record<string, (CookItem | null)[]> = {}; // 조리도구 종류 → CookItem 또는 null 배열 (화구는 MAX_BURNERS칸, burnerCount칸만 사용)
  cutting: Cutting | null = null; // 도마: {menu, quality, taps} 또는 비어 있음
  tray: (Bowl | null)[] = []; // 완성 그릇
  seats: (CustomerLogic | null)[] = [];
  seatWait: number[] = []; // 자리마다 다음 손님이 앉을 수 있기까지 남은 시간
  seatRefill: boolean[] = []; // 손님이 떠난 자리: 손님 간격과 상관없이 다음 손님이 바로 온다

  customersTotal = 0; // 오늘 올 손님 수 (0이면 무제한 = 무한 영업)
  quotaDone = false; // 오늘 한 번이라도 할당량을 채웠나
  spawned = 0;
  spawnTimer = D.FIRST_SPAWN_DELAY;
  arrivalCooldown = 0.0; // 스토리: 다음 손님이 들어올 수 있기까지 (손님 사이 최소 간격 ARRIVAL_GAP)
  spawnInterval = 15.0;

  sales = 0;
  tips = 0;
  waste = 0;
  itemsOrdered = 0;
  itemsPerfect = 0;
  happyCount = 0;
  angryCount = 0;
  lives = D.ENDLESS_LIVES;
  target = 0;
  regularsServed: string[] = [];
  regularsToday: string[] = []; // 이번 영업에 온 단골 (한 번씩만)
  cameo = ""; // 이번 영업의 첫 손님으로 꼭 올 손님 종류 (예: 두 번째 가게 첫날 "imo"). 비어 있으면 없음
  cameoCame = false; // cameo 손님이 들어왔음
  stock: Record<string, number> | null = null; // 메뉴 → 남은 재료 (인분). null = 무한 (테스트·봇·미식가 이벤트)
  wasted = 0; // 버린 음식 (그릇 수)
  frozen = false; // 튜토리얼 설명 중: 손님 인내심이 줄지 않음
  powder = 0; // 가진 마법의 가루 (영업 시작 때 GameState 에서 받음)
  powderArmed = false; // 가루 통을 눌러 준비함 → 다음에 올리는 음식에 뿌림
  powderUsed = 0;
  prices: Record<string, string> = {}; // 메뉴 → 가격 단계 (cheap / normal / pricey), 없으면 보통
  ratingOn = false; // 실시간 가게 평점을 쓰나 (테스트·봇은 끔)
  rating = D.RATING_START;
  ratingStart = D.RATING_START;
  reviewTags: Record<string, number> = {};
  opened = true; // 가게 문을 열었나 (화면은 "준비 중" 팻말로 시작해서, 팻말을 뒤집어야 손님이 온다. 테스트·봇은 처음부터 열림)

  setupStory(level: number, burners: number, heatScale: number, patienceMult: number, seed = 0): void {
    this.level = clamp(level, 1, D.TOTAL_LEVELS);
    this.endless = false;
    this.event = false;
    this.eventDef = null;
    this.setShop(D.shopForLevel(this.level));
    const cfg = D.levelConfig(this.level);
    this.customersTotal = cfg.customers;
    this.spawnInterval = cfg.interval;
    this.target = cfg.target;
    this.menuPool = D.unlockedMenus(this.level);
    this.newMenus = D.menusUnlockedOn(this.level);
    this.customerTypes = D.customerTypesFor(this.level);
    this.setupCommon(burners, heatScale, patienceMult, seed);
  }

  /** 무한 영업: 클리어한 가게의 전체 메뉴·전체 손님 */
  setupEndless(shopId: string, burners: number, heatScale: number, patienceMult: number, seed = 0): void {
    this.setShop(D.shopDef(shopId));
    this.level = this.shop.last_level;
    this.endless = true;
    this.event = false;
    this.eventDef = null;
    this.customersTotal = 0;
    this.spawnInterval = D.ENDLESS_START_INTERVAL;
    this.target = 0;
    this.menuPool = D.shopMenus(this.shopId);
    this.newMenus = [];
    this.customerTypes = D.customerTypesFor(D.TOTAL_LEVELS);
    this.setupCommon(burners, heatScale, patienceMult, seed);
  }

  /** 미식가 이벤트: 그 가게의 모든 메뉴, 손님은 가운데 자리의 미식가 한 명뿐 */
  setupEvent(shopId: string, burners: number, heatScale: number, patienceMult: number, seed = 0): void {
    this.setShop(D.shopDef(shopId));
    this.level = this.shop.last_level;
    this.endless = false;
    this.event = true;
    this.eventDef = D.eventFor(shopId) ?? D.EVENTS[0];
    this.customersTotal = 1;
    this.spawnInterval = 999.0;
    this.target = 0;
    this.menuPool = D.shopMenus(this.shopId);
    this.newMenus = [];
    this.customerTypes = ["gourmet"];
    this.setupCommon(burners, heatScale, patienceMult, seed);
  }

  /** 미식가 코스: 코스마다 서로 다른 메뉴 perRound 가지 (메뉴가 모자라면 겹침) */
  gourmetCourse(): string[][] {
    const e = this.eventDef ?? D.EVENTS[0];
    const out: string[][] = [];
    for (let r = 0; r < e.rounds; r++) {
      const pool = [...this.menuPool];
      const round: string[] = [];
      for (let k = 0; k < e.perRound; k++) {
        if (pool.length === 0) pool.push(...this.menuPool);
        round.push(pool.splice(this.rng.randiRange(0, pool.length - 1), 1)[0]);
      }
      out.push(round);
    }
    return out;
  }

  private setShop(shop: D.ShopDef): void {
    this.shop = shop;
    this.shopId = shop.id;
  }

  private setupCommon(burners: number, heatScale: number, patienceMult: number, seed: number): void {
    this.burnerCount = D.burnersFor(burners);
    this.burnerValue = Math.max(1, Math.trunc(burners));
    this.burnerPerfectBonus = D.burnerPerfectBonus(burners);
    this.heatScale = heatScale;
    this.patienceMult = patienceMult;
    if (seed !== 0) this.rng.seed = seed;
    else this.rng.randomize();
    this.elapsed = 0.0;
    this.quotaDone = false;
    this.isOver = false;
    this.stations = {};
    for (const kind of D.shopStationKinds(this.shop)) {
      const n = kind === D.STATION_BURNER ? D.MAX_BURNERS : D.shopStationSlots(this.shop, kind);
      this.stations[kind] = new Array(n).fill(null);
    }
    this.tray = new Array(this.shop.menus.length * D.TRAY_PER_MENU).fill(null);
    this.seats = new Array(D.SEATS).fill(null);
    this.seatWait = new Array(D.SEATS).fill(0.0);
    this.seatRefill = new Array(D.SEATS).fill(false);
    this.cutting = null;
    this.spawned = 0;
    this.spawnTimer = D.FIRST_SPAWN_DELAY;
    this.arrivalCooldown = 0.0;
    this.sales = 0;
    this.tips = 0;
    this.waste = 0;
    this.itemsOrdered = 0;
    this.itemsPerfect = 0;
    this.happyCount = 0;
    this.angryCount = 0;
    this.lives = D.ENDLESS_LIVES;
    this.regularsServed = [];
    this.regularsToday = [];
    this.gourmet = null;
    this.stock = null;
    this.wasted = 0;
    this.opened = true;
    this.powder = 0;
    this.powderArmed = false;
    this.powderUsed = 0;
    this.prices = {};
    this.ratingOn = false;
    this.rating = D.RATING_START;
    this.ratingStart = D.RATING_START;
    this.reviewTags = {};
  }

  /** 메뉴 가격 단계와 가게 평점으로 영업 (setup 다음에 부름). 평점은 손님이 떠날 때마다 실시간으로 바뀜 */
  useMarket(prices: Record<string, string>, rating: number): void {
    this.prices = { ...prices };
    this.ratingOn = true;
    this.rating = rating;
    this.ratingStart = rating;
  }

  priceLevel(menuId: string): string {
    return this.prices[menuId] ?? "normal";
  }

  /** 영업 중 가격 바꾸기 (2026-11-17 사용자: 장보기 말고 영업 중인 가게에서). 다음에 내는 그릇부터 이 값 */
  setPriceLevel(menuId: string, level: string): void {
    if (!(level in D.PRICE_LEVELS)) return;
    this.prices[menuId] = level;
  }

  /** 일반 손님에게 붙는 메뉴 값 (가격 단계 반영) */
  postedPrice(menuId: string): number {
    return Math.round((D.menuPrice(menuId) * priceMult(this.priceLevel(menuId))) / 10) * 10;
  }

  /** 가루 통 탭: 가루가 있으면 준비 ↔ 취소. 준비됐으면 true */
  armPowder(): boolean {
    if (this.powder <= 0) {
      this.powderArmed = false;
      return false;
    }
    this.powderArmed = !this.powderArmed;
    return this.powderArmed;
  }

  /** 가루를 뿌리고 하나 씀 */
  private usePowder(): boolean {
    if (!this.powderArmed || this.powder <= 0) return false;
    this.powderArmed = false;
    this.powder -= 1;
    this.powderUsed += 1;
    return true;
  }

  /** 문 닫힌 채로 시작 (팻말 "준비 중"): 음식은 미리 만들 수 있고, 손님은 open() 뒤부터 */
  closeShop(): void {
    this.opened = false;
  }

  /** 팻말을 "영업 중"으로: 첫 손님은 FIRST_SPAWN_DELAY 뒤 */
  open(): void {
    if (this.opened) return;
    this.opened = true;
    this.spawnTimer = D.FIRST_SPAWN_DELAY;
  }

  /** 영업 중에 재료를 더 삼 (가게 창고 최대까지) */
  addStock(menuId: string, n: number): void {
    if (this.stock === null) return;
    this.stock[menuId] = Math.min(D.STOCK_MAX, (this.stock[menuId] ?? 0) + n);
  }

  /** 가게에 사 둔 재료로 영업 (setup 다음에 부름). 재료가 없는 메뉴는 품절 */
  useStock(stock: Record<string, number>): void {
    this.stock = {};
    for (const m of this.shop.menus) this.stock[m] = Math.max(0, Math.trunc(stock[m] ?? 0));
  }

  /** 남은 재료 (무한이면 Infinity) */
  stockLeft(menuId: string): number {
    return this.stock === null ? Infinity : (this.stock[menuId] ?? 0);
  }

  /** 품절: 재료도 없고 만들어 둔 것도 없음 → 손님이 주문하지 않는다 */
  soldOut(menuId: string): boolean {
    return this.stockLeft(menuId) <= 0 && (this.supplyCounts()[menuId] ?? 0) <= 0;
  }

  // ---------------------------------------------------------------- 진행

  update(delta: number): void {
    if (this.isOver) return;
    if (!this.opened) {
      // 문 열기 전: 조리만 (미리 만들어 둘 수 있음). 시간도 안 셈
      this.tickStations(delta);
      return;
    }
    this.elapsed += delta;
    if (this.endless) {
      const steps = Math.floor(this.elapsed / D.ENDLESS_RAMP_EVERY);
      this.spawnInterval = Math.max(D.ENDLESS_MIN_INTERVAL, D.ENDLESS_START_INTERVAL - steps * D.ENDLESS_RAMP_STEP);
    }
    this.tickStations(delta);
    this.tickCustomers(delta);
    for (let i = 0; i < this.seatWait.length; i++) this.seatWait[i] = Math.max(0.0, this.seatWait[i] - delta);
    this.tickSpawn(delta);
    this.checkEnd();
  }

  revenue(): number {
    return this.sales + this.tips - this.waste;
  }

  result(): ShiftResult {
    const ratio = this.itemsPerfect / Math.max(1, this.itemsOrdered);
    const total = this.revenue();
    const gr = this.event ? this.gourmetResult() : undefined;
    return {
      level: this.level,
      shop: this.shopId,
      endless: this.endless,
      event: this.event,
      gourmet: gr,
      sales: this.sales,
      tips: this.tips,
      waste: this.waste,
      revenue: total,
      target: this.target,
      passed: this.endless || this.event || total >= this.target,
      stars: gr !== undefined ? gr.grade : D.starsFor(ratio),
      perfect_ratio: ratio,
      items_ordered: this.itemsOrdered,
      items_perfect: this.itemsPerfect,
      happy: this.happyCount,
      angry: this.angryCount,
      customers: this.spawned,
      regulars: [...this.regularsServed],
      elapsed: this.elapsed,
      stock_left: this.stock === null ? undefined : { ...this.stock },
      wasted: this.wasted,
      powder_used: this.powderUsed,
      rating_start: this.ratingOn ? this.ratingStart : undefined,
      rating_end: this.ratingOn ? this.rating : undefined,
      review_tags: this.ratingOn ? { ...this.reviewTags } : undefined,
    };
  }

  /** 미식가 이벤트 결과 (코스를 끝까지 봤으면 별 1~5, 아니면 0) */
  gourmetResult(): GourmetResult {
    const e = this.eventDef ?? D.EVENTS[0];
    const g = this.gourmet;
    const total = D.eventDishes(e);
    if (g === null) return { grade: 0, satisfaction: 0, reward: 0, perfect: 0, cooked: 0, bad: 0, missed: 0, total };
    const sat = g.finalSatisfaction();
    const grade = g.finished ? D.gourmetGrade(sat) : 0;
    return { grade, satisfaction: sat, reward: D.eventReward(e, grade), perfect: g.perfect, cooked: g.cooked, bad: g.bad, missed: g.missed, total: g.total() };
  }

  // ---------------------------------------------------------------- 플레이어 액션

  /** 재료 탭 → 해당 조리도구의 빈 칸에 올림(도마 메뉴는 도마로). 올린 칸 번호, 자리가 없으면 -1, 재료가 없으면 -2 */
  addIngredient(menuId: string): number {
    if (this.isOver || !this.menuPool.includes(menuId)) return -1;
    const have = this.stockLeft(menuId);
    if (have <= 0) return -2;
    const station = D.menuStation(menuId);
    if (station === D.STATION_BOARD) {
      if (this.cutting !== null) return -1;
      this.cutting = { menu: menuId, quality: D.Q.PERFECT, taps: 0 };
      if (this.usePowder()) this.cutting.magic = true;
      this.takeStock(menuId, 1);
      return 0;
    }
    const arr = this.stationArray(station);
    for (let i = 0; i < this.stationCapacity(station); i++) {
      if (arr[i] === null) {
        const scale = D.stationUsesHeat(station) ? this.heatScale : 1.0;
        const item = new CookItem(menuId, scale);
        // 큰 판·솥은 한 판 = 그릇 수만큼 재료 (남은 재료가 모자라면 있는 만큼만)
        const n = D.stationIsBatch(station) ? Math.min(this.batchSize(station), have) : 1;
        if (D.stationIsBatch(station)) item.setBatch(n);
        item.perfectBonus = D.perfectBonusFor(this.shop, station, this.burnerValue); // 불 조절 업그레이드
        if (this.usePowder()) item.magic = true;
        arr[i] = item;
        this.takeStock(menuId, n);
        return i;
      }
    }
    return -1;
  }

  private takeStock(menuId: string, n: number): void {
    if (this.stock !== null) this.stock[menuId] = Math.max(0, (this.stock[menuId] ?? 0) - n);
  }

  /** 큰 판·솥 한 번에 만드는 그릇 수 (떡볶이 판은 업그레이드로 늘어남) */
  batchSize(station: string): number {
    if (station === "pan") return D.panPortions(this.burnerValue);
    if (station === "steamer") return D.STEAMER_PORTIONS;
    return 1;
  }

  /** 조리 중인 음식 탭 → 뒤집기 / 면 넣기 / 꺼내기 / (큰 판·솥) 한 그릇 덜기 */
  tapStation(station: string, index: number): StationTapResult {
    const item = this.stationItem(station, index);
    if (item === null || this.isOver) return { action: "none" };
    if (item.nextTapAction() === "take_out") {
      const toBoard = D.usesBoard(item.menuId);
      if (toBoard && this.cutting !== null) return { action: "blocked", reason: "board" };
      if (!toBoard && this.freeTraySlot(item.menuId) < 0) return { action: "blocked", reason: "tray", menu: item.menuId };
      let q: number;
      if (item.isBatch()) {
        q = item.takePortion();
        if (item.portions <= 0) this.stationArray(station)[index] = null;
      } else {
        q = item.tap().quality ?? D.Q.RAW;
        this.stationArray(station)[index] = null;
      }
      const left = item.isBatch() ? item.portions : 0;
      if (toBoard) {
        this.cutting = { menu: item.menuId, quality: q, taps: 0, magic: item.magic };
        return { action: "to_board", quality: q, menu: item.menuId, left };
      }
      const slot = this.freeTraySlot(item.menuId);
      this.tray[slot] = { menu: item.menuId, quality: q, magic: item.magic };
      return { action: "take_out", quality: q, slot, menu: item.menuId, left };
    }
    return item.tap();
  }

  /** 도마 탭 → 썰기·말기·버무리기. 정해진 횟수를 채우면 그릇에 담겨 완성 칸으로 */
  tapCutting(): { action: string; taps?: number; slot?: number; reason?: string; menu?: string } {
    if (this.cutting === null || this.isOver) return { action: "none" };
    const need = D.boardTaps(this.cutting.menu);
    const taps = Math.min(this.cutting.taps + 1, need);
    this.cutting.taps = taps;
    if (taps < need) return { action: "cut", taps };
    const slot = this.freeTraySlot(this.cutting.menu);
    if (slot < 0) return { action: "blocked", reason: "tray", menu: this.cutting.menu };
    this.tray[slot] = { menu: this.cutting.menu, quality: this.cutting.quality, magic: this.cutting.magic };
    this.cutting = null;
    return { action: "plated", slot };
  }

  /** 조리 중인 음식 버리기 (큰 판·솥은 남은 그릇 수만큼 손해) */
  discardStation(station: string, index: number): number {
    const item = this.stationItem(station, index);
    if (item === null) return 0;
    this.stationArray(station)[index] = null;
    return this.addWaste(item.menuId, item.portions);
  }

  discardTray(slot: number): number {
    if (slot < 0 || slot >= this.tray.length || this.tray[slot] === null) return 0;
    const menu = this.tray[slot]!.menu;
    this.tray[slot] = null;
    return this.addWaste(menu);
  }

  discardCutting(): number {
    if (this.cutting === null) return 0;
    const menu = this.cutting.menu;
    this.cutting = null;
    return this.addWaste(menu);
  }

  /** 완성 그릇을 손님에게 → {result: ok / angry / reject, ...} */
  serve(slot: number, seat: number): ServeResult {
    if (this.isOver || slot < 0 || slot >= this.tray.length || this.tray[slot] === null) return { result: "reject" };
    if (seat < 0 || seat >= this.seats.length || this.seats[seat] === null) return { result: "reject" };
    const bowl = this.tray[slot]!;
    const c = this.seats[seat]!;
    if (c instanceof GourmetLogic) return this.serveGourmet(slot, seat, c);
    const quality = bowl.quality;
    const res = c.serve(bowl.menu, quality, bowl.magic === true, priceMult(this.priceLevel(bowl.menu)), this.priceLevel(bowl.menu));
    const why = res.reason ?? "";
    if (res.result === "reject") {
      if (why === "wrong") this.customerReacted.emit(seat, why);
      return res;
    }
    this.tray[slot] = null;
    const paid = res.paid ?? 0;
    const tip = res.tip ?? 0;
    this.sales += paid;
    this.tips += tip;
    if (quality === D.Q.PERFECT && res.result === "ok") this.itemsPerfect += 1;
    this.moneyEarned.emit(seat, paid, tip, quality);
    if (!this.endless && !this.quotaDone && this.revenue() >= this.target) {
      this.quotaDone = true;
      this.quotaReached.emit();
    }
    if (why === "burnt") this.customerReacted.emit(seat, "burnt"); // 탄 음식: 투덜대며 받음 (값은 반만)
    // 한마디: 마법의 맛 > 비싸다 (일반 손님) > 단골 팁 > 싸니까 괜찮다
    const lvl = this.priceLevel(bowl.menu);
    const sens = c.priceSensitive() && this.ratingOn;
    let line = "";
    if (res.magic === true) line = "magic";
    else if (sens && lvl === "pricey" && res.result === "ok") line = quality === D.Q.PERFECT ? (this.rng.randf() < 0.4 ? "pricey_ok" : "") : "pricey";
    else if (tip > 0 && (c.typeId === "regular" || c.typeId === "imo")) line = "tip";
    else if (c.typeId === "imo" && res.done && res.result === "ok") line = "imo_bye"; // 이모는 다 먹으면 꼭 한마디
    else if (sens && lvl === "cheap" && res.result === "ok" && quality !== D.Q.PERFECT && why !== "burnt") line = "cheap_ok";
    if (line !== "" && why !== "burnt") this.customerReacted.emit(seat, line);
    else if (line !== "" && why === "burnt" && line === "pricey") this.customerReacted.emit(seat, line);
    const tipLine = line !== "";
    if (res.result === "angry") {
      this.customerReacted.emit(seat, "raw");
      this.customerLeaves(seat, "angry", D.RAW_LEAVE_DELAY);
    } else if (res.done) {
      if (c.regularId !== "") this.regularsServed.push(c.regularId);
      // 탄 음식에 투덜대거나 팁을 주며 한마디 하는 손님은 대사를 다 하고 떠나도록 자리를 조금 더 비워 둔다
      this.customerLeaves(seat, "happy", why === "burnt" || tipLine ? D.RAW_LEAVE_DELAY : D.SEAT_REFILL_DELAY);
    }
    return res;
  }

  /** 미식가에게 서빙: 무엇을 받든 한마디 평가(g_*), 덜 익은 요리에도 떠나지 않음, 코스를 다 받으면 다음 코스 */
  private serveGourmet(slot: number, seat: number, c: GourmetLogic): ServeResult {
    const bowl = this.tray[slot]!;
    const res = c.serve(bowl.menu, bowl.quality, bowl.magic === true);
    if (res.result === "reject") {
      if (res.reason === "wrong") this.customerReacted.emit(seat, "g_wrong");
      return res;
    }
    this.tray[slot] = null;
    const paid = res.paid ?? 0;
    const tip = res.tip ?? 0;
    this.sales += paid;
    this.tips += tip;
    if (bowl.quality === D.Q.PERFECT) this.itemsPerfect += 1;
    this.moneyEarned.emit(seat, paid, tip, bowl.quality);
    this.customerReacted.emit(seat, res.reason ?? "g_cooked");
    if (res.next) this.orderChanged.emit(seat);
    if (res.done) this.gourmetLeaves(seat, c);
    return res;
  }

  /** 코스가 끝난 미식가가 평가를 마치고 떠남 */
  private gourmetLeaves(seat: number, c: GourmetLogic): void {
    this.customerLeaves(seat, c.finalSatisfaction() >= D.GOURMET_GRADES[1] ? "happy" : "angry", D.REACTION_TIME + 0.6);
  }

  /**
   * 완성 그릇 탭 → 그 메뉴를 기다리는 손님 중 인내심이 가장 적게 남은 손님에게 자동으로 (2026-11-12 사용자 요청, 드래그 대신)
   * 반환: serve 결과 + seat. 그 메뉴를 기다리는 손님이 없으면 {result: "none"}
   */
  autoServe(slot: number): ServeResult {
    const seat = this.bestSeatFor(slot);
    if (seat < 0) return { result: "none" };
    const res = this.serve(slot, seat);
    res.seat = seat;
    return res;
  }

  /** 그 그릇 메뉴를 아직 못 받은 손님 중 인내심이 가장 적게 남은 자리 (없으면 -1) */
  bestSeatFor(slot: number): number {
    if (this.isOver || slot < 0 || slot >= this.tray.length || this.tray[slot] === null) return -1;
    const menu = this.tray[slot]!.menu;
    let best = -1;
    let bestPatience = Infinity;
    for (let i = 0; i < this.seats.length; i++) {
      const c = this.seats[i];
      if (c !== null && c.isWaiting() && c.unservedMenus().includes(menu) && c.patience < bestPatience) {
        best = i;
        bestPatience = c.patience;
      }
    }
    return best;
  }

  /** 손님 탭 (취객이 주문을 다시 말함) */
  tapCustomer(seat: number): boolean {
    if (seat < 0 || seat >= this.seats.length || this.seats[seat] === null) return false;
    return this.seats[seat]!.reveal();
  }

  // ---------------------------------------------------------------- 조회

  stationKinds(): string[] {
    return Object.keys(this.stations);
  }

  stationArray(station: string): (CookItem | null)[] {
    return this.stations[station] ?? [];
  }

  stationCapacity(station: string): number {
    if (!(station in this.stations)) return 0;
    if (station === D.STATION_BURNER) return this.burnerCount;
    return D.shopStationSlots(this.shop, station);
  }

  stationItem(station: string, index: number): CookItem | null {
    const arr = this.stationArray(station);
    if (index < 0 || index >= arr.length) return null;
    return arr[index];
  }

  /** 이 조리도구를 쓰는 메뉴가 오늘 열려 있는지 */
  stationInUse(station: string): boolean {
    return this.menuPool.some((m) => D.menuStation(m) === station);
  }

  /** 완성 칸 slot 이 어느 메뉴 그릇인지 (메뉴마다 TRAY_PER_MENU 칸, 가게 메뉴 순서대로) */
  trayMenu(slot: number): string {
    const menus = this.shop.menus;
    const k = Math.trunc(slot / D.TRAY_PER_MENU);
    return slot >= 0 && k < menus.length ? menus[k] : "";
  }

  /** 그 메뉴의 빈 그릇 칸 (없으면 -1) */
  freeTraySlot(menuId: string): number {
    for (let i = 0; i < this.tray.length; i++) {
      if (this.tray[i] === null && this.trayMenu(i) === menuId) return i;
    }
    return -1;
  }

  /** 비어 있고, 앞 손님이 떠난 뒤 잠깐 기다린 자리 중 하나 */
  freeSeatIndex(): number {
    const free: number[] = [];
    for (let i = 0; i < this.seats.length; i++) {
      if (this.seats[i] === null && (i >= this.seatWait.length || this.seatWait[i] <= 0.0)) free.push(i);
    }
    if (free.length === 0) return -1;
    return free[this.rng.randiRange(0, free.length - 1)];
  }

  /** 아직 다 받지 못한 손님 수 (자리에 있는 손님 + 아직 안 온 손님) */
  customersLeft(): number {
    return Math.max(0, this.customersTotal - this.happyCount - this.angryCount);
  }

  seatedCount(): number {
    return this.seats.filter((c) => c !== null).length;
  }

  /** 조리 중·도마·완성 칸에 있는 메뉴 그릇 수 (탄 음식 제외, 큰 판·솥은 남은 그릇 수) */
  supplyCounts(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const station of Object.keys(this.stations)) {
      for (const item of this.stationArray(station)) {
        if (item !== null && !item.burnt) out[item.menuId] = (out[item.menuId] ?? 0) + item.portions;
      }
    }
    if (this.cutting !== null) out[this.cutting.menu] = (out[this.cutting.menu] ?? 0) + 1;
    for (const bowl of this.tray) {
      if (bowl !== null) out[bowl.menu] = (out[bowl.menu] ?? 0) + 1;
    }
    return out;
  }

  /** 테스트용: 정해진 주문의 손님을 빈자리에 앉힘 */
  debugSeatCustomer(seat: number, c: CustomerLogic): void {
    this.seats[seat] = c;
    this.spawned += 1;
    this.itemsOrdered += c.items.length;
    this.customerArrived.emit(seat);
  }

  // ---------------------------------------------------------------- 내부

  private tickStations(delta: number): void {
    for (const station of Object.keys(this.stations)) {
      const arr = this.stationArray(station);
      for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        if (item !== null && item.tick(delta)) this.itemBurnt.emit(station, i);
      }
    }
  }

  private tickCustomers(delta: number): void {
    if (this.frozen) return;
    for (let i = 0; i < this.seats.length; i++) {
      const c = this.seats[i];
      if (c === null) continue;
      const ev = c.tick(delta, this.rng, this.menuPool);
      if (ev === "angry") this.customerLeaves(i, "angry");
      else if (ev === "swapped") this.orderChanged.emit(i);
      else if (ev === "late") {
        this.customerReacted.emit(i, "g_late");
        this.orderChanged.emit(i);
      } else if (ev === "done" && c instanceof GourmetLogic) {
        this.customerReacted.emit(i, "g_late");
        this.gourmetLeaves(i, c);
      }
    }
  }

  private tickSpawn(delta: number): void {
    if (this.customersTotal > 0 && this.spawned >= this.customersTotal) return;
    this.spawnTimer -= delta;
    if (this.event) {
      if (this.spawnTimer <= 0.0 && this.seats[D.GOURMET_SEAT] === null) this.spawnGourmet();
      return;
    }
    this.arrivalCooldown = Math.max(0.0, this.arrivalCooldown - delta);
    if (this.arrivalCooldown > 0.0) return; // 바로 앞 손님이 들어온 지 얼마 안 됨 (한꺼번에 몰려오지 않게)
    // 손님이 떠난 자리에는 손님 간격과 상관없이 다음 손님 (자리마다 정해진 기다림이 끝나면, 한 번에 한 명씩)
    for (let i = 0; i < this.seats.length; i++) {
      if (this.seatRefill[i] && this.seats[i] === null && this.seatWait[i] <= 0.0) {
        this.seatRefill[i] = false;
        this.spawnCustomer(i);
        return;
      }
    }
    // 빈자리는 손님 간격마다 한 명씩 더 채운다 (하루 시작할 때 자리가 차는 속도)
    if (this.spawnTimer > 0.0) return;
    const seat = this.freeSeatIndex();
    if (seat < 0) {
      this.spawnTimer = 0.0; // 자리가 나면 바로 입장
      return;
    }
    this.spawnCustomer(seat);
    this.spawnTimer = this.spawnInterval;
  }

  private spawnGourmet(): void {
    const e = this.eventDef ?? D.EVENTS[0];
    const c = new GourmetLogic(this.gourmetCourse(), e.patience * this.patienceMult);
    c.line = e.hello;
    c.critic = e.critic;
    this.gourmet = c;
    this.seats[D.GOURMET_SEAT] = c;
    this.spawned += 1;
    this.itemsOrdered += c.total();
    this.customerArrived.emit(D.GOURMET_SEAT);
  }

  private spawnCustomer(seat: number): void {
    // 정해진 첫 손님 (포장마차 이모): 그날 맨 처음 한 번만
    const cameo = this.cameo !== "" && !this.cameoCame && this.spawned === 0 ? this.cameo : "";
    let typeId = cameo !== "" ? cameo : this.pickType();
    // 올 단골이 없으면 (오늘 다 왔으면) 보통 손님으로
    const reg = typeId === "regular" ? this.pickRegular() : null;
    if (typeId === "regular" && reg === null) typeId = "normal";
    let count = 1;
    if (D.CUSTOMERS[typeId].max_items >= 2 && this.rng.randf() < D.SECOND_ITEM_CHANCE) count = 2;
    const menus: string[] = [];
    for (let k = 0; k < count; k++) menus.push(this.pickMenu());
    // 가게 평점이 높을수록 일반 손님이 조금 더 기다려 줌 (단골은 그대로)
    const ratingK = this.ratingOn && typeId !== "regular" ? D.ratingPatience(this.rating) : 1.0;
    const c = new CustomerLogic(typeId, menus, this.patienceMult * ratingK);
    if (typeId === "regular" && reg !== null) {
      const r = reg;
      this.regularsToday.push(r.id);
      c.regularId = r.id;
      c.line = r.lines[this.rng.randiRange(0, r.lines.length - 1)];
    } else if (typeId === "jinsang") {
      c.swapAt = this.rng.randfRange(D.JINSANG_SWAP_MIN, D.JINSANG_SWAP_MAX);
    } else if (typeId === "imo") {
      c.line = D.IMO_HELLO;
      this.cameoCame = true;
    }
    this.seats[seat] = c;
    this.spawned += 1;
    this.itemsOrdered += count;
    if (!this.endless) this.arrivalCooldown = D.ARRIVAL_GAP;
    this.customerArrived.emit(seat);
  }

  private pickType(): string {
    let total = 0.0;
    for (const t of this.customerTypes) total += D.CUSTOMERS[t].weight;
    let roll = this.rng.randf() * total;
    for (const t of this.customerTypes) {
      roll -= D.CUSTOMERS[t].weight;
      if (roll <= 0.0) return t;
    }
    return this.customerTypes[this.customerTypes.length - 1];
  }

  /**
   * 이 가게에 오는 단골 중 아무나 하나 (똑같은 확률). 오늘(이번 영업) 이미 온 단골은 다시 안 옴 — 올 사람이 없으면 null.
   * (2026-11-16 사용자: "같은 스테이지에만 사람 안 겹치면 돼, 그것만 지키고 사람 오는 건 랜덤으로")
   */
  pickRegular(): D.RegularDef | null {
    const pool = D.regularsFor(this.shopId).filter((r) => !this.regularsToday.includes(r.id));
    if (pool.length === 0) return null;
    return pool[this.rng.randiRange(0, pool.length - 1)];
  }

  private pickMenu(): string {
    // 품절 메뉴는 주문하지 않는다 (전부 품절이면 아무거나 — 그날은 손님이 화내며 떠남)
    let pool = this.menuPool.filter((m) => !this.soldOut(m));
    if (pool.length === 0) pool = this.menuPool;
    let total = 0.0;
    for (const m of pool) total += this.menuWeight(m);
    let roll = this.rng.randf() * total;
    for (const m of pool) {
      roll -= this.menuWeight(m);
      if (roll <= 0.0) return m;
    }
    return pool[pool.length - 1];
  }

  private menuWeight(menuId: string): number {
    return this.newMenus.includes(menuId) ? D.NEW_MENU_WEIGHT : 1.0;
  }

  /** minWait = 그 자리가 비기까지 최소 시간 (덜 익은 음식에 반응하고 떠나는 손님은 더 오래) */
  private customerLeaves(seat: number, reason: string, minWait: number = D.SEAT_REFILL_DELAY): void {
    const c = this.seats[seat];
    if (c === null) return;
    this.seats[seat] = null;
    if (seat < this.seatWait.length) {
      // 스토리는 떠난 자리에 SEAT_REFILL_MIN~MAX초 뒤 다음 손님 (무한 영업은 손님 간격으로 점점 빨라지는 맛을 남긴다)
      const refill = reason !== "closing" && !this.endless;
      let wait = 0.0;
      if (refill) {
        wait = D.SEAT_REFILL_MAX <= D.SEAT_REFILL_MIN ? D.SEAT_REFILL_MIN : this.rng.randfRange(D.SEAT_REFILL_MIN, D.SEAT_REFILL_MAX);
      }
      this.seatWait[seat] = Math.max(minWait, wait);
      this.seatRefill[seat] = refill;
    }
    if (reason === "happy") this.happyCount += 1;
    else if (reason === "angry") {
      this.angryCount += 1;
      if (this.endless) this.lives = Math.max(0, this.lives - 1);
    }
    // 가게 평점: 떠나는 손님의 평가 쪽으로 (영업이 끝나 내보내는 손님·미식가는 빼고)
    if (this.ratingOn && reason !== "closing" && !(c instanceof GourmetLogic)) {
      const served = c.items.filter((it) => it.served);
      const rv = reviewOf({
        angry: reason === "angry",
        qualities: served.map((it) => it.quality),
        priceLevels: served.map((it) => it.priceLevel ?? this.priceLevel(it.menu)),
        priceSensitive: c.priceSensitive(),
        patienceRatio: reason === "angry" && served.length === 0 ? 0 : c.lastPatienceRatio,
        magic: c.gotMagic,
      });
      this.rating = nextRating(this.rating, rv.score, D.RATING_ALPHA);
      this.reviewTags[rv.tag] = (this.reviewTags[rv.tag] ?? 0) + 1;
      this.reviewed.emit(seat, rv, this.rating);
    }
    this.customerLeft.emit(seat, c, reason);
  }

  /** 버림: 재료를 사서 쓰는 영업은 그 재료를 잃는 것으로 끝 (돈은 안 뺌), 재료가 무한인 테스트·봇은 재료값만큼 폐기 손실 */
  private addWaste(menuId: string, count = 1): number {
    this.wasted += Math.max(1, count);
    if (this.stock !== null) return 0;
    const cost = D.wasteCost(menuId) * Math.max(1, count);
    this.waste += cost;
    return cost;
  }

  private checkEnd(): void {
    let done = false;
    if (this.endless) done = this.lives <= 0;
    else if (this.spawned >= this.customersTotal && this.seatedCount() === 0) done = true; // 그날 손님을 모두 받음 (시간 제한 없음)
    if (done) this.finish();
  }

  private finish(): void {
    this.isOver = true;
    for (let i = 0; i < this.seats.length; i++) {
      if (this.seats[i] !== null) this.customerLeaves(i, "closing");
    }
    this.ended.emit();
  }
}
