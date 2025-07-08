import {
  Scalar,
  Converter as IConverter
} from "@cardinal-cryptography/shielder-sdk-crypto";
import * as singleThreadedWasm from "shielder_bindings/web-singlethreaded";

export class Converter implements IConverter {
  hex32ToScalar(hex: `0x${string}`): Promise<Scalar> {
    return Promise.resolve(new Scalar(singleThreadedWasm.hex_32_to_f(hex)));
  }
}
