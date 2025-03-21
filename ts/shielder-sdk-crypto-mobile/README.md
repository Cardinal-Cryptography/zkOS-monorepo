# @cardinal-cryptography/shielder-sdk-crypto-mobile

shielder-sdk cryptography bindings for react native

## Usage

```bash
npm install @cardinal-cryptography/shielder-sdk-crypto-mobile
```

```typescript
import { RNCryptoClient } from '@cardinal-cryptography/shielder-sdk-crypto-mobile';
import { CryptoClient } from '@cardinal-cryptography/shielder-sdk-crypto';

const client: CryptoClient = new RNCryptoClient();
```

## Building

```bash
# Install dependencies
yarn

# Build ios rust targets and bindings
yarn ubrn:ios
# Build android rust targets and bindings
yarn ubrn:android

```

## License

Apache-2.0

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
and [uniffi-bindgen-react-native](https://github.com/jhugman/uniffi-bindgen-react-native)
