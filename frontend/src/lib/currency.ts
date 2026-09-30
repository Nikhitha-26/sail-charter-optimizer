export const USD_TO_INR = 93

export function usdToInr(value: number): number {
  return value * USD_TO_INR
}

export function formatINR(
  value: number,
  options?: {
    maximumFractionDigits?: number
    minimumFractionDigits?: number
  },
): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: options?.maximumFractionDigits ?? 0,
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
  }).format(usdToInr(value))
}

export function formatINRPerTonne(value: number): string {
  return `${formatINR(value, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}/MT`
}

export function formatINRMillion(value: number): string {
  return `₹${(usdToInr(value) / 1_000_000).toFixed(2)}M`
}

export function formatINRCrore(value: number): string {
  return `₹${(usdToInr(value) / 10_000_000).toFixed(2)} Cr`
}