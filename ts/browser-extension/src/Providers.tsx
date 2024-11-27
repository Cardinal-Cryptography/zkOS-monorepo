import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { WasmProvider } from './domains/shielder';

import { Toaster } from '@/components';

type Props = { children: ReactNode };

export const Providers = ({ children }: Props) => {
  const queryClient = new QueryClient();

  return (
    <>
      <QueryClientProvider client={queryClient}>
        <WasmProvider>{children}</WasmProvider>
      </QueryClientProvider>
      <Toaster />
    </>
  );
};
