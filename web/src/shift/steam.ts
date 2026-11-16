// 김 (Godot CPUParticles2D 를 단순하게): 위로 올라가며 커지고 흐려지는 흰 연기 알갱이.

import { Color, V, WHITE, v } from "../engine/geom.ts";
import type { Gfx } from "../engine/gfx.ts";
import { Node2D } from "../engine/node.ts";

let puffSprite: HTMLCanvasElement | null = null;

function puff(): HTMLCanvasElement {
  if (puffSprite === null) {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext("2d")!;
    const gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 64, 64);
    puffSprite = c;
  }
  return puffSprite;
}

let darkSprite: HTMLCanvasElement | null = null;

function darkPuff(): HTMLCanvasElement {
  if (darkSprite === null) {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(puff(), 0, 0);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = "rgb(89,84,82)";
    ctx.fillRect(0, 0, 64, 64);
    darkSprite = c;
  }
  return darkSprite;
}

interface Puff {
  p: V;
  vel: V;
  age: number;
  scale: number;
}

export class Steam extends Node2D {
  amount = 10;
  lifetime = 1.4;
  extents = v(30, 6);
  emitting = false;
  color: Color = WHITE;
  private puffs: Puff[] = [];
  private acc = 0;

  process(dt: number): void {
    for (const p of this.puffs) {
      p.age += dt;
      p.vel = p.vel.add(v(0, -30 * dt));
      p.p = p.p.add(p.vel.mul(dt));
    }
    this.puffs = this.puffs.filter((p) => p.age < this.lifetime);
    if (!this.emitting) {
      this.acc = 0;
      return;
    }
    this.acc += (dt * this.amount) / this.lifetime;
    while (this.acc >= 1) {
      this.acc -= 1;
      const spread = ((Math.random() * 2 - 1) * 18 * Math.PI) / 180;
      const speed = 40 + Math.random() * 40;
      this.puffs.push({
        p: v((Math.random() * 2 - 1) * this.extents.x, (Math.random() * 2 - 1) * this.extents.y),
        vel: v(Math.sin(spread) * speed, -Math.cos(spread) * speed),
        age: 0,
        scale: 0.5 + Math.random() * 0.6,
      });
    }
  }

  draw(g: Gfx): void {
    if (this.puffs.length === 0) return;
    const img = this.color.r < 0.5 ? darkPuff() : puff();
    const ctx = g.ctx;
    const base = ctx.globalAlpha;
    for (const p of this.puffs) {
      const a = 0.42 * (1 - p.age / this.lifetime);
      if (a <= 0) continue;
      const s = 64 * p.scale;
      ctx.globalAlpha = base * a;
      ctx.drawImage(img, p.p.x - s * 0.5, p.p.y - s * 0.5, s, s);
    }
    ctx.globalAlpha = base;
  }
}
