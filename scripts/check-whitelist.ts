import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  const DARKPOOL = "0x0C23295BdA3cd43735c911a098458dD6f617f27d";
  const RWA = "0x36e40621B4dd645354860cDa8562bbD3ac3c56B9";

  const DarkPool = await ethers.getContractAt("DarkPool", DARKPOOL);

  const isWhitelisted = await DarkPool.whitelistedTokens(RWA);
  console.log("RWA token whitelisted:", isWhitelisted);

  // Check the failing tx to see what address was passed
  const provider = ethers.provider;
  const tx = await provider.getTransaction("0xf9516e16623a7168c6da31ac62b55dd267eda186845b4009acc0032c17c37f25");
  console.log("\nFailing tx data:", tx?.data);
  
  // Decode the calldata
  const iface = new ethers.Interface([
    "function placeEncryptedOrder(bytes32[] handles, bytes inputProof, address rwaToken, uint8 side)"
  ]);
  try {
    const decoded = iface.parseTransaction({ data: tx?.data });
    console.log("\nDecoded calldata:");
    console.log("  handles:", decoded?.args[0]);
    console.log("  inputProof length:", decoded?.args[1]?.length);
    console.log("  rwaToken:", decoded?.args[2]);
    console.log("  side:", decoded?.args[3]);
  } catch (e) {
    console.log("Could not decode calldata:", e);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
