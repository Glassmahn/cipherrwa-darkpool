const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying MatchingEngine upgrade...");

  const ME = await ethers.deployContract("MatchingEngine");
  await ME.waitForDeployment();
  const addr = await ME.getAddress();
  console.log("MatchingEngine deployed at:", addr);

  const DARKPOOL = "0x318F23D39fd29e31a503A2A190Cff95C069E4e77";
  const tx = await ME.setDarkPool(DARKPOOL);
  await tx.wait();
  console.log("setDarkPool done");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
