import { createContext, useContext } from "react";

type WasmContextType = {
  isWasmLoaded: boolean;
  error: Error | null;
};

const WasmContext = createContext<WasmContextType | undefined>(undefined);

const useWasm = () => {
  const context = useContext(WasmContext);
  if (context === undefined) {
    throw new Error("useWasm must be used within a WasmProvider.");
  }
  return context;
};

export default useWasm;
export { WasmContext };
