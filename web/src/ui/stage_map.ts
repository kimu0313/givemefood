// 스테이지 지도: 가게 5곳이 길 하나로 쭉 이어진 긴 지도 (2026-11-12 사용자 요청: 한 화면에 두 개씩 끊지 말고 부드럽게 이어지듯이).
// 손가락으로 좌우로 밀어서 보고(놓으면 미끄러지듯 멈춤), 양쪽 화살표·←/→·마우스 휠로 앞뒤 가게로 넘어간다.
// 아이소메트릭 3/4 시점 (2026-11-14, 배치는 art/map_geo.ts): 길이 땅 격자를 따라 지그재그로 가게들을 잇고,
// 가게마다 V 자로 꺾인 길 안쪽에 건물, 스테이지 7개는 길바닥에 박힌 발판, 건물 입구 앞마당에 ∞(무한 영업). 끝에는 "새 가게 준비 중" 빈터.
// 가게의 마지막 스테이지를 깨면 그 가게 무한 영업이 열리고, 다음 가게는 모은 돈으로 산다 (잠긴 건물에 "가게 열기 · 값").
// 위쪽(고정): 타이틀로 / 지금 보고 있는 가게 이름 / 별·지갑.

import { R, V, clamp, rgb, v } from "../engine/geom.ts";
import { Scene, type PointerInfo } from "../engine/game.ts";
import { Node2D, type Tween } from "../engine/node.ts";
import { Sound } from "../engine/audio.ts";
import * as Ui from "../engine/ui.ts";
import * as D from "../core/defs.ts";
import type { ShopDef } from "../core/defs.ts";
import { GameState } from "../state/game_state.ts";
import { MapArt } from "../art/map_art.ts";
import * as G from "../art/map_geo.ts";
import { LevelNode, MapButton, MapNote, ShopPlate, SideArrow } from "./map_widgets.ts";
import { starRow } from "./star_row.ts";
import { openCollection } from "./collection.ts";
import { gourmetPortrait } from "./portrait.ts";
import { menuIcons, menuPic } from "../shift/shift_hud.ts";

/** 돈 한 줄: 왼쪽 이름, 오른쪽 동전 + 금액 (굵은 숫자) */
function moneyRow(name: string, won: number, color = Ui.INK): HTMLDivElement {
  const h = Ui.hbox(10);
  h.style.alignItems = "center";
  const l = Ui.label(name, 32, Ui.INK, "left");
  l.style.flex = "1 1 auto";
  h.append(l, Ui.icon(Ui.ICON.coin, 38), Ui.heading(D.formatWon(won), 32, color, null, "right"));
  return h;
}

export { ZONE_W, LOT_W, zoneX, worldWidth, levelPos } from "../art/map_geo.ts";
const ZONE_W = G.ZONE_W;
const PLATE_SIZE = v(420, 52);
const PLATE_MIN_Y = 128.0; // 이름표가 위쪽 제목 상자에 닿지 않게
const UPGRADE_SIZE = v(240, 62);
const LEVEL_R = 60.0;
const ENDLESS_R = 46.0;
const EVENT_R = 54.0; // 미식가 이벤트 발판
const DRAG_START = 14.0; // 이만큼 움직여야 밀기로 본다 (그 전엔 탭)
const FRICTION = 4.0; // 놓은 뒤 미끄러지다 멈추는 빠르기
const SCROLL_TIME = 0.45;
const MAX_FLING = 6000.0; // 놓았을 때 미끄러지는 속도 상한 (설계 px/초)

export function buyText(sid: string): string {
  return `가게 열기 · ${D.formatWon(D.shopOpenCost(sid))}`;
}

type Tappable = { node: Node2D; hit: (local: V) => boolean; press: () => void; world: boolean };

export class StageMap extends Scene {
  private layer!: Node2D; // 지도 전체 (좌우로 움직이는 부분)
  private art!: MapArt;
  private hudLayer!: Node2D; // 고정된 캔버스 부분 (양쪽 화살표)
  private popup: HTMLDivElement | null = null;
  private nodes: LevelNode[] = [];
  private arrows: SideArrow[] = [];
  private tappables: Tappable[] = [];
  private titleEl!: HTMLDivElement;
  private subtitleEl!: HTMLDivElement;
  private scroll = 0.0;
  private vel = 0.0;
  private dragging = false;
  private dragMoved = false;
  private pressX = 0.0;
  private sliding = false;
  private scrollTween: Tween | null = null;
  private centerShopIdx = -1;

  ready(): void {
    this.clearColor = rgb(0.17, 0.18, 0.23);
    this.layer = this.add(new Node2D());
    this.build();
    this.buildHud();
    // 처음 보여 줄 곳: 방금 가게를 다 깼으면 살 가게, 아니면 지금 도전할 스테이지
    const buy = GameState.justShopCleared !== "" ? GameState.nextBuyableShop() : "";
    GameState.justShopCleared = "";
    if (buy !== "") this.scrollToShop(D.shopIndex(buy), false);
    else this.scrollToLevelOf(GameState.currentMapShop());
    Sound.playBgm("title");
  }

  onBack(): void {
    if (this.popup !== null) this.closePopup();
    else this.goTitle();
  }

  levelNodes(): LevelNode[] {
    return this.nodes;
  }

  isSliding(): boolean {
    return this.sliding;
  }

  scrollX(): number {
    return this.scroll;
  }

  private maxScroll(): number {
    return Math.max(0.0, G.worldWidth() - this.vw);
  }

  /** 화면 가운데에 있는 가게 순번 */
  centerShop(): number {
    return clamp(Math.floor((this.scroll + this.vw * 0.5) / ZONE_W), 0, D.SHOPS.length - 1);
  }

  shopId(): string {
    return D.SHOPS[this.centerShop()].id;
  }

  // ---------------------------------------------------------------- 지도 그리기

  private build(): void {
    const L = G.layout();
    const art = new MapArt();
    art.size = v(G.worldWidth(), this.vh);
    this.art = this.layer.add(art);
    // 발판·이름표·단추는 그림 위에, 화면 위쪽(뒤)에 있는 것부터 차례로
    const levels: [number, V][] = [];
    for (let lv = 1; lv <= D.TOTAL_LEVELS; lv++) levels.push([lv, G.levelPos(lv)]);
    for (const z of L.zones) {
      art.locked.push(z.shop !== null && !GameState.shopOpened(z.shop.id));
      art.spurOpen.push(z.shop !== null && GameState.shopCleared(z.shop.id));
    }
    for (const z of L.zones) if (z.shop !== null) this.addEndlessNode(z.shop.id, G.endlessPos(z.shop.id));
    // 스테이지 + 가게 사이 미식가 이벤트 발판을 화면 위쪽(뒤)부터
    const spots: [number, () => void][] = levels.map(([lv, pos]) => [pos.y, () => this.addLevelNode(lv, pos)]);
    for (const e of D.EVENTS) {
      const pos = G.eventPos(e.shop);
      spots.push([pos.y, () => this.addEventNode(e.shop, pos)]);
    }
    spots.sort((x, y) => x[0] - y[0]);
    for (const [, add] of spots) add();
    for (const z of L.zones) {
      const sh = z.shop;
      if (sh === null) continue;
      const opened = GameState.shopOpened(sh.id);
      // 이름표 (+ 열린 가게는 오른쪽에 업그레이드) 는 건물 위에
      const b = z.bounds;
      const rowW = PLATE_SIZE.x + (opened ? 14.0 + UPGRADE_SIZE.x : 0.0);
      const y = Math.max(PLATE_MIN_Y, b.y - PLATE_SIZE.y - 18.0);
      const x = b.center().x - rowW * 0.5;
      this.addPlate(sh, v(x, y), opened);
      if (opened) this.addUpgradeButton(sh.id, v(x + PLATE_SIZE.x + 14.0, y - (UPGRADE_SIZE.y - PLATE_SIZE.y) * 0.5));
      else this.addLockedNote(sh, b);
    }
    art.walkedS = GameState.storyCleared || GameState.levelCleared(D.TOTAL_LEVELS) ? L.endS : G.levelS(clamp(GameState.level, 1, D.TOTAL_LEVELS));
    if (GameState.justUnlocked > 0) GameState.justUnlocked = 0;
  }

  private addLevelNode(lv: number, pos: V): void {
    const node = new LevelNode();
    node.radius = LEVEL_R;
    node.number = lv;
    node.stars = GameState.starsOf(lv);
    const news = D.menusUnlockedOn(lv);
    if (news.length > 0) node.menuId = news[0];
    node.state = GameState.levelCleared(lv) ? "cleared" : GameState.levelOpen(lv) ? "current" : "locked";
    node.position = pos;
    // ∞ 샛길이 오른쪽 위로 갈라지는 발판은 메뉴 배지를 왼쪽에
    const z = G.zoneOf(D.shopForLevel(lv).id);
    node.badgeLeft = z.front === "gy" && Math.abs(z.spurS - G.levelS(lv)) < 0.01;
    node.onPressed = () => this.onLevelPressed(lv);
    this.layer.add(node);
    this.nodes.push(node);
    this.tappables.push({ node, hit: (p) => node.hit(p), press: () => node.onPressed(), world: true });
    if (GameState.justUnlocked === lv) node.pop();
  }

  private addEndlessNode(sid: string, pos: V): void {
    const node = new LevelNode();
    node.radius = ENDLESS_R;
    node.endless = true;
    node.state = GameState.shopCleared(sid) ? "cleared" : "locked";
    node.position = pos;
    node.onPressed = () => this.onEndlessPressed(sid);
    this.layer.add(node);
    this.nodes.push(node);
    this.tappables.push({ node, hit: (p) => node.hit(p), press: () => node.onPressed(), world: true });
  }

  /** 가게와 다음 가게 사이 미식가 이벤트 발판 */
  private addEventNode(sid: string, pos: V): void {
    const node = new LevelNode();
    node.radius = EVENT_R;
    node.event = true;
    node.number = 0; // 숫자 없는 발판
    node.grade = GameState.eventGrade(sid);
    node.state = GameState.eventPlayed(sid) ? "cleared" : GameState.eventOpen(sid) ? "current" : "locked";
    node.position = pos;
    node.onPressed = () => this.onEventPressed(sid);
    this.layer.add(node);
    this.nodes.push(node);
    this.tappables.push({ node, hit: (p) => node.hit(p), press: () => node.onPressed(), world: true });
  }

  private addPlate(sh: ShopDef, pos: V, opened: boolean): void {
    const plate = new ShopPlate();
    plate.shop = sh;
    plate.number = D.shopIndex(sh.id) + 1;
    plate.locked = !opened;
    plate.position = pos;
    plate.size = PLATE_SIZE;
    this.layer.add(plate);
  }

  private addButton(b: MapButton): void {
    this.layer.add(b);
    this.tappables.push({
      node: b,
      hit: (p) => b.hit(p),
      press: () => {
        b.press();
        b.onPressed();
      },
      world: true,
    });
  }

  private addUpgradeButton(sid: string, pos: V): void {
    const b = new MapButton();
    b.text = "업그레이드";
    b.icon = "up";
    b.color = Ui.GOOD;
    b.fontSize = 28;
    b.size = UPGRADE_SIZE;
    b.position = pos;
    b.badge = GameState.canBuyAny(sid);
    b.onPressed = () => this.goUpgrade(sid);
    this.addButton(b);
  }

  /** 아직 안 연 가게: 앞 가게를 다 깼으면 "가게 열기 · 값" 버튼 (돈이 모자라면 흐리게 + 얼마 더 필요한지), 아니면 언제 살 수 있는지 */
  private addLockedNote(sh: ShopDef, facade: R): void {
    const sid = sh.id;
    const prev = D.SHOPS[Math.max(0, D.shopIndex(sid) - 1)];
    const prevStage = D.levelName(prev.last_level);
    let text = `${prevStage}${D.josa(prevStage, "을", "를")} 깨면\n돈을 모아 열 수 있어요`;
    const buyable = GameState.canBuyShop(sid);
    if (buyable) {
      const cost = D.shopOpenCost(sid);
      const enough = GameState.wallet >= cost;
      const b = new MapButton();
      b.text = buyText(sid);
      b.color = enough ? Ui.GOOD : Ui.SECONDARY;
      b.fontSize = 30;
      b.size = v(380, 72);
      b.position = v(facade.center().x - 190.0, facade.center().y + 10.0);
      b.disabled = !enough;
      b.onPressed = () => this.buyShop(sid);
      this.addButton(b);
      if (enough) {
        // 살 수 있으면 버튼이 콩콩 (눈에 띄게): 가운데를 기준으로 커졌다 작아짐
        const base = b.position;
        const st = { s: 1.0 };
        const tw = b.createTween().setLoops();
        tw.prop(st, "s", 1.07, 0.45).setTrans("sine");
        tw.prop(st, "s", 1.0, 0.45).setTrans("sine");
        b.process = (dt: number) => {
          MapButton.prototype.process.call(b, dt);
          b.scale = v(st.s, st.s);
          b.position = base.sub(b.size.mul((st.s - 1) * 0.5));
        };
        return;
      }
      text = `${D.formatWon(cost - GameState.wallet)} 더 필요해요\n${prev.name} 무한 영업으로 모아요`;
    }
    const note = new MapNote();
    note.text = text;
    note.position = v(facade.center().x - 240.0, facade.center().y + (buyable ? 96.0 : 46.0));
    note.size = v(480, 90);
    this.layer.add(note);
  }

  private buyShop(sid: string): void {
    if (this.busy()) return;
    if (GameState.buyShop(sid)) {
      Sound.playSfx("coin");
      this.game.goto("stage_open");
    }
  }

  // ---------------------------------------------------------------- 좌우로 밀기 · 넘기기

  private setScroll(x: number): void {
    this.scroll = clamp(x, 0.0, this.maxScroll());
    this.layer.position = v(-this.scroll, this.layer.position.y);
    this.art.viewX0 = this.scroll;
    this.art.viewX1 = this.scroll + this.vw;
    this.updateHud();
  }

  /** 지도를 x 로 (animate = 부드럽게) */
  scrollTo(x: number, animate = true): void {
    this.scrollTween?.kill();
    this.vel = 0.0;
    const target = clamp(x, 0.0, this.maxScroll());
    if (!animate) {
      this.setScroll(target);
      this.settle();
      return;
    }
    this.sliding = true;
    const tw = this.createTween().setTrans("cubic").setEase("out");
    tw.method((x) => this.setScroll(x), this.scroll, target, SCROLL_TIME);
    tw.call(() => {
      this.sliding = false;
      this.settle();
    });
    this.scrollTween = tw;
  }

  /** 가게 구역이 화면 가운데 오게 */
  scrollToShop(i: number, animate = true): void {
    const idx = clamp(i, 0, D.SHOPS.length - 1);
    this.scrollTo(G.zoneX(idx) + ZONE_W * 0.5 - this.vw * 0.5, animate);
  }

  /** 그 가게에서 지금 도전할 스테이지(없으면 가게 가운데)가 화면 가운데 오게 */
  private scrollToLevelOf(sid: string): void {
    const sh = D.shopDef(sid);
    const lv = clamp(GameState.level, sh.first_level, sh.last_level);
    this.scrollTo(G.levelPos(lv).x - this.vw * 0.5, false);
  }

  /** 양쪽 화살표 / ←·→ : 앞·뒤 가게로 */
  flip(dir: number): void {
    if (this.popup !== null) return;
    const i = this.centerShop() + dir;
    if (i < 0 || i >= D.SHOPS.length) {
      this.bounce(dir);
      return;
    }
    Sound.playSfx("tap");
    this.scrollToShop(i);
  }

  /** 더 갈 곳이 없을 때: 살짝 밀었다가 되돌린다 */
  private bounce(dir: number): void {
    const tw = this.createTween().setTrans("sine");
    tw.prop(this.layer, "position:x", -this.scroll - 36.0 * dir, 0.08);
    tw.prop(this.layer, "position:x", -this.scroll, 0.18);
  }

  /** 손가락으로 밀기 (단추·스테이지 위에서 시작해도 밀 수 있게 전체 입력에서 본다) */
  onPointer(e: PointerInfo): void {
    if (this.popup !== null) return;
    if (e.type === "down") {
      this.dragging = true;
      this.dragMoved = false;
      this.pressX = e.pos.x;
      if (this.scrollTween !== null && this.scrollTween.isRunning()) {
        this.scrollTween.kill();
        this.sliding = false;
      }
      this.vel = 0.0;
      return;
    }
    if (e.type === "move") {
      if (!this.dragging) return;
      if (!this.dragMoved && Math.abs(e.pos.x - this.pressX) > DRAG_START) this.dragMoved = true;
      if (this.dragMoved) {
        this.dragBy(e.rel.x);
        this.vel = clamp(-e.vel.x, -MAX_FLING, MAX_FLING);
      }
      return;
    }
    if (!this.dragging) return;
    this.dragging = false;
    if (this.dragMoved) {
      // 민 손가락을 뗀 것: 이번 탭은 무시 (스테이지·단추가 눌리지 않게). 밀던 속도로 미끄러짐
      this.vel = clamp(-e.vel.x, -MAX_FLING, MAX_FLING);
      return;
    }
    this.settle();
    this.tapAt(e.pos);
  }

  /** 누른 자리의 화살표·단추·스테이지 (위에 그려진 것부터) */
  private tapAt(p: V): void {
    for (const a of this.arrows) {
      if (a.hit(p.sub(a.position))) {
        a.press();
        a.onPressed();
        return;
      }
    }
    const world = p.add(v(this.scroll, 0));
    for (let i = this.tappables.length - 1; i >= 0; i--) {
      const t = this.tappables[i];
      if (t.hit(world.sub(t.node.position))) {
        t.press();
        return;
      }
    }
  }

  onWheel(dy: number, dx: number): void {
    if (this.popup !== null) return;
    const d = Math.abs(dx) > Math.abs(dy) ? dx : dy;
    if (d < 0) this.scrollTo(this.scroll - 260.0);
    else if (d > 0) this.scrollTo(this.scroll + 260.0);
  }

  onKey(key: string): void {
    if (key === "ArrowLeft") this.flip(-1);
    else if (key === "ArrowRight") this.flip(1);
  }

  /** 손가락이 dx 만큼 움직임 (오른쪽으로 밀면 지도는 왼쪽 것을 보여 줌) */
  dragBy(dx: number): void {
    this.setScroll(this.scroll - dx);
  }

  /** 놓은 뒤: 밀던 속도로 미끄러지다 멈춤 */
  releaseWith(velocity: number): void {
    this.dragging = false;
    this.vel = velocity;
  }

  process(dt: number): void {
    if (this.dragging || Math.abs(this.vel) < 8.0) return;
    const before = this.scroll;
    this.setScroll(this.scroll + this.vel * dt);
    this.vel *= Math.exp(-FRICTION * dt);
    if (Math.abs(before - this.scroll) < 1e-6 || Math.abs(this.vel) < 8.0) {
      this.vel = 0.0;
      this.settle();
    }
  }

  /** 지도가 멈췄을 때: 가운데 있는 열린 가게를 "보고 있는 가게"로 (업그레이드·다음에 지도 열 때 기준) */
  private settle(): void {
    const sid = this.shopId();
    if (GameState.shopOpened(sid)) GameState.mapShop = sid;
  }

  private busy(): boolean {
    return this.sliding || this.popup !== null;
  }

  // ---------------------------------------------------------------- 고정 부분 (위쪽 막대 + 양쪽 화살표)

  private buildHud(): void {
    const vs = v(this.vw, this.vh);
    const back = Ui.button("", Ui.SECONDARY, 30, 84);
    Ui.withIcon(back, Ui.ICON.back, "타이틀");
    back.style.padding = "0 22px 4px 16px";
    Ui.place(back, 20, 16, 200, 72);
    Ui.onPress(back, () => this.goTitle());
    this.ui.appendChild(back);

    // 타이틀 옆: 단골 도감 · 기록 (2026-11-16 사용자: 시작 화면이 아니라 게임 안에서 보게)
    const book = Ui.button("", Ui.SECONDARY, 30, 84);
    Ui.withIcon(book, Ui.ICON.book, "단골 도감");
    book.style.padding = "0 22px 4px 16px";
    Ui.place(book, 234, 16, 250, 72);
    Ui.onPress(book, () => this.openBook());
    this.ui.appendChild(book);

    // 가운데: 가게 간판 (나무 판 + 가게 이름 큰 글자 + 스테이지 범위)
    const bar = Ui.chip(30);
    Ui.place(bar, vs.x * 0.5 - 330.0, 12, 660, 104);
    this.ui.appendChild(bar);
    this.titleEl = Ui.place(Ui.heading("", 40, Ui.CREAM, rgb(0.1, 0.05, 0.02)), 0, 6, 652, 58);
    this.titleEl.style.lineHeight = "58px";
    bar.appendChild(this.titleEl);
    this.subtitleEl = Ui.place(Ui.label("", 25, rgb(1.0, 0.8, 0.45)), 0, 60, 652, 32);
    this.subtitleEl.style.lineHeight = "32px";
    bar.appendChild(this.subtitleEl);

    // 오른쪽: 모은 별 · 지갑
    const info = Ui.chip(999);
    info.classList.add("hbox");
    info.style.alignItems = "center";
    info.style.gap = "10px";
    info.style.padding = "0 26px 0 14px";
    Ui.place(info, vs.x - 20.0 - 470.0, 16, 470, 76);
    this.ui.appendChild(info);
    info.appendChild(Ui.icon(Ui.ICON.star, 46));
    const stars = Ui.heading(String(GameState.totalStars()), 34, Ui.GOLD, rgb(0.1, 0.05, 0.02), "left");
    stars.style.minWidth = "70px";
    info.appendChild(stars);
    info.appendChild(Ui.spacer(0, true));
    info.appendChild(Ui.icon(Ui.ICON.coin, 46));
    info.appendChild(Ui.heading(D.formatWon(GameState.wallet), 34, Ui.CREAM, rgb(0.1, 0.05, 0.02), "right"));

    // 화면 양쪽 큰 화살표: 앞 / 뒤 가게로
    this.hudLayer = this.add(new Node2D());
    for (const dir of [-1, 1]) {
      const arrow = new SideArrow();
      arrow.dir = dir;
      arrow.position = v(dir < 0 ? 0.0 : vs.x - SideArrow.SIZE.x, vs.y * 0.5 - 70.0);
      arrow.onPressed = () => this.flip(dir);
      this.hudLayer.add(arrow);
      this.arrows.push(arrow);
    }
    this.centerShopIdx = -1;
    this.updateHud();
  }

  /** 가운데 가게가 바뀌면 위쪽 이름과 양쪽 화살표(갈 가게 이름·자물쇠·살 수 있음 "!")를 바꾼다 */
  private updateHud(): void {
    if (!this.titleEl) return;
    const i = this.centerShop();
    if (i === this.centerShopIdx) return;
    this.centerShopIdx = i;
    const sh = D.SHOPS[i];
    Ui.setText(this.titleEl, sh.name);
    Ui.setText(this.subtitleEl, `${i + 1}번째 가게 · 스테이지 ${sh.first_level}~${sh.last_level}`);
    for (const arrow of this.arrows) {
      const j = i + arrow.dir;
      arrow.enabled = j >= 0 && j < D.SHOPS.length;
      arrow.locked = false;
      arrow.buyable = false;
      if (arrow.enabled) {
        const tid = D.SHOPS[j].id;
        arrow.caption = D.SHOPS[j].name;
        arrow.locked = !GameState.shopOpened(tid);
        arrow.buyable = GameState.canBuyShop(tid) && GameState.wallet >= D.shopOpenCost(tid);
      }
    }
  }

  // ---------------------------------------------------------------- 스테이지 고르기

  private onLevelPressed(lv: number): void {
    if (this.busy()) return;
    if (!GameState.levelOpen(lv)) {
      this.toastLocked(lv);
      return;
    }
    this.openLevelPopup(lv);
  }

  /** 잠긴 스테이지를 눌렀을 때: 아직 안 연 가게의 스테이지면 가게를 사야 한다고 알려 주고 (살 수 있으면 그 자리에서 "가게 열기") */
  private toastLocked(lv: number): void {
    const shop = D.shopForLevel(lv);
    const sid = shop.id;
    const col = this.panelPopup(D.levelName(lv), Ui.SECONDARY);
    const lock = Ui.icon(Ui.ICON.lock, 84);
    lock.style.alignSelf = "center";
    col.appendChild(lock);
    col.appendChild(Ui.label(shop.name, 34, Ui.MUTED));
    if (GameState.shopOpened(sid)) {
      col.appendChild(Ui.label("앞 스테이지를 먼저 깨야 열려요.", 34, Ui.INK));
    } else if (GameState.canBuyShop(sid)) {
      const cost = D.shopOpenCost(sid);
      const enough = GameState.wallet >= cost;
      col.appendChild(Ui.label(`'${shop.name}'${D.josa(shop.name, "을", "를")} 열면 시작할 수 있어요.`, 32, Ui.INK, "center", true));
      const box = Ui.inset(16);
      box.classList.add("vbox");
      box.style.gap = "8px";
      box.appendChild(moneyRow("지갑", GameState.wallet, Ui.INK));
      box.appendChild(moneyRow("가게 값", cost, enough ? Ui.GOOD : Ui.BAD));
      col.appendChild(box);
      if (!enough) {
        const prev = D.SHOPS[Math.max(0, D.shopIndex(sid) - 1)];
        col.appendChild(Ui.label(`${D.formatWon(cost - GameState.wallet)} 더 필요해요 · ${prev.name} 무한 영업으로 모아요`, 27, Ui.BAD, "center", true));
      }
      const row = Ui.hbox(20);
      col.appendChild(row);
      const close = Ui.button("닫기", Ui.SECONDARY, 36, 110);
      close.style.minWidth = "200px";
      Ui.onPress(close, () => this.closePopup());
      row.appendChild(close);
      const buy = Ui.button(buyText(sid), enough ? Ui.GOOD : Ui.SECONDARY, 36, 110);
      buy.style.flex = "1 1 auto";
      buy.disabled = !enough;
      if (enough) Ui.lively(buy);
      Ui.onPress(buy, () => {
        this.closePopup();
        this.buyShop(sid);
      });
      row.appendChild(buy);
      return;
    } else {
      const prev = D.SHOPS[Math.max(0, D.shopIndex(sid) - 1)];
      const pn = D.levelName(prev.last_level);
      col.appendChild(Ui.label(`${pn}${D.josa(pn, "을", "를")} 깨면 돈을 모아 '${shop.name}'${D.josa(shop.name, "을", "를")} 열 수 있어요.`, 32, Ui.INK, "center", true));
    }
    const ok = Ui.button("확인", Ui.SECONDARY, 38, 110);
    Ui.onPress(ok, () => this.closePopup());
    col.appendChild(ok);
  }

  openLevelPopup(lv: number): void {
    const shop = D.shopForLevel(lv);
    const last = lv === shop.last_level;
    const col = this.panelPopup(D.levelName(lv), last ? rgb(0.8, 0.26, 0.52) : Ui.ACCENT);
    col.appendChild(Ui.label(last ? `${shop.name} · 마지막 스테이지!` : shop.name, 32, Ui.MUTED));
    col.appendChild(starRow(GameState.starsOf(lv), 420, 84, 34).el);
    const cfg = D.levelConfig(lv);
    const box = Ui.inset(16);
    box.classList.add("vbox");
    box.style.gap = "10px";
    box.appendChild(moneyRow("하루 할당량", cfg.target, Ui.INK));
    const mrow = Ui.hbox(12);
    mrow.style.alignItems = "center";
    const ml = Ui.label("메뉴", 32, Ui.INK, "left");
    ml.style.flex = "1 1 auto";
    mrow.append(ml, menuIcons(D.unlockedMenus(lv), D.menusUnlockedOn(lv)).el);
    box.appendChild(mrow);
    col.appendChild(box);
    const news: string[] = [];
    for (const m of D.menusUnlockedOn(lv)) news.push(`새 메뉴 ${D.menuName(m)}`);
    for (const t of D.customersUnlockedOn(lv)) news.push(`새 손님 ${D.CUSTOMERS[t].name}`);
    if (news.length > 0) col.appendChild(Ui.tag(news.join(" · "), Ui.GOOD, 28));
    // 새 메뉴 그림
    for (const m of D.menusUnlockedOn(lv)) {
      const pic = menuPic(m, 680, 120);
      pic.el.style.alignSelf = "center";
      col.appendChild(pic.el);
    }
    if (GameState.levelCleared(lv)) col.appendChild(Ui.label("이미 깬 스테이지예요. 다시 하면 별을 더 받을 수 있어요.", 25, Ui.MUTED, "center", true));
    col.appendChild(Ui.spacer(4));
    const row = Ui.hbox(20);
    col.appendChild(row);
    const close = Ui.button("닫기", Ui.SECONDARY, 36, 110);
    close.style.minWidth = "200px";
    Ui.onPress(close, () => this.closePopup());
    row.appendChild(close);
    const go = Ui.button("", Ui.ACCENT, 44, 110);
    Ui.withIcon(go, Ui.ICON.play, "영업 시작");
    Ui.lively(go);
    go.style.flex = "1 1 auto";
    Ui.onPress(go, () => this.startLevel(lv));
    row.appendChild(go);
  }

  /** 가운데 팝업 창 (위에 리본 제목) → 내용을 넣을 세로 상자 */
  private panelPopup(title: string, color = Ui.ACCENT): HTMLDivElement {
    this.closePopup();
    this.dragging = false;
    this.vel = 0.0;
    const ov = Ui.overlay(this.ui, 0.6);
    ov.classList.add("center");
    const p = Ui.popPanel(Ui.PAPER, 36, 40);
    p.style.width = "780px";
    p.style.marginTop = "50px";
    ov.appendChild(p);
    p.appendChild(Ui.ribbon(title, color, 46));
    const col = Ui.vbox(14);
    p.appendChild(col);
    this.popup = ov;
    return col;
  }

  private closePopup(): void {
    this.popup?.remove();
    this.popup = null;
  }

  private startLevel(lv: number): void {
    GameState.chooseLevel(lv);
    this.game.goto("shift");
  }

  private onEndlessPressed(sid: string): void {
    if (this.busy()) return;
    if (!GameState.shopCleared(sid)) {
      const shop = D.shopDef(sid);
      const col = this.panelPopup("무한 영업", Ui.AD);
      const lock = Ui.icon(Ui.ICON.lock, 84);
      lock.style.alignSelf = "center";
      col.appendChild(lock);
      col.appendChild(Ui.label(shop.name, 34, Ui.MUTED));
      const ln = D.levelName(shop.last_level);
      col.appendChild(Ui.label(`${ln}${D.josa(ln, "을", "를")} 깨면 열려요.`, 34, Ui.INK));
      const ok = Ui.button("확인", Ui.SECONDARY, 38, 110);
      Ui.onPress(ok, () => this.closePopup());
      col.appendChild(ok);
      return;
    }
    GameState.mode = "endless";
    GameState.endlessShop = sid;
    GameState.mapShop = sid;
    this.game.goto("shift");
  }

  // ---------------------------------------------------------------- 미식가 이벤트

  /** 잠김: 언제 열리는지 / 도전 가능: 설명 + 도전하기 / 다녀감: 받은 별·한줄평 */
  private onEventPressed(sid: string): void {
    if (this.busy()) return;
    const e = D.eventFor(sid);
    if (e === null) return;
    const shop = D.shopDef(sid);
    const col = this.panelPopup("미식가 방문", Ui.EVENT);
    const face = gourmetPortrait(150, GameState.eventPlayed(sid) || GameState.eventOpen(sid));
    face.el.style.alignSelf = "center";
    col.appendChild(face.el);
    if (GameState.eventPlayed(sid)) {
      const grade = GameState.eventGrade(sid);
      col.appendChild(starRow(grade, 420, 80, 36).el);
      col.appendChild(Ui.label(`"${D.GOURMET_REVIEWS[grade]}"`, 30, Ui.INK, "center", true));
      col.appendChild(Ui.label(`${shop.name}에 이미 다녀갔어요 · 보상 ${D.formatWon(D.eventReward(e, grade))}`, 27, Ui.MUTED, "center", true));
      const ok = Ui.button("확인", Ui.SECONDARY, 38, 110);
      Ui.onPress(ok, () => this.closePopup());
      col.appendChild(ok);
      return;
    }
    if (!GameState.eventOpen(sid)) {
      const ln = D.levelName(shop.last_level);
      col.appendChild(Ui.label(`${ln}${D.josa(ln, "을", "를")} 깨면 까다로운 미식가가\n${shop.name}에 찾아와요.`, 32, Ui.INK, "center", true));
      col.appendChild(Ui.label(`별 5개면 보상 ${D.formatWon(e.reward)} · 딱 한 번만 도전할 수 있어요`, 27, Ui.MUTED, "center", true));
      const ok = Ui.button("확인", Ui.SECONDARY, 38, 110);
      Ui.onPress(ok, () => this.closePopup());
      col.appendChild(ok);
      return;
    }
    col.appendChild(Ui.label(`${D.CUSTOMERS.gourmet.name}이 ${shop.name}에 찾아왔어요!`, 32, Ui.INK, "center", true));
    const box = Ui.inset(16);
    box.classList.add("vbox");
    box.style.gap = "6px";
    box.appendChild(Ui.row("주문", `${e.perRound}가지씩 코스 ${e.rounds}번`, 30));
    box.appendChild(Ui.row("평가", "완벽한 요리만 높은 점수", 30));
    box.appendChild(Ui.row("보상", `별 5개면 ${D.formatWon(e.reward)}`, 30, Ui.INK, Ui.EVENT));
    col.appendChild(box);
    col.appendChild(Ui.tag("딱 한 번만 도전할 수 있어요!", Ui.BAD, 28));
    const row = Ui.hbox(20);
    col.appendChild(row);
    const close = Ui.button("닫기", Ui.SECONDARY, 36, 110);
    close.style.minWidth = "200px";
    Ui.onPress(close, () => this.closePopup());
    row.appendChild(close);
    const go = Ui.button("", Ui.EVENT, 44, 110);
    Ui.withIcon(go, Ui.ICON.play, "도전하기");
    Ui.lively(go);
    go.style.flex = "1 1 auto";
    Ui.onPress(go, () => {
      GameState.chooseEvent(sid);
      this.game.goto("shift");
    });
    row.appendChild(go);
  }

  private goTitle(): void {
    this.game.goto("title");
  }

  /** 단골 도감 · 기록 창 (기록을 지우면 시작 화면으로) */
  private openBook(): void {
    if (this.busy()) return;
    this.closePopup();
    this.dragging = false;
    this.vel = 0.0;
    this.popup = openCollection(this.ui, {
      onClose: () => this.closePopup(),
      onReset: () => this.game.goto("title"),
    });
  }

  private goUpgrade(sid: string): void {
    if (this.busy()) return;
    GameState.mapShop = sid;
    this.game.goto("upgrade");
  }
}
