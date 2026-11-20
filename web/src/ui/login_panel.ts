// 로그인 (2026-11-16 사용자가 준 그림 두 장: 메인 화면 왼쪽 위 "👤 로그인" 나무판 + 누르면 뜨는 로그인 창).
// 그림은 tools/cutout_slate.mjs 로 회색 배경을 오려 낸 것 (원본 art_src/ui_login_button.png · ui_login_panel.png).
// 로그인 창 그림(LOGIN_W×LOGIN_H) 위 그려진 자리에 진짜 입력 칸·체크·버튼을 얹는다 (자리 = 그림 픽셀, P 아래).
//   아이디 / 비밀번호 칸 (그림의 흐린 "입력" 글씨는 칸 색으로 덮고 진짜 placeholder) · 자동 로그인 체크 · 아이디/비밀번호 찾기
//   로그인(빨간 판) · 회원가입(크림 판) — 회원가입을 누르면 같은 창이 가입 모드가 된다 (제목·버튼 글씨를 덮어 바꿈).
// 계정은 서버 없이 이 기기 안에만 (GameState.signUp / login / resetPassword).

import { Sound } from "../engine/audio.ts";
import * as Ui from "../engine/ui.ts";
import { GameState, NAME_MAX, PW_MIN } from "../state/game_state.ts";
import { getLang, tr } from "../i18n/i18n.ts";

const PANEL_SRC = "assets/art/ui/login_panel.webp";
const PLANK_SRC = "assets/art/ui/login_button.webp";
const LOGIN_W = 969;
const LOGIN_H = 1264;
const PLANK_W = 428;
const PLANK_H = 134;

/** 로그인 창 그림 속 자리 [x0, y0, x1, y1] (그림 픽셀) */
const P = {
  title: [290, 118, 655, 258] as const, // 빨간 제목 판의 "로그인" 글씨
  id: [232, 393, 848, 480] as const, // 아이디 칸 (사람 아이콘 오른쪽)
  pw: [232, 543, 848, 628] as const, // 비밀번호 칸 (자물쇠 오른쪽)
  check: [112, 668, 384, 734] as const, // 자동 로그인 (네모 + 글씨)
  box: [120, 680, 168, 722] as const, // 체크 네모
  checkText: [186, 672, 380, 728] as const,
  find: [528, 668, 862, 734] as const, // 아이디 / 비밀번호 찾기
  error: [116, 736, 862, 786] as const, // 알림 줄 (그림엔 빈 종이)
  row: [104, 660, 872, 740] as const, // 가입 모드에선 체크·찾기 줄을 종이로 덮고 안내
  ok: [118, 788, 865, 940] as const, // 빨간 로그인 판
  okText: [360, 806, 628, 910] as const,
  alt: [162, 980, 822, 1110] as const, // 크림 회원가입 판
  altText: [350, 1000, 632, 1090] as const,
};
const COLOR = {
  titleRed: "rgb(150, 66, 48)",
  red: "rgb(170, 74, 55)",
  cream: "rgb(220, 169, 121)",
  field: "rgb(223, 182, 143)",
  paper: "rgb(224, 178, 136)",
  plank: "rgb(239, 206, 177)", // 로그인 버튼 나무판 (2026-11-18 밝힘, tools/title_ui_art.mjs)
  ink: "#2e1d14",
  light: "#fbecd2",
};

const CSS = `
.login-plank { position: absolute; pointer-events: auto; cursor: pointer; padding: 0; border: 0; background: transparent; outline: none;
  transition: transform 0.08s, filter 0.12s; filter: drop-shadow(0 6px 0 rgba(0,0,0,0.35)); }
.login-plank:hover, .login-plank:focus-visible { filter: drop-shadow(0 6px 0 rgba(0,0,0,0.35)) drop-shadow(0 0 14px rgba(255, 200, 100, 0.9)) brightness(1.06); }
.login-plank:active { transform: translateY(4px) scale(0.98); }
.login-plank img, .login-panel img.art { display: block; width: 100%; height: 100%; pointer-events: none; user-select: none; -webkit-user-drag: none; }
.login-cover { position: absolute; pointer-events: none; display: flex; align-items: center; justify-content: center; white-space: nowrap; overflow: hidden;
  border-radius: 10px; font-family: var(--lang-fonts, "Jua"), "Malgun Gothic", sans-serif; }
.login-panel { position: absolute; pointer-events: auto; }
.login-input { position: absolute; box-sizing: border-box; border: 0; outline: none; padding: 0 14px; border-radius: 8px; pointer-events: auto;
  font-family: var(--lang-fonts, "Jua"), "Malgun Gothic", sans-serif; color: ${COLOR.ink}; background: ${COLOR.field}; }
.login-input::placeholder { color: rgba(80, 55, 38, 0.55); }
.login-input:focus { box-shadow: inset 0 0 0 3px rgba(170, 74, 55, 0.55); }
.login-hot { position: absolute; pointer-events: auto; cursor: pointer; background: transparent; border: 0; padding: 0; border-radius: 12px; outline: none;
  transition: background 0.1s, box-shadow 0.1s, transform 0.08s; }
.login-hot:hover, .login-hot:focus-visible { background: rgba(255, 240, 200, 0.16); box-shadow: 0 0 0 4px rgba(255, 210, 120, 0.85), 0 0 22px rgba(255, 180, 70, 0.6); }
.login-hot:active { background: rgba(40, 20, 8, 0.16); transform: scale(0.985); }
.login-hot.link:hover { box-shadow: none; background: rgba(255, 240, 200, 0.25); }
.login-error { position: absolute; pointer-events: none; display: flex; align-items: center; justify-content: center; text-align: center; color: #a3241a;
  font-family: var(--lang-fonts, "Jua"), "Malgun Gothic", sans-serif; line-height: 1.1; }
.login-x { position: absolute; pointer-events: auto; cursor: pointer; border-radius: 50%; border: 5px solid #2e1d14; background: #fbecd2; color: #2e1d14;
  font-family: "Jua", sans-serif; display: flex; align-items: center; justify-content: center; box-shadow: 0 5px 0 rgba(0,0,0,0.35); }
.login-x:active { transform: translateY(3px); }
`;
let cssAdded = false;
function addCss(): void {
  if (cssAdded || typeof document === "undefined") return;
  cssAdded = true;
  const s = document.createElement("style");
  s.textContent = CSS;
  document.head.appendChild(s);
}

type Rect = readonly [number, number, number, number];

/** 그림 픽셀 자리 → 그림을 k 배로 그렸을 때의 CSS 자리 */
function place(el: HTMLElement, r: Rect, k: number): void {
  Object.assign(el.style, { left: `${r[0] * k}px`, top: `${r[1] * k}px`, width: `${(r[2] - r[0]) * k}px`, height: `${(r[3] - r[1]) * k}px` });
}

/** 그림 속 글씨를 같은 색 판으로 덮고 새 글씨 */
function cover(r: Rect, k: number, bg: string, ink: string, text: string, size: number): HTMLDivElement {
  const c = Ui.div("login-cover");
  place(c, r, k);
  Object.assign(c.style, { background: bg, boxShadow: `0 0 6px 5px ${bg}`, color: ink, fontSize: `${size}px` });
  c.textContent = text;
  return c;
}

/**
 * 메인 화면 왼쪽 위 "👤 로그인" 나무판 (width = 화면에서의 너비). 로그인했으면 글씨 자리에 아이디.
 * 한국어가 아니면 글씨를 덮어 번역 ("Log in").
 */
export function loginPlank(width: number, onPress: () => void): HTMLButtonElement {
  addCss();
  const k = width / PLANK_W;
  const b = document.createElement("button");
  b.className = "login-plank";
  b.style.width = `${width}px`;
  b.style.height = `${PLANK_H * k}px`;
  const img = document.createElement("img");
  img.src = PLANK_SRC;
  img.alt = "";
  b.appendChild(img);
  const name = GameState.account;
  b.setAttribute("aria-label", name !== "" ? "계정" : "로그인");
  if (name !== "" || getLang() !== "ko") {
    const c = cover([176, 26, 392, 110], k, COLOR.plank, COLOR.ink, name !== "" ? name : "로그인", Math.round(46 * k * (name.length > 5 ? 0.8 : 1)));
    if (name !== "") c.dataset.notr = "1"; // 아이디는 번역하지 않음
    b.appendChild(c);
  }
  Ui.onPress(b, onPress);
  return b;
}

/**
 * 로그인 창 (화면을 어둡게 덮고 가운데). onDone = 로그인·가입 성공 (화면 다시 그리기), onClose = 그냥 닫음.
 * 돌려준 덮개를 지우면 닫힌다.
 */
export function openLoginPanel(parent: HTMLElement, vw: number, vh: number, onDone: () => void, onClose: () => void): HTMLDivElement {
  addCss();
  const ov = Ui.overlay(parent, 0.62);
  const H = Math.min(vh - 80, 960);
  const k = H / LOGIN_H;
  const W = LOGIN_W * k;
  const panel = Ui.div("login-panel");
  Object.assign(panel.style, { left: `${(vw - W) * 0.5}px`, top: `${(vh - H) * 0.5}px`, width: `${W}px`, height: `${H}px` });
  ov.appendChild(panel);
  // 바깥(어두운 곳)을 누르면 닫힘
  ov.addEventListener("pointerdown", (e) => {
    if (e.target === ov) onClose();
  });
  const art = document.createElement("img");
  art.className = "art";
  art.src = PANEL_SRC;
  art.alt = "";
  panel.appendChild(art);

  let mode: "login" | "signup" = "login";
  let auto = GameState.autoLogin;
  const layer = Ui.div(); // 모드마다 바뀌는 덮개들
  Object.assign(layer.style, { position: "absolute", inset: "0", pointerEvents: "none" });
  panel.appendChild(layer);

  const fs = (r: Rect, f = 0.5): number => Math.round((r[3] - r[1]) * k * f);
  const input = (r: Rect, type: string): HTMLInputElement => {
    const i = document.createElement("input");
    i.className = "login-input";
    i.type = type;
    i.autocomplete = "off";
    i.spellcheck = false;
    place(i, r, k);
    i.style.fontSize = `${fs(r, 0.46)}px`;
    i.addEventListener("pointerdown", (e) => e.stopPropagation());
    i.addEventListener("keydown", (e) => {
      e.stopPropagation(); // 게임 단축키(뒤로 가기 등)로 새지 않게
      if (e.key === "Enter") submit();
      if (e.key === "Escape") onClose();
    });
    panel.appendChild(i);
    return i;
  };
  const idIn = input(P.id, "text");
  idIn.maxLength = NAME_MAX + 4;
  idIn.value = GameState.lastAccount;
  const pwIn = input(P.pw, "password");
  pwIn.maxLength = 24;

  const err = Ui.div("login-error");
  place(err, P.error, k);
  err.style.fontSize = `${fs(P.error, 0.68)}px`;
  panel.appendChild(err);
  const showError = (text: string, good = false): void => {
    err.textContent = text;
    err.style.color = good ? "#2f6b2a" : "#a3241a";
    if (text !== "" && !good) Sound.playSfx("denied");
  };

  const hot = (r: Rect, label: string, fn: () => void, cls = ""): HTMLButtonElement => {
    const b = document.createElement("button");
    b.className = `login-hot ${cls}`;
    b.setAttribute("aria-label", label);
    place(b, r, k);
    Ui.onPress(b, fn);
    panel.appendChild(b);
    return b;
  };
  // 자동 로그인 체크 (그림 네모 위에 체크 표시)
  const tick = Ui.div();
  place(tick, P.box, k);
  Object.assign(tick.style, { position: "absolute", pointerEvents: "none" });
  tick.innerHTML = `<svg viewBox="0 0 48 42" width="100%" height="100%"><path d="M8 22 L20 34 L44 4" fill="none" stroke="#a3241a" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  panel.appendChild(tick);
  const checkBtn = hot(P.check, "자동 로그인", () => {
    auto = !auto;
    tick.style.visibility = auto ? "visible" : "hidden";
  }, "link");
  const findBtn = hot(P.find, "아이디 / 비밀번호 찾기", () => openFind(), "link");
  hot(P.ok, "로그인", () => submit());
  hot(P.alt, "회원가입", () => setMode(mode === "login" ? "signup" : "login"));

  // 닫기 (오른쪽 위 동그란 X)
  const x = document.createElement("button");
  x.className = "login-x";
  const xs = Math.round(78 * k * 1.2);
  Object.assign(x.style, { width: `${xs}px`, height: `${xs}px`, right: `${-xs * 0.25}px`, top: `${110 * k}px`, fontSize: `${xs * 0.5}px` });
  x.textContent = "✕";
  x.setAttribute("aria-label", "닫기");
  Ui.onPress(x, onClose);
  panel.appendChild(x);

  const setMode = (m: "login" | "signup"): void => {
    mode = m;
    layer.replaceChildren();
    showError("");
    const ko = getLang() === "ko";
    const signup = m === "signup";
    idIn.placeholder = tr(signup ? `아이디 (2~${NAME_MAX}글자)` : "아이디 입력");
    pwIn.placeholder = tr(signup ? `비밀번호 (${PW_MIN}글자 이상)` : "비밀번호 입력");
    tick.style.visibility = !signup && auto ? "visible" : "hidden";
    checkBtn.style.display = signup ? "none" : "";
    findBtn.style.display = signup ? "none" : "";
    if (signup) {
      layer.appendChild(cover(P.title, k, COLOR.titleRed, COLOR.light, "회원가입", fs(P.title, 0.62)));
      const note = cover(P.row, k, COLOR.paper, "#6b4a36", "아이디와 비밀번호는 이 기기에만 저장돼요", fs(P.row, 0.4));
      layer.appendChild(note);
      layer.appendChild(cover(P.okText, k, COLOR.red, COLOR.light, "가입하기", fs(P.okText, 0.56)));
      layer.appendChild(cover(P.altText, k, COLOR.cream, COLOR.ink, "로그인으로", fs(P.altText, 0.5)));
      idIn.value = "";
    } else if (!ko) {
      // 다른 언어: 그림 속 한국어 글씨를 덮어 번역
      layer.appendChild(cover(P.title, k, COLOR.titleRed, COLOR.light, "로그인", fs(P.title, 0.62)));
      layer.appendChild(cover(P.checkText, k, COLOR.paper, COLOR.ink, "자동 로그인", fs(P.checkText, 0.5)));
      layer.appendChild(cover(P.find, k, COLOR.paper, COLOR.ink, "아이디 / 비밀번호 찾기", fs(P.find, 0.42)));
      layer.appendChild(cover(P.okText, k, COLOR.red, COLOR.light, "로그인", fs(P.okText, 0.56)));
      layer.appendChild(cover(P.altText, k, COLOR.cream, COLOR.ink, "회원가입", fs(P.altText, 0.5)));
    }
    setTimeout(() => (idIn.value === "" ? idIn : pwIn).focus(), 0);
  };

  const submit = (): void => {
    const res = mode === "signup" ? GameState.signUp(idIn.value, pwIn.value, true) : GameState.login(idIn.value, pwIn.value, auto);
    if (!res.ok) {
      showError(res.error);
      (res.error.includes("비밀번호") ? pwIn : idIn).focus();
      return;
    }
    Sound.playSfx("coin");
    onDone();
  };

  /** 아이디 / 비밀번호 찾기: 이 기기에 있는 아이디 목록 (누르면 아이디 칸에) + 고른 아이디의 비밀번호 새로 정하기 */
  const openFind = (): void => {
    const box = Ui.overlay(ov, 0.5);
    box.classList.add("center");
    const p = Ui.popPanel(Ui.PAPER, 40, 40);
    p.style.width = "860px";
    box.appendChild(p);
    p.appendChild(Ui.ribbon("아이디 / 비밀번호 찾기", Ui.ACCENT, 40));
    const col = Ui.vbox(16);
    p.appendChild(col);
    const close = (): void => box.remove();
    if (GameState.accounts.length === 0) {
      col.appendChild(Ui.label("이 기기에 만든 아이디가 없어요.\n'회원가입'으로 새로 만들어 주세요.", 30, Ui.INK, "center", true));
    } else {
      col.appendChild(Ui.label("이 기기에 있는 아이디 (누르면 고름)", 28, Ui.MUTED));
      const list = Ui.hbox(12);
      list.style.flexWrap = "wrap";
      list.style.justifyContent = "center";
      list.dataset.notr = "1";
      col.appendChild(list);
      let picked = idIn.value !== "" ? GameState.findAccount(idIn.value) : "";
      const pwNew = document.createElement("input");
      const paint = (): void => {
        list.replaceChildren();
        for (const n of GameState.accounts) {
          const nb = Ui.button("", n === picked ? Ui.ACCENT : Ui.CARD, 28, 72);
          Ui.withIcon(nb, Ui.ICON.user, n);
          if (n !== picked) nb.style.color = Ui.INK.css();
          nb.style.marginBottom = "4px";
          Ui.onPress(nb, () => {
            picked = n;
            idIn.value = n;
            paint();
          });
          list.appendChild(nb);
        }
      };
      paint();
      col.appendChild(Ui.label("비밀번호를 잊었다면 아이디를 고르고 새 비밀번호를 정해요.\n(기록은 이 기기에만 있어서 이 기기에서만 바꿀 수 있어요)", 25, Ui.MUTED, "center", true));
      pwNew.type = "password";
      pwNew.className = "field";
      pwNew.placeholder = tr(`새 비밀번호 (${PW_MIN}글자 이상)`);
      pwNew.maxLength = 24;
      pwNew.addEventListener("pointerdown", (e) => e.stopPropagation());
      pwNew.addEventListener("keydown", (e) => e.stopPropagation());
      col.appendChild(pwNew);
      const msg = Ui.label(" ", 26, Ui.BAD, "center");
      col.appendChild(msg);
      const reset = Ui.button("새 비밀번호로 바꾸기", Ui.GOOD, 32, 88);
      Ui.onPress(reset, () => {
        if (picked === "") {
          Ui.setText(msg, "먼저 아이디를 골라 주세요.");
          return;
        }
        const e = GameState.resetPassword(picked, pwNew.value);
        if (e !== "") {
          Ui.setText(msg, e);
          return;
        }
        close();
        pwIn.value = "";
        showError("비밀번호를 바꿨어요. 새 비밀번호로 로그인해 주세요.", true);
        pwIn.focus();
      });
      col.appendChild(reset);
    }
    const back = Ui.button("돌아가기", Ui.SECONDARY, 30, 80);
    Ui.onPress(back, close);
    col.appendChild(back);
  };

  setMode("login");
  return ov;
}
