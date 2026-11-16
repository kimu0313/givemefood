// 사운드 훅. 파일이 없으면 조용히 넘어간다.
// public/assets/audio/ 아래에 파일을 넣고 아래 목록에 이름(확장자 포함)을 적으면 바로 재생된다:
//   BGM: assets/audio/bgm/{title,shift,settlement}.ogg|mp3
//   SFX: assets/audio/sfx/{sizzle,flip,bubble,perfect,burnt,coin,angry,rain,chop,tap,denied}.ogg|mp3

const SFX_FILES: string[] = []; // 예: "coin.mp3"
const BGM_FILES: string[] = []; // 예: "title.mp3"

const SFX_DIR = "assets/audio/sfx/";
const BGM_DIR = "assets/audio/bgm/";

function find(list: string[], id: string): string | null {
  const f = list.find((n) => n.replace(/\.[^.]+$/, "") === id);
  return f ?? null;
}

class AudioHub {
  private bgm: HTMLAudioElement | null = null;
  private bgmId = "";
  muted = false;

  playSfx(id: string): void {
    if (this.muted || typeof Audio === "undefined") return;
    const f = find(SFX_FILES, id);
    if (f === null) return;
    const a = new Audio(SFX_DIR + f);
    void a.play().catch(() => {});
  }

  playBgm(id: string): void {
    if (id === this.bgmId) return;
    this.bgmId = id;
    if (this.bgm) {
      this.bgm.pause();
      this.bgm = null;
    }
    if (this.muted || typeof Audio === "undefined") return;
    const f = find(BGM_FILES, id);
    if (f === null) return;
    const a = new Audio(BGM_DIR + f);
    a.loop = true;
    a.volume = 0.5;
    this.bgm = a;
    void a.play().catch(() => {});
  }
}

export const Sound = new AudioHub();
