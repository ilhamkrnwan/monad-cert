import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { monadTestnet } from 'wagmi/chains';
import { http } from 'wagmi';

export const config = getDefaultConfig({
  appName: 'MonadCert',
  projectId: '3bc9b6eeab33c7f8a7e0ed8a3ed14db3',
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: http('https://testnet-rpc.monad.xyz'),
  },
  ssr: true,
});
