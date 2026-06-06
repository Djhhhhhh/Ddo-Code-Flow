"use strict";

/** @param {{ inputPerMillionUsd: number, outputPerMillionUsd: number }} pricing */
function estimateCostUsd(inputTokens, outputTokens, pricing) {
  const inRate = Number(pricing?.inputPerMillionUsd) || 0;
  const outRate = Number(pricing?.outputPerMillionUsd) || 0;
  if (inRate === 0 && outRate === 0) return null;
  const cost =
    (inputTokens / 1_000_000) * inRate + (outputTokens / 1_000_000) * outRate;
  return Math.round(cost * 100) / 100;
}

module.exports = { estimateCostUsd };
