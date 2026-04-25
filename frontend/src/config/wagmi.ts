import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { monadTestnet } from 'wagmi/chains';
import { http } from 'wagmi';

export const config = getDefaultConfig({
  appName: 'MonadCert',
  projectId: 'a2c70c7cde8ed64ca250de7616de2bcb',
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: http('https://testnet-rpc.monad.xyz'),
  },
  ssr: true,
});
