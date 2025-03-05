import { CustomError } from "ts-custom-error";

export class OutdatedSdkError extends CustomError {
  public constructor(text: string) {
    super(text);
  }
}
