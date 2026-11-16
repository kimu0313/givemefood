// 새 가게 오픈: 지도에서 모은 돈으로 새 가게를 사면 한 번 나온다.
// 새 가게 배경 + 소개 + 이 가게에서 나올 메뉴 4개 → 새 가게 스테이지 지도로

import { R, rgb, v } from "../engine/geom.ts";
import { CanvasWidget, Scene } from "../engine/game.ts";
import { Node2D } from "../engine/node.ts";
import { DISPLAY, type Gfx } from "../engine/gfx.ts";
import { Sound } from "../engine/audio.ts";
import * as Ui from "../engine/ui.ts";
import * as D from "../core/defs.ts";
import { GameState } from "../state/game_state.ts";
import { StreetArt } from "../art/street_art.ts";
import * as FoodArt from "../art/food_art.ts";

/** 그릇에 담긴 메뉴 + 이름 + 나오는 날 */
function menuCard(menu: string, w: number, h: number): CanvasWidget {
  return new CanvasWidget(w, h, (g, t) => {
    FoodArt.setClock(t);
    const c = v(w * 0.5, 62.0);
    FoodArt.drawBowl(g, menu, c, 0.72, D.Q.PERFECT);
    FoodArt.text(g, D.menuName(menu), v(w * 0.5, 134.0), 30, Ui.INK, w, DISPLAY);
    FoodArt.text(g, `${D.levelName(D.menuUnlockLevel(menu))} · ${D.formatWon(D.menuPrice(menu))}`, v(w * 0.5, 170.0), 23, Ui.MUTED, w);
  });
}

class Dim extends Node2D {
  size = v(1920, 1080);
  draw(g: Gfx): void {
    g.rect(new R(0, 0, this.size.x, this.size.y), rgb(0.06, 0.03, 0.02, 0.55));
  }
}

export class StageOpenScene extends Scene {
  private shopId = "pocha";

  ready(): void {
    const sid = GameState.justOpened !== "" ? GameState.justOpened : GameState.frontierShopId();
    this.shopId = sid;
    const shop = D.shopDef(sid);
    const vs = v(this.vw, this.vh);

    const art = new StreetArt();
    art.size = vs;
    art.awningY = 0.0;
    art.awningH = 60.0;
    art.counterY = vs.y;
    art.theme = shop.theme;
    for (const m of shop.menus) art.menuNames.push(D.menuName(m));
    this.add(art);
    const dim = new Dim();
    dim.size = vs;
    this.add(dim);

    const m = Ui.screenMargin(this.ui, 70, 60, 120);
    const center = Ui.center();
    m.appendChild(center);
    const p = Ui.popPanel(Ui.PAPER, 40, 36);
    p.style.width = "1400px";
    p.style.marginTop = "40px";
    center.appendChild(p);
    p.appendChild(Ui.ribbon("새 가게 오픈!", rgb(0.85, 0.28, 0.5), 50));
    const col = Ui.vbox(12);
    p.appendChild(col);

    const stageNo = D.shopIndex(sid) + 1;
    col.appendChild(Ui.heading(shop.name, 72, Ui.ACCENT, Ui.INK));
    col.appendChild(Ui.label(`${stageNo}번째 가게 · 스테이지 ${shop.first_level}~${shop.last_level} · ${shop.desc}`, 28, Ui.MUTED, "center", true));

    const menus = Ui.hbox(14);
    col.appendChild(menus);
    const cw = (1400 - 84 - 14 * (shop.menus.length - 1)) / shop.menus.length;
    for (const mid of shop.menus) {
      const cell = Ui.inset(4);
      cell.style.flex = "1 1 0";
      const card = menuCard(mid, cw - 26, 196);
      cell.appendChild(card.el);
      menus.appendChild(cell);
    }

    col.appendChild(Ui.label("조리도구: " + D.shopToolsText(shop), 29, Ui.INK));
    col.appendChild(Ui.label(`새 가게라 장비(화구·화력·${shop.comfort})는 처음부터 다시 갖춰요. 지갑은 그대로 가져가요. 지도의 업그레이드 버튼에서 준비하세요.`, 25, Ui.MUTED, "center", true));
    col.appendChild(Ui.spacer(2));
    const go = Ui.button("", Ui.ACCENT, 46, 116);
    Ui.withIcon(go, Ui.ICON.play, "새 가게 지도 보기");
    Ui.lively(go);
    go.style.alignSelf = "center";
    go.style.width = "640px";
    Ui.onPress(go, () => this.onGo());
    col.appendChild(go);
    Sound.playBgm("settlement");
  }

  private onGo(): void {
    GameState.mapShop = this.shopId;
    GameState.justOpened = "";
    this.game.goto("map");
  }

  onBack(): void {
    this.onGo();
  }
}
