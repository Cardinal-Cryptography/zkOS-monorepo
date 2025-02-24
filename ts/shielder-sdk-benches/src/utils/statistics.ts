/**
 * Calculate the average (mean) of an array of numbers
 */
export function calculateAverage(data: number[]): number {
  if (data.length === 0) return 0;
  const sum = data.reduce((acc, val) => acc + val, 0);
  return sum / data.length;
}

/**
 * Calculate the median of an array of numbers
 */
export function calculateMedian(data: number[]): number {
  if (data.length === 0) return 0;

  // Sort the data
  const sortedData = [...data].sort((a, b) => a - b);

  // If odd length, return the middle element
  if (sortedData.length % 2 === 1) {
    return sortedData[Math.floor(sortedData.length / 2)];
  }

  // If even length, return the average of the two middle elements
  const mid = sortedData.length / 2;
  return (sortedData[mid - 1] + sortedData[mid]) / 2;
}

/**
 * Calculate a percentile value from an array of numbers
 * @param data Array of numbers
 * @param percentile Percentile to calculate (0-100)
 */
export function calculatePercentile(
  data: number[],
  percentile: number
): number {
  if (data.length === 0) return 0;
  if (percentile < 0 || percentile > 100) {
    throw new Error("Percentile must be between 0 and 100");
  }

  // Sort the data
  const sortedData = [...data].sort((a, b) => a - b);

  // Calculate the index
  const index = (percentile / 100) * (sortedData.length - 1);

  // If index is an integer, return the value at that index
  if (Number.isInteger(index)) {
    return sortedData[index];
  }

  // Otherwise, interpolate between the two closest values
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const weight = index - lowerIndex;

  return (
    sortedData[lowerIndex] * (1 - weight) + sortedData[upperIndex] * weight
  );
}
