import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying SCAI Token...");

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