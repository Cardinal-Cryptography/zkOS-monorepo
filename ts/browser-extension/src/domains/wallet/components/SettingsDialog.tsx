import { Settings } from 'lucide-react';

import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  toast,
} from '@/components';
import { usePrivateKey } from '@/domains/account';
import cn from '@/utils/classnames';

export type SettingsProps = {
  className?: string,
};

export const SettingsDialog = (props: SettingsProps) => {
  const privateKey = usePrivateKey();

  const copyPrivateKey = () => {
    void navigator.clipboard.writeText(privateKey as string);
    toast({
      title: 'Exported!',
      description: 'Private key copied to clipboard.',
    });
  };

  return (
    <Dialog>
      <DialogTrigger>
        <Settings
          className={cn(
            props.className,
            'w-6 h-6 text-black hover:text-blue-500'
          )}
        />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Set up your private wallet</DialogDescription>
        </DialogHeader>
        <div className="flex items-center">
          <Button onClick={() => void copyPrivateKey()}>
            Copy private key to clipboard
          </Button>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
