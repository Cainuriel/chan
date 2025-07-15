/**
 * @title Deployment Script for Real Cryptographic UTXO System
 * @dev Deploys RealBBSVerifier, RealPedersenVerifier, and UTXOVault contracts
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 DEPLOYING REAL CRYPTOGRAPHIC UTXO SYSTEM");
  console.log("=============================================");
  
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");

  // ========================
  // STEP 1: DEPLOY LIBRARIES
  // ========================
  
  console.log("\n📚 Step 1: Deploying cryptographic libraries...");
  
  // Deploy RealBBSVerifier library
  console.log("   Deploying RealBBSVerifier...");
  const RealBBSVerifier = await ethers.deployContract("RealBBSVerifier");
  await RealBBSVerifier.waitForDeployment();
  const bbsVerifierAddress = await RealBBSVerifier.getAddress();
  console.log("   ✅ RealBBSVerifier deployed at:", bbsVerifierAddress);
  
  // Deploy RealPedersenVerifier library
  console.log("   Deploying RealPedersenVerifier...");
  const RealPedersenVerifier = await ethers.deployContract("RealPedersenVerifier");
  await RealPedersenVerifier.waitForDeployment();
  const pedersenVerifierAddress = await RealPedersenVerifier.getAddress();
  console.log("   ✅ RealPedersenVerifier deployed at:", pedersenVerifierAddress);

  // ========================
  // STEP 2: DEPLOY MAIN CONTRACT
  // ========================
  
  console.log("\n🏛️ Step 2: Deploying main UTXO contract...");
  
  // Deploy UTXOVault with linked libraries
  console.log("   Deploying UTXOVault with linked libraries...");
  const UTXOVault = await ethers.deployContract("UTXOVault", [], {
    libraries: {
      RealBBSVerifier: bbsVerifierAddress,
      RealPedersenVerifier: pedersenVerifierAddress
    }
  });
  await UTXOVault.waitForDeployment();
  const utxoVaultAddress = await UTXOVault.getAddress();
  console.log("   ✅ UTXOVault deployed at:", utxoVaultAddress);

  // ========================
  // STEP 3: INITIAL CONFIGURATION
  // ========================
  
  console.log("\n⚙️ Step 3: Initial configuration...");
  
  // Set proof validity period (1 hour = 3600 seconds)
  console.log("   Setting proof validity period to 1 hour...");
  await UTXOVault.setProofValidityPeriod(3600);
  console.log("   ✅ Proof validity period set");

  // ========================
  // DEPLOYMENT SUMMARY
  // ========================
  
  console.log("\n🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!");
  console.log("=====================================");
  console.log("📋 Contract Addresses:");
  console.log("   RealBBSVerifier:     ", bbsVerifierAddress);
  console.log("   RealPedersenVerifier:", pedersenVerifierAddress);
  console.log("   UTXOVault:           ", utxoVaultAddress);
  
  console.log("\n🔐 Cryptographic Features:");
  console.log("   ✅ Real BBS+ Signature Verification");
  console.log("   ✅ Real Pedersen Commitment Verification");
  console.log("   ✅ Real Nullifier Double-Spend Prevention");
  console.log("   ✅ Automatic ERC20 Token Registration");
  console.log("   ✅ Mathematical Range Proof Verification");

  // ========================
  // SAVE DEPLOYMENT INFO
  // ========================
  
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      RealBBSVerifier: bbsVerifierAddress,
      RealPedersenVerifier: pedersenVerifierAddress,
      UTXOVault: utxoVaultAddress
    },
    features: {
      realCryptography: true,
      bbsSignatures: true,
      pedersenCommitments: true,
      nullifierPrevention: true,
      tokenRegistry: true
    }
  };

  // Save to file for frontend integration
  const fs = require('fs');
  const deploymentPath = './src/contracts/deployment.json';
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n💾 Deployment info saved to:", deploymentPath);

  console.log("\n🚀 Ready for production with real cryptography!");
  return deploymentInfo;
}

// Handle errors
main()
  .then((deploymentInfo) => {
    console.log("✅ Deployment script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });

module.exports = { main };
