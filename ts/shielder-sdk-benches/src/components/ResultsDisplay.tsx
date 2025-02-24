import { BenchmarkResult } from "../types/benchmark";

type ResultsDisplayProps = {
  results: BenchmarkResult | null;
  functionName: string;
};

export const ResultsDisplay = ({
  results,
  functionName
}: ResultsDisplayProps) => {
  if (!results) {
    return (
      <div className="results-display">
        <h2>Benchmark Results</h2>
        <p className="no-results">
          No results yet. Run a benchmark to see results.
        </p>
      </div>
    );
  }

  const formatTime = (time: number) => {
    return `${time.toFixed(2)} ms`;
  };

  return (
    <div className="results-display">
      <h2>Benchmark Results for {functionName}</h2>

      <div className="results-stats">
        <div className="stat-card">
          <h3>Average</h3>
          <div className="stat-value">{formatTime(results.average)}</div>
        </div>

        <div className="stat-card">
          <h3>Median</h3>
          <div className="stat-value">{formatTime(results.median)}</div>
        </div>

        <div className="stat-card">
          <h3>95th Percentile</h3>
          <div className="stat-value">{formatTime(results.percentile95)}</div>
        </div>
      </div>

      <div className="results-raw">
        <h3>Raw Data</h3>
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Run #</th>
                <th>Time (ms)</th>
              </tr>
            </thead>
            <tbody>
              {results.rawData.map((time, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>{formatTime(time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
