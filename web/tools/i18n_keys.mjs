// 번역할 한국어 글 목록 뽑기 (src/i18n/dict.ts 를 채울 때 씀): node tools/i18n_keys.mjs [missing]
//   코드의 "…" '…' `…` 중 한글이 든 것. 템플릿의 ${…} 는 {0} {1} …, ${D.josa(…)} / ${josa(…)} 는 {j} (조사 자리) 로 바꿈.
//   missing 을 붙이면 사전(dict.ts)에 아직 없는 것만. 주석·i18n 폴더는 뺌.
import fs from "node:fs";
import path from "node:path";

const onlyMissing = process.argv[2] === "missing";
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) {
      if (!p.endsWith("i18n")) walk(p);
    } else if (p.endsWith(".ts")) files.push(p);
  }
})("src");

/** `…${a}…${b}…` → "…{0}…{1}…" (조사 함수는 {j}) */
function templateKey(body) {
  let out = "";
  let n = 0;
  let i = 0;
  while (i < body.length) {
    if (body[i] === "\\" && i + 1 < body.length) {
      const c = body[i + 1];
      out += c === "n" ? "\n" : c === "t" ? "\t" : c;
      i += 2;
      continue;
    }
    if (body[i] === "$" && body[i + 1] === "{") {
      let depth = 1;
      let j = i + 2;
      while (j < body.length && depth > 0) {
        if (body[j] === "{") depth++;
        else if (body[j] === "}") depth--;
        j++;
      }
      const expr = body.slice(i + 2, j - 1);
      out += /\bjosa\(/.test(expr) ? "{j}" : `{${n++}}`;
      i = j;
      continue;
    }
    out += body[i];
    i++;
  }
  return out;
}

function unescape(s) {
  return s.replace(/\\(.)/g, (_, c) => (c === "n" ? "\n" : c === "t" ? "\t" : c));
}

const keys = new Map(); // key → files
for (const f of files) {
  const src = fs
    .readFileSync(f, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
  const re = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;
  let m;
  while ((m = re.exec(src))) {
    let k;
    if (m[3] !== undefined) k = templateKey(m[3]);
    else k = unescape(m[1] ?? m[2]);
    if (!/[가-힣]/.test(k)) continue;
    const short = f.replace(/\\/g, "/").replace(/^src\//, "");
    if (!keys.has(k)) keys.set(k, new Set());
    keys.get(k).add(short);
  }
}

let have = new Set();
if (onlyMissing) {
  // src/i18n/dict*.ts 의 각 줄 첫 문자열 (JSON 처럼 씀)
  for (const f of fs.readdirSync("src/i18n").filter((n) => /^dict.*\.ts$/.test(n))) {
    for (const line of fs.readFileSync(`src/i18n/${f}`, "utf8").split("\n")) {
      const mm = /^\s*\[("(?:[^"\\]|\\.)*")/.exec(line);
      if (mm) have.add(JSON.parse(mm[1]).trim());
    }
  }
}
const out = [...keys.entries()].filter(([k]) => !have.has(k.trim())).map(([k, fs_]) => ({ k, files: [...fs_].join(",") }));
console.log(JSON.stringify(out, null, 1));
console.error(`${out.length} / ${keys.size} keys`);
