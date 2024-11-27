import { Wallet as WalletIcon, Shield, LoaderCircle } from 'lucide-react';
import { useEffect } from 'react';
import { formatEther } from 'viem';

import { SettingsDialog } from './SettingsDialog';
import StartPage from './StartPage';

import { Address, Card, CardContent, CardHeader, CardTitle, Loader } from '@/components';
import { useBalance, useAccount, roundBalance, usePrivateKey, ShieldFundsForm, SendFundsForm } from '@/domains/account';
import {
  useShielderBalance,
  useWasm,
  useShielderSync,
  useShielderIsReady,
  useShielderClient,
} from '@/domains/shielder';
import { TransactionsList } from '@/domains/transaction';

const Wallet = () => {
  const publicBalance = useBalance();
  const shieldedBalance = useShielderBalance();
  const privateKey = usePrivateKey();
  const shielderClient = useShielderClient();
  const { isWasmLoaded, error } = useWasm();

  // sync shielder once at the component render
  const {
    mutate: sync,
    isPending: isSyncing,
    isSuccess: hasSynced,
    error: syncError,
  } = useShielderSync();

  const shielderIsReady = useShielderIsReady();

  useEffect(() => {
    if (
      isWasmLoaded &&
      !hasSynced &&
      !isSyncing &&
      shielderClient &&
      !syncError
    ) {
      sync();
    }
  }, [isWasmLoaded, hasSynced, isSyncing, sync, shielderClient, syncError]);

  const account = useAccount();

  if (!privateKey) {
    return <StartPage />;
  }

  if (error) {
    return <div>Error loading WASM: {error.message}</div>;
  }

  if (syncError) {
    return <div>Error syncing: {syncError.message}</div>;
  }

  if (!account) {
    return <Loader text="Loading account..." />;
  }

  return (
    <div className="max-w-[500px] w-full mx-auto p-8 text-center">
      <div className="w-full">
        <div className="flex items-center justify-between space-y-2 pb-2">
          <h2 className="text-lg font-bold tracking-tight">AZERO Wallet</h2>
          <div className="flex items-center justify-center space-x-2">
            <Address
              className="text-xs bg-gray-100 p-1 rounded"
              address={account.account.address}
            />
            <SettingsDialog className="bg-gray-100 rounded" />
          </div>
        </div>
        <div className="space-y-4 pt-0">
          <div className="flex flex-col space-y-2">
            <Card className="flex-1">
              <CardHeader className="p-2">
                <CardTitle className="flex items-center text-sm">
                  <WalletIcon className="mr-1 h-4 w-4" /> Public
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <div className="text-sm font-bold">
                  {roundBalance(formatEther(publicBalance))} AZERO
                </div>
              </CardContent>
            </Card>

            <Card className="flex-1">
              <CardHeader className="p-2">
                <CardTitle className="flex items-center text-sm">
                  <Shield className="mr-1 h-4 w-4" />
                  Shielded
                  {shielderIsReady ? (
                    ''
                  ) : (
                    <div className="flex items-center ml-3 mr-1 text-blue-400">
                      <LoaderCircle className="w-4 h-4 animate-spin" />
                      <p>Syncing</p>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <div className="text-sm font-bold">
                  {roundBalance(formatEther(shieldedBalance))} AZERO
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex space-x-2">
            <ShieldFundsForm />
            <SendFundsForm />
          </div>
          <TransactionsList />
        </div>
      </div>
    </div>
  );
};

export default Wallet;
