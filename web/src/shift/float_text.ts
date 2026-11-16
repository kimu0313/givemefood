// 위로 떠오르며 사라지는 글자 (+3,000원, 완벽!, 탔어요! 등)

import { Color, V, WHITE, rgb, v } from "../engine/geom.ts";
import type { Gfx } from "../engine/gfx.ts";
import { Node2D } from "../engine/node.ts";
import * as FoodArt from "../art/food_art.ts";

export class FloatText extends Node2D {
  text = "";
  color: Color = WHITE;
  fontSize = 40;

  static spawn(parent: Node2D, pos: V, text: string, color: Color, size = 40, delay = 0.0): void {
    const f = new FloatText();
    f.text = text;
    f.color = color;
    f.fontSize = size;
    f.position = pos;
    f.z = 40;
    parent.add(f);
    f.alpha = delay > 0.0 ? 0.0 : 1.0;
    const tw = f.createTween();
    if (delay > 0.0) {
      tw.interval(delay);
      tw.prop(f, "modulate:a", 1.0, 0.05);
    }
    tw.prop(f, "position:y", pos.y - 110.0, 0.9).setEase("out").setTrans("cubic");
    tw.parallel().prop(f, "modulate:a", 0.0, 0.35).setDelay(0.6);
    tw.call(() => f.queueFree());
  }

  draw(g: Gfx): void {
    FoodArt.textOutlined(g, this.text, v(), this.fontSize, this.color, rgb(0, 0, 0, 0.75), 8, 600.0);
  }
}
