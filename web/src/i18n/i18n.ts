// 언어 (2026-11-16 사용자 "설정에는 중국어·일본어·영어·한국어 번역 기능"): 게임 글은 한국어로 쓰고, 화면에 나가는 순간 번역한다.
//   · 캔버스 글자: Gfx.text / textOutline / measure, FoodArt.text·textOutlined(줄 나누기 전), 손님 말풍선
//   · HTML 글자: watchDom 이 화면에 붙는 글자 마디(text node)와 입력 칸 placeholder 를 바로 바꿔 씀 (data-notr 안은 그대로)
// 사전 = dict.ts [한국어, English, 日本語, 中文]. 한국어 쪽 {0} {1} … 는 코드의 ${…} 자리 (숫자·이름이 들어감, 들어간 말도 다시 번역),
// {j} 는 한국어 조사(을/를·이/가 …) 자리라 다른 말에선 없앤다. 못 찾으면: 줄마다 → 틀(template) → " · " 같은 구분자로 나눠서 →
// 아는 낱말만 바꿔 끼우기 → 그래도 없으면 한국어 그대로.
// 이 파일은 DOM 없이도 불러올 수 있다 (테스트는 늘 한국어).

import { DICT } from "./dict.ts";

export type Lang = "ko" | "en" | "ja" | "zh";
/** 설정 화면에 나오는 순서 · 그 언어로 쓴 이름 (번역하지 않음) */
export const LANGS: { id: Lang; name: string }[] = [
  { id: "ko", name: "한국어" },
  { id: "en", name: "English" },
  { id: "ja", name: "日本語" },
  { id: "zh", name: "中文" },
];
const LANG_KEY = "pocha_tycoon_lang";
const COL: Record<Lang, number> = { ko: 0, en: 1, ja: 2, zh: 3 };
const HANGUL = /[가-힣]/;
const JOSA = "(?:을|를|이|가|은|는|와|과|으로|로|이에요|예요|이랑|랑)?";
// {n} 바로 뒤가 단위(원·칸·그릇·인분·초·개·명·번·%…)면 그 자리는 숫자만 ("가득 (+5) · 1,200원" 을 통째로 "{0}원" 으로 잡지 않게)
const UNIT = /^(원|칸|그릇|인분|초|개|명|번|%|단계|점|글자|가지)/;
const NUM = "(\\d[\\d,.]*)"; // 부호는 틀 쪽에 ("+{0}원" → "+₩{0}")

let lang: Lang = "ko";
try {
  const v = typeof localStorage !== "undefined" ? localStorage.getItem(LANG_KEY) : null;
  if (v === "en" || v === "ja" || v === "zh" || v === "ko") lang = v;
} catch {
  // 저장소를 못 쓰면 한국어
}

interface Template {
  re: RegExp;
  out: string;
  multi: boolean; // 한국어 틀에 줄바꿈이 있음
  lit: number; // 틀에서 정해진 글자 수 (많을수록 먼저 맞춰 봄)
}
let exact = new Map<string, string>();
let templates: Template[] = [];
let glossary: [string, string][] = [];
const cache = new Map<string, string>();
const listeners: (() => void)[] = [];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 지금 언어의 사전을 만든다 (언어를 바꿀 때마다) */
function build(): void {
  exact = new Map();
  templates = [];
  glossary = [];
  cache.clear();
  if (lang === "ko") return;
  const col = COL[lang];
  for (const row of DICT) {
    const ko = row[0];
    const out = row[col];
    if (!out) continue;
    if (!/\{(\d+|j)\}/.test(ko)) {
      exact.set(ko, out);
      if (ko.length >= 2 && ko.length <= 12 && !ko.includes("\n")) glossary.push([ko, out]);
      continue;
    }
    // 틀: 글자 부분은 그대로, {n} = 아무 글자 (짧게), {j} = 조사 (있어도 없어도)
    const parts = ko.split(/(\{\d+\}|\{j\})/);
    let re = "^";
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p === "{j}") re += JOSA;
      else if (/^\{\d+\}$/.test(p)) re += UNIT.test(parts[i + 1] ?? "") ? NUM : "([\\s\\S]*?)";
      else re += escapeRe(p);
    }
    re += "$";
    // {n} 순서대로 붙는 묶음 번호 → 번역문의 {n} 을 그 묶음으로
    const idx = [...ko.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1]));
    let k = 0;
    const order: Record<number, number> = {};
    for (const n of idx) order[n] = ++k;
    templates.push({
      re: new RegExp(re),
      out: out.replace(/\{(\d+)\}/g, (_, n) => `{@${order[Number(n)] ?? 0}}`),
      multi: ko.includes("\n"),
      lit: ko.replace(/\{(\d+|j)\}/g, "").length,
    });
  }
  // 글자가 많이 정해진 틀부터 (덜 모호한 것 먼저)
  templates.sort((a, b) => b.lit - a.lit);
  glossary.sort((a, b) => b[0].length - a[0].length);
}
build();

export function getLang(): Lang {
  return lang;
}

/** 언어 바꾸기 (저장). 화면은 부른 쪽에서 다시 만든다 (장면 다시 열기) */
export function setLang(l: Lang): void {
  if (l === lang) return;
  lang = l;
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch {
    // 무시
  }
  build();
  for (const f of listeners) f();
}

export function onLangChange(f: () => void): void {
  listeners.push(f);
}

/** 한국어 글 → 지금 언어 (한국어면 그대로, 사전에 없으면 아는 데까지만) */
export function tr(s: string): string {
  if (lang === "ko" || s.length === 0 || !HANGUL.test(s)) return s;
  const hit = cache.get(s);
  if (hit !== undefined) return hit;
  const out = translate(s, 0);
  if (cache.size > 6000) cache.clear();
  cache.set(s, out);
  return out;
}

function translate(s: string, depth: number): string {
  if (!HANGUL.test(s)) return s;
  const e = exact.get(s);
  if (e !== undefined) return e;
  // 앞뒤 빈칸은 두고 가운데만
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s)!;
  if (m[1] !== "" || m[3] !== "") {
    const inner = exact.get(m[2]);
    if (inner !== undefined) return m[1] + inner + m[3];
  }
  if (depth > 5) return s;
  // 틀: 여러 줄 글은 줄바꿈이 든 틀만, 한 줄 글은 한 줄 틀만 (안 맞으면 줄마다 따로)
  const multi = s.includes("\n");
  for (const t of templates) {
    if (t.multi !== multi) continue;
    const mm = t.re.exec(s);
    if (mm === null) continue;
    return t.out.replace(/\{@(\d+)\}/g, (_, n) => translate(mm[Number(n)] ?? "", depth + 1));
  }
  if (multi) return s.split("\n").map((x) => translate(x, depth + 1)).join("\n");
  for (const sep of [" · ", " / ", " | ", " → ", ", ", ": ", " - "]) {
    if (!s.includes(sep)) continue;
    return s
      .split(sep)
      .map((x) => translate(x, depth + 1))
      .join(sep);
  }
  // 앞뒤 기호(!, ?, …, 괄호)를 떼고 다시
  const p = /^([\s"'“‘(\[《「『·•✨★☆!?~…:]*)([\s\S]*?)([\s"'”’)\]》」』!?~…:.,·]*)$/.exec(s);
  if (p !== null && (p[1] !== "" || p[3] !== "") && p[2] !== "") {
    const core = translate(p[2], depth + 1);
    if (core !== p[2]) return p[1] + core + p[3];
  }
  // 아는 낱말만 바꿔 끼우기 (긴 것부터)
  let g = s;
  for (const [k, v] of glossary) if (g.includes(k)) g = g.split(k).join(v);
  return g;
}

/** HTML 화면 글자 바꾸기: root 아래에 붙거나 바뀌는 글자를 지금 언어로 (data-notr 안, 입력 칸 안 글은 그대로) */
export function watchDom(root: Node): void {
  if (typeof MutationObserver === "undefined") return;
  const done = new WeakMap<Node, string>();
  const skip = (el: Element | null): boolean => el === null || el.closest("[data-notr]") !== null || el.tagName === "STYLE" || el.tagName === "SCRIPT";
  const fixText = (t: Text): void => {
    if (lang === "ko") return;
    const v = t.nodeValue ?? "";
    if (done.get(t) === v || !HANGUL.test(v) || skip(t.parentElement)) return;
    const o = tr(v);
    done.set(t, o);
    if (o !== v) t.nodeValue = o;
  };
  const fixEl = (el: Element): void => {
    if (lang === "ko" || skip(el)) return;
    const inputs = el.matches("input, textarea") ? [el] : [...el.querySelectorAll("input, textarea")];
    for (const i of inputs) {
      const ph = i.getAttribute("placeholder");
      if (ph !== null && HANGUL.test(ph)) i.setAttribute("placeholder", tr(ph));
    }
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n !== null; n = w.nextNode()) fixText(n as Text);
  };
  new MutationObserver((muts) => {
    if (lang === "ko") return;
    for (const mu of muts) {
      if (mu.type === "characterData") fixText(mu.target as Text);
      else
        mu.addedNodes.forEach((n) => {
          if (n.nodeType === 3) fixText(n as Text);
          else if (n.nodeType === 1) fixEl(n as Element);
        });
    }
  }).observe(root, { childList: true, characterData: true, subtree: true });
  if (root.nodeType === 1) fixEl(root as Element);
  else if (root === document) fixEl(document.body);
}

/** 한국어 글꼴(주아)에 없는 가나·한자를 그 언어 글꼴로 (일본어는 일본 글꼴 먼저, 중국어는 중국 글꼴 먼저) */
export function langFonts(): string {
  if (lang === "ja") return `"Jua", "Yu Gothic UI", "Yu Gothic", "Meiryo", "Hiragino Maru Gothic ProN", "Hiragino Sans", "Noto Sans JP"`;
  if (lang === "zh") return `"Jua", "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC"`;
  return `"Jua"`;
}
