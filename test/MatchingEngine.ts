import { expect } from "chai";
import { ethers } from "hardhat";
import { MatchingEngine } from "../typechain-types";

describe("MatchingEngine Contract", function () {
  let matchingEngine: MatchingEngine;
  let owner: any, trader: any;

  beforeEach(async () => {
    [owner, trader] = await ethers.getSigners();
    const MatchingEngineFactory = await ethers.getContractFactory("MatchingEngine");
    matchingEngine = await MatchingEngineFactory.deploy();
    await matchingEngine.waitForDeployment();
  });

  it("Should deploy with correct initial state", async () => {
    expect(await matchingEngine.getMatchHistoryLength()).to.equal(0);
  });

  it("Should have zero TWAP count initially", async () => {
    const zeroAddr = ethers.ZeroAddress;
    expect(await matchingEngine.getTWAPCount(zeroAddr)).to.equal(0);
  });

  it("Should only allow owner to set dark pool", async () => {
    await expect(
      matchingEngine.connect(trader).setDarkPool(trader.address)
    ).to.be.reverted;
  });

  it("Should set dark pool address by owner", async () => {
    await matchingEngine.setDarkPool(trader.address);
    expect(await matchingEngine.darkPool()).to.equal(trader.address);
  });
});
