import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying SCAI Token...");
  // deployment address 0x290483A8fC8ed76647dA75260eb2a2594B5330a2
  // rpc url https://mainnet-rpc.scai.network
  // chain id 34(0x22)
  // explorer url https://explorer.securechain.ai
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📍 Deploying from:", deployer.address);

  // Deploy contract
  const SCAIToken = await ethers.getContractFactory("SCAIToken");
  const scai = await SCAIToken.deploy();

  await scai.waitForDeployment();
  const contractAddress = await scai.getAddress();

  console.log("✅ SCAI Token deployed to:", contractAddress);

  // Log deployment info
  console.log("\n📋 Deployment Info:");
  console.log("═".repeat(50));
  console.log("Contract Address:", contractAddress);
  console.log("Deployer Address:", deployer.address);
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("═".repeat(50));

  // Save deployment info to .env
  console.log("\n📝 Add to your .env file:");
  console.log(`SCAI_CONTRACT_ADDRESS=${contractAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });