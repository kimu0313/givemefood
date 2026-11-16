// 손가락을 따라다니는 드래그 중인 물건 (그릇 / 조리 중 음식 / 도마 위 음식)

import { rgb, v } from "../engine/geom.ts";
import type { Gfx } from "../engine/gfx.ts";
import { Node2D } from "../engine/node.ts";
import type { CookItem } from "../core/cook_item.ts";
import type { Cutting } from "../core/shift_session.ts";
import * as FoodArt from "../art/food_art.ts";
import { drawCookItem } from "./station_view.ts";
import { drawBoardFood } from "./kitchen_view.ts";

export class DragGhost extends Node2D {
  kind = "";
  menu = "";
  quality = 0;
  item: CookItem | null = null;
  cutting: Cutting | null = null;

  showBowl(menu: string, quality: number): void {
    this.kind = "bowl";
    this.menu = menu;
    this.quality = quality;
  }

  showItem(item: CookItem): void {
    this.kind = "item";
    this.item = item;
  }

  showBoard(cutting: Cutting): void {
    this.kind = "board";
    this.cutting = { ...cutting };
  }

  clear(): void {
    this.kind = "";
    this.item = null;
    this.visible = false;
  }

  draw(g: Gfx): void {
    g.circle(v(0, 40), 70.0, rgb(0, 0, 0, 0.18));
    switch (this.kind) {
      case "bowl":
        FoodArt.drawBowl(g, this.menu, v(0, -20), 1.05, this.quality);
        break;
      case "item":
        if (this.item !== null) drawCookItem(g, this.item, v(0, -20), 0.8);
        break;
      case "board": {
        const m = this.cutting?.menu ?? "sundae";
        const col = FoodArt.qualityColor(m, this.cutting?.quality ?? 0);
        drawBoardFood(g, m, this.cutting?.taps ?? 0, v(0, -20), 0.8, col);
        break;
      }
    }
  }
}
