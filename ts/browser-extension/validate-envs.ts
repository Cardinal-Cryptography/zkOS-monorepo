import { config } from 'dotenv';
import { z } from 'zod';

config();

export const envSchema = z.object({
  PLASMO_PUBLIC_PRIVATE_KEY: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid private key format.')
    .or(z.literal('')),
  PLASMO_PUBLIC_RPC_URL: z
    .string()
    .url('Invalid RPC URL format.'),
  PLASMO_PUBLIC_RELAYER_URL: z
    .string()
    .url('Invalid Relayer URL format.'),
  PLASMO_PUBLIC_SHIELDER_CONTRACT_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid contract address format.'),
  PLASMO_PUBLIC_CHAIN_ID: z
    .string()
    .regex(/^\d+$/, 'Invalid chain ID format.'),
  PLASMO_PUBLIC_RELAYER_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid relayer address format.'),
  PLASMO_PUBLIC_STORAGE_MODE: z
    .enum(['webapp', 'extension']),
});

const parsedEnvs = envSchema.safeParse(process.env);

if (!parsedEnvs.success) {
  console.error('Invalid environment variables: ', parsedEnvs.error.format());
  process.exit(1);
}

export const env = parsedEnvs.data;
