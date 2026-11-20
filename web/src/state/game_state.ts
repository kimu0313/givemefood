// 저장되는 진행 상황 (브라우저 localStorage): 열린 레벨, 레벨별 별, 지갑, 가게별 업그레이드, 단골 도감, 가게별 최고 기록.
// 레벨(스테이지) 번호는 전체 번호 1~35 이고 화면에도 그대로 "스테이지 N" 으로 보여 준다.
// 가게의 마지막 스테이지를 깨도 다음 가게는 저절로 안 열린다: 모은 돈으로 산다 (buyShop).
// 계정(로그인): 서버 없이 이 기기 안에서 이름별로 저장 칸을 나눈다. 게스트 = 예전 그대로 SAVE_KEY,
// 로그인한 이름 = SAVE_KEY@이름. 계정 목록과 지금 로그인한 이름은 ACCOUNTS_KEY 에.
// 2026-11-16 사용자 로그인 창 그림 (아이디·비밀번호·자동 로그인·아이디/비밀번호 찾기·회원가입): 새 계정은 회원가입(signUp)으로만,
// 로그인(login)은 있는 아이디 + 비밀번호. 비밀번호는 그대로 두지 않고 계정 목록에 해시로 (서버가 없어 이 기기 안에서만 막는 정도).
// 예전에 이름만으로 만든 계정은 비밀번호가 없어서 처음 로그인할 때 적은 비밀번호가 그 계정 비밀번호가 된다.
// 자동 로그인을 끄고 로그인하면 다음에 켤 때는 게스트로 시작 (아이디 칸에는 마지막 아이디).

import * as D from "../core/defs.ts";
import type { ShiftResult } from "../core/shift_session.ts";
import { Signal } from "../core/signal.ts";
import { clamp } from "../engine/geom.ts";

export const SAVE_KEY = "pocha_tycoon_save";
export const ACCOUNTS_KEY = "pocha_tycoon_accounts";
export const NAME_MIN = 2;
export const NAME_MAX = 10;
export const PW_MIN = 4;
export const PW_MAX = 20;
// 6 = 가게마다 7스테이지 (4·5 는 5스테이지 → 가게 안 순서대로 옮김), 5 = 별점 5개 만점 (4 이하는 3개 만점 → 1·3·5개로)
export const SAVE_VERSION = 7; // 7 = 업그레이드 5단계 (2026-11-18, 옛 단계는 같은 효과 단계로)

type IntDict = Record<string, number>;
type UpgradeDict = Record<string, number>;

/** 저장소 (브라우저 localStorage 와 같은 모양, 테스트에서는 메모리로 바꿔 끼운다) */
export interface KeyStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStore(): KeyStore | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** 계정 이름 다듬기: 앞뒤 공백 빼고, 안쪽 공백은 하나로, 눈에 안 보이는 글자는 지운다 */
export function normalizeName(raw: string): string {
  return raw.replace(/[\u0000-\u001f\u007f\u200b-\u200f\ufeff]/g, "").replace(/\s+/g, " ").trim();
}

/** 이름이 안 되는 까닭 (되면 "") */
export function nameError(raw: string): string {
  const n = Array.from(normalizeName(raw)).length;
  if (n === 0) return "이름을 적어 주세요.";
  if (n < NAME_MIN) return `이름은 ${NAME_MIN}글자 이상이어야 해요.`;
  if (n > NAME_MAX) return `이름은 ${NAME_MAX}글자까지 돼요.`;
  return "";
}

/** 비밀번호가 안 되는 까닭 (되면 "") */
export function passwordError(pw: string): string {
  if (pw.length === 0) return "비밀번호를 적어 주세요.";
  if (pw.length < PW_MIN) return `비밀번호는 ${PW_MIN}글자 이상이어야 해요.`;
  if (pw.length > PW_MAX) return `비밀번호는 ${PW_MAX}글자까지 돼요.`;
  return "";
}

/** 비밀번호 해시 (아이디를 소금으로 섞은 FNV-1a 두 번, 16진수 16글자). 이 기기 안에서 그대로 안 보이게 하는 정도 */
export function passwordHash(name: string, pw: string): string {
  const text = `pocha:${normalizeName(name).toLowerCase()}:${pw}`;
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ (c + i), 0x5bd1e995) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

export interface LoginResult {
  ok: boolean;
  error: string;
  created: boolean; // 새 계정을 만들었음
  carried: boolean; // 게스트로 하던 기록을 새 계정으로 옮겼음
}

export class GameStateClass {
  readonly changed = new Signal();

  level = 1; // 지금까지 열린 가장 높은 레벨 (여기까지 지도에서 고를 수 있다)
  storyCleared = false; // 마지막 가게 마지막 레벨까지 깸
  wallet = D.START_MONEY; // 처음 시작하면 개업 자금. 외상으로 재료를 사면 잠깐 마이너스가 될 수 있다 (다음 정산에서 갚음)
  stock: Record<string, Record<string, number>> = {}; // 가게 id → 메뉴 → 사 둔 재료 (인분)
  powder = 0; // 마법의 가루 (모든 가게에서 같이 씀)
  prices: Record<string, Record<string, string>> = {}; // 가게 id → 메뉴 → 가격 단계 (cheap / normal / pricey)
  ratings: Record<string, number> = {}; // 가게 id → 실시간 가게 평점 (1~5)
  tutorial = "start"; // 처음 하는 사람 튜토리얼 단계: start(지도) → buy(장보기) → upgrade → stage → cook(영업) → "" (끝)
  upgrades: Record<string, UpgradeDict> = {}; // 가게 id → {burners, heat, stove} 단계
  regulars: IntDict = {}; // 단골 id → 방문(서빙 성공) 횟수
  bestEndless: IntDict = {}; // 가게 id → 무한 영업 최고 매출
  levelStars: IntDict = {}; // "13" → 그 레벨 최고 별점 1~5 (깬 레벨만 있음)
  events: IntDict = {}; // 미식가 이벤트: 가게 id → 받은 별 0~5 (있으면 이미 한 번 도전함, 0 = 중간에 나감)
  imoVisited = false; // 포장마차 이모가 두 번째 가게 첫 손님으로 이미 다녀감 (한 번만)

  saveEnabled = true; // 테스트·캡처는 false로 두고 실제 저장을 건드리지 않는다
  store: KeyStore | null = browserStore();
  account = ""; // 로그인한 이름 ("" = 게스트)
  accounts: string[] = []; // 이 기기에 만들어진 계정 이름들 (만든 순서)
  passwords: Record<string, string> = {}; // 계정 이름(소문자) → 비밀번호 해시 (없으면 예전 계정 = 비밀번호 없음)
  autoLogin = true; // 자동 로그인 (끄면 다음에 켤 때 게스트로)
  lastAccount = ""; // 마지막으로 로그인한 아이디 (로그인 창 아이디 칸에 미리)
  justLoggedIn = ""; // 방금 로그인한 이름 (시작 화면에서 인사)
  mode = "story"; // 다음 영업 모드: story / endless
  playLevel = 1; // 지도에서 고른, 다음에 영업할 레벨
  mapShop = ""; // 지도에서 보고 있는 가게 (비어 있으면 가장 최근에 열린 가게)
  endlessShop = "pocha"; // 무한 영업할 가게
  eventShop = ""; // 미식가 이벤트를 할 가게 (mode = "event")
  /** 미식가 만화를 보고 바로 들어옴 → 영업 안내 창 없이 곧장 시작 (저장 안 함, 2026-11-21) */
  eventFromComic = false;
  lastResult: ShiftResult | null = null;
  justCleared = false; // 이번 정산으로 마지막 레벨을 처음 깸
  justOpened = ""; // 방금 산 가게 id (가게 오픈 화면을 보여 줌)
  justShopCleared = ""; // 이번 정산으로 마지막 스테이지를 깬 가게 (지도에서 다음에 살 가게를 보여 줌)
  justUnlocked = 0; // 이번 정산으로 새로 열린 레벨 (지도에서 연출)

  // ---------------------------------------------------------------- 가게 / 레벨

  /** 가장 최근에 열린 가게 */
  frontierShop(): D.ShopDef {
    return D.shopForLevel(this.level);
  }

  frontierShopId(): string {
    return this.frontierShop().id;
  }

  /** 지도에서 보고 있는 가게 id */
  currentMapShop(): string {
    if (this.mapShop === "" || !this.shopOpened(this.mapShop)) return this.frontierShopId();
    return this.mapShop;
  }

  /** 이 가게의 마지막 스테이지까지 깼는지 (무한 영업이 열리고, 다음 가게를 살 수 있음) */
  shopCleared(shopId: string): boolean {
    if (this.storyCleared) return true;
    const last = D.shopDef(shopId).last_level;
    return this.level > last || this.levelCleared(last);
  }

  /** 이 가게를 지금 살 수 있는지: 아직 안 열렸고, 바로 앞 가게의 마지막 스테이지를 깼음 (돈은 따로 확인) */
  canBuyShop(shopId: string): boolean {
    const i = D.shopIndex(shopId);
    if (i <= 0 || this.shopOpened(shopId)) return false;
    return this.shopCleared(D.SHOPS[i - 1].id);
  }

  /** 지금 살 수 있는 다음 가게 id (없으면 "") */
  nextBuyableShop(): string {
    for (const sh of D.SHOPS) if (this.canBuyShop(sh.id)) return sh.id;
    return "";
  }

  /** 모은 돈으로 새 가게 열기 → 그 가게 첫 스테이지가 열리고 새 가게 오픈 화면(justOpened) */
  buyShop(shopId: string): boolean {
    if (!this.canBuyShop(shopId)) return false;
    const cost = D.shopOpenCost(shopId);
    if (this.wallet < cost) return false;
    this.wallet -= cost;
    this.level = Math.max(this.level, D.shopDef(shopId).first_level);
    // 개업 선물: 첫 메뉴 재료 (돈을 다 써서 가게를 사도 바로 영업할 수 있게)
    const first = D.shopDef(shopId).menus[0];
    this.addStock(shopId, first, D.NEW_SHOP_STOCK);
    this.justOpened = shopId;
    this.justUnlocked = this.level;
    this.mapShop = shopId;
    this.saveGame();
    this.changed.emit();
    return true;
  }

  /** 이 가게가 열렸는지 */
  shopOpened(shopId: string): boolean {
    return this.level >= D.shopDef(shopId).first_level;
  }

  levelOpen(lv: number): boolean {
    return lv <= this.level;
  }

  levelCleared(lv: number): boolean {
    return String(lv) in this.levelStars;
  }

  starsOf(lv: number): number {
    return this.levelStars[String(lv)] ?? 0;
  }

  bestEndlessFor(shopId: string): number {
    return this.bestEndless[shopId] ?? 0;
  }

  shopStars(shopId: string): number {
    const shop = D.shopDef(shopId);
    let total = 0;
    for (let lv = shop.first_level; lv <= shop.last_level; lv++) total += this.starsOf(lv);
    return total;
  }

  /** 가게 별점 (5점 만점): 그 가게 레벨 별의 평균. 안 깬 레벨은 0개로 친다 */
  shopRating(shopId: string): number {
    return this.shopStars(shopId) / D.shopLevelCount(D.shopDef(shopId));
  }

  totalStars(): number {
    return Object.values(this.levelStars).reduce((a, b) => a + b, 0);
  }

  /** 지도에서 레벨을 골라 영업 준비 */
  chooseLevel(lv: number): void {
    this.playLevel = clamp(lv, 1, this.level);
    this.mode = "story";
    this.mapShop = D.shopForLevel(this.playLevel).id;
  }

  // ---------------------------------------------------------------- 미식가 이벤트 (가게와 가게 사이, 한 번만)

  /** 이 가게 뒤에 미식가 이벤트가 있는지 */
  hasEvent(shopId: string): boolean {
    return D.eventFor(shopId) !== null;
  }

  /** 이미 도전했는지 (한 번만 할 수 있다) */
  eventPlayed(shopId: string): boolean {
    return shopId in this.events;
  }

  /** 받은 별 (0 = 아직 안 했거나 중간에 나감) */
  eventGrade(shopId: string): number {
    return this.events[shopId] ?? 0;
  }

  /** 지금 도전할 수 있는지: 그 가게 마지막 스테이지를 깼고, 아직 안 함 */
  eventOpen(shopId: string): boolean {
    return this.hasEvent(shopId) && this.shopCleared(shopId) && !this.eventPlayed(shopId);
  }

  /** 지도에서 미식가 이벤트를 골라 영업 준비 */
  chooseEvent(shopId: string): void {
    this.mode = "event";
    this.eventShop = shopId;
    this.mapShop = shopId;
  }

  /** "영업 시작"을 누르는 순간 기회를 쓴다 (중간에 나가도 다시 못 함, 보상 없음) */
  startEvent(shopId: string): void {
    if (!this.eventOpen(shopId)) return;
    this.events[shopId] = 0;
    this.saveGame();
  }

  // ---------------------------------------------------------------- 업그레이드 (가게마다 따로)

  private shopOrMap(shopId: string): string {
    return shopId !== "" ? shopId : this.currentMapShop();
  }

  upgradeLevel(id: string, shopId = ""): number {
    const sid = this.shopOrMap(shopId);
    return this.upgrades[sid]?.[id] ?? 0;
  }

  upgradeLevels(id: string): D.UpgradeLevel[] {
    return D.UPGRADES[id].levels;
  }

  /** 다음 단계 정의 + 이 가게 기준 가격(cost). 최대 단계면 null */
  nextUpgrade(id: string, shopId = ""): D.UpgradeLevel | null {
    const sid = this.shopOrMap(shopId);
    const lv = this.upgradeLevel(id, sid);
    const levels = this.upgradeLevels(id);
    if (lv >= levels.length) return null;
    return { ...levels[lv], cost: D.upgradeCost(id, lv, sid), desc: D.upgradeDesc(id, lv, sid) };
  }

  /** 지금 지갑으로 살 수 있는 업그레이드가 있는지 (지도 버튼에 표시) */
  canBuyAny(shopId = ""): boolean {
    for (const id of D.UPGRADE_ORDER) {
      const nxt = this.nextUpgrade(id, shopId);
      if (nxt !== null && this.wallet >= nxt.cost) return true;
    }
    return false;
  }

  buyUpgrade(id: string, shopId = ""): boolean {
    const sid = this.shopOrMap(shopId);
    const nxt = this.nextUpgrade(id, sid);
    if (nxt === null) return false;
    if (this.wallet < nxt.cost) return false;
    this.wallet -= nxt.cost;
    const levels = this.upgrades[sid] ?? {};
    levels[id] = this.upgradeLevel(id, sid) + 1;
    this.upgrades[sid] = levels;
    this.saveGame();
    this.changed.emit();
    return true;
  }

  /** 화구 칸 수 (4칸까지) */
  burnerCount(shopId = ""): number {
    return D.burnersFor(this.burnerValue(shopId));
  }

  /** 화구 업그레이드 단계 값 (영업에 그대로 넘김: 칸 수·떡볶이 판 크기·불 조절, D.UPGRADES 설명) */
  burnerValue(shopId = ""): number {
    return Math.trunc(this.upgradeValue("burners", D.BASE_BURNERS, shopId));
  }

  heatScale(shopId = ""): number {
    return 1.0 - this.upgradeValue("heat", 0.0, shopId);
  }

  patienceMult(shopId = ""): number {
    return 1.0 + this.upgradeValue("stove", 0.0, shopId);
  }

  private upgradeValue(id: string, defaultValue: number, shopId: string): number {
    const lv = this.upgradeLevel(id, shopId);
    if (lv <= 0) return defaultValue;
    return this.upgradeLevels(id)[lv - 1].value;
  }

  // ---------------------------------------------------------------- 영업 결과

  recordResult(r: ShiftResult): void {
    this.lastResult = { ...r, regulars: [...r.regulars], settled: false };
    for (const id of r.regulars ?? []) this.regulars[id] = (this.regulars[id] ?? 0) + 1;
    if (r.event && r.gourmet !== undefined) this.events[r.shop] = Math.max(this.events[r.shop] ?? 0, r.gourmet.grade);
    if ((r.powder_used ?? 0) > 0) this.powder = Math.max(0, this.powder - (r.powder_used ?? 0));
    if (r.rating_end !== undefined) this.ratings[r.shop] = clamp(r.rating_end, 1, 5);
    if (r.stock_left !== undefined) {
      // 영업에서 쓰고 남은 재료
      const sh: Record<string, number> = {};
      for (const m of Object.keys(r.stock_left)) sh[m] = clamp(r.stock_left[m], 0, D.STOCK_MAX);
      this.stock[r.shop] = { ...(this.stock[r.shop] ?? {}), ...sh };
    }
    if (r.endless) {
      const sid = r.shop ?? "pocha";
      this.bestEndless[sid] = Math.max(this.bestEndlessFor(sid), r.revenue);
    }
    this.saveGame();
  }

  /** 정산 화면을 떠날 때 한 번 호출. doubled = 광고 매출 2배, adPass = 광고로 통과 */
  settle(doubled: boolean, adPass: boolean): void {
    const r = this.lastResult;
    if (r === null || r.settled) return;
    r.settled = true;
    let gain = r.revenue;
    if (doubled && gain > 0) gain *= 2;
    if (r.event) {
      // 미식가 리뷰로 유명해짐: 몰려든 손님 덕에 매출이 오르고 가게 평점도 오름
      gain += r.gourmet?.reward ?? 0;
      const g = r.gourmet?.grade ?? 0;
      this.ratings[r.shop] = clamp(this.liveRating(r.shop) + (D.FAME_RATING[g] ?? 0), 1, 5);
    }
    this.wallet += gain; // 외상(마이너스)이 있으면 여기서 갚는다
    this.justCleared = false;
    this.justOpened = "";
    this.justShopCleared = "";
    this.justUnlocked = 0;
    if (!r.endless && !r.event) {
      const lv = r.level;
      if (r.passed || adPass) {
        const key = String(lv);
        this.levelStars[key] = Math.max(this.levelStars[key] ?? 0, Math.max(1, r.stars));
        if (lv >= D.TOTAL_LEVELS) {
          this.justCleared = !this.storyCleared;
          this.storyCleared = true;
        } else if (lv + 1 > this.level) {
          if (D.shopIndexForLevel(lv + 1) === D.shopIndexForLevel(lv)) {
            this.level = lv + 1;
            this.justUnlocked = this.level;
          } else if (!this.shopOpened(D.shopForLevel(lv + 1).id)) {
            // 가게의 마지막 스테이지: 다음 가게는 저절로 안 열리고, 무한 영업으로 돈을 모아 산다
            this.justShopCleared = D.shopForLevel(lv).id;
          }
        }
      }
    }
    this.saveGame();
    this.changed.emit();
  }

  // ---------------------------------------------------------------- 저장

  saveData(): Record<string, unknown> {
    return {
      version: SAVE_VERSION,
      level: this.level,
      story_cleared: this.storyCleared,
      wallet: this.wallet,
      upgrades: this.upgrades,
      regulars: this.regulars,
      best_endless: this.bestEndless,
      level_stars: this.levelStars,
      events: this.events,
      stock: this.stock,
      powder: this.powder,
      prices: this.prices,
      ratings: this.ratings,
      tutorial: this.tutorial,
      imo_visited: this.imoVisited,
    };
  }

  /** 이 계정의 저장 칸 이름 */
  saveKey(name = this.account): string {
    return name === "" ? SAVE_KEY : `${SAVE_KEY}@${name}`;
  }

  saveGame(): void {
    if (!this.saveEnabled || this.store === null) return;
    try {
      this.store.setItem(this.saveKey(), JSON.stringify(this.saveData(), null, 2));
    } catch (e) {
      console.warn("save failed", e);
    }
  }

  /** 계정 목록 + 지금 로그인한 계정의 저장을 읽는다 */
  loadGame(): void {
    this.loadAccounts();
    this.loadSlot();
  }

  /** 지금 계정의 저장 칸을 읽어 진행 상황에 넣는다 (없으면 그대로) */
  private loadSlot(): void {
    if (this.store === null) return;
    let text: string | null = null;
    try {
      text = this.store.getItem(this.saveKey());
    } catch {
      return;
    }
    if (text === null) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.warn("save unreadable, starting fresh");
      return;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return;
    this.applySave(parsed as Record<string, unknown>);
  }

  // ---------------------------------------------------------------- 계정 (로그인 / 로그아웃)

  private loadAccounts(): void {
    this.accounts = [];
    this.account = "";
    if (this.store === null) return;
    let d: unknown = null;
    try {
      d = JSON.parse(this.store.getItem(ACCOUNTS_KEY) ?? "null");
    } catch {
      return;
    }
    if (!isDict(d)) return;
    const names = Array.isArray(d["names"]) ? d["names"] : [];
    for (const n of names) {
      if (typeof n === "string" && nameError(n) === "" && this.findAccount(n) === "") this.accounts.push(normalizeName(n));
    }
    const cur = typeof d["current"] === "string" ? this.findAccount(d["current"]) : "";
    this.passwords = {};
    if (isDict(d["pw"])) for (const [k, v] of Object.entries(d["pw"])) if (typeof v === "string" && this.findAccount(k) !== "") this.passwords[k.toLowerCase()] = v;
    this.autoLogin = d["auto"] !== false;
    this.lastAccount = typeof d["last"] === "string" ? this.findAccount(d["last"]) : cur;
    // 자동 로그인을 꺼 두었으면 게스트로 시작
    this.account = this.autoLogin ? cur : "";
  }

  private saveAccounts(): void {
    if (!this.saveEnabled || this.store === null) return;
    try {
      this.store.setItem(ACCOUNTS_KEY, JSON.stringify({ current: this.account, names: this.accounts, pw: this.passwords, auto: this.autoLogin, last: this.lastAccount }));
    } catch (e) {
      console.warn("account save failed", e);
    }
  }

  /** 이미 있는 계정 이름 (영문 대소문자는 같은 이름으로 봄), 없으면 "" */
  findAccount(raw: string): string {
    const n = normalizeName(raw).toLowerCase();
    return this.accounts.find((a) => a.toLowerCase() === n) ?? "";
  }

  /** 게스트로 무언가 해 둔 게 있는지 (새 계정을 만들 때 옮겨 갈 기록) */
  hasProgress(): boolean {
    return this.level > 1 || this.storyCleared || this.wallet !== D.START_MONEY || Object.keys(this.levelStars).length > 0 || Object.keys(this.regulars).length > 0 || Object.keys(this.events).length > 0;
  }

  // ---------------------------------------------------------------- 재료 (장보기)

  stockOf(shopId: string, menuId: string): number {
    return this.stock[shopId]?.[menuId] ?? 0;
  }

  /** 그 가게 메뉴들의 남은 재료 (영업에 넘겨줌) */
  stockFor(shopId: string): Record<string, number> {
    const out: Record<string, number> = {};
    for (const m of D.shopDef(shopId).menus) out[m] = this.stockOf(shopId, m);
    return out;
  }

  private addStock(shopId: string, menuId: string, n: number): void {
    const sh = this.stock[shopId] ?? {};
    sh[menuId] = clamp((sh[menuId] ?? 0) + n, 0, D.STOCK_MAX);
    this.stock[shopId] = sh;
  }

  /** 더 살 수 있는 양 (창고가 꽉 차면 0) */
  stockRoom(shopId: string, menuId: string): number {
    return Math.max(0, D.STOCK_MAX - this.stockOf(shopId, menuId));
  }

  /** 재료 n인분 사기 (창고 남은 자리만큼). credit = 돈이 모자라면 외상 (지갑이 마이너스, 다음 정산에서 갚음) */
  buyStock(shopId: string, menuId: string, n: number, credit = false): boolean {
    const k = Math.min(n, this.stockRoom(shopId, menuId));
    if (k <= 0) return false;
    const cost = this.stockCost(shopId, menuId, k);
    if (this.wallet < cost && !credit) return false;
    this.wallet -= cost;
    this.addStock(shopId, menuId, k);
    this.saveGame();
    this.changed.emit();
    return true;
  }

  /**
   * 영업 중에 산 재료 값만 지갑에서 냄 (모자라면 마이너스 — 오늘 번 돈으로 정산에서 갚음).
   * 재료 자체는 그 영업(ShiftSession.addStock)에 넣고, 영업이 끝나면 남은 재료(stock_left)로 가게 창고를 덮어씀.
   */
  payStock(cost: number): void {
    this.wallet -= Math.max(0, cost);
    this.saveGame();
    this.changed.emit();
  }

  /** 그 스테이지 하루에 모자라는 재료 (메뉴 → 인분, 모자란 것만) */
  stockShortage(level: number): Record<string, number> {
    const sid = D.shopForLevel(level).id;
    const need = D.stockNeed(level);
    const out: Record<string, number> = {};
    for (const m of Object.keys(need)) {
      const short = need[m] - this.stockOf(sid, m);
      if (short > 0) out[m] = short;
    }
    return out;
  }

  shortageCost(level: number): number {
    const sid = D.shopForLevel(level).id;
    const short = this.stockShortage(level);
    return Object.keys(short).reduce((n, m) => n + this.stockCost(sid, m, short[m]), 0);
  }

  /**
   * 튜토리얼 장보기에서 공짜로 받는 첫 가게 첫 메뉴(떡볶이) 양 = 첫 스테이지 하루치를 재료 묶음 단위로 올림 (지금 10인분).
   * (2026-11-17 사용자 "튜토리얼 때 사는 떡볶이는 무료로" — 시작 돈이 0원이라)
   */
  tutorialFreeTotal(): number {
    const sh = D.SHOPS[0];
    const need = D.stockNeed(sh.first_level)[sh.menus[0]] ?? 10;
    return Math.ceil(need / D.STOCK_PACK) * D.STOCK_PACK;
  }

  /** 지금 공짜로 살 수 있는 양: 튜토리얼 인사·장보기 단계(start / buy) 동안 떡볶이만, tutorialFreeTotal 까지 */
  freeStock(shopId: string, menuId: string): number {
    if (this.tutorial !== "start" && this.tutorial !== "buy") return 0;
    const sh = D.SHOPS[0];
    if (shopId !== sh.id || menuId !== sh.menus[0]) return 0;
    return Math.max(0, this.tutorialFreeTotal() - this.stockOf(shopId, menuId));
  }

  /** 재료 n인분 값 (튜토리얼 공짜분은 빼고) */
  stockCost(shopId: string, menuId: string, n: number): number {
    return Math.max(0, n - this.freeStock(shopId, menuId)) * D.ingredientCost(menuId);
  }

  /** 모자라는 재료를 한 번에 사기 (돈이 모자라면 외상 — 진행이 막히지 않게) */
  buyShortage(level: number): number {
    const sid = D.shopForLevel(level).id;
    const short = this.stockShortage(level);
    let spent = 0;
    for (const m of Object.keys(short)) {
      const before = this.wallet;
      if (this.buyStock(sid, m, short[m], true)) spent += before - this.wallet;
    }
    return spent;
  }

  // ---------------------------------------------------------------- 메뉴 가격 · 가게 평점

  priceOf(shopId: string, menuId: string): string {
    return this.prices[shopId]?.[menuId] ?? "normal";
  }

  pricesFor(shopId: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const m of D.shopDef(shopId).menus) out[m] = this.priceOf(shopId, m);
    return out;
  }

  setPrice(shopId: string, menuId: string, level: string): void {
    if (!(level in D.PRICE_LEVELS)) return;
    const sh = this.prices[shopId] ?? {};
    sh[menuId] = level;
    this.prices[shopId] = sh;
    this.saveGame();
    this.changed.emit();
  }

  /** 실시간 가게 평점 (아직 영업 안 한 가게는 RATING_START) */
  liveRating(shopId: string): number {
    return this.ratings[shopId] ?? D.RATING_START;
  }

  /** 마법의 가루 하나 사기 */
  buyPowder(): boolean {
    if (this.powder >= D.POWDER_MAX || this.wallet < D.POWDER_PRICE) return false;
    this.wallet -= D.POWDER_PRICE;
    this.powder += 1;
    this.saveGame();
    this.changed.emit();
    return true;
  }

  /** 이번 스토리 영업에 포장마차 이모가 첫 손님으로 오는지: 두 번째 가게 첫 스테이지, 아직 안 다녀감 */
  imoComesTo(level: number): boolean {
    return !this.imoVisited && level === D.shopDef(D.IMO_SHOP).first_level;
  }

  /** 이모가 들어옴 → 다시는 안 옴 (영업 도중에 나가도) */
  markImoVisited(): void {
    if (this.imoVisited) return;
    this.imoVisited = true;
    this.saveGame();
  }

  // ---------------------------------------------------------------- 튜토리얼

  /** 다음 단계로 (끝이면 "") */
  setTutorial(step: string): void {
    // 장보기 전에 튜토리얼을 건너뛰어도 공짜 떡볶이는 받는다 (돈 0원으로 시작해서 영업을 못 하는 일이 없게)
    if (step === "" && (this.tutorial === "start" || this.tutorial === "buy")) {
      const sh = D.SHOPS[0];
      const free = this.freeStock(sh.id, sh.menus[0]);
      if (free > 0) this.addStock(sh.id, sh.menus[0], free);
    }
    this.tutorial = step;
    this.saveGame();
  }

  /** 이 계정에 비밀번호가 있는지 (예전에 이름만으로 만든 계정은 없음) */
  hasPassword(name: string): boolean {
    return normalizeName(name).toLowerCase() in this.passwords;
  }

  /**
   * 로그인: 있는 아이디 + 비밀번호. 지금 기록을 저장하고 그 계정의 저장 칸으로 바꾼다.
   * auto = 자동 로그인 (다음에 켤 때도 이 계정으로). 비밀번호가 없던 예전 계정은 이번에 적은 비밀번호를 그 계정 비밀번호로.
   */
  login(raw: string, pw = "", auto = true): LoginResult {
    const fail = (error: string): LoginResult => ({ ok: false, error, created: false, carried: false });
    if (normalizeName(raw) === "") return fail("아이디를 적어 주세요.");
    const existing = this.findAccount(raw);
    if (existing === "") return fail("없는 아이디예요. 아래 '회원가입'으로 새로 만들어요.");
    const key = existing.toLowerCase();
    if (key in this.passwords) {
      if (pw.length === 0) return fail("비밀번호를 적어 주세요.");
      if (this.passwords[key] !== passwordHash(existing, pw)) return fail("비밀번호가 맞지 않아요.");
    } else if (pw.length > 0) {
      const e = passwordError(pw);
      if (e !== "") return fail(e);
      this.passwords[key] = passwordHash(existing, pw);
    }
    this.saveGame();
    this.account = existing;
    this.autoLogin = auto;
    this.lastAccount = existing;
    this.clearProgress();
    this.loadSlot();
    this.justLoggedIn = existing;
    this.saveAccounts();
    this.changed.emit();
    return { ok: true, error: "", created: false, carried: false };
  }

  /**
   * 회원가입: 새 아이디 + 비밀번호로 계정을 만들고 바로 로그인. 게스트로 하던 기록이 있으면 새 계정으로 옮긴다 (게스트 칸은 비움).
   */
  signUp(raw: string, pw: string, auto = true): LoginResult {
    const fail = (error: string): LoginResult => ({ ok: false, error, created: false, carried: false });
    const error = nameError(raw);
    if (error !== "") return fail(error.replace("이름", "아이디"));
    if (this.findAccount(raw) !== "") return fail("이미 있는 아이디예요. 다른 아이디를 적거나 로그인해 주세요.");
    const pe = passwordError(pw);
    if (pe !== "") return fail(pe);
    this.saveGame();
    const name = normalizeName(raw);
    const carried = this.account === "" && this.hasProgress();
    this.accounts.push(name);
    this.passwords[name.toLowerCase()] = passwordHash(name, pw);
    this.account = name;
    this.autoLogin = auto;
    this.lastAccount = name;
    if (carried) {
      if (this.saveEnabled && this.store !== null) {
        try {
          this.store.removeItem(SAVE_KEY);
        } catch {
          // 지우지 못해도 게스트 기록이 남을 뿐
        }
      }
    } else {
      this.clearProgress();
    }
    this.saveGame();
    this.justLoggedIn = name;
    this.saveAccounts();
    this.changed.emit();
    return { ok: true, error: "", created: true, carried };
  }

  /** 비밀번호 다시 정하기 (아이디/비밀번호 찾기): 이 기기에 있는 계정만. 서버가 없어 이 기기를 쓰는 사람을 믿는다 */
  resetPassword(raw: string, pw: string): string {
    const existing = this.findAccount(raw);
    if (existing === "") return "이 기기에 없는 아이디예요.";
    const pe = passwordError(pw);
    if (pe !== "") return pe;
    this.passwords[existing.toLowerCase()] = passwordHash(existing, pw);
    this.saveAccounts();
    return "";
  }

  /** 로그아웃: 계정 기록을 저장하고 게스트 저장 칸으로 돌아간다 */
  logout(): void {
    if (this.account === "") return;
    this.saveGame();
    this.account = "";
    this.justLoggedIn = "";
    this.clearProgress();
    this.loadSlot();
    this.saveAccounts();
    this.changed.emit();
  }

  /** 예전 저장의 가게별 길이: 버전 1 = 포장마차 5일, 버전 2 = 6일·7일씩 가게 5곳, 버전 3 = 레벨 10개씩 가게 5곳 */
  static oldShopLengths(version: number): number[] {
    if (version < 2) return [5];
    if (version === 2) return [6, 7, 7, 7, 7];
    return [10, 10, 10, 10, 10];
  }

  /** 예전 번호(일차·레벨) → 지금 전체 레벨 번호 (같은 가게, 비슷한 진행 위치) */
  static oldToLevel(old: number, version: number): number {
    const lens = GameStateClass.oldShopLengths(version);
    let start = 1;
    for (let k = 0; k < lens.length; k++) {
      const nOld = lens[k];
      if (old < start + nOld || k === lens.length - 1) {
        const n = clamp(old - start + 1, 1, nOld);
        const shop = D.SHOPS[Math.min(k, D.SHOPS.length - 1)];
        const count = D.shopLevelCount(shop);
        // 지금 가게의 스테이지가 더 많으면 순서 그대로, 적으면 비율로 줄여서 (두 개가 하나로 합쳐질 수 있음)
        const m = count >= nOld ? n : Math.ceil((n * count) / nOld);
        return shop.first_level + clamp(m, 1, count) - 1;
      }
      start += nOld;
    }
    return 1;
  }

  /** 예전 저장에서 "다음에 할 차례"였던 번호 → 지금 열린 레벨 */
  static oldFrontier(old: number, version: number): number {
    const lv = GameStateClass.oldToLevel(old, version);
    if (old <= 1) return lv;
    const prev = GameStateClass.oldToLevel(old - 1, version);
    if (D.shopIndexForLevel(prev) !== D.shopIndexForLevel(lv)) return lv;
    return Math.min(prev + 1, D.shopForLevel(prev).last_level);
  }

  /** 저장 데이터 적용 (버전 1·2 = "일차" 시절, 버전 3 = 가게마다 레벨 10개, 4·5 = 5스테이지 → 지금 레벨로 옮김) */
  applySave(d: Record<string, unknown>): void {
    this.applyProgress(d);
    // 재료: 예전 저장(재료가 없던 때)은 열린 가게의 열린 메뉴마다 10인분씩 넣어 준다 (바로 이어서 영업할 수 있게)
    this.stock = {};
    const st = d["stock"];
    if (isDict(st)) {
      for (const sid of Object.keys(st)) {
        if (!D.SHOPS.some((s) => s.id === sid)) continue;
        for (const [m, n] of Object.entries(intDict(st[sid]))) this.addStock(sid, m, n);
      }
    } else {
      for (const sh of D.SHOPS) {
        if (!this.shopOpened(sh.id)) continue;
        for (const m of sh.menus) if (D.menuUnlockLevel(m) <= Math.max(this.level, sh.first_level)) this.addStock(sh.id, m, D.STOCK_PACK * 2);
      }
    }
    this.powder = clamp(toInt(d["powder"], 0), 0, D.POWDER_MAX);
    this.prices = {};
    const pr = d["prices"];
    if (isDict(pr)) {
      for (const sid of Object.keys(pr)) {
        const row = pr[sid];
        if (!isDict(row)) continue;
        for (const [m, lv] of Object.entries(row)) if (typeof lv === "string" && lv in D.PRICE_LEVELS) (this.prices[sid] ??= {})[m] = lv;
      }
    }
    this.ratings = {};
    const rt = d["ratings"];
    if (isDict(rt)) for (const [sid, val] of Object.entries(rt)) if (typeof val === "number" && Number.isFinite(val)) this.ratings[sid] = clamp(val, 1, 5);
    // 튜토리얼: 저장에 없으면 (예전 저장) 이미 해 본 사람은 건너뜀
    const tut = d["tutorial"];
    this.tutorial = typeof tut === "string" ? tut : this.hasProgress() ? "" : "start";
    this.imoVisited = d["imo_visited"] === true;
  }

  private applyProgress(d: Record<string, unknown>): void {
    const version = toInt(d["version"], 1);
    this.events = {};
    for (const [k, val] of Object.entries(intDict(d["events"]))) if (D.eventFor(k) !== null) this.events[k] = clamp(val, 0, D.MAX_STARS);
    this.storyCleared = false;
    this.wallet = clamp(toInt(d["wallet"], 0), -1000000000, 1000000000000);
    this.regulars = intDict(d["regulars"]);
    this.upgrades = {};
    this.bestEndless = {};
    this.levelStars = {};
    if (version < 2) {
      this.upgrades["pocha"] = this.upgradeDict(d["upgrades"], version);
      this.bestEndless["pocha"] = Math.max(0, toInt(d["best_endless"], 0));
    } else {
      const up = d["upgrades"];
      if (isDict(up)) {
        for (const sid of Object.keys(up)) this.upgrades[sid] = this.upgradeDict(up[sid], version);
      }
      this.bestEndless = intDict(d["best_endless"]);
    }
    if (version >= 4) {
      this.storyCleared = Boolean(d["story_cleared"]);
      let stars = intDict(d["level_stars"]);
      if (version < 5) stars = starsToFive(stars);
      if (version >= 6) {
        this.level = clamp(toInt(d["level"], 1), 1, D.TOTAL_LEVELS);
        this.levelStars = stars;
        return;
      }
      // 버전 4·5 = 가게마다 5스테이지 → 지금 7스테이지: 가게 안 순서 그대로 옮기고, 새로 생긴 6·7번째는 아직 안 깬 것
      for (const k of Object.keys(stars)) this.levelStars[String(fiveToSeven(Number(k)))] = stars[k];
      const oldLv = clamp(toInt(d["level"], 1), 1, 25);
      this.level = fiveToSeven(oldLv);
      if (String(oldLv) in stars && (oldLv - 1) % 5 === 4) this.level += 1; // 가게 마지막(5번째)까지 깼으면 새로 생긴 6번째부터
      if (this.storyCleared) this.level = D.TOTAL_LEVELS;
      this.level = clamp(this.level, 1, D.TOTAL_LEVELS);
      return;
    }
    // 예전 번호 → 지금 레벨. 별점은 합쳐지는 레벨 중 높은 쪽으로 (3개 만점 → 5개 만점)
    const oldStars = starsToFive(intDict(d[version >= 3 ? "level_stars" : "day_stars"]));
    for (const k of Object.keys(oldStars)) {
      const key = String(GameStateClass.oldToLevel(Number(k), version));
      this.levelStars[key] = Math.max(this.levelStars[key] ?? 0, oldStars[k]);
    }
    const oldCleared = Boolean(d["story_cleared"]);
    if (version >= 2 && oldCleared) {
      // 모든 가게를 다 깬 저장
      this.storyCleared = true;
      this.level = D.TOTAL_LEVELS;
      return;
    }
    this.level = GameStateClass.oldFrontier(toInt(d[version >= 3 ? "level" : "day"], 1), version);
    if (version < 2 && oldCleared) this.level = D.SHOPS[1].first_level; // 예전 포장마차 5일을 다 깸 → 분식집부터
    // 아직 안 깬 레벨에 붙은 별은 지운다 (두 레벨이 하나로 합쳐질 때 생김)
    for (const k of Object.keys(this.levelStars)) {
      if (Number(k) >= this.level) delete this.levelStars[k];
    }
  }

  /** 지금 계정의 기록을 처음 상태로 (저장은 안 함) */
  private clearProgress(): void {
    this.level = 1;
    this.storyCleared = false;
    this.wallet = D.START_MONEY;
    this.stock = {};
    this.powder = 0;
    this.prices = {};
    this.ratings = {};
    this.tutorial = "start";
    this.imoVisited = false;
    this.upgrades = {};
    this.regulars = {};
    this.bestEndless = {};
    this.levelStars = {};
    this.events = {};
    this.eventShop = "";
    this.playLevel = 1;
    this.mapShop = "";
    this.lastResult = null;
    this.justCleared = false;
    this.justOpened = "";
    this.justShopCleared = "";
    this.justUnlocked = 0;
  }

  /**
   * 디버그 (2026-11-16 사용자 "모든 가게를 플레이 해 보고 싶은데 디버그로 모든 레벨 다 깬 걸로"): 주소 뒤 ?debug=clear 로 연다.
   * 35 스테이지 모두 깬 걸로 (이미 깬 스테이지 별점은 그대로, 안 깬 곳은 별 3개), 모든 가게·무한 영업이 열림.
   * 미식가 이벤트는 해 보라고 안 한 채로 두고, 튜토리얼 끝, 모든 메뉴 재료 가득, 지갑은 적어도 100만 원.
   */
  debugClearAll(): void {
    this.level = D.TOTAL_LEVELS;
    this.storyCleared = true;
    for (let lv = 1; lv <= D.TOTAL_LEVELS; lv++) {
      const key = String(lv);
      if (!(key in this.levelStars)) this.levelStars[key] = 3;
    }
    for (const sh of D.SHOPS) for (const m of sh.menus) this.addStock(sh.id, m, D.STOCK_MAX);
    this.wallet = Math.max(this.wallet, 1000000);
    this.tutorial = "";
    this.saveGame();
    this.changed.emit();
  }

  /** 디버그 (2026-11-17 사용자 "디버그로 미식가 스테이지 안 한 걸로"): ?debug=events — 모든 미식가 이벤트 기록을 지워 다시 도전할 수 있게 (저장됨) */
  debugResetEvents(): void {
    this.events = {};
    this.saveGame();
    this.changed.emit();
  }

  /**
   * 디버그를 이 기기의 모든 저장 칸(게스트 + 모든 계정)에 적용하고 지금 계정으로 돌아옴
   * (2026-11-18 사용자 "디버그로 모든 스테이지 다 해제해 줘"를 두 번 — 자동 로그인을 꺼 두면 게스트 칸에만 들어가서,
   * 그 뒤 로그인한 계정은 그대로였음)
   */
  debugEverySlot(fn: () => void): void {
    const cur = this.account;
    for (const name of ["", ...this.accounts]) {
      this.account = name;
      this.clearProgress();
      this.loadSlot();
      fn();
      this.saveGame();
    }
    this.account = cur;
    this.clearProgress();
    this.loadSlot();
    this.changed.emit();
  }

  resetGame(): void {
    this.clearProgress();
    this.saveGame();
    this.changed.emit();
  }

  private upgradeDict(v: unknown, version: number): UpgradeDict {
    const out: UpgradeDict = {};
    if (!isDict(v)) return out;
    for (const id of D.UPGRADE_ORDER) {
      const lv = toInt(v[id], 0);
      out[id] = clamp(version < 7 ? D.migrateUpgradeLevel(id, lv) : lv, 0, this.upgradeLevels(id).length);
    }
    return out;
  }
}

/** 가게마다 5스테이지 시절 번호(1~25) → 지금 번호 (가게 안 순서 그대로: 5스테이지 → 그 가게 5번째) */
export function fiveToSeven(lv: number): number {
  const k = Math.trunc((Math.max(lv, 1) - 1) / 5);
  const n = ((Math.max(lv, 1) - 1) % 5) + 1;
  return clamp(k * D.LEVELS_PER_SHOP + n, 1, D.TOTAL_LEVELS);
}

/** 별 3개 만점 시절 별점 → 5개 만점 (1 → 1, 2 → 3, 3 → 5) */
function starsToFive(d: IntDict): IntDict {
  const out: IntDict = {};
  for (const k of Object.keys(d)) out[k] = clamp(d[k] * 2 - 1, 1, D.MAX_STARS);
  return out;
}

function isDict(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toInt(v: unknown, def: number): number {
  if (v === undefined || v === null) return def;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

function intDict(v: unknown): IntDict {
  const out: IntDict = {};
  if (isDict(v)) for (const k of Object.keys(v)) out[String(k)] = toInt(v[k], 0);
  return out;
}

/** 게임 전체에서 쓰는 하나뿐인 진행 상황 (Godot autoload GameState) */
export const GameState = new GameStateClass();
