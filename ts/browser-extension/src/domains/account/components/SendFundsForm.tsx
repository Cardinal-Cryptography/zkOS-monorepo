import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, SendHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { isAddress, parseEther, TransactionExecutionError } from 'viem';
import { z } from 'zod';

import {
  Button, Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger, DialogFooter, Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage, Input, Switch, toast,
} from '@/components';
import { CONSTANTS } from '@/constants';
import { useAccount, useBalance } from '@/domains/account';
import { useShielderBalance, useShielderClient, useShielderIsReady, useShielderSync } from '@/domains/shielder';
import {
  validateSendTransactionAmount,
  useCurrentGasPrice,
  useIsTransactionInProgress,
} from '@/domains/transaction';

const SendFundsForm = () => {
  const [isTransactionInProgress] = useIsTransactionInProgress();
  const shielderIsReady = useShielderIsReady();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const shielderBalance = useShielderBalance();
  const balance = useBalance();
  const account = useAccount();
  const shielderClient = useShielderClient();
  const currentGasPrice = useCurrentGasPrice();
  const shielderSync = useShielderSync();

  const sendFormSchema = z
    .object({
      address: z
        .string()
        .refine((value) => isAddress(value), { message: 'Invalid address.' }),
      azero: z.string(),
      privacy: z.boolean(),
    })
    .superRefine(({ privacy, azero }, ctx) => {
      const selectedBalance = privacy ? shielderBalance : balance;
      validateSendTransactionAmount(
        selectedBalance,
        (privacy ? 0n : 1n) *
        currentGasPrice *
        CONSTANTS.PUBLIC_SEND_ACTION_GAS_LIMIT
      )(azero, ctx);
    });

  const sendForm = useForm<z.infer<typeof sendFormSchema>>({
    resolver: zodResolver(sendFormSchema),
    defaultValues: {
      address: '' as `0x${string}`,
      azero: '0',
      privacy: true,
    },
    mode: 'onChange',
  });

  const sendFunds = async (
    address: `0x${string}`,
    amount: bigint,
    privacy: boolean
  ) => {
    console.log('Sending funds');
    try {
      if (!privacy) {
        if (!account) {
          throw new Error('Account is not available.');
        }

        await account.sendTransaction({
          to: address,
          value: amount,
          gas: CONSTANTS.PUBLIC_SEND_ACTION_GAS_LIMIT,
        });
      } else {
        if (!shielderClient) {
          throw new Error('ShielderClient is not available.');
        }

        await shielderClient.withdraw(amount, address);
        shielderSync.mutate();
      }
    } catch (error) {
      toast({
        title: 'Error sending funds!',
        variant: 'destructive',
        description:
          (error as TransactionExecutionError).shortMessage ||
          'An error occurred while sending funds.',
      });
    }
  };

  async function onSubmit(values: z.infer<typeof sendFormSchema>) {
    setLoading(true);
    await sendFunds(
      values.address,
      parseEther(values.azero),
      values.privacy
    );
    setLoading(false);
    setOpen(false);
    sendForm.reset();
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
          <SendHorizontal className="mr-2 h-4 w-4" /> Send
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[280px]">
        <DialogHeader>
          <DialogTitle>Send Funds</DialogTitle>
        </DialogHeader>
        <DialogDescription>Send your AZERO privately.</DialogDescription>
        <Form {...sendForm}>
          <form onSubmit={(event) => void sendForm.handleSubmit(onSubmit)(event)}>
            <FormField
              control={sendForm.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={sendForm.control}
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
            <FormField
              control={sendForm.control}
              name="privacy"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2 mt-1">
                  <div>
                    <FormLabel> Send Privately </FormLabel>
                  </div>
                  <div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          void sendForm.trigger('azero');
                        }}
                        className="col-span-3"
                      />
                    </FormControl>
                  </div>
                </FormItem>
              )}
            />
            <DialogFooter className="mt-2">
              {loading ? (
                <Button type="submit" disabled>
                  <Loader2 className="mr-1 animate-spin" /> Sending...
                </Button>
              ) : (
                <Button type="submit"> Send </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default SendFundsForm;
