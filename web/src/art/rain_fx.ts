// 빗줄기. area 안에만 내린다.

import { R, rgb, v } from "../engine/geom.ts";
import type { Gfx } from "../engine/gfx.ts";
import { Node2D } from "../engine/node.ts";
import { Rng, randf, randfRange } from "../engine/rng.ts";

export class RainFx extends Node2D {
  area = new R(0, 0, 1080, 1920);
  count = 140;
  color = rgb(0.75, 0.82, 1.0, 0.32);
  private drops: { x: number; y: number; z: number }[] = [];

  enterTree(): void {
    const rng = new Rng(1234);
    for (let i = 0; i < this.count; i++) {
      this.drops.push({
        x: rng.randfRange(this.area.x, this.area.endX + 80.0),
        y: rng.randfRange(this.area.y, this.area.endY),
        z: rng.randfRange(900.0, 1400.0),
      });
    }
  }

  process(dt: number): void {
    for (const d of this.drops) {
      d.y += d.z * dt;
      d.x -= d.z * 0.12 * dt;
      if (d.y > this.area.endY) {
        d.y = this.area.y - randf() * 80.0;
        d.x = randfRange(this.area.x, this.area.endX + 80.0);
      }
    }
  }

  draw(g: Gfx): void {
    const ctx = g.ctx;
    ctx.beginPath();
    for (const d of this.drops) {
      if (d.y < this.area.y) continue;
      const l = d.z * 0.032;
      const top = Math.max(this.area.y, d.y - l);
      ctx.moveTo(d.x + (d.y - top) * 0.12, top);
      ctx.lineTo(d.x, d.y);
    }
    ctx.strokeStyle = this.color.css();
    ctx.lineWidth = 2.0;
    ctx.lineCap = "butt";
    ctx.stroke();
    void v;
  }
}
