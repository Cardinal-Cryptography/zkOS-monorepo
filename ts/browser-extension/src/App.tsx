import { Providers } from './Providers';

import { Wallet } from '@/domains/wallet';

function App() {
  return (
    <Providers>
      <Wallet />
    </Providers>
  );
}

export default App;
