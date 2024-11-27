import { execSync } from "child_process";

import { sdkTest } from "@tests/playwrightTestUtils";

sdkTest("agrees with Rust", async ({ workerPage }) => {
  for (const nonce of [0n, 1n, 2n ** 32n - 1n]) {
    const { id, nullifier, trapdoor } = await workerPage.evaluate(
      async (nonce) => {
        const secretGenerator = window.crypto.createSecretGenerator();
        const id = window.crypto.scalar.fromBigint(2n ** 253n);

        const { nullifier, trapdoor } = secretGenerator.getSecrets(id, nonce);

        return {
          id: id.bytes.toString(),
          nullifier: nullifier.bytes.toString(),
          trapdoor: trapdoor.bytes.toString(),
        };
      },
      nonce,
    );

    execSync(
      `../../target/debug/test-ts-conversions` +
        ` wasm-secrets-agree-with-rust` +
        ` --seed ${id}` +
        ` --nonce ${nonce}` +
        ` --expected-nullifier ${nullifier}` +
        ` --expected-trapdoor ${trapdoor}`,
      {
        stdio: "ignore",
      },
    );
  }
});
