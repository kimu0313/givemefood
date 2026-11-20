// 손님 한 명이 떠날 때 남기는 평가 (1~5점, 순수 로직) — 가게 평점이 실시간으로 이 점수 쪽으로 움직인다.
// 2026-11-16 사용자: "메뉴 가격 저렴/보통/비쌈 (반값/두 배), 가게 평점·평가에 영향. 평가는 플레이할 때마다 실시간으로.
//   단골·미식가는 가격 영향 없음, 일반 손님이 유독 느낀다. 너무 비싸면 받고 나서 비싸다고 하고 평가도 비싸다고,
//   저렴하면 약간 실수해도 후해지게."
//
// 점수: 받은 음식 품질 평균 (완벽 5 · 익음 3.8 · 탐 2.2), 덜 익어서·기다리다 화나서 떠나면 1점.
//   일반 손님(가격을 느끼는 손님)만: 저렴 = 익음·탐을 한 단계 후하게 + 0.3, 비쌈 = 완벽이어도 −0.8, 아니면 −1.4.
//   기다림: 인내심이 1/4 밑으로 남았으면 −0.6, 절반 넘게 남았으면 +0.2. 마법의 가루 요리 +0.5.

import { Q, PRICE_LEVELS } from "./defs.ts";

export interface ReviewInput {
  angry: boolean; // 화나서 떠남 (덜 익은 음식 / 너무 오래 기다림)
  qualities: number[]; // 받은 음식 품질들
  priceLevels: string[]; // 받은 음식 메뉴의 가격 단계 (cheap / normal / pricey)
  priceSensitive: boolean; // 가격을 느끼는 손님 (단골·미식가는 false)
  patienceRatio: number; // 마지막 음식을 받을 때 남은 인내심 (0~1)
  magic: boolean;
}

export interface Review {
  score: number; // 1~5
  tag: string; // 평가 한마디 종류: good / cheap / pricey / slow / bad
}

const BASE: Record<number, number> = { [Q.PERFECT]: 5.0, [Q.COOKED]: 3.8, [Q.BURNT]: 2.2, [Q.RAW]: 1.0 };
const LENIENT: Record<number, number> = { [Q.PERFECT]: 5.0, [Q.COOKED]: 4.7, [Q.BURNT]: 3.4, [Q.RAW]: 1.0 };

export function reviewOf(r: ReviewInput): Review {
  if (r.angry || r.qualities.length === 0) return { score: 1.0, tag: r.patienceRatio <= 0.01 ? "slow" : "bad" };
  const sens = r.priceSensitive;
  const cheap = sens && r.priceLevels.some((p) => p === "cheap");
  const pricey = sens && r.priceLevels.some((p) => p === "pricey");
  const table = cheap ? LENIENT : BASE;
  let score = r.qualities.reduce((n, q) => n + (table[q] ?? 3.0), 0) / r.qualities.length;
  const allPerfect = r.qualities.every((q) => q === Q.PERFECT);
  if (cheap) score += 0.3;
  if (pricey) score -= allPerfect ? 0.8 : 1.4;
  if (r.patienceRatio < 0.25) score -= 0.6;
  else if (r.patienceRatio > 0.5) score += 0.2;
  if (r.magic) score += 0.5;
  score = Math.min(5.0, Math.max(1.0, score));
  let tag = score >= 4.2 ? "good" : "bad";
  if (pricey) tag = "pricey";
  else if (cheap && score >= 4.0) tag = "cheap";
  else if (r.patienceRatio < 0.25 && score < 4.2) tag = "slow";
  return { score, tag };
}

/** 평점을 새 평가 쪽으로 조금 (최근 손님일수록 크게) */
export function nextRating(rating: number, score: number, alpha: number): number {
  return Math.min(5.0, Math.max(1.0, rating + (score - rating) * alpha));
}

/** 가격 단계 → 일반 손님이 내는 값 배수 */
export function priceMult(level: string): number {
  return PRICE_LEVELS[level]?.mult ?? 1.0;
}
