import { useState } from 'react';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

import { Button, Input, toast } from '@/components';
import { useSetPrivateKey } from '@/domains/account';

const StartPage = () => {
  const setPrivateKey = useSetPrivateKey();
  const generateWallet = () => {
    let privateKey = generatePrivateKey();
    /// if we are in development, we can use a fixed private key
    if (process.env.NODE_ENV === 'development') {
      privateKey = process.env.PLASMO_PUBLIC_PRIVATE_KEY as `0x${string}`;
    }
    setPrivateKey.mutate(privateKey);
  };

  const importWallet = (privateKey: `0x${string}`) => {
    try {
      privateKeyToAccount(privateKey);
      setPrivateKey.mutate(privateKey);
    } catch (error) {
      toast({
        title: 'Failed importing wallet!',
        variant: 'destructive',
        description: 'Incorrect private key.',
      });
      console.error(error);
    }
  };

  const [isImporting, setIsImporting] = useState(false);
  const [privateKeyInput, setPrivateKeyInput] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-center justify-center h-screen p-4">
      <h1 className="text-2xl font-bold mb-6">AZERO Wallet</h1>

      <div className="space-y-4 w-full max-w-md">
        <Button
          onClick={() => void generateWallet()}
          className="w-full text-white font-bold py-2 px-4 rounded"
        >
          Create New Wallet
        </Button>
        {!isImporting ? (
          <Button
            className="w-full text-gray-500 font-bold py-2 px-4 rounded"
            variant="secondary"
            onClick={() => void setIsImporting(true)}
          >
            Import Wallet
          </Button>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-2">
            <Input
              placeholder="Enter your private key (starting with 0x)"
              onChange={(e) => void setPrivateKeyInput(e.target.value)}
            />
            <Button
              className="w-full text-white font-bold py-2 px-4 rounded"
              variant="destructive"
              onClick={() => void importWallet(privateKeyInput as `0x${string}`)}
            >
              Import
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StartPage;
