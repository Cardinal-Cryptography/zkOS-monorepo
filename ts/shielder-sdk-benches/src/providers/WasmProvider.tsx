import { type ReactNode, useEffect, useState } from "react";
import type { CryptoClient } from "@cardinal-cryptography/shielder-sdk-crypto";

import { WasmContext } from "@/lib/useWasm";
import { wasmCryptoClientRead } from "@/lib/utils";

type Props = { children: ReactNode };

export let wasmCryptoClient: CryptoClient | null = null;

const WasmProvider = ({ children }: Props) => {
  const [isWasmLoaded, setIsWasmLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    wasmCryptoClientRead
      .then((cryptoClient) => {
        console.log("Wasm loaded");
        wasmCryptoClient = cryptoClient;
        void setIsWasmLoaded(true);
      })
      .catch((err: unknown) => void setError(err as Error));
  }, []);

  return (
    <WasmContext.Provider value={{ isWasmLoaded, error }}>
      {children}
    </WasmContext.Provider>
  );
};

export default WasmProvider;
