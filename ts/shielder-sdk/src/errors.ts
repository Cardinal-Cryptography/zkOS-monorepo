import { CustomError } from "ts-custom-error";

export class OutdatedSdkError extends CustomError {
  public constructor(message: string) {
    super(message);
  }
}

export class AccountNotOnChainError extends CustomError {
  public constructor(message: string) {
    super(message);
  }
}
