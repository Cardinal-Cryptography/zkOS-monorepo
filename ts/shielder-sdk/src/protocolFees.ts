import { IContract } from "@/chain/contract";

export const MAX_BPS: bigint = 10_000n;

export type ProtocolFeeQuote = {
  amount: bigint;
  protocolFee: bigint;
};

export class ProtocolFees {
  private depositFeeBps?: bigint;
  private withdrawFeeBps?: bigint;
  constructor(private contract: IContract) {}

  /**
   * Calculate protocol deposit fee amount.
   * @param {bigint} amount Amount on which to compute the protocol fee.
   * @param {boolean} [feeIncluded=true] Whether the protocol fee is included in the `amount` (default: `true`).
   * @returns {ProtocolFeeQuote} An object containing the total `amount` required for the deposit, and the `protocolFee` part.
   */
  async getProtocolDepositFee(
    amount: bigint,
    feeIncluded: boolean = true
  ): Promise<ProtocolFeeQuote> {
    const depositFeeBps =
      this.depositFeeBps ?? (await this.syncProtocolDepositFeeBps());
    return feeIncluded
      ? computeProtocolFeeFromGross(amount, depositFeeBps)
      : computeProtocolFeeFromNet(amount, depositFeeBps);
  }

  /**
   * Calculate protocol withdraw fee amount.
   * @param {bigint} amount Amount on which to compute the protocol fee.
   * @param {boolean} [feeIncluded=true] Whether the protocol fee is included in the `amount`.
   * @returns {ProtocolFeeQuote} An object containing the total `amount` required for the withdrawal, and the `protocolFee` part.
   */
  async getProtocolWithdrawFee(
    amount: bigint,
    feeIncluded: boolean = true
  ): Promise<ProtocolFeeQuote> {
    const withdrawFeeBps =
      this.withdrawFeeBps ?? (await this.syncProtocolWithdrawFeeBps());
    return feeIncluded
      ? computeProtocolFeeFromGross(amount, withdrawFeeBps)
      : computeProtocolFeeFromNet(amount, withdrawFeeBps);
  }

  /**
   * Fetches protocol deposit fee from the Contract and updates its state.
   * @returns {Promise<bigint>} Protocol deposit fee denoted in basis points.
   */
  async syncProtocolDepositFeeBps(): Promise<bigint> {
    this.depositFeeBps = await this.contract.protocolDepositFeeBps();
    return new Promise((resolve) => resolve(this.depositFeeBps!));
  }

  /**
   * Fetches protocol withdraw fee from the Contract and updates its state.
   * @returns {Promise<bigint>} Protocol withdraw fee denoted in basis points.
   */
  async syncProtocolWithdrawFeeBps(): Promise<bigint> {
    this.withdrawFeeBps = await this.contract.protocolWithdrawFeeBps();
    return new Promise((resolve) => resolve(this.withdrawFeeBps!));
  }
}
/**
 * Compute protocol fee from an amount that already includes the protocol fee.
 */
function computeProtocolFeeFromGross(
  amount: bigint,
  protocolFeeBps: bigint
): ProtocolFeeQuote {
  return {
    amount,
    protocolFee: (amount * protocolFeeBps + MAX_BPS - 1n) / MAX_BPS
  };
}
/**
 * Compute protocol fee from an amount that excludes the protocol fee.
 */
function computeProtocolFeeFromNet(
  amount: bigint,
  protocolFeeBps: bigint
): ProtocolFeeQuote {
  const denom = MAX_BPS - protocolFeeBps;
  const protocolFee = (amount * protocolFeeBps + denom - 1n) / denom;
  return {
    amount: amount + protocolFee,
    protocolFee
  };
}
