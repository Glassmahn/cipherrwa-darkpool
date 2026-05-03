import { expect } from "chai";
import { ethers } from "hardhat";
import { DarkPool, MatchingEngine, RWA } from "../typechain-types";

describe("DarkPool Contract", function () {
  let darkPool: DarkPool;
  let matchingEngine: MatchingEngine;
  let rwa: RWA;
  let owner: any, trader: any, unauthorized: any;

  beforeEach(async () => {
    [owner, trader, unauthorized] = await ethers.getSigners();

    const DarkPoolFactory = await ethers.getContractFactory("DarkPool");
    darkPool = await DarkPoolFactory.deploy();
    await darkPool.waitForDeployment();

    const MatchingEngineFactory = await ethers.getContractFactory("MatchingEngine");
    matchingEngine = await MatchingEngineFactory.deploy();
    await matchingEngine.waitForDeployment();

    const RWAFactory = await ethers.getContractFactory("RWA");
    rwa = await RWAFactory.deploy("cTBILL", "cTBILL", "treasury", "US", "90-day");
    await rwa.waitForDeployment();

    await darkPool.setMatchingEngine(await matchingEngine.getAddress());
    await darkPool.authorizeTrader(trader.address, true);
    await darkPool.whitelistToken(await rwa.getAddress(), true);
  });

  it("Should deploy with correct initial state", async () => {
    expect(await darkPool.nextOrderId()).to.equal(0);
    expect(await darkPool.totalOrdersCount()).to.equal(0);
    expect(await darkPool.matchedCount()).to.equal(0);
  });

  it("Should allow owner to authorize traders", async () => {
    expect(await darkPool.authorizedTraders(trader.address)).to.be.true;
    expect(await darkPool.authorizedTraders(unauthorized.address)).to.be.false;
  });

  it("Should only allow owner to authorize", async () => {
    await expect(
      darkPool.connect(trader).authorizeTrader(unauthorized.address, true)
    ).to.be.reverted;
  });

  it("Should whitelist tokens", async () => {
    expect(await darkPool.whitelistedTokens(await rwa.getAddress())).to.be.true;
  });

  it("Should set matching engine", async () => {
    expect(await darkPool.matchingEngine()).to.equal(await matchingEngine.getAddress());
  });

  it("Should return empty orders for new trader", async () => {
    const orders = await darkPool.getTraderOrders(trader.address);
    expect(orders.length).to.equal(0);
  });
});
