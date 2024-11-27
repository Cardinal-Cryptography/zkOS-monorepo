import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { shieldActionGasLimit } from 'shielder-sdk';
import { parseEther, TransactionExecutionError } from 'viem';
import { z } from 'zod';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  toast,
} from '@/components';
import { useBalance } from '@/domains/account';
import { useShielderClient, useShielderIsReady, useShielderSync } from '@/domains/shielder';
import { useCurrentGasPrice, useIsTransactionInProgress, validateShieldTransactionAmount } from '@/domains/transaction';

const ShieldFundsForm = () => {
  const [isTransactionInProgress] = useIsTransactionInProgress();
  const shielderIsReady = useShielderIsReady();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const balance = useBalance();
  const shielderClient = useShielderClient();
  const shielderSync = useShielderSync();
  const currentGasPrice = useCurrentGasPrice();

  const shieldFormSchema = z
    .object({
      azero: z.string(),
    })
    .superRefine(({ azero }, ctx) => {
      validateShieldTransactionAmount(
        balance,
        BigInt(currentGasPrice * shieldActionGasLimit)
      )(azero, ctx);
    });

  const shieldForm = useForm<z.infer<typeof shieldFormSchema>>({
    resolver: zodResolver(shieldFormSchema),
    defaultValues: {
      azero: '0',
    },
    mode: 'onChange',
  });

  useEffect(() => {
    void shieldForm.trigger();
  }, [balance, shieldForm]);

  const shieldFunds = async (amount: bigint) => {
    console.log('Shielding funds');
    if (!shielderClient) {
      throw new Error('ShielderClient is not available.');
    }

    try {
      await shielderClient.shield(amount);
      shielderSync.mutate();
    } catch (error) {
      toast({
        title: 'Error shielding funds!',
        variant: 'destructive',
        description:
          (error as TransactionExecutionError).shortMessage ||
          'An error occurred while shielding funds.',
      });
    }
  };

  async function onSubmit(values: z.infer<typeof shieldFormSchema>) {
    setLoading(true);
    await shieldFunds(parseEther(values.azero));
    setOpen(false);
    setLoading(false);
    shieldForm.reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={isTransactionInProgress || !shielderIsReady}
        >
          <ShieldCheck className="mr-2 h-4 w-4" /> Shield
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[280px]">
        <DialogHeader>
          <DialogTitle>Shield Funds</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Make your AZERO private. Shielded funds are not visible for the
          public.
        </DialogDescription>

        <Form {...shieldForm}>
          <form onSubmit={(event) => void shieldForm.handleSubmit(onSubmit)(event)}>
            <FormField
              control={shieldForm.control}
              name="azero"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>AZERO</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="mt-2">
              {loading ? (
                <Button type="submit" disabled>
                  <Loader2 className="mr-1 animate-spin" /> Shielding...
                </Button>
              ) : (
                <Button type="submit"> Shield </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ShieldFundsForm;
