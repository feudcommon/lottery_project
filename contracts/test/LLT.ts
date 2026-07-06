import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

const INITIAL_SUPPLY = 1_000_000n * 10n ** 18n;

describe("LuckyLoopToken", function () {
  async function deployFixture() {
    const [owner, alice, bob, carol] = await ethers.getSigners();
    const token = await ethers.deployContract("LuckyLoopToken");
    return { token, owner, alice, bob, carol };
  }

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      const { token } = await deployFixture();
      expect(await token.name()).to.equal("Lucky Loop Token");
      expect(await token.symbol()).to.equal("LLT");
    });

    it("Should use 18 decimals", async function () {
      const { token } = await deployFixture();
      expect(await token.decimals()).to.equal(18);
    });

    it("Should mint the initial supply to the deployer", async function () {
      const { token, owner } = await deployFixture();
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
      expect(await token.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
    });

    it("Should set the deployer as the owner", async function () {
      const { token, owner } = await deployFixture();
      expect(await token.owner()).to.equal(owner.address);
    });
  });

  describe("Minting", function () {
    it("Should allow the owner to mint new tokens", async function () {
      const { token, alice } = await deployFixture();
      const amount = ethers.parseUnits("1000", 18);

      const before = await token.balanceOf(alice.address);
      await token.mint(alice.address, amount);
      const after = await token.balanceOf(alice.address);

      expect(after - before).to.equal(amount);
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY + amount);
    });

    it("Should revert when a non-owner tries to mint", async function () {
      const { token, alice, bob } = await deployFixture();
      const amount = ethers.parseUnits("1000", 18);

      await expect(
        token.connect(alice).mint(bob.address, amount),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("batchTransfer", function () {
    it("Should transfer to multiple recipients in one call", async function () {
      const { token, alice, bob, carol } = await deployFixture();
      const amounts = [
        ethers.parseUnits("100", 18),
        ethers.parseUnits("200", 18),
        ethers.parseUnits("300", 18),
      ];
      const recipients = [alice.address, bob.address, carol.address];

      await token.batchTransfer(recipients, amounts);

      expect(await token.balanceOf(alice.address)).to.equal(amounts[0]);
      expect(await token.balanceOf(bob.address)).to.equal(amounts[1]);
      expect(await token.balanceOf(carol.address)).to.equal(amounts[2]);
    });

    it("Should revert if recipients and amounts length differ", async function () {
      const { token, alice, bob } = await deployFixture();
      const recipients = [alice.address, bob.address];
      const amounts = [ethers.parseUnits("100", 18)];

      await expect(
        token.batchTransfer(recipients, amounts),
      ).to.be.revertedWith("Recipients and amounts must have same length");
    });

    it("Should revert when called by a non-owner", async function () {
      const { token, alice, bob } = await deployFixture();
      const recipients = [bob.address];
      const amounts = [ethers.parseUnits("100", 18)];

      await expect(
        token.connect(alice).batchTransfer(recipients, amounts),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert if the owner's balance is insufficient", async function () {
      const { token, alice, bob } = await deployFixture();
      const recipients = [alice.address, bob.address];
      // more than the total supply
      const amounts = [INITIAL_SUPPLY, 1n];

      await expect(
        token.batchTransfer(recipients, amounts),
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });
  });

  describe("Burning (ERC20Burnable)", function () {
    it("Should allow a holder to burn their own tokens", async function () {
      const { token, owner } = await deployFixture();
      const burnAmount = ethers.parseUnits("500", 18);

      const before = await token.balanceOf(owner.address);
      await token.burn(burnAmount);
      const after = await token.balanceOf(owner.address);

      expect(before - after).to.equal(burnAmount);
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY - burnAmount);
    });

    it("Should allow burnFrom with a sufficient allowance", async function () {
      const { token, owner, alice } = await deployFixture();
      const burnAmount = ethers.parseUnits("250", 18);

      await token.approve(alice.address, burnAmount);
      await token.connect(alice).burnFrom(owner.address, burnAmount);

      expect(await token.balanceOf(owner.address)).to.equal(
        INITIAL_SUPPLY - burnAmount,
      );
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY - burnAmount);
      expect(await token.allowance(owner.address, alice.address)).to.equal(0);
    });

    it("Should revert burnFrom without a sufficient allowance", async function () {
      const { token, owner, alice } = await deployFixture();
      const burnAmount = ethers.parseUnits("250", 18);

      await expect(
        token.connect(alice).burnFrom(owner.address, burnAmount),
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });
  });
});