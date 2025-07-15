# Real Cryptographic UTXO System - Deployment Commands

## Prerequisites
npm install --save-dev hardhat @nomicfoundation/hardhat-ethers ethers

## Local Development Network
npx hardhat node

## Deploy to Local Network
npx hardhat run scripts/deploy.js --network localhost

## Deploy to Testnet (Sepolia)
npx hardhat run scripts/deploy.js --network sepolia

## Deploy to Mainnet
npx hardhat run scripts/deploy.js --network mainnet

## Verify Contracts (after deployment)
npx hardhat verify --network <network> <contract-address>

## Example Usage
# 1. Start local node
npx hardhat node

# 2. Deploy contracts
npx hardhat run scripts/deploy.js --network localhost

# 3. Contract addresses will be saved to: src/contracts/deployment.json
