import { useState, useCallback } from "react";
import { BenchmarkFunction, BenchmarkResult } from "../types/benchmark";
import {
  calculateAverage,
  calculateMedian,
  calculatePercentile
} from "../utils/statistics";
import { newAccountFunction } from "@/lib/newAccount";
import { wasmCryptoClientRead } from "@/lib/utils";
import { depositFunction } from "@/lib/deposit";

export const useBenchmark = (
  functionName: BenchmarkFunction,
  executionDelay: number,
  samples: number
) => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<BenchmarkResult | null>(null);

  // This is a placeholder for the actual benchmark implementation
  // The real implementation will be provided by the user later
  const runBenchmark = useCallback(async () => {
    // Simulate benchmark execution
    const runBenchmark = async () => {
      if (functionName === "NewAccount")
        return await newAccountFunction(await wasmCryptoClientRead);
      else if (functionName === "Deposit")
        return await depositFunction(await wasmCryptoClientRead);
      throw new Error("Unknown function");
    };

    setIsRunning(true);
    setResults(null);

    const rawData: number[] = [];

    try {
      for (let i = 0; i < samples; i++) {
        // Run the benchmark
        const executionTime = await runBenchmark();

        rawData.push(executionTime);

        // Wait for the specified delay before the next run
        if (i < samples - 1 && executionDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, executionDelay));
        }
      }

      // Calculate statistics
      const average = calculateAverage(rawData);
      const median = calculateMedian(rawData);
      const percentile95 = calculatePercentile(rawData, 95);

      setResults({
        average,
        median,
        percentile95,
        rawData
      });
    } catch (error) {
      console.error(`Error running ${functionName} benchmark:`, error);
    } finally {
      setIsRunning(false);
    }
  }, [functionName, executionDelay, samples]);

  const resetBenchmark = useCallback(() => {
    setResults(null);
  }, []);

  return {
    isRunning,
    results,
    startBenchmark: runBenchmark,
    resetBenchmark
  };
};
