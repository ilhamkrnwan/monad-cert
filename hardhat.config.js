require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// ============================================================
// CRITICAL: Monad charges gas based on gas_LIMIT (not gas used)
// Always set accurate gas limits to avoid overcharging users
// ============================================================

const MONAD_TESTNET_RPC = process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOY_PRIVATE_KEY;

if (!DEPLOYER_PRIVATE_KEY) {
  console.warn("⚠️  WARNING: DEPLOY_PRIVATE_KEY not set in .env — deployment will fail.");
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.24",   // Required by OpenZeppelin v5 dependencies
        settings: {
          optimizer: { enabled: true, runs: 200 },
          evmVersion: "cancun", // Monad supports Cancun (mcopy opcode required by OZ v5)
        },
      },
      {
        version: "0.8.20",   // Fallback for other contracts
        settings: {
          optimizer: { enabled: true, runs: 200 },
        },
      },
    ],
  },

  networks: {
    // --------------------------------------------------------
    // Monad Testnet
    // Chain ID : 10143
    // Explorer : https://testnet.monadscan.com
    // Faucet   : https://faucet.monad.xyz
    // --------------------------------------------------------
    monadTestnet: {
      url: MONAD_TESTNET_RPC,
      chainId: 10143,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
      // Monad gas: charged on gas_limit not gas_used
      // gasPrice: "auto" lets ethers.js use EIP-1559 (recommended)
      gasPrice: "auto",
      timeout: 120000,   // 2 min timeout for testnet latency
    },

    // --------------------------------------------------------
    // Monad Mainnet (placeholder — uncomment when ready)
    // Chain ID : 143
    // Explorer : https://monadscan.com
    // --------------------------------------------------------
    // monadMainnet: {
    //   url: "https://rpc.monad.xyz",
    //   chainId: 143,
    //   accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    //   gasPrice: "auto",
    // },

    // Local Hardhat network (for testing)
    hardhat: {
      chainId: 31337,
    },
  },

  paths: {
    sources:   "./contracts",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },
};
