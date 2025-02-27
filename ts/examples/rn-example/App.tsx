import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import ShielderSdkCryptoMobileModule, {
  ExpoCryptoClient
} from "shielder-sdk-crypto-mobile";
import {
  createShielderClient,
  nativeToken
} from "@cardinal-cryptography/shielder-sdk";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { polyfillWebCrypto } from "expo-standard-web-crypto";

polyfillWebCrypto();

// randomly generated private key
const privateKey: `0x${string}` =
  "0x9f016799b76362151677bf567f6f38d2653bc0c24147b70aaef1c872bf79514a";

const cryptoClient = new ExpoCryptoClient();
const shielderClient = createShielderClient(
  privateKey,
  2039,
  "https://rpc.alephzero-testnet.gelato.digital",
  "0x68D624B7b18173b3F8C9880f5f45854C3c6a6800",
  "http://localhost:8545",
  {
    getItem: async (key: string) => {
      return await AsyncStorage.getItem(key);
    },
    setItem: async (key: string, value: string) => {
      await AsyncStorage.setItem(key, value);
    }
  },
  cryptoClient,
  {
    onCalldataGenerated(calldata, _) {}
  }
);

export default function App() {
  // const shielderClient = createShielderClient();
  const [hash, setHash] = useState<string | null>(null);
  useEffect(() => {
    const hashInput = new Uint8Array(32).fill(0);
    console.log("kek");
    ShielderSdkCryptoMobileModule.poseidonHash(Array.from(hashInput)).then(
      (hash) => {
        setHash(hash.toString());
      }
    );
  });

  return (
    <View style={styles.container}>
      <Text>Open up App.tsx to start working on your app!</Text>
      <Text>{hash}</Text>
      <StatusBar style="auto" />
      <Button
        onPress={async () => {
          try {
            await shielderClient.shield(
              nativeToken(),
              1n,
              (() => {}) as any,
              "0x94CdA03e2c3FcD82f1221b18Ad8E93f5b9421BEA"
            );
          } catch (err) {
            console.error(err);
          }
        }}
        title="Shield!"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center"
  }
});
