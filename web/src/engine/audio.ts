// 소리: 음악 파일 없이 브라우저(Web Audio)에서 바로 만들어 낸다 (2026-11-16 사용자 "귀여운 식당과 어울리는 브금,
// 재료 버리는 소리, 음식 만드는 소리, 돈 받는 소리 등등 효과음").
//   BGM: 마림바·오르골 멜로디 + 우쿨렐레처럼 통통 튀는 화음 + 베이스 + 살랑이는 셰이커. 장면마다 곡이 다르다
//        (title·map = 느긋한 F장조, shift = 통통 튀는 C장조, settlement = 잔잔한 G장조, event = 살짝 긴장되는 A단조).
//   SFX: 튀김 지글지글, 보글보글, 칼질, 뒤집기, 그릇 달그락, 서빙, 동전, 완벽, 탐, 화남, 안 됨, 쓰레기통, 업그레이드, 버튼 …
//   비(rain): 비 오는 골목 포장마차에서 계속 들리는 빗소리 (다음 곡으로 바뀌면 멈춤).
// 브라우저는 사람이 한 번 누르기 전에는 소리를 못 내게 해서, 첫 클릭·키 입력 때 소리를 켜고 그때 곡을 시작한다.
// 소리 끄기는 저장 (localStorage "pocha_tycoon_sound" = "off"). 노드(테스트)에서는 아무것도 안 한다.

const SOUND_KEY = "pocha_tycoon_sound";

// ---------------------------------------------------------------- 곡 데이터

/** 음 이름 → MIDI 번호 ("C5", "F#4", "Bb3") */
function midi(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (m === null) return 60;
  const base: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let n = base[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  n += (Number(m[3]) + 1) * 12;
  return n;
}

function hz(n: number): number {
  return 440 * Math.pow(2, (n - 69) / 12);
}

/** 화음 이름 → 뿌리음 + 구성음 (반음) */
function chord(name: string): { root: number; tones: number[] } {
  const m = /^([A-G][#b]?)(m7|maj7|m|7)?$/.exec(name);
  const root = midi((m?.[1] ?? "C") + "3");
  const kind = m?.[2] ?? "";
  const tones = kind === "m" ? [0, 3, 7] : kind === "7" ? [0, 4, 7, 10] : kind === "m7" ? [0, 3, 7, 10] : kind === "maj7" ? [0, 4, 7, 11] : [0, 4, 7];
  return { root, tones };
}

interface Song {
  bpm: number;
  lead: "marimba" | "musicbox" | "pluck";
  chords: string[]; // 마디마다 화음
  melody: string[]; // 마디마다 8분음표 8개 ("C5", "." 쉼표, "-" 앞 음 늘임)
  drums: "bouncy" | "soft" | "none";
  leadVol: number;
}

const SONGS: Record<string, Song> = {
  // 영업: 통통 튀는 C장조 (오름 - 웃음 - 바쁨)
  shift: {
    bpm: 122,
    lead: "marimba",
    drums: "bouncy",
    leadVol: 0.5,
    chords: ["C", "Am", "F", "G", "C", "Am", "Dm", "G"],
    melody: [
      "E5 G5 C6 G5 A5 G5 E5 .",
      "C5 E5 A5 E5 G5 E5 C5 .",
      "F5 A5 C6 A5 D6 C6 A5 .",
      "G5 . B5 D6 B5 G5 D5 .",
      "E5 G5 C6 G5 E6 D6 C6 .",
      "A5 C6 E6 C6 B5 A5 E5 .",
      "D5 F5 A5 F5 G5 F5 D5 .",
      "B4 D5 G5 B5 D6 - C6 .",
    ],
  },
  // 시작·지도: 느긋한 F장조 오르골
  title: {
    bpm: 98,
    lead: "musicbox",
    drums: "soft",
    leadVol: 0.42,
    chords: ["F", "Dm", "Bb", "C", "F", "Dm", "Bb", "C7"],
    melody: [
      "C5 F5 A5 F5 G5 A5 F5 .",
      "D5 F5 A5 F5 E5 D5 A4 .",
      "D5 F5 Bb5 F5 A5 G5 F5 .",
      "E5 G5 C6 - Bb5 A5 G5 .",
      "A5 C6 F6 C6 A5 G5 F5 .",
      "F5 A5 D6 A5 F5 E5 D5 .",
      "Bb4 D5 F5 Bb5 A5 F5 D5 .",
      "C5 E5 G5 Bb5 A5 - G5 .",
    ],
  },
  // 정산: 잔잔한 G장조
  settlement: {
    bpm: 86,
    lead: "musicbox",
    drums: "none",
    leadVol: 0.4,
    chords: ["G", "Em", "C", "D", "G", "Em", "Am", "D"],
    melody: [
      "B4 D5 G5 D5 B4 - A4 .",
      "G4 B4 E5 B4 G4 - F#4 .",
      "E4 G4 C5 G4 E5 - D5 .",
      "F#4 A4 D5 F#5 A5 - D5 .",
      "B4 D5 G5 B5 D6 - B5 .",
      "G5 E5 B4 E5 G5 - F#5 .",
      "E5 C5 A4 C5 E5 - D5 .",
      "D5 F#5 A5 F#5 D5 - . .",
    ],
  },
  // 미식가 이벤트: 살짝 긴장되지만 귀여운 A단조
  event: {
    bpm: 116,
    lead: "pluck",
    drums: "bouncy",
    leadVol: 0.45,
    chords: ["Am", "F", "G", "E7", "Am", "F", "Dm", "E7"],
    melody: [
      "A4 C5 E5 A5 G5 E5 C5 E5",
      "F4 A4 C5 F5 E5 C5 A4 C5",
      "G4 B4 D5 G5 F5 D5 B4 D5",
      "E4 G#4 B4 E5 G#5 - E5 .",
      "A5 . E5 . C5 E5 A5 .",
      "F5 . C5 . A4 C5 F5 .",
      "D5 F5 A5 F5 E5 D5 C5 B4",
      "G#4 B4 E5 G#5 B5 - . .",
    ],
  },
};
SONGS.map = SONGS.title;

// ---------------------------------------------------------------- 재생기

class AudioHub {
  muted = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bgmBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private bgmId = "";
  private song: Song | null = null;
  private step = 0; // 16분음표 칸
  private nextTime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private rain: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private wantRain = false;
  private lastSfx: Record<string, number> = {};

  constructor() {
    if (typeof window === "undefined") return;
    try {
      this.muted = localStorage.getItem(SOUND_KEY) === "off";
    } catch {
      // 저장소를 못 쓰면 켠 채로
    }
    const unlock = () => this.unlock();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
  }

  /** 첫 입력 때 소리 켜기 (그 전에 고른 곡을 이때 시작) */
  private unlock(): void {
    if (typeof AudioContext === "undefined") return;
    if (this.ctx === null) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return;
      }
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      // 살짝 눌러 주는 컴프레서 (소리가 겹쳐도 깨지지 않게)
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp);
      comp.connect(c.destination);
      this.bgmBus = c.createGain();
      this.bgmBus.gain.value = 0.32;
      this.bgmBus.connect(this.master);
      this.sfxBus = c.createGain();
      this.sfxBus.gain.value = 0.7;
      this.sfxBus.connect(this.master);
      const len = c.sampleRate * 2;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    if (this.song !== null && this.timer === null) this.startSequencer();
    if (this.wantRain && this.rain === null) this.startRain();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    try {
      localStorage.setItem(SOUND_KEY, m ? "off" : "on");
    } catch {
      // 무시
    }
    if (this.master !== null && this.ctx !== null) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  // ---------------------------------------------------------------- BGM

  playBgm(id: string): void {
    if (id === this.bgmId) return;
    this.bgmId = id;
    this.stopRain();
    const next = SONGS[id] ?? null;
    if (next !== null && next === this.song) return; // 같은 곡이면 이어서 (시작 화면 → 지도)
    this.song = next;
    this.stopSequencer();
    if (this.song !== null && this.ctx !== null) this.startSequencer();
  }

  private startSequencer(): void {
    const c = this.ctx;
    if (c === null || this.song === null) return;
    this.step = 0;
    this.nextTime = c.currentTime + 0.12;
    // 앞을 조금씩 내다보며 음을 예약 (화면이 버벅여도 박자가 안 흔들리게)
    this.timer = setInterval(() => this.schedule(), 25);
  }

  private stopSequencer(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    const c = this.ctx;
    const s = this.song;
    if (c === null || s === null) return;
    const dt = 60 / s.bpm / 4; // 16분음표
    while (this.nextTime < c.currentTime + 0.15) {
      this.playStep(s, this.step, this.nextTime, dt);
      this.step = (this.step + 1) % (s.chords.length * 16);
      this.nextTime += dt;
    }
  }

  private playStep(s: Song, step: number, t: number, dt: number): void {
    const bar = Math.floor(step / 16);
    const k = step % 16; // 마디 안 16분음표
    const ch = chord(s.chords[bar]);
    // 멜로디: 8분음표 (짝수 칸)
    if (k % 2 === 0) {
      const notes = s.melody[bar].split(/\s+/);
      const e = k / 2;
      const n = notes[e] ?? ".";
      if (n !== "." && n !== "-") {
        let hold = 1;
        while (notes[e + hold] === "-") hold++;
        this.lead(s, midi(n), t, dt * 2 * hold);
      }
    }
    // 베이스: 박마다 뿌리음·5도 번갈아
    if (k % 4 === 0) {
      const beat = k / 4;
      const n = ch.root - 12 + (beat % 2 === 1 ? 7 : 0);
      this.bass(n, t, dt * 3);
    }
    // 우쿨렐레 같은 화음: 2·4박 뒤 엇박 (오 - 짠 - 오 - 짠)
    if (s.drums !== "none" && (k === 6 || k === 14)) this.strum(ch, t);
    if (s.drums === "none" && k === 0) this.pad(ch, t, dt * 16);
    // 북
    if (s.drums !== "none") {
      if (k === 0 || (s.drums === "bouncy" && k === 8)) this.kick(t, s.drums === "bouncy" ? 0.55 : 0.35);
      if (s.drums === "bouncy" && (k === 4 || k === 12)) this.clap(t);
      if (k % 2 === 0) this.shaker(t, k % 4 === 2 ? 0.09 : 0.05);
    }
  }

  // ---------------------------------------------------------------- 악기

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private osc(type: OscillatorType, freq: number, t: number, dur: number, peak: number, bus: AudioNode, attack = 0.005, detune = 0): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    const g = c.createGain();
    this.env(g, t, peak, attack, dur);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }

  private lead(s: Song, n: number, t: number, len: number): void {
    const bus = this.bgmBus!;
    const f = hz(n);
    const v = s.leadVol;
    if (s.lead === "marimba") {
      // 마림바: 사인 + 4배음이 빨리 사라짐
      this.osc("sine", f, t, Math.min(0.5, len + 0.1), v, bus);
      this.osc("sine", f * 4, t, 0.06, v * 0.25, bus);
    } else if (s.lead === "musicbox") {
      // 오르골: 맑은 사인 + 높은 배음, 길게 울림
      this.osc("sine", f, t, Math.min(0.9, len + 0.4), v, bus);
      this.osc("sine", f * 2, t, 0.25, v * 0.3, bus);
      this.osc("triangle", f * 3, t, 0.08, v * 0.12, bus);
    } else {
      // 뜯는 소리 (삼각파 + 짧은 사각파)
      this.osc("triangle", f, t, Math.min(0.35, len + 0.05), v, bus);
      this.osc("square", f, t, 0.04, v * 0.12, bus);
    }
  }

  private bass(n: number, t: number, len: number): void {
    this.osc("triangle", hz(n), t, Math.min(0.32, len), 0.5, this.bgmBus!, 0.008);
  }

  private strum(ch: { root: number; tones: number[] }, t: number): void {
    ch.tones.slice(0, 3).forEach((d, i) => {
      this.osc("triangle", hz(ch.root + 12 + d), t + i * 0.012, 0.13, 0.13, this.bgmBus!, 0.004);
    });
  }

  private pad(ch: { root: number; tones: number[] }, t: number, len: number): void {
    for (const d of ch.tones.slice(0, 3)) this.osc("sine", hz(ch.root + 12 + d), t, len * 0.9, 0.07, this.bgmBus!, 0.3);
  }

  private kick(t: number, vol: number): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = c.createGain();
    this.env(g, t, vol, 0.003, 0.16);
    o.connect(g);
    g.connect(this.bgmBus!);
    o.start(t);
    o.stop(t + 0.22);
  }

  /** 잡음 한 번 (필터 종류·주파수·길이) */
  private noise(t: number, dur: number, vol: number, type: BiquadFilterType, freq: number, bus: AudioNode, q = 1, attack = 0.002): void {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    this.env(g, t, vol, attack, dur);
    src.connect(f);
    f.connect(g);
    g.connect(bus);
    const off = Math.random() * 1.5;
    src.start(t, off);
    src.stop(t + attack + dur + 0.05);
  }

  private clap(t: number): void {
    this.noise(t, 0.09, 0.22, "bandpass", 1800, this.bgmBus!, 0.8);
  }

  private shaker(t: number, vol: number): void {
    this.noise(t, 0.04, vol, "highpass", 7000, this.bgmBus!);
  }

  // ---------------------------------------------------------------- 빗소리 (계속)

  private startRain(): void {
    const c = this.ctx;
    if (c === null || this.noiseBuf === null) return;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 2400;
    const g = c.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(0.09, c.currentTime, 0.6);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus!);
    src.start();
    this.rain = { src, gain: g };
  }

  private stopRain(): void {
    this.wantRain = false;
    if (this.rain !== null && this.ctx !== null) {
      const r = this.rain;
      r.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
      setTimeout(() => r.src.stop(), 900);
    }
    this.rain = null;
  }

  // ---------------------------------------------------------------- 효과음

  playSfx(id: string): void {
    if (id === "rain") {
      this.wantRain = true;
      if (this.ctx !== null && this.rain === null) this.startRain();
      return;
    }
    const c = this.ctx;
    if (c === null || this.muted) return;
    // 같은 소리가 한꺼번에 여러 번 겹치지 않게
    const now = c.currentTime;
    if (now - (this.lastSfx[id] ?? -1) < 0.04) return;
    this.lastSfx[id] = now;
    const t = now + 0.005;
    const bus = this.sfxBus!;
    switch (id) {
      case "click": // 버튼
        this.osc("sine", 880, t, 0.05, 0.25, bus);
        this.osc("sine", 1320, t + 0.02, 0.05, 0.15, bus);
        break;
      case "tap": // 작은 톡
        this.osc("sine", 660, t, 0.06, 0.3, bus);
        break;
      case "sizzle": // 튀김·굽기: 지글지글 (높은 잡음 + 타닥타닥)
        this.noise(t, 0.7, 0.28, "highpass", 3500, bus, 0.7, 0.03);
        for (let i = 0; i < 6; i++) this.noise(t + 0.05 + Math.random() * 0.55, 0.02, 0.25, "bandpass", 5000 + Math.random() * 3000, bus, 3);
        break;
      case "bubble": // 끓이기: 보글보글
        for (let i = 0; i < 4; i++) {
          const tt = t + i * 0.08 + Math.random() * 0.03;
          const o = c.createOscillator();
          o.type = "sine";
          const f0 = 300 + Math.random() * 250;
          o.frequency.setValueAtTime(f0, tt);
          o.frequency.exponentialRampToValueAtTime(f0 * 2.2, tt + 0.07);
          const g = c.createGain();
          this.env(g, tt, 0.22, 0.005, 0.07);
          o.connect(g);
          g.connect(bus);
          o.start(tt);
          o.stop(tt + 0.12);
        }
        break;
      case "chop": // 칼질: 탁 (짧은 잡음 + 낮은 쿵)
        this.noise(t, 0.05, 0.4, "bandpass", 2500, bus, 1.5);
        this.osc("sine", 180, t, 0.06, 0.35, bus);
        break;
      case "flip": // 뒤집기: 휙
        {
          const src = c.createBufferSource();
          src.buffer = this.noiseBuf;
          const f = c.createBiquadFilter();
          f.type = "bandpass";
          f.Q.value = 2;
          f.frequency.setValueAtTime(600, t);
          f.frequency.exponentialRampToValueAtTime(3000, t + 0.15);
          const g = c.createGain();
          this.env(g, t, 0.3, 0.02, 0.16);
          src.connect(f);
          f.connect(g);
          g.connect(bus);
          src.start(t, Math.random());
          src.stop(t + 0.25);
        }
        break;
      case "plate": // 그릇 달그락
        this.osc("sine", 2100, t, 0.12, 0.18, bus);
        this.osc("sine", 3150, t + 0.01, 0.08, 0.1, bus);
        this.osc("triangle", 1250, t, 0.05, 0.12, bus);
        break;
      case "serve": // 서빙: 슝 + 톡
        this.noise(t, 0.12, 0.12, "bandpass", 1500, bus, 1.2, 0.03);
        this.osc("sine", 520, t + 0.1, 0.08, 0.25, bus);
        this.osc("sine", 780, t + 0.15, 0.1, 0.2, bus);
        break;
      case "coin": // 돈 받기: 띠링!
        this.osc("square", hz(midi("B5")), t, 0.07, 0.12, bus);
        this.osc("square", hz(midi("E6")), t + 0.07, 0.28, 0.12, bus);
        this.osc("sine", hz(midi("E7")), t + 0.07, 0.2, 0.06, bus);
        break;
      case "perfect": // 완벽: 반짝 두 음
        this.osc("sine", hz(midi("C6")), t, 0.18, 0.28, bus);
        this.osc("sine", hz(midi("G6")), t + 0.08, 0.3, 0.26, bus);
        this.osc("triangle", hz(midi("C7")), t + 0.16, 0.25, 0.1, bus);
        break;
      case "burnt": // 탐: 치익 + 축 처지는 음
        this.noise(t, 0.35, 0.2, "lowpass", 900, bus, 0.7);
        {
          const o = c.createOscillator();
          o.type = "sawtooth";
          o.frequency.setValueAtTime(320, t);
          o.frequency.exponentialRampToValueAtTime(110, t + 0.4);
          const lp = c.createBiquadFilter();
          lp.type = "lowpass";
          lp.frequency.value = 900;
          const g = c.createGain();
          this.env(g, t, 0.16, 0.01, 0.4);
          o.connect(lp);
          lp.connect(g);
          g.connect(bus);
          o.start(t);
          o.stop(t + 0.5);
        }
        break;
      case "angry": // 화남: 흥!
        {
          const o = c.createOscillator();
          o.type = "square";
          o.frequency.setValueAtTime(260, t);
          o.frequency.exponentialRampToValueAtTime(150, t + 0.22);
          const lp = c.createBiquadFilter();
          lp.type = "lowpass";
          lp.frequency.value = 1200;
          const g = c.createGain();
          this.env(g, t, 0.16, 0.01, 0.24);
          o.connect(lp);
          lp.connect(g);
          g.connect(bus);
          o.start(t);
          o.stop(t + 0.3);
        }
        break;
      case "denied": // 안 됨: 뿌뿌
        this.osc("square", 220, t, 0.06, 0.1, bus);
        this.osc("square", 175, t + 0.09, 0.08, 0.1, bus);
        break;
      case "trash": // 쓰레기통: 털썩 + 바스락
        {
          const o = c.createOscillator();
          o.type = "sine";
          o.frequency.setValueAtTime(160, t);
          o.frequency.exponentialRampToValueAtTime(55, t + 0.18);
          const g = c.createGain();
          this.env(g, t, 0.45, 0.004, 0.2);
          o.connect(g);
          g.connect(bus);
          o.start(t);
          o.stop(t + 0.3);
        }
        for (let i = 0; i < 5; i++) this.noise(t + 0.04 + i * 0.035, 0.03, 0.18, "bandpass", 2000 + Math.random() * 2500, bus, 1.5);
        break;
      case "upgrade": // 업그레이드: 반짝 올라가는 아르페지오
        ["C5", "E5", "G5", "C6", "E6"].forEach((n, i) => this.osc("triangle", hz(midi(n)), t + i * 0.06, 0.2, 0.18, bus));
        this.osc("sine", hz(midi("G6")), t + 0.3, 0.4, 0.12, bus);
        break;
      case "fanfare": // 할당량 달성·클리어: 빰빠밤!
        ["C5", "E5", "G5"].forEach((n, i) => this.osc("square", hz(midi(n)), t + i * 0.09, 0.08, 0.1, bus));
        ["C6", "E6", "G6"].forEach((n) => this.osc("triangle", hz(midi(n)), t + 0.3, 0.5, 0.12, bus));
        this.osc("sine", hz(midi("C4")), t + 0.3, 0.5, 0.2, bus);
        break;
      case "magic": // 마법의 가루: 반짝반짝 올라가는 소리
        ["A5", "C#6", "E6", "A6", "C#7", "E7"].forEach((n, i) => {
          this.osc("sine", hz(midi(n)), t + i * 0.045, 0.3, 0.13, bus);
          this.osc("triangle", hz(midi(n)) * 2, t + i * 0.045, 0.08, 0.04, bus);
        });
        this.noise(t, 0.4, 0.06, "highpass", 8000, bus, 0.7, 0.05);
        break;
      case "open": // 가게 문 열기: 딸랑딸랑
        for (let i = 0; i < 4; i++) {
          this.osc("triangle", hz(midi(i % 2 === 0 ? "E6" : "G#6")), t + i * 0.09, 0.35, 0.16, bus);
          this.osc("sine", hz(midi(i % 2 === 0 ? "E7" : "G#7")), t + i * 0.09, 0.12, 0.05, bus);
        }
        break;
      case "shutter": // 셔터 내림: 드르륵
        for (let i = 0; i < 10; i++) this.noise(t + i * 0.045, 0.03, 0.16, "bandpass", 900 + i * 40, bus, 2);
        this.osc("sine", 90, t + 0.46, 0.15, 0.3, bus);
        break;
    }
  }
}

export const Sound = new AudioHub();
