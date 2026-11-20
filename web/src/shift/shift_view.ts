// 영업 화면. ShiftSession(규칙)을 돌리고 그리기·입력·연출을 맡는다.
// 가로 화면 기준: 세로 1080 고정, 가로 1920 이상(긴 폰은 좌우가 넓어지고 내용은 가운데 정렬).
//
//   y   0~ 90  천막 지붕 + 상단 정보 상자(오늘 매출·할당량 / 레벨·일시정지, 무한 영업은 버틴 시간도)
//   y  90~580  배경 + 손님 3명 (주문 말풍선은 머리 위, 말풍선 안에 인내심 게이지)
//   y 580~700  카운터: 완성 칸 + 도마
//   y 700~900  조리대: 가게 왼쪽 도구 / 화구 1~4 / 가게 오른쪽 도구 (80% 크기), 양쪽 도구가 같으면 붙여서 왼쪽 + 화구 1~4
//              골목 포장마차는 어묵 사각틀(2×2) / 떡볶이 판 / 순대 솥 / 튀김기 (shopLayout)
//   y 900~1080 재료통(메뉴 수만큼, 최대 4개), 그릇 더미, 쓰레기통
// 가게(스테이지)마다 배경·조리도구·메뉴가 다르다 (SHOPS).

import { R, V, WHITE, rgb, v } from "../engine/geom.ts";
import type { Gfx } from "../engine/gfx.ts";
import { Scene, type PointerInfo } from "../engine/game.ts";
import { Node2D } from "../engine/node.ts";
import { Sound } from "../engine/audio.ts";
import * as Ui from "../engine/ui.ts";
import * as D from "../core/defs.ts";
import { ShiftSession } from "../core/shift_session.ts";
import type { ServeResult } from "../core/customer_logic.ts";
import { Market, type MarketHooks } from "../ui/supply.ts";
import { GameState } from "../state/game_state.ts";
import { StreetArt } from "../art/street_art.ts";
import { RainFx } from "../art/rain_fx.ts";
import { kitchenScaleY, mapRect, mapY, shopArt, type ArtStation, type Rect4 } from "../art/shop_art.ts";
import * as ArtAssets from "../art/art_assets.ts";
import * as DishArt from "../art/dish_art.ts";
import { KitchenView, BOWL_SCALE } from "./kitchen_view.ts";
import { StationView, StoveFrame } from "./station_view.ts";
import { CustomerView } from "./customer_view.ts";
import { DragGhost } from "./drag_ghost.ts";
import { FloatText } from "./float_text.ts";
import { ShiftHud, menuPic, type IntroEntry } from "./shift_hud.ts";
import { Tutorial, elementRect, type TutStep } from "../ui/tutorial.ts";

const BASE_W = 1920.0;
const DRAG_THRESHOLD = 22.0;
// 조리대 (2026-11-16 사용자 "음식 만드는 공간 조금 넓게, 화구 4개는 일렬 말고 아래위로 붙게, 음식 크게, 조리기구 사이 간격 좁게"):
// 카운터를 올려 조리대를 높이고, 도구들은 STATION_W 너비에 STATION_GAP 만 띄워 꽉 채운다. 화구 4칸은 2×2 한 덩어리(화로).
// 조리도구는 원본 높이 STATION_LOCAL_H(2×2 화구 한 칸은 BURNER_LOCAL_H)로 그리고 화면 높이에 맞춰 키운다.
const STATION_W = 1800.0; // 조리대 도구 전체 너비 (화면 기준)
const STATION_GAP = 12.0; // 조리도구 사이 간격 (예전 33)
const STATION_LOCAL_H = 240.0;
const BURNER_LOCAL_H = 150.0;
const BURNER_GAP = 8.0; // 2×2 화구 칸 사이
const BURNER_W = 1.15; // 화구 한 칸 너비 (옆 도구 한 칸 대비)
const SEAT_X = [480.0, 960.0, 1440.0]; // 손님 3명. 2026-11-12 사용자 요청으로 630 → 480 간격으로 붙임
const CUSTOMER_SCALE = 1.1;
// 2026-11-17 사용자 "손님이 너무 안 보여, 조리대 비율을 낮춰 줘, 손님이 조금 더 전신으로": 카운터를 510 → 590 으로 내리고
// 머리는 거의 그대로(335) 두어 손님이 가슴·허리까지 보이게 (조리대·재료 카드 줄은 그만큼 줄어듦, shop_art.ts ART_BANDS 와 맞춤)
export const COUNTER_Y = 590.0; // 예전 580 → 510 (조리대를 넓히려고 올렸다가) → 590
// 2026-11-17 사용자 "손님 위치를 위로 좀, 말풍선은 머리 오른쪽에" (335 → 290), 이어서 "다 위로 올려 줘, 상체 더 보이게,
// 위 UI 가 가리면 UI 크기를 줄여서라도" (290 → 215, 위 정보 칸 86 → 64 높이). 몸이 짧게 잘린 그림은 카운터에 닿을 만큼만 (seatHeadY)
const HEAD_ABOVE_COUNTER = 375.0; // 손님 머리 높이 = 카운터 위
const CLOSING_DELAY = 2.0; // 영업이 끝난 뒤 "오늘 영업 끝!" 셔터가 내려오기까지 (초)

const Phase = { INTRO: 0, RUNNING: 1, CLOSING: 2 } as const;

interface Pending {
  kind?: string;
  slot?: number;
  view?: StationView;
  sub?: number;
  station?: string;
  index?: number;
  menu?: string;
  seat?: number;
}

/** 손님에게 날아가는 그릇 (자동 서빙 연출) */
class ServeFly extends Node2D {
  menu = "";
  quality = 0;

  static spawn(parent: Node2D, menu: string, quality: number, from: V, to: V): void {
    const f = new ServeFly();
    f.menu = menu;
    f.quality = quality;
    f.position = from;
    parent.add(f);
    const tw = f.createTween();
    tw.prop(f, "position", to, 0.28).setTrans("quad").setEase("in");
    tw.parallel().prop(f, "scale", v(0.75, 0.75), 0.28);
    tw.prop(f, "modulate:a", 0.0, 0.12);
    tw.call(() => f.queueFree());
  }

  draw(g: Gfx): void {
    DishArt.draw(g, this.menu, v(), BOWL_SCALE, this.quality);
  }
}

export class ShiftView extends Scene {
  session = new ShiftSession();
  phase: number = Phase.INTRO;
  x0 = 0.0; // 화면이 1920보다 넓을 때 가운데 정렬 오프셋
  counterY = COUNTER_Y;
  headY = COUNTER_Y - HEAD_ABOVE_COUNTER;

  street!: StreetArt;
  rain: RainFx | null = null;
  customerLayer!: Node2D;
  kitchen!: KitchenView;
  stationViews: StationView[] = [];
  fxLayer!: Node2D;
  ghost!: DragGhost;
  hud!: ShiftHud;
  customerViews: (CustomerView | null)[] = [null, null, null];

  private pending: Pending = {};
  private pressPos = v();
  private dragging = false;

  ready(): void {
    this.x0 = Math.max(0.0, (this.vw - BASE_W) * 0.5);
    const s = this.session;
    if (GameState.mode === "endless") {
      const sid = GameState.endlessShop;
      s.setupEndless(sid, GameState.burnerValue(sid), GameState.heatScale(sid), GameState.patienceMult(sid));
      s.useStock(GameState.stockFor(sid));
      s.useMarket(GameState.pricesFor(sid), GameState.liveRating(sid));
    } else if (GameState.mode === "event") {
      // 미식가 코스 재료는 미식가가 직접 골라 온다 (가게 재료를 안 씀)
      const sid = GameState.eventShop;
      s.setupEvent(sid, GameState.burnerValue(sid), GameState.heatScale(sid), GameState.patienceMult(sid));
    } else {
      const sid = D.shopForLevel(GameState.playLevel).id;
      s.setupStory(GameState.playLevel, GameState.burnerValue(sid), GameState.heatScale(sid), GameState.patienceMult(sid));
      if (GameState.imoComesTo(GameState.playLevel)) s.cameo = "imo"; // 두 번째 가게 첫날: 이모가 첫 손님으로 축하하러
      s.useStock(GameState.stockFor(sid));
      s.useMarket(GameState.pricesFor(sid), GameState.liveRating(sid));
    }
    s.customerArrived.connect((seat) => this.onCustomerArrived(seat));
    s.customerLeft.connect((seat, _c, reason) => this.onCustomerLeft(seat, reason));
    s.customerReacted.connect((seat, kind) => this.customerViews[seat]?.react(kind));
    s.reviewed.connect((seat, rv) => this.onReviewed(seat, rv.score, rv.tag));
    s.orderChanged.connect((seat) => this.onOrderChanged(seat));
    s.itemBurnt.connect((station, index) => this.onItemBurnt(station, index));
    s.moneyEarned.connect((seat, paid, tip, quality) => this.onMoneyEarned(seat, paid, tip, quality));
    s.ended.connect(() => this.startClosing());
    s.quotaReached.connect(() => {
      this.hud.toast("할당량 달성! 손님이 오는 동안 계속 장사해요", rgb(0.55, 1.0, 0.6));
      Sound.playSfx("fanfare");
    });
    s.powder = GameState.powder; // 마법의 가루 (영업이 끝나면 쓴 만큼 GameState 에서 뺌)
    s.closeShop(); // "준비 중" 팻말로 시작 — 팻말을 눌러야 손님이 온다
    this.build();
    this.hud.buildSign(this.vw);
    this.hud.signPressed.connect(() => this.openShop());
    this.hud.updateStats(s);
    if (s.event && GameState.eventFromComic) {
      // 미식가 만화를 보고 들어옴 (2026-11-21 사용자 "만화 컷 지나고 뜨는 UI 없애 줘, 계속하기 누르면 가게에 바로 미식가가 오게"):
      // 안내 창·"준비 중" 팻말 없이 바로 영업 시작 (여기서 기회를 씀) → 미식가가 FIRST_SPAWN_DELAY 뒤 들어옴
      GameState.eventFromComic = false;
      this.startEventNow();
    } else this.showIntro();
    Sound.playBgm(s.event ? "event" : "shift");
    if (s.shop.rain) Sound.playSfx("rain");
  }

  seatX(i: number): number {
    return this.x0 + SEAT_X[i];
  }

  private build(): void {
    const s = this.session;
    const size = v(this.vw, this.vh);
    const street = new StreetArt();
    street.size = size;
    street.counterY = this.counterY;
    street.awningY = 0.0;
    street.awningH = 64.0;
    street.theme = s.shop.theme;
    street.shopId = s.shopId;
    if (["alley", "market", "beach"].includes(street.theme)) street.signText = s.shop.short;
    for (const m of s.shop.menus) street.menuNames.push(D.menuName(m));
    this.street = this.add(street);

    // 바깥 거리에서 영업하는 골목 포장마차만 화면 전체에 비가 온다 (실내 가게는 창밖에만)
    // 가게 그림(사용자 그림)이 있으면 그림 속 바깥이 보이는 곳에만
    const art = ArtAssets.shopImage(s.shopId) !== null ? shopArt(s.shopId) : null;
    if (street.theme === "alley") {
      const rain = new RainFx();
      const ra = art?.rain;
      const rr = art && ra ? mapRect(art, ra) : null;
      rain.area = rr ? new R(this.x0 + rr[0], rr[1], rr[2] - rr[0], rr[3] - rr[1]) : new R(0, 140, this.vw, this.counterY - 140.0);
      rain.count = 180;
      this.rain = this.add(rain);
    }

    this.customerLayer = this.add(new Node2D());

    const kitchen = new KitchenView();
    kitchen.session = s;
    kitchen.size = size;
    kitchen.x0 = this.x0;
    kitchen.counterY = this.counterY;
    kitchen.trayY = this.counterY + 62.0;
    kitchen.binsY = 1004.0;
    kitchen.art = art;
    this.kitchen = this.add(kitchen);
    this.buildStations();

    this.fxLayer = this.add(new Node2D());

    this.ghost = new DragGhost();
    this.ghost.visible = false;
    this.ghost.z = 50;
    this.add(this.ghost);

    this.hud = new ShiftHud();
    this.add(this.hud);
    this.hud.build(this.ui, this.vw, this.vh);
    this.hud.startPressed.connect(() => this.onStart());
    this.hud.backPressed.connect(() => this.game.goto("map")); // 미식가 이벤트: 기회를 쓰지 않고 돌아감
    this.hud.pausePressed.connect(() => this.pauseGame());
    this.hud.pricePressed.connect(() => this.openPricePanel());
    this.hud.resumePressed.connect(() => this.resumeGame());
    this.hud.quitPressed.connect(() => this.quitToTitle());
  }

  /**
   * 조리대: 가게 배치(shopLayout)대로 왼쪽부터, 완성 칸 아래 ~ 재료 선반 위를 꽉 채워서.
   * 화구가 없는 가게(골목 포장마차)는 width 비율대로 나누고, 화구가 있는 가게는 옆 도구 = 칸 수만큼 너비,
   * 화구 4칸 = 위 2 · 아래 2 로 붙인 화로 한 덩어리 (같은 종류 옆 도구는 shopLayout 에서 이미 붙어 있음).
   */
  private buildStations(): void {
    const s = this.session;
    // 가게 그림 속 조리 도구가 이 가게 도구와 같으면 (shop_art.ts kitchen) 그 자리에 놓고 틀은 그림 것을 씀
    const artKitchen = this.kitchen.art?.kitchen ?? null;
    if (artKitchen !== null && ArtAssets.shopImage(s.shopId) !== null && this.placeArtStations(artKitchen)) return;
    const top = this.kitchen.kitchenTop() + 14.0;
    const bottom = this.kitchen.shelfTop() - 5.0;
    const h = bottom - top;
    const cy = (top + bottom) * 0.5;
    const layout = D.shopLayout(s.shop);
    const others = layout.filter((e) => e.kind !== D.STATION_BURNER);
    const hasBurners = others.length < layout.length;
    let x = this.x0 + BASE_W * 0.5 - STATION_W * 0.5;
    if (!hasBurners) {
      const total = layout.reduce((n, e) => n + (e.width ?? 1.0), 0);
      const unit = (STATION_W - STATION_GAP * (layout.length - 1)) / total;
      for (const e of layout) {
        const w = unit * (e.width ?? 1.0);
        this.addStation(e.kind, e.first, e.slots, v(x + w * 0.5, cy), e.title, v(w, h), STATION_LOCAL_H, e.grid ?? 0);
        x += w + STATION_GAP;
      }
      return;
    }
    const sideSlots = others.reduce((n, e) => n + e.slots, 0);
    const sw = (STATION_W - STATION_GAP * others.length - BURNER_GAP) / (sideSlots + 2.0 * BURNER_W);
    const bw = sw * BURNER_W;
    const bh = (h - BURNER_GAP) * 0.5;
    for (const e of layout) {
      if (e.kind !== D.STATION_BURNER) {
        const w = sw * e.slots;
        this.addStation(e.kind, e.first, e.slots, v(x + w * 0.5, cy), e.title, v(w, h), STATION_LOCAL_H, e.grid ?? 0);
        x += w + STATION_GAP;
        continue;
      }
      if (e.first !== 0) continue; // 화로 한 덩어리는 화구 1 자리에서 4칸 다 놓음
      const blockW = bw * 2.0 + BURNER_GAP;
      const frame = new StoveFrame();
      frame.rect = new R(x, top, blockW, h);
      this.add(frame);
      for (let k = 0; k < D.MAX_BURNERS; k++) {
        const col = k % 2;
        const row = Math.trunc(k / 2);
        const c = v(x + col * (bw + BURNER_GAP) + bw * 0.5, top + row * (bh + BURNER_GAP) + bh * 0.5);
        this.addStation(D.STATION_BURNER, k, 1, c, `화구 ${k + 1}`, v(bw, bh), BURNER_LOCAL_H, 0);
      }
      x += blockW + STATION_GAP;
    }
  }

  /** 그림 속 도구 자리에 도구를 놓음 (배치 순서·종류가 그림과 다르면 false → 보통 배치) */
  private placeArtStations(list: ArtStation[]): boolean {
    const layout = D.shopLayout(this.session.shop);
    const art = this.kitchen.art;
    if (art === null || layout.length !== list.length || layout.some((e, i) => e.kind !== list[i].kind)) return false;
    const ky = kitchenScaleY(art);
    layout.forEach((e, i) => {
      const a = list[i];
      // 그림 좌표 → 화면 (조리대 띠는 세로로 줄어듦)
      const [x0, y0, x1, y1] = mapRect(art, a.rect);
      const c = v(this.x0 + (x0 + x1) * 0.5, (y0 + y1) * 0.5);
      const sv = this.addStation(e.kind, e.first, e.slots, c, e.title, v(x1 - x0, y1 - y0), y1 - y0, e.grid ?? 0);
      const loc = (r0: Rect4): R => {
        const r = mapRect(art, r0);
        return new R(this.x0 + r[0] - c.x, r[1] - c.y, r[2] - r[0], r[3] - r[1]);
      };
      sv.art = {
        cells: a.cells ? a.cells.map(loc) : null,
        pan: a.pan ? loc(a.pan) : null,
        pot: a.pot ? [v(this.x0 + a.pot[0] - c.x, mapY(art, a.pot[1]) - c.y), v(a.pot[2], a.pot[3] * ky)] : null,
        hasPan: a.hasPan ?? false,
        hasPot: a.hasPot ?? false,
      };
      sv.refreshSteam();
    });
    return true;
  }

  /** screen = 화면에서 차지할 크기, localH = 그 도구를 그리는 원본 높이 (화면 높이에 맞춰 같은 비율로 키움) */
  private addStation(station: string, first: number, count: number, pos: V, title: string, screen: V, localH: number, grid: number): StationView {
    const sv = new StationView();
    const k = screen.y / localH;
    sv.setup(this.session, station, first, count, v(screen.x / k, localH), title, grid);
    sv.position = pos;
    sv.scale = v(k, k);
    if (!this.session.stationInUse(station)) sv.lockedNote = this.stationUnlockNote(station);
    else if (station === D.STATION_BURNER && first >= this.session.burnerCount) sv.lockedNote = "화구 추가\n업그레이드";
    this.add(sv);
    this.stationViews.push(sv);
    return sv;
  }

  /** 아직 쓰는 메뉴가 없는 조리도구: 처음 쓰는 메뉴와 그 날짜 */
  private stationUnlockNote(station: string): string {
    for (const m of this.session.shop.menus) {
      if (D.menuStation(m) === station) return `${D.menuName(m)} · ${D.levelName(D.menuUnlockLevel(m))}`;
    }
    return "사용 안 함";
  }

  // ---------------------------------------------------------------- 진행

  process(dt: number): void {
    if (this.phase === Phase.RUNNING) this.session.update(dt);
    this.holdTutorialPerfect();
    this.hud.updateStats(this.session);
    this.tut?.update();
  }

  private showIntro(): void {
    const s = this.session;
    const entries: IntroEntry[] = [];
    const shopName = s.shop.name;
    if (s.event) {
      const e = s.eventDef ?? D.EVENTS[0];
      entries.push({ head: D.criticName(e.critic), body: `한 번에 ${e.perRound}가지씩, 코스 ${e.rounds}번 주문해요. 코스가 지날수록 더 못 기다려요.` });
      entries.push({ head: "평가", body: "완벽 3점 · 익음 1점 · 탐·덜 익음·늦음 0점\n만족도에 따라 별 1~5개" });
      entries.push({ head: "유명세", body: `좋은 평가를 받으면 신문에 실려 가게가 유명해져요!\n손님이 몰려 매출이 최대 +${D.formatWon(e.reward)}, 가게 평점도 올라요` });
      entries.push({ head: "딱 한 번!", body: "영업을 시작하면 다시 도전할 수 없어요.\n중간에 나가면 리뷰도 없어요." });
      this.hud.showIntro(`미식가 방문 · ${shopName}`, "까다로운 미식가가 찾아왔어요!", entries, "도전 시작!", Ui.EVENT, "나중에");
      return;
    }
    if (s.endless) {
      entries.push({ head: "규칙", body: `화난 손님이 ${D.ENDLESS_LIVES}명 나오면 영업 끝. 시간이 갈수록 손님이 빨리 와요.` });
      entries.push({ head: "최고 기록", body: D.formatWon(GameState.bestEndlessFor(s.shopId)) });
      this.hud.showIntro(`무한 영업 · ${shopName}`, `${shopName}의 모든 메뉴, 모든 손님`, entries, "영업 시작!");
      return;
    }
    const firstLevel = s.level === s.shop.first_level;
    if (s.level === 1) {
      entries.push({
        head: "조작법",
        body: "재료 탭 → 떡볶이 판에 한 판 끓이기  ·  다 익으면 판 탭 → 한 그릇씩 덜기 (초록 구간이 완벽!)\n완성 그릇 탭 → 인내심이 가장 적게 남은 손님에게 자동 서빙",
      });
    } else if (firstLevel) {
      entries.push({ head: `새 가게 · ${shopName}`, body: `${s.shop.desc}\n조리도구: ${D.shopToolsText(s.shop)}` });
    }
    for (const m of s.newMenus) entries.push({ head: `새 메뉴 · ${D.menuName(m)} ${D.formatWon(D.menuPrice(m))}`, body: D.MENUS[m].tip, menu: m });
    for (const t of D.customersUnlockedOn(s.level)) entries.push({ head: `새 손님 · ${D.CUSTOMERS[t].name}`, body: D.CUSTOMERS[t].desc });
    let subtitle = `오늘 할당량 ${D.formatWon(s.target)} · 시간 제한 없음`;
    let title = `${D.levelName(s.level)} · ${shopName}`;
    if (firstLevel && s.level > 1) {
      title = `${shopName} 첫 영업!`;
      subtitle = D.levelName(s.level) + " · " + subtitle;
    }
    this.hud.showIntro(title, subtitle, entries, "영업 시작!");
  }

  private onStart(): void {
    if (this.session.event) GameState.startEvent(this.session.shopId); // 여기서 기회를 쓴다
    this.hud.hideIntro();
    this.phase = Phase.RUNNING;
    this.tut = this.makeTutorial();
    this.hud.setPriceVisible(this.tut === null && this.priceChangeable());
    if (this.tut === null) this.hud.toast("준비가 되면 '준비 중' 팻말을 눌러 가게 문을 열어요! (미리 만들어 둬도 돼요)", rgb(1.0, 0.9, 0.6));
  }

  /** 미식가 만화 다음: 안내 창 없이 곧장 가게 문을 열고 미식가를 맞음 */
  private startEventNow(): void {
    GameState.startEvent(this.session.shopId); // 여기서 기회를 쓴다
    this.phase = Phase.RUNNING;
    this.hud.setPriceVisible(false);
    this.session.open();
    this.hud.flipSign();
    Sound.playSfx("open");
  }

  /** 팻말을 "영업 중"으로 뒤집어 손님을 받기 시작 (캡처 도구도 부름) */
  openShop(): void {
    if (this.phase !== Phase.RUNNING || this.session.opened) return;
    // 튜토리얼 중에는 마지막 단계(팻말)에서만 문을 엶 — 그 전엔 손님이 오지 않게 (2026-11-21)
    if (this.tut?.active() && GameState.tutorial === "cook" && !this.tutAtSign()) return;
    this.session.open();
    this.hud.flipSign();
    Sound.playSfx("open");
    this.hud.toast("영업 시작! 손님이 와요", rgb(0.6, 1.0, 0.6));
    this.tut?.onEvent("open");
  }

  // ---------------------------------------------------------------- 영업 중 재료 사기 (품절 재료통을 누르면)

  private buyPanel: HTMLDivElement | null = null;

  /**
   * 품절된 재료통을 누르면: 잠깐 멈추고 장보기와 같은 재료 가게 화면 (2026-11-20 사용자 "품절 재료 눌렀을 때 장보기랑 같은 화면").
   * 이 가게 재료만 (가게 탭 없음), 품절 재료 칸이 반짝, 지갑 + 오늘 번 돈까지 쓸 수 있음 (모자란 만큼은 정산에서 갚음).
   * 산 재료는 지금 영업에 바로 들어감. 마법의 가루도 살 수 있음 (지갑으로만). 오른쪽 위 X = 영업으로.
   */
  private openBuyPanel(menu: string): void {
    if (this.buyPanel !== null || this.session.stock === null) return;
    const s = this.session;
    const sid = s.shopId;
    this.game.paused = true;
    this.cancelDrag();
    const ov = Ui.overlay(this.ui, 0.8);
    ov.style.zIndex = "30";
    this.buyPanel = ov;
    const budget = (): number => GameState.wallet + Math.max(0, s.revenue());
    const hooks: MarketHooks = {
      inShift: true,
      have: (_sid, m) => s.stockLeft(m),
      room: (_sid, m) => Math.max(0, D.STOCK_MAX - s.stockLeft(m)),
      cost: (_sid, m, n) => GameState.stockCost(sid, m, n),
      budget,
      buy: (_sid, m, n) => {
        const k = Math.min(n, D.STOCK_MAX - s.stockLeft(m));
        if (k <= 0) return false;
        const cost = GameState.stockCost(sid, m, k);
        if (cost > budget()) return false;
        GameState.payStock(cost);
        s.addStock(m, k);
        return true;
      },
      powder: () => s.powder,
      buyPowder: () => {
        if (!GameState.buyPowder()) return false;
        s.powder += 1;
        return true;
      },
      note: () => `지갑 ${D.formatWon(GameState.wallet)} + 오늘 번 돈 ${D.formatWon(Math.max(0, s.revenue()))}까지 쓸 수 있어요 · 모자란 만큼은 정산에서 갚아요`,
    };
    const market = new Market({
      shopId: sid,
      hooks,
      tabs: false,
      highlight: menu,
      closeLabel: "영업으로 돌아가기",
      onClose: () => this.closeBuyPanel(),
      greeting: `${D.menuName(menu)} 재료가 다 떨어졌네! 얼른 담아 줄게요~`,
    });
    ov.appendChild(market.root);
  }

  private closeBuyPanel(): void {
    this.buyPanel?.remove();
    this.buyPanel = null;
    this.game.paused = false;
  }

  // ---------------------------------------------------------------- 영업 중 가격표 (2026-11-17 사용자 "장보기 말고 영업 중인 가게에서 가격 조정")

  private pricePanel: HTMLDivElement | null = null;

  /** 가격을 바꿀 수 있는 영업 (가게 평점·가격이 있는 스토리·무한 영업. 미식가 이벤트는 기본 값만 냄) */
  private priceChangeable(): boolean {
    return this.session.ratingOn && !this.session.event;
  }

  /** 위 "가격표": 잠깐 멈추고 메뉴마다 저렴·보통·비쌈. 바꾸면 다음에 내는 그릇부터 그 값, 가게에 저장돼 다음 영업도 그대로 */
  private openPricePanel(): void {
    if (this.pricePanel !== null || this.buyPanel !== null || this.phase !== Phase.RUNNING || this.game.paused || !this.priceChangeable()) return;
    const s = this.session;
    const sid = s.shopId;
    this.game.paused = true;
    this.cancelDrag();
    const ov = Ui.overlay(this.ui, 0.55);
    ov.classList.add("center");
    ov.style.zIndex = "30";
    this.pricePanel = ov;
    const p = Ui.popPanel(Ui.PAPER, 36, 36);
    p.style.width = "1180px";
    ov.appendChild(p);
    p.appendChild(Ui.ribbon("가격표", Ui.ACCENT, 46));
    const col = Ui.vbox(16);
    col.style.alignItems = "stretch";
    p.appendChild(col);
    const list = Ui.vbox(12);
    list.style.alignItems = "stretch";
    col.appendChild(list);
    const menus = this.kitchen.binMenus().filter((m) => s.menuPool.includes(m));
    const won = (mid: string, lv: string): number => Math.round((D.menuPrice(mid) * D.PRICE_LEVELS[lv].mult) / 10) * 10;
    const fill = (): void => {
      list.replaceChildren(
        ...menus.map((mid) => {
          const row = Ui.hbox(12);
          row.style.alignItems = "center";
          const pic = menuPic(mid, 150, 84);
          row.appendChild(pic.el);
          const name = Ui.heading(D.menuName(mid), 34, Ui.INK, null, "left");
          name.style.flex = "0 0 190px";
          row.appendChild(name);
          const cur = s.priceLevel(mid);
          for (const lv of D.PRICE_ORDER) {
            const on = lv === cur;
            const c = lv === "cheap" ? Ui.AD : lv === "pricey" ? Ui.BAD : Ui.SECONDARY;
            const b = Ui.button("", on ? c : Ui.CARD, 24, 78);
            b.replaceChildren(Ui.label(`${D.PRICE_LEVELS[lv].name} · ${D.formatWon(won(mid, lv))}`, 26, on ? Ui.CREAM : Ui.INK, "center"));
            b.style.flex = "1 1 0";
            b.style.padding = "4px 6px 8px";
            if (!on) b.style.opacity = "0.85";
            Ui.onPress(b, () => {
              if (s.priceLevel(mid) === lv) return;
              s.setPriceLevel(mid, lv);
              GameState.setPrice(sid, mid, lv); // 가게에 저장 (다음 영업도 이 값)
              Sound.playSfx("coin");
              fill();
            });
            row.appendChild(b);
          }
          return row;
        }),
      );
    };
    fill();
    col.appendChild(Ui.label("바꾸면 바로 적용돼요 · 비싸게 팔면 돈은 더 벌지만 손님 평가가 깐깐해져요 · 단골손님은 늘 보통 값을 내요", 24, Ui.MUTED, "center", true));
    const close = Ui.button("닫기", Ui.SECONDARY, 32, 90);
    Ui.onPress(close, () => this.closePricePanel());
    col.appendChild(close);
  }

  private closePricePanel(): void {
    this.pricePanel?.remove();
    this.pricePanel = null;
    this.game.paused = false;
  }

  // ---------------------------------------------------------------- 튜토리얼 (첫 영업: 재료통 → 판 → 그릇 → 마무리)

  private tut: Tutorial | null = null;
  private tutSlot = -1; // 방금 덜어 낸 그릇 칸

  /** 튜토리얼 "덜기" 단계: 조리 중인 음식이 완벽 구간을 넘지 않게 붙잡아 둠 (완벽일 때만 꺼낼 수 있으니 졸아 버리면 막힘) */
  private holdTutorialPerfect(): void {
    // 덜기 단계부터 튜토리얼이 끝날 때까지 (남은 판도 설명 듣는 동안 졸지 않게)
    if (!(this.tut?.active() && GameState.tutorial === "cook") || this.tut.waiting() === "add") return;
    const s = this.session;
    for (const st of s.stationKinds()) {
      for (let i = 0; i < s.stationCapacity(st); i++) {
        const it = s.stationItem(st, i);
        if (it === null || it.isWaitStep() || it.burnt) continue;
        const end = it.stepTime("perfect_end");
        if (end > 0 && it.stepElapsed > end - 0.4) it.stepElapsed = end - 0.4;
      }
    }
  }

  /** 튜토리얼이 팻말을 가리키는 마지막 단계인지 */
  private tutAtSign(): boolean {
    return this.tut?.waiting() === "open";
  }

  private stationRect(station: string): R | null {
    const sv = this.stationViews.find((k) => k.station === station);
    if (sv === undefined) return null;
    const w = sv.size.x * sv.scale.x;
    const h = sv.size.y * sv.scale.y;
    return new R(sv.position.x - w * 0.5, sv.position.y - h * 0.5, w, h);
  }

  private makeTutorial(): Tutorial | null {
    const s = this.session;
    if (GameState.tutorial !== "cook" || s.endless || s.event || s.level !== 1) return null;
    const menu = s.menuPool[0];
    const station = D.menuStation(menu);
    const bin = this.kitchen.binMenus().indexOf(menu);
    s.frozen = true; // 설명하는 동안 손님은 기다려 준다
    // 2026-11-21 사용자 "이모 튜토리얼이 끝나야만 손님이 오게": 손님 없이 먼저 만드는 법을 배우고, 마지막에 팻말을 눌러 문을 열면
    // 튜토리얼이 끝나고 그때부터 손님이 온다 (팻말은 그 단계 전에는 못 누름 — 튜토리얼 덮개가 가린 곳만 눌림)
    const side = (): "left" | "right" => "left";
    const steps: TutStep[] = [
      {
        text: `손님이 오기 전에 미리 만들어 둘 수 있어요. 아래 ${D.menuName(menu)} 재료통을 탭해서 ${D.stationTitle(s.shop, station)}에 올려요!`,
        target: () => this.kitchen.binRect(bin),
        wait: "add",
        boxSide: side,
      },
      {
        text: `끓는 중이에요. 칸 위 막대가 초록색 '완벽' 구간에 들어올 때까지 기다렸다가, 완벽해지면 ${D.stationTitle(s.shop, station)}을 탭해서 한 그릇 덜어요! (영업 중엔 너무 오래 두면 졸아서 완벽이 아니게 돼요)`,
        target: () => this.stationRect(station),
        wait: "takeout",
        boxSide: side,
      },
      {
        text: "완성된 그릇이 완성 칸에 놓였어요. 손님이 오면 머리 옆 말풍선에 주문이 떠요. 그때 그릇을 탭하면 그 손님에게 바로 가요!",
        target: () => (this.tutSlot >= 0 ? this.kitchen.trayRect(this.tutSlot) : null),
        next: "알겠어요!",
        boxSide: side,
      },
      {
        text: "손님 말풍선 아래 인내심 막대가 다 줄기 전에 서빙하고, 완벽하게 만들수록 별점이 올라가요. 단골은 완벽한 요리에 기분 좋게 팁도 줘요!",
        next: "좋아요!",
        boxSide: side,
      },
      {
        text: "준비 끝! 이제 위에 걸린 '준비 중' 팻말을 눌러서 '영업 중'으로 바꿔요. 문을 열면 손님이 와요. 힘내요, 사장님!",
        target: () => {
          const el = this.hud.signElement();
          return el !== null ? elementRect(el, this) : null;
        },
        wait: "open",
        done: () => GameState.setTutorial(""),
      },
    ];
    return new Tutorial(this, steps, () => {
      s.frozen = false;
      this.hud.setPriceVisible(this.priceChangeable());
    });
  }

  private startClosing(): void {
    if (this.phase === Phase.CLOSING) return;
    this.phase = Phase.CLOSING;
    this.cancelDrag();
    GameState.recordResult(this.session.result());
    const caption = this.session.endless ? "영업 종료" : this.session.event ? "미식가 평가 끝!" : "오늘 영업 끝!";
    // 마지막 손님이 떠나는 모습·번 돈을 잠깐 보여 준 뒤 셔터를 내린다 (2026-11-12 사용자 요청: 바로 말고 2초 뒤)
    const tw = this.createTween();
    tw.interval(CLOSING_DELAY);
    tw.call(() => this.hud.playClosing(caption, () => this.game.goto("settlement")));
  }

  private pauseGame(): void {
    if (this.phase !== Phase.RUNNING || this.game.paused) return;
    this.cancelDrag();
    this.game.paused = true;
    Sound.setBgmPaused(true); // 일시정지하면 배경 음악·빗소리도 멈춤
    this.hud.showPause();
  }

  private resumeGame(): void {
    this.game.paused = false;
    Sound.setBgmPaused(false);
    this.hud.hidePause();
  }

  private quitToTitle(): void {
    this.game.paused = false;
    Sound.setBgmPaused(false);
    this.game.goto("title");
  }

  onFocusLost(): void {
    this.pauseGame();
  }

  onBack(): void {
    if (this.buyPanel !== null) this.closeBuyPanel();
    else if (this.pricePanel !== null) this.closePricePanel();
    else if (this.game.paused) this.resumeGame();
    else this.pauseGame();
  }

  // ---------------------------------------------------------------- 입력

  onPointer(e: PointerInfo): void {
    if (this.phase !== Phase.RUNNING || this.game.paused) return;
    if (e.type === "down") this.onPress(e.pos);
    else if (e.type === "up") this.onRelease(e.pos);
    else if (this.pending.kind !== undefined) this.onMove(e.pos);
  }

  private onPress(p: V): void {
    this.pressPos = p;
    this.dragging = false;
    this.pending = this.hit(p);
  }

  private onMove(p: V): void {
    const k = this.kitchen;
    if (this.dragging) {
      this.ghost.position = p;
      k.trashHot = k.trashRect().hasPoint(p);
      return;
    }
    if (p.distanceTo(this.pressPos) < DRAG_THRESHOLD) return;
    const kind = this.pending.kind ?? "";
    if (kind === "bowl") {
      const slot = this.pending.slot!;
      const bowl = this.session.tray[slot];
      if (bowl === null) return;
      this.ghost.showBowl(bowl.menu, bowl.quality);
      k.hiddenTraySlot = slot;
    } else if (kind === "station") {
      const item = this.session.stationItem(this.pending.station!, this.pending.index!);
      if (item === null) return;
      this.ghost.showItem(item);
      this.pending.view!.hiddenSlot = this.pending.sub!;
    } else if (kind === "board" && this.session.cutting !== null) {
      this.ghost.showBoard(this.session.cutting);
      k.hideBoard = true;
    } else {
      return;
    }
    this.dragging = true;
    k.dragging = true;
    this.ghost.position = p;
    this.ghost.visible = true;
  }

  private onRelease(p: V): void {
    if (this.pending.kind === undefined) return;
    if (this.dragging) this.drop(p);
    else this.tap();
    this.cancelDrag();
  }

  private cancelDrag(): void {
    if (this.pending.view) this.pending.view.hiddenSlot = -1;
    this.pending = {};
    this.dragging = false;
    this.ghost.clear();
    this.kitchen.hiddenTraySlot = -1;
    this.kitchen.hideBoard = false;
    this.kitchen.dragging = false;
    this.kitchen.trashHot = false;
  }

  private hit(p: V): Pending {
    const k = this.kitchen;
    const slot = k.traySlotAt(p);
    if (slot >= 0) return this.session.tray[slot] !== null ? { kind: "bowl", slot } : { kind: "empty_tray", slot };
    if (k.boardRect().hasPoint(p)) return { kind: "board" };
    for (const sv of this.stationViews) {
      const sub = sv.hitSlot(p);
      if (sub >= 0) return { kind: "station", view: sv, sub, station: sv.station, index: sv.firstIndex + sub };
    }
    const menu = k.binAt(p);
    if (menu !== "") return { kind: "bin", menu };
    if (k.powderRect().hasPoint(p)) return { kind: "powder" };
    const seat = this.seatAt(p);
    if (seat >= 0) return { kind: "customer", seat };
    return {};
  }

  /** 손님 영역: 오른쪽 주문 말풍선 먼저 (옆 손님 자리까지 뻗어 있음), 그다음 손님 몸 */
  private seatAt(p: V): number {
    if (p.y > this.counterY + 20.0 || p.y < 76.0) return -1;
    for (let i = 0; i < D.SEATS; i++) {
      const view = this.customerViews[i];
      if (view === null || view.leaving || this.session.seats[i] === null) continue;
      const b = view.bubbleRect().grow(10.0);
      const s = view.scale;
      const r = new R(view.position.x + b.x * s.x, view.position.y + b.y * s.y, b.w * s.x, b.h * s.y);
      if (r.hasPoint(p)) return i;
    }
    for (let i = 0; i < D.SEATS; i++) {
      const x = this.seatX(i);
      if (p.x >= x - 230.0 && p.x <= x + 230.0 && this.session.seats[i] !== null) return i;
    }
    return -1;
  }

  private tap(): void {
    const pd = this.pending;
    switch (pd.kind ?? "") {
      case "bowl":
        this.serveBowl(pd.slot!);
        break;
      case "empty_tray": {
        const m = this.session.trayMenu(pd.slot!);
        this.hud.toast(`${D.menuName(m)} 그릇이에요 · 메뉴마다 ${D.TRAY_PER_MENU}그릇까지 덜어 둘 수 있어요`);
        break;
      }
      case "board":
        this.tapBoard();
        break;
      case "station":
        this.tapStation();
        break;
      case "bin":
        this.tapBin(pd.menu!);
        break;
      case "powder":
        this.tapPowder();
        break;
      case "customer": {
        const seat = pd.seat!;
        if (this.session.tapCustomer(seat)) {
          Sound.playSfx("tap");
          this.customerViews[seat]?.bump();
        }
        break;
      }
    }
  }

  private tapBoard(): void {
    const res = this.session.tapCutting();
    switch (res.action) {
      case "cut":
      case "plated":
        this.kitchen.popBoard();
        Sound.playSfx("chop");
        break;
      case "blocked":
        this.hud.toast(this.trayFullText(res.menu ?? ""), rgb(1, 0.6, 0.5));
        break;
      case "none":
        this.hud.toast(this.boardHelp());
        break;
    }
  }

  /** 빈 도마를 탭했을 때 안내 */
  private boardHelp(): string {
    for (const m of this.session.menuPool) {
      if (D.usesBoard(m)) {
        if (D.menuStation(m) === D.STATION_BOARD) {
          const steps = D.boardSteps(m);
          const how = steps.length > 0 ? steps.join(" → ") : D.boardVerb(m);
          return `${D.menuName(m)} 재료통 탭 → 여기서 ${how}`;
        }
        return `꺼낸 ${D.menuName(m)} → 여기서 ${D.boardVerb(m)}`;
      }
    }
    return this.kitchen.boardNote() + " — 아직 쓸 일이 없어요";
  }

  private tapStation(): void {
    const sv = this.pending.view!;
    const sub = this.pending.sub!;
    if (sv.isLocked()) {
      this.hud.toast(sv.lockedNote.replace(/\n/g, " "));
      return;
    }
    // 튜토리얼 "덜기" 단계: 완벽 구간일 때만 꺼냄 (2026-11-21 사용자 "튜토리얼에 떡볶이가 완벽할 때 꺼내게")
    if (this.tut?.waiting() === "takeout") {
      const item = this.session.stationItem(sv.station, this.pending.index!);
      if (item !== null && item.stepQuality() !== D.Q.PERFECT) {
        this.hud.toast("아직이에요! 막대가 초록색 '완벽'에 들어오면 탭해요", rgb(1.0, 0.85, 0.5));
        Sound.playSfx("denied");
        return;
      }
    }
    const res = this.session.tapStation(sv.station, this.pending.index!);
    const pos = sv.toGlobal(sv.slotCenter(sub));
    const action = res.action;
    switch (action) {
      case "take_out":
      case "to_board":
        this.qualityPopup(pos, res.quality ?? 0);
        if (action === "to_board") this.kitchen.popBoard();
        else Sound.playSfx("plate");
        if (action === "take_out" && res.slot !== undefined) {
          this.tutSlot = res.slot;
          this.tut?.onEvent("takeout");
        }
        break;
      case "blocked":
        if (res.reason === "board") {
          const m = this.session.cutting?.menu ?? "";
          const what = m !== "" ? D.menuName(m) : "음식";
          this.hud.toast(`도마에 있는 ${what}부터 ${verbEnding(m !== "" ? D.boardVerb(m) : "썰기")} 주세요`, rgb(1, 0.6, 0.5));
        } else {
          this.hud.toast(this.trayFullText(res.menu ?? ""), rgb(1, 0.6, 0.5));
        }
        Sound.playSfx("denied");
        break;
      case "wait": {
        const item = this.session.stationItem(sv.station, this.pending.index!);
        this.hud.toast(`아직이에요: ${item !== null ? item.step().label : "기다리는 중"}…`);
        break;
      }
      case "none":
        this.hud.toast("아래 재료를 탭하면 여기에 올라가요");
        break;
      default:
        // 다음 단계로 (뒤집기, 면 넣기, 말기 …)
        sv.pop(sub);
        Sound.playSfx(action === "flip" ? "flip" : "bubble");
    }
  }

  /** 그 메뉴 그릇 2개가 다 찼을 때 안내 */
  private trayFullText(menu: string): string {
    if (menu === "") return "완성 칸이 꽉 찼어요! 먼저 서빙하세요";
    return `${D.menuName(menu)} 그릇 ${D.TRAY_PER_MENU}개가 다 찼어요! 먼저 서빙하세요`;
  }

  /** 마법의 가루 통: 준비 ↔ 취소 (없으면 어디서 사는지 안내) */
  private tapPowder(): void {
    const s = this.session;
    if (s.powder <= 0) {
      this.hud.toast(`마법의 가루가 없어요 · 지도의 '장보기'에서 ${D.formatWon(D.POWDER_PRICE)}에 살 수 있어요`, rgb(0.9, 0.75, 1.0));
      Sound.playSfx("denied");
      return;
    }
    if (s.armPowder()) {
      this.hud.toast("✨ 가루 준비…! 다음에 올리는 재료에 뿌려져요. 무슨 일이 일어날까요?", rgb(0.9, 0.75, 1.0));
      Sound.playSfx("magic");
    } else {
      this.hud.toast("가루 뿌리기를 취소했어요");
      Sound.playSfx("tap");
    }
  }

  private tapBin(menu: string): void {
    const s = this.session;
    if (!s.menuPool.includes(menu)) {
      this.hud.toast(`${D.menuName(menu)} — ${D.levelName(D.menuUnlockLevel(menu))}에 열려요`);
      return;
    }
    const usedBefore = s.powderUsed;
    const idx = s.addIngredient(menu);
    const station = D.menuStation(menu);
    if (s.powderUsed > usedBefore) {
      this.hud.toast(`✨ ${D.menuName(menu)}에 마법의 가루를 뿌렸어요!`, rgb(0.9, 0.75, 1.0));
      Sound.playSfx("magic");
    }
    if (idx === -2) {
      // 품절: 그 자리에서 재료 사기 창
      Sound.playSfx("denied");
      this.openBuyPanel(menu);
      return;
    }
    if (idx < 0) {
      const busy = D.STATIONS[station]?.busy ?? "";
      this.hud.toast(busy !== "" ? busy : `${D.stationTitle(s.shop, station)}에 빈자리가 없어요`, rgb(1, 0.6, 0.5));
      Sound.playSfx("denied");
      return;
    }
    this.kitchen.popBin(menu);
    this.tut?.onEvent("add");
    if (station === D.STATION_BOARD) {
      this.kitchen.popBoard();
      Sound.playSfx("chop");
      return;
    }
    Sound.playSfx(D.stationUsesHeat(station) && station !== "steamer" ? "sizzle" : "bubble");
    for (const sv of this.stationViews) {
      if (sv.station === station && idx >= sv.firstIndex && idx < sv.firstIndex + sv.slotCount) sv.pop(idx - sv.firstIndex);
    }
  }

  private drop(p: V): void {
    const onTrash = this.kitchen.trashRect().hasPoint(p);
    const pd = this.pending;
    switch (pd.kind ?? "") {
      case "bowl": {
        const slot = pd.slot!;
        if (onTrash) {
          this.wastePopup(p, this.session.discardTray(slot));
          return;
        }
        // 손님에게 직접 끌어다 놓아도 된다 (탭하면 자동으로 나감)
        const seat = this.seatAt(p);
        if (seat < 0) return;
        const sr = this.session.serve(slot, seat);
        sr.seat = seat;
        this.afterServe(sr);
        break;
      }
      case "station":
        if (onTrash) this.wastePopup(p, this.session.discardStation(pd.station!, pd.index!));
        break;
      case "board":
        if (onTrash) this.wastePopup(p, this.session.discardCutting());
        break;
    }
  }

  /** 완성 그릇 탭 → 그 메뉴를 기다리는 손님 중 인내심이 가장 적게 남은 손님에게 자동으로 (그릇이 손님에게 날아감) */
  private serveBowl(slot: number): void {
    const bowl = this.session.tray[slot];
    if (bowl === null) return;
    const menu = bowl.menu;
    const quality = bowl.quality;
    const from = this.kitchen.trayCenter(slot).add(v(0, -14));
    const res = this.session.autoServe(slot);
    if (res.result === "none") {
      this.hud.toast(`${D.menuName(menu)} 주문한 손님이 없어요`, rgb(1, 0.6, 0.5));
      Sound.playSfx("denied");
      return;
    }
    if (res.result !== "reject") {
      ServeFly.spawn(this.fxLayer, menu, quality, from, v(this.seatX(res.seat!), this.headY + 120.0));
      Sound.playSfx("serve");
      this.tut?.onEvent("serve");
    }
    this.afterServe(res);
  }

  /** 서빙 결과 안내 (다른 메뉴는 손님이 안 받음, 덜 익은 음식은 화내며 떠남, 탄 음식은 투덜대며 받고 값은 반만) */
  private afterServe(res: ServeResult): void {
    if (res.magic === true) {
      // 마법의 가루 요리: 반짝이는 글자 (효과는 말하지 않음 — 받은 돈을 보고 알아채게)
      const x = res.seat !== undefined ? this.seatX(res.seat) : this.vw * 0.5;
      FloatText.spawn(this.fxLayer, v(x, this.headY - 80.0), "✨ 마법의 맛!", rgb(0.95, 0.75, 1.0), 40, 0.15);
      Sound.playSfx("magic");
    }
    if (res.result === "reject") {
      if (res.reason === "wrong") this.hud.toast("주문한 메뉴가 아니에요", rgb(1, 0.6, 0.5));
      Sound.playSfx("denied");
    } else if (res.result === "angry") {
      this.hud.toast("덜 익은 음식! 손님이 화나서 떠났어요", rgb(1, 0.45, 0.4));
    } else if (res.reason === "burnt") {
      this.hud.toast("탄 음식이라 값을 반만 받았어요", rgb(1, 0.6, 0.5));
    }
  }

  private qualityPopup(pos: V, q: number): void {
    const colors = [rgb(1, 0.55, 0.45), rgb(1, 0.92, 0.75), rgb(0.5, 1, 0.55), rgb(0.6, 0.6, 0.6)];
    const label = q === D.Q.PERFECT ? "완벽!" : D.QUALITY_NAMES[q];
    FloatText.spawn(this.fxLayer, pos.add(v(0, -60)), label, colors[q], q === D.Q.PERFECT ? 44 : 34);
    Sound.playSfx(q === D.Q.PERFECT ? "perfect" : "tap");
  }

  private wastePopup(pos: V, cost: number): void {
    Sound.playSfx("trash");
    if (cost <= 0) {
      FloatText.spawn(this.fxLayer, pos.add(v(0, -40)), "버렸어요", rgb(1, 0.75, 0.6), 32);
      return;
    }
    FloatText.spawn(this.fxLayer, pos.add(v(0, -40)), `폐기 -${D.formatWon(cost)}`, rgb(1, 0.5, 0.45), 34);
    Sound.playSfx("tap");
  }

  // ---------------------------------------------------------------- 세션 이벤트

  /** 손님이 떠나며 남긴 평가: 머리 위에 별 점수 + 짧은 평 (위쪽 평점은 HUD 가 매 프레임 그림) */
  private onReviewed(seat: number, score: number, tag: string): void {
    const words: Record<string, string> = { good: "맛있어요", cheap: "가성비 최고", pricey: "비싸요…", slow: "너무 늦어요", bad: "별로예요" };
    const col = score >= 4.2 ? rgb(1.0, 0.86, 0.3) : score >= 3.0 ? rgb(1.0, 0.95, 0.85) : rgb(1.0, 0.55, 0.45);
    const pos = v(this.seatX(seat), this.headY - 96.0);
    FloatText.spawn(this.fxLayer, pos, `★${score.toFixed(1)} ${words[tag] ?? ""}`, col, 32, 0.35);
    this.hud.flashRating(score >= 3.0 ? 1 : -1);
  }

  private facesToday = new Set<string>(); // 이번 영업에 온 손님 얼굴 (같은 사람이 또 오지 않게 — 그것 말고는 랜덤)

  private onCustomerArrived(seat: number): void {
    const c = this.session.seats[seat]!;
    if (c.typeId === "imo") GameState.markImoVisited(); // 한 번 오면 끝 (영업 도중에 나가도 다시 안 옴)
    const view = new CustomerView();
    const taken = this.customerViews.filter((o): o is CustomerView => o !== null && !o.freed).map((o) => o.spriteName);
    view.setup(c, seat, taken, this.facesToday);
    // 모두 같은 크기 (머리 크기를 맞춤 — 미식가도 따로 키우지 않음, 2026-11-17)
    const k = CUSTOMER_SCALE;
    view.scale = v(k, k);
    view.position = v(this.seatX(seat), this.seatHeadY(view.bodyBelow() * k));
    this.customerLayer.add(view);
    view.playEnter();
    this.customerViews[seat] = view;
  }

  /** 손님 머리 높이: 다 같이 headY, 몸이 짧은 그림은 몸 끝이 카운터(그림 가게는 그림 속 카운터 윗면) 뒤로 숨는 만큼 내림 */
  private seatHeadY(bodyBelow: number): number {
    const art = this.kitchen.art;
    const cover = art !== null ? mapY(art, art.counterLine) : this.counterY;
    return Math.max(this.headY, cover + 14.0 - bodyBelow);
  }

  private onCustomerLeft(seat: number, reason: string): void {
    const view = this.customerViews[seat];
    this.customerViews[seat] = null;
    view?.playLeave(reason);
    if (reason === "angry") {
      Sound.playSfx("angry");
      if (this.session.endless) this.hud.toast(`화난 손님! 남은 기회 ${this.session.lives}`, rgb(1, 0.45, 0.4));
    }
  }

  private onOrderChanged(seat: number): void {
    this.customerViews[seat]?.flashChange();
    const g = this.session.gourmet;
    if (g !== null && this.session.seats[seat] === g) {
      this.hud.toast(`다음 코스! (${g.round + 1} / ${g.rounds.length})`, rgb(0.85, 0.7, 1.0));
      Sound.playSfx("tap");
      return;
    }
    this.hud.toast("진상 손님이 주문을 바꿨어요!", rgb(0.95, 0.6, 1.0));
    Sound.playSfx("denied");
  }

  private onItemBurnt(station: string, index: number): void {
    Sound.playSfx("burnt");
    for (const sv of this.stationViews) {
      if (sv.station === station && index >= sv.firstIndex && index < sv.firstIndex + sv.slotCount) {
        FloatText.spawn(this.fxLayer, sv.toGlobal(sv.slotCenter(index - sv.firstIndex)).add(v(0, -60)), "탔어요!", rgb(1, 0.45, 0.35), 36);
      }
    }
  }

  private onMoneyEarned(seat: number, paid: number, tip: number, quality: number): void {
    const view = this.customerViews[seat];
    if (view && quality !== D.Q.RAW && quality !== D.Q.BURNT) view.bump();
    const pos = v(this.seatX(seat), this.headY - 20.0);
    if (paid <= 0) return;
    FloatText.spawn(this.fxLayer, pos, `+${D.formatWon(paid)}`, Ui.GOLD, 42);
    if (tip > 0) FloatText.spawn(this.fxLayer, pos.add(v(0, 50)), `팁 +${D.formatWon(tip)}`, rgb(0.6, 1.0, 0.6), 34, 0.25);
    Sound.playSfx("coin");
  }

  dispose(): void {
    this.game.paused = false;
    void WHITE;
  }
}

/** "썰기" → "썰어", "말기" → "말아", "버무리기" → "버무려", "무치기" → "무쳐" */
function verbEnding(verb: string): string {
  switch (verb) {
    case "썰기":
      return "썰어";
    case "말기":
      return "말아";
    case "버무리기":
      return "버무려";
    case "무치기":
      return "무쳐";
    case "비비기":
      return "비벼";
  }
  return "손질해";
}
