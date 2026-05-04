import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  const DARKPOOL = "0x0C23295BdA3cd43735c911a098458dD6f617f27d";
  const RWA = "0x36e40621B4dd645354860cDa8562bbD3ac3c56B9";

  const [signer] = await ethers.getSigners();
  console.log("Whitelisting from:", signer.address);

  const DarkPool = await ethers.getContractAt("DarkPool", DARKPOOL);

  const tx = await DarkPool.whitelistToken(RWA, true);
  console.log("TX hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("Confirmed in block:", receipt?.blockNumber);

  const isWhitelisted = await DarkPool.whitelistedTokens(RWA);
  console.log("Token whitelisted:", isWhitelisted);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
