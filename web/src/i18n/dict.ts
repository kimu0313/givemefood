// 번역 사전 [한국어, English, 日本語, 中文] — i18n.ts 설명 참고. ({0}… = 코드의 ${…} 자리, {j} = 한국어 조사 자리)
// 새 한국어 글을 넣으면: node tools/i18n_keys.mjs missing 으로 빠진 것을 보고 아래 세 파일 중 맞는 곳에 한 줄씩.
import { GAME } from "./dict_game.ts";
import { LINES } from "./dict_lines.ts";
import { UI } from "./dict_ui.ts";

export const DICT: [string, string, string, string][] = [...GAME, ...LINES, ...UI];
