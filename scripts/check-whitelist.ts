import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  const DARKPOOL = "0x318F23D39fd29e31a503A2A190Cff95C069E4e77";
  const RWA = "0x2e74A6F0e739B6F61f8c143385d4D80e8f3D9164";

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
