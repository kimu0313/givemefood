// Godot 4 RandomNumberGenerator 와 같은 결과를 내는 PCG32 (같은 시드 → 같은 수열).
// 봇 밸런스 리포트·배경 그림(건물·나무 배치)이 Godot 판과 똑같이 나오게 한다.

const MASK64 = (1n << 64n) - 1n;
const MULT = 6364136223846793005n;
const DEFAULT_INC = 1442695040888963407n;

function clz32(x: number): number {
  return Math.clz32(x);
}

export class Rng {
  private state = 0n;
  private inc = ((DEFAULT_INC << 1n) | 1n) & MASK64;

  constructor(seed?: number | bigint) {
    if (seed === undefined) this.randomize();
    else this.seed = seed;
  }

  set seed(s: number | bigint) {
    const sv = BigInt.asUintN(64, typeof s === "bigint" ? s : BigInt(Math.trunc(s)));
    this.state = 0n;
    this.inc = ((DEFAULT_INC << 1n) | 1n) & MASK64;
    this.next();
    this.state = (this.state + sv) & MASK64;
    this.next();
  }

  randomize(): void {
    const hi = Math.floor(Math.random() * 0x100000000);
    const lo = Math.floor(Math.random() * 0x100000000);
    this.seed = (BigInt(hi) << 32n) | BigInt(lo);
  }

  /** 32비트 부호 없는 정수 */
  next(): number {
    const old = this.state;
    this.state = (old * MULT + this.inc) & MASK64;
    const xorshifted = Number((((old >> 18n) ^ old) >> 27n) & 0xffffffffn);
    const rot = Number(old >> 59n);
    return ((xorshifted >>> rot) | (xorshifted << ((-rot) & 31))) >>> 0;
  }

  randi(): number {
    return this.next();
  }

  private bounded(bounds: number): number {
    const threshold = ((0x100000000 - bounds) >>> 0) % bounds;
    for (;;) {
      const r = this.next();
      if (r >= threshold) return r % bounds;
    }
  }

  /** [0, 1] float (Godot 4 RandomPCG::randf) */
  randf(): number {
    const proto = this.next();
    if (proto === 0) return 0;
    const sig = Math.fround(((this.next() | 0x80000001) >>> 0));
    return Math.fround(sig * Math.pow(2, -32 - clz32(proto)));
  }

  randfRange(from: number, to: number): number {
    const f = Math.fround(from);
    return Math.fround(Math.fround(this.randf() * Math.fround(Math.fround(to) - f)) + f);
  }

  randiRange(from: number, to: number): number {
    if (from === to) return from;
    const bounds = Math.abs(from - to) + 1;
    return this.bounded(bounds) + Math.min(from, to);
  }
}

/** 시드 없는 전역 랜덤 (Godot randi() / randf()) */
export function randi(): number {
  return Math.floor(Math.random() * 0x100000000);
}

export function randf(): number {
  return Math.random();
}

export function randfRange(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

/** Godot String.hash() (djb2) */
export function strHash(s: string): number {
  let h = 5381;
  for (const ch of s) {
    h = (((h << 5) + h) >>> 0) + (ch.codePointAt(0) ?? 0);
    h >>>= 0;
  }
  return h >>> 0;
}
