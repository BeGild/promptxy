export function formatTotalTokensCompact(totalTokens: number): string {
  if (!Number.isFinite(totalTokens) || totalTokens <= 0) {
    return '0';
  }

  if (totalTokens >= 1_000_000) {
    return `${(totalTokens / 1_000_000).toFixed(2)}M`;
  }

  if (totalTokens >= 1_000) {
    return `${(totalTokens / 1_000).toFixed(1)}K`;
  }

  return totalTokens.toLocaleString();
}

export function formatUsdCostCompact(totalCost: number): string {
  if (!Number.isFinite(totalCost)) {
    return '$0.00';
  }

  const abs = Math.abs(totalCost);
  const sign = totalCost < 0 ? '-' : '';

  if (abs === 0) {
    return `${sign}$0.00`;
  }

  // >= $0.01：常规 2 位小数；< $0.01：展示到 6 位避免长期显示 0.00
  if (abs >= 0.01) {
    return `${sign}$${abs.toFixed(2)}`;
  }

  const compact = abs
    .toFixed(6)
    .replace(/0+$/, '')
    .replace(/\.$/, '');

  return `${sign}$${compact}`;
}

