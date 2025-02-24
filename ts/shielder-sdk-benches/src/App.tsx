import { Benchmarks } from "./pages/Benchmarks";
import WasmProvider from "./providers/WasmProvider";

function App() {
  return (
    <WasmProvider>
      <Benchmarks />
    </WasmProvider>
  );
}

export default App;
