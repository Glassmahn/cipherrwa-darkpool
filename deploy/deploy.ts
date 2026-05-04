const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "ETH");

  // 1. Deploy RWA token (cTBILL)
  console.log("\n1. Deploying RWA token...");
  const RWA = await ethers.deployContract("RWA", [
    "Cipher T-Bill",
    "cTBILL",
    "treasury",
    "US",
    "Rolling 90-day",
  ]);
  await RWA.waitForDeployment();
  const rwaAddress = await RWA.getAddress();
  console.log("  RWA deployed at:", rwaAddress);

  // 2. Deploy DarkPool
  console.log("\n2. Deploying DarkPool...");
  const DarkPool = await ethers.deployContract("DarkPool");
  await DarkPool.waitForDeployment();
  const darkPoolAddress = await DarkPool.getAddress();
  console.log("  DarkPool deployed at:", darkPoolAddress);

  // 3. Deploy MatchingEngine
  console.log("\n3. Deploying MatchingEngine...");
  const MatchingEngine = await ethers.deployContract("MatchingEngine");
  await MatchingEngine.waitForDeployment();
  const engineAddress = await MatchingEngine.getAddress();
  console.log("  MatchingEngine deployed at:", engineAddress);

  // 4. Wire up contracts
  console.log("\n4. Wiring up contracts...");
  const tx1 = await DarkPool.setMatchingEngine(engineAddress);
  await tx1.wait();
  console.log("  DarkPool.setMatchingEngine done");

  const tx2 = await MatchingEngine.setDarkPool(darkPoolAddress);
  await tx2.wait();
  console.log("  MatchingEngine.setDarkPool done");

  // 5. Whitelist RWA token
  console.log("\n5. Setting up permissions...");
  const tx3 = await DarkPool.whitelistToken(rwaAddress, true);
  await tx3.wait();
  console.log("  RWA token whitelisted");

  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("RWA_ADDRESS:", rwaAddress);
  console.log("DARKPOOL_ADDRESS:", darkPoolAddress);
  console.log("MATCHING_ENGINE_ADDRESS:", engineAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
