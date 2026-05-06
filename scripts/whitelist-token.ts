import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  const DARKPOOL = "0x318F23D39fd29e31a503A2A190Cff95C069E4e77";
  const RWA = "0x2e74A6F0e739B6F61f8c143385d4D80e8f3D9164";

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
