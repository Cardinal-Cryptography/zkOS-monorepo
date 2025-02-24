import { useState } from "react";
import "./Benchmarks.css";
import { BenchmarkFunction, BenchmarkConfig } from "../types/benchmark";
import { FunctionSelector } from "../components/FunctionSelector";
import { BenchmarkForm } from "../components/BenchmarkForm";
import { ControlPanel } from "../components/ControlPanel";
import { ResultsDisplay } from "../components/ResultsDisplay";
import { useBenchmark } from "../hooks/useBenchmark";
import useWasm from "../lib/useWasm";

export const Benchmarks = () => {
  const { isWasmLoaded, error } = useWasm();

  // State for selected function and benchmark configuration
  const [selectedFunction, setSelectedFunction] =
    useState<BenchmarkFunction>("NewAccount");
  const [config, setConfig] = useState<BenchmarkConfig>({
    executionDelay: 100,
    samples: 10
  });

  // Use the benchmark hook
  const { isRunning, results, startBenchmark, resetBenchmark } = useBenchmark(
    selectedFunction,
    config.executionDelay,
    config.samples
  );

  // Handle function selection
  const handleFunctionSelect = (func: BenchmarkFunction) => {
    setSelectedFunction(func);
    resetBenchmark();
  };

  // Handle configuration changes
  const handleExecutionDelayChange = (delay: number) => {
    setConfig((prev) => ({ ...prev, executionDelay: delay }));
  };

  const handleSamplesChange = (samples: number) => {
    setConfig((prev) => ({ ...prev, samples }));
  };

  // If WASM is not loaded yet, show loading state
  if (!isWasmLoaded) {
    return (
      <div className="benchmark-dashboard">
        <h1>Shielder SDK Benchmarks</h1>
        <p>Loading WASM modules...</p>
      </div>
    );
  }

  // If there was an error loading WASM, show error state
  if (error) {
    return (
      <div className="benchmark-dashboard">
        <h1>Shielder SDK Benchmarks</h1>
        <p className="error">Error loading WASM: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="benchmark-dashboard">
      <h1>Shielder SDK Benchmarks</h1>

      <FunctionSelector
        options={["NewAccount", "Deposit", "Withdraw"]}
        selectedFunction={selectedFunction}
        onSelect={handleFunctionSelect}
      />

      <BenchmarkForm
        config={config}
        onExecutionDelayChange={handleExecutionDelayChange}
        onSamplesChange={handleSamplesChange}
      />

      <ControlPanel
        onStart={startBenchmark}
        onReset={resetBenchmark}
        isRunning={isRunning}
      />

      <ResultsDisplay results={results} functionName={selectedFunction} />
    </div>
  );
};
