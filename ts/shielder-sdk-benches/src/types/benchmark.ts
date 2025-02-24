export type BenchmarkFunction = "NewAccount" | "Deposit" | "Withdraw";

export type BenchmarkConfig = {
  executionDelay: number;
  samples: number;
};

export type BenchmarkResult = {
  average: number;
  median: number;
  percentile95: number;
  rawData: number[];
};
