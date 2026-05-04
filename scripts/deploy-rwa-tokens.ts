const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const darkPoolAddress = process.env.NEXT_PUBLIC_DARKPOOL_ADDRESS;
  if (!darkPoolAddress) {
    console.error("Set NEXT_PUBLIC_DARKPOOL_ADDRESS in .env");
    process.exit(1);
  }

  const DarkPool = await ethers.getContractAt("DarkPool", darkPoolAddress);

  // Deploy cREAL
  console.log("\n1. Deploying cREAL...");
  const CREAL = await ethers.deployContract("RWA", [
    "Cipher Real Estate",
    "cREAL",
    "real-estate",
    "Global",
    "Perpetual",
  ]);
  await CREAL.waitForDeployment();
  const crealAddress = await CREAL.getAddress();
  console.log("  cREAL deployed at:", crealAddress);

  // Deploy cCARBON
  console.log("\n2. Deploying cCARBON...");
  const CCARBON = await ethers.deployContract("RWA", [
    "Cipher Carbon Credit",
    "cCARBON",
    "carbon-credit",
    "EU/UN",
    "Vintage 2024",
  ]);
  await CCARBON.waitForDeployment();
  const ccarbonAddress = await CCARBON.getAddress();
  console.log("  cCARBON deployed at:", ccarbonAddress);

  // Whitelist both
  console.log("\n3. Whitelisting tokens...");
  let tx = await DarkPool.whitelistToken(crealAddress, true);
  await tx.wait();
  console.log("  cREAL whitelisted");

  tx = await DarkPool.whitelistToken(ccarbonAddress, true);
  await tx.wait();
  console.log("  cCARBON whitelisted");

  console.log("\n=== COMPLETE ===");
  console.log("NEXT_PUBLIC_RWA_CREAL=", crealAddress);
  console.log("NEXT_PUBLIC_RWA_CCARBON=", ccarbonAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
