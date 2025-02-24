import { BenchmarkFunction } from "../types/benchmark";

type FunctionSelectorProps = {
  options: BenchmarkFunction[];
  selectedFunction: BenchmarkFunction;
  onSelect: (func: BenchmarkFunction) => void;
};

export const FunctionSelector = ({
  options,
  selectedFunction,
  onSelect
}: FunctionSelectorProps) => {
  return (
    <div className="function-selector">
      <h2>Select Function to Benchmark</h2>
      <div className="function-buttons">
        {options.map((func) => (
          <button
            key={func}
            className={`function-button ${selectedFunction === func ? "selected" : ""}`}
            onClick={() => onSelect(func)}
            disabled={func !== "NewAccount"}
          >
            {func}
          </button>
        ))}
      </div>
    </div>
  );
};
