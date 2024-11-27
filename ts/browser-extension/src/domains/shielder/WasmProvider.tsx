import { type ReactNode, useEffect, useState } from 'react';
import { wasmClientWorkerReady } from 'shielder-sdk';

import { WasmContext } from './useWasm';

type Props = { children: ReactNode };

const WasmProvider = ({ children }: Props) => {
  const [isWasmLoaded, setIsWasmLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    wasmClientWorkerReady
      .then(() => void setIsWasmLoaded(true))
      .catch((err: unknown) => void setError(err as Error));
  }, []);

  return (
    <WasmContext.Provider value={{ isWasmLoaded, error }}>
      {children}
    </WasmContext.Provider>
  );
};

export default WasmProvider;
