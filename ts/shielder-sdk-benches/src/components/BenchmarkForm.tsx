import { BenchmarkConfig } from "../types/benchmark";

type BenchmarkFormProps = {
  config: BenchmarkConfig;
  onExecutionDelayChange: (delay: number) => void;
  onSamplesChange: (samples: number) => void;
};

export const BenchmarkForm = ({
  config,
  onExecutionDelayChange,
  onSamplesChange
}: BenchmarkFormProps) => {
  const handleDelayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 0) {
      onExecutionDelayChange(value);
    }
  };

  const handleSamplesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0) {
      onSamplesChange(value);
    }
  };

  return (
    <div className="benchmark-form">
      <h2>Benchmark Configuration</h2>
      <div className="form-group">
        <label htmlFor="execution-delay">
          Execution Delay (ms):
          <input
            id="execution-delay"
            type="number"
            min="0"
            value={config.executionDelay}
            onChange={handleDelayChange}
          />
        </label>
        <p className="form-help">Time to wait between benchmark executions</p>
      </div>

      <div className="form-group">
        <label htmlFor="samples">
          Number of Samples:
          <input
            id="samples"
            type="number"
            min="1"
            value={config.samples}
            onChange={handleSamplesChange}
          />
        </label>
        <p className="form-help">Number of times to run the benchmark</p>
      </div>
    </div>
  );
};
