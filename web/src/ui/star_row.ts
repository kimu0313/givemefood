// 별점 표시 (게임 별: 먹선 테두리 + 금색). 5개 만점. pop = 별이 하나씩 통통 튀어나오며 켜짐 (정산 화면)

import { v } from "../engine/geom.ts";
import { CanvasWidget } from "../engine/game.ts";
import * as D from "../core/defs.ts";
import * as FoodArt from "../art/food_art.ts";

export function starRow(stars: number, w = 480, h = 100, starSize = 42.0, pop = false): CanvasWidget {
  const wd = new CanvasWidget(w, h, (g, t) => {
    const max = D.MAX_STARS;
    const gap = starSize * 2.2;
    for (let i = 0; i < max; i++) {
      const on = i < stars;
      let s = 1.0;
      if (pop && on) {
        // 0.25초 간격으로 하나씩: 커졌다가 제자리로
        const k = t - 0.35 - i * 0.25;
        if (k < 0) s = 0.0;
        else if (k < 0.3) s = 1.0 + Math.sin((k / 0.3) * Math.PI) * 0.45;
      }
      // 가운데 별을 살짝 크게, 양 끝은 살짝 아래로 (왕관처럼)
      const d = i - (max - 1) * 0.5;
      const c = v(w * 0.5 + d * gap, h * 0.5 + Math.abs(d) * starSize * 0.12);
      const r = starSize * (1.0 - Math.abs(d) * 0.06);
      if (pop && on && s === 0.0) FoodArt.gameStar(g, c, r, false);
      else FoodArt.gameStar(g, c, r * s, on);
    }
  });
  if (pop) wd.animated = true;
  wd.el.style.alignSelf = "center";
  return wd;
}
