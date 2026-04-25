const { ethers } = require("hardhat");

/**
 * Deploy script for EduTrust SBT contract
 * Network: Monad Testnet (Chain ID: 10143)
 *
 * Usage:
 *   npx hardhat run scripts/deploy.js --network monadTestnet
 *
 * Prerequisites:
 *   1. Set DEPLOY_PRIVATE_KEY in .env (your deployer wallet)
 *   2. Set ADMIN_WALLET in .env (the Provider Admin wallet address)
 *   3. Ensure deployer wallet has MON testnet tokens (https://faucet.monad.xyz)
 */
async function main() {
  console.log("\n🚀 MonadCert — EduTrust Deployment Script");
  console.log("==========================================\n");

  // ── 1. Get deployer info ──────────────────────────────────────
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const balance = await ethers.provider.getBalance(deployerAddress);

  console.log("📋 Deployer address :", deployerAddress);
  console.log("💰 Deployer balance :", ethers.formatEther(balance), "MON");

  if (balance === 0n) {
    throw new Error("❌ Deployer wallet has 0 MON. Fund it via https://faucet.monad.xyz");
  }

  // ── 2. Determine admin wallet ─────────────────────────────────
  // initialOwner = the Provider Admin who controls grantInstitution / revoke
  // Default: deployer wallet. Override via ADMIN_WALLET env var.
  const adminWallet = process.env.ADMIN_WALLET || deployerAddress;
  console.log("🔑 Protocol Admin   :", adminWallet);

  if (adminWallet !== deployerAddress) {
    console.log("   (using ADMIN_WALLET from .env — different from deployer)");
  }

  // ── 3. Get contract factory ───────────────────────────────────
  const EduTrust = await ethers.getContractFactory("EduTrust");

  // ── 4. Estimate deployment gas ────────────────────────────────
  // Monad charges on gas_limit — important to estimate accurately
  const deployTx = await EduTrust.getDeployTransaction(adminWallet);
  const estimatedGas = await ethers.provider.estimateGas(deployTx);
  const feeData = await ethers.provider.getFeeData();

  console.log("\n⛽ Gas estimate     :", estimatedGas.toString(), "gas units");
  console.log("💲 Base fee         :", ethers.formatUnits(feeData.gasPrice || 0n, "gwei"), "gwei");

  // ── 5. Deploy ─────────────────────────────────────────────────
  console.log("\n⏳ Deploying EduTrust...");
  const contract = await EduTrust.deploy(adminWallet);

  console.log("📡 Transaction hash :", contract.deploymentTransaction().hash);
  console.log("⏳ Waiting for confirmation...\n");

  // Wait for 2 confirmations (Monad finalizes fast ~400ms blocks)
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();

  // ── 6. Verify deployment ──────────────────────────────────────
  const deployedCode = await ethers.provider.getCode(contractAddress);
  if (deployedCode === "0x") {
    throw new Error("❌ Deployment failed — no code at contract address");
  }

  // ── 7. Print summary ──────────────────────────────────────────
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║        ✅  DEPLOYMENT SUCCESSFUL                 ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log(`║  Contract   : EduTrust (EDUT SBT)                ║`);
  console.log(`║  Network    : Monad Testnet (Chain ID: 10143)     ║`);
  console.log(`║  Address    : ${contractAddress}  ║`);
  console.log(`║  Admin      : ${adminWallet}  ║`);
  console.log("╚══════════════════════════════════════════════════╝");
  console.log("\n📋 Next Steps:");
  console.log("  1. Save contract address → give to frontend team (Reyhan)");
  console.log("  2. Update .env → NEXT_PUBLIC_EDUTRUST_ADDRESS=" + contractAddress);
  console.log("  3. Get ABI from: artifacts/contracts/EduTrust.sol/EduTrust.json");
  console.log("  4. Explore: https://testnet.monadscan.com/address/" + contractAddress);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
