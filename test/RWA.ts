import { expect } from "chai";
import { ethers } from "hardhat";
import { RWA } from "../typechain-types";

describe("RWA Contract", function () {
  let rwa: RWA;
  let owner: any, trader: any;

  beforeEach(async () => {
    [owner, trader] = await ethers.getSigners();
    const RWAFactory = await ethers.getContractFactory("RWA");
    rwa = await RWAFactory.deploy(
      "Cipher Treasury Bills",
      "cTBILL",
      "treasury",
      "US",
      "Rolling 90-day"
    );
    await rwa.waitForDeployment();
  });

  it("Should deploy with correct metadata", async () => {
    expect(await rwa.name()).to.equal("Cipher Treasury Bills");
    expect(await rwa.symbol()).to.equal("cTBILL");
    expect(await rwa.assetType()).to.equal("treasury");
    expect(await rwa.jurisdiction()).to.equal("US");
    expect(await rwa.maturity()).to.equal("Rolling 90-day");
  });

  it("Should allow owner to add/remove whitelist", async () => {
    await rwa.addToWhitelist(trader.address);
    expect(await rwa.whitelist(trader.address)).to.be.true;

    await rwa.removeFromWhitelist(trader.address);
    expect(await rwa.whitelist(trader.address)).to.be.false;
  });

  it("Should only allow owner to whitelist", async () => {
    await expect(
      rwa.connect(trader).addToWhitelist(trader.address)
    ).to.be.reverted;
  });

  it("Should have zero total supply initially", async () => {
    expect(await rwa.totalSupply()).to.equal(0);
  });

  it("Should return correct token decimals", async () => {
    expect(await rwa.decimals()).to.equal(6);
  });
});
