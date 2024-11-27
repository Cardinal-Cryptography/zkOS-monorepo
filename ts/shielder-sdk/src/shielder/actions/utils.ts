import { Scalar } from "@/crypto/scalar";
import { AccountState } from "@/shielder/state";
import { noteVersion } from "@/utils";
import { wasmClientWorker } from "@/wasmClientWorker";

export async function rawAction(
  stateOld: AccountState,
  amount: bigint,
  balanceChange: (currentBalance: bigint, amount: bigint) => bigint
): Promise<AccountState | null> {
  const { nullifier: nullifierNew, trapdoor: trapdoorNew } =
    await wasmClientWorker.getSecrets(stateOld.id, stateOld.nonce);
  const balanceNew = balanceChange(stateOld.balance, amount);
  if (balanceNew < 0n) {
    return null;
  }
  const hAccountBalanceNew = await wasmClientWorker.poseidonHash([
    Scalar.fromBigint(balanceNew)
  ]);
  const version = noteVersion();
  const noteNew = await wasmClientWorker.poseidonHash([
    version,
    stateOld.id,
    nullifierNew,
    trapdoorNew,
    hAccountBalanceNew
  ]);
  return {
    id: stateOld.id,
    nonce: stateOld.nonce + 1n,
    balance: balanceNew,
    currentNote: noteNew
  };
}
