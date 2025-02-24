type ControlPanelProps = {
  onStart: () => void;
  onReset: () => void;
  isRunning: boolean;
};

export const ControlPanel = ({
  onStart,
  onReset,
  isRunning
}: ControlPanelProps) => {
  return (
    <div className="control-panel">
      <button className="start-button" onClick={onStart} disabled={isRunning}>
        {isRunning ? "Running..." : "Start Benchmark"}
      </button>
      <button className="reset-button" onClick={onReset} disabled={isRunning}>
        Reset Results
      </button>
    </div>
  );
};
