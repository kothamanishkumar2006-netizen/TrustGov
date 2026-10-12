import { expect } from "chai";
import { ethers } from "hardhat";
import { TrustGovRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("TrustGovRegistry Smart Contract", function () {
  let registry: TrustGovRegistry;
  let owner: SignerWithAddress;
  let unauthorizedUser: SignerWithAddress;

  // Sample bytes32 hashes
  const sampleDidHash = ethers.keccak256(ethers.toUtf8Bytes("did:trustgov:550e8400-e29b-41d4-a716-446655440001"));
  const sampleCredentialHash = ethers.keccak256(ethers.toUtf8Bytes("VC-TG-TG-OFF-001-CANONICAL-PAYLOAD-HASH"));
  const sampleOfficerDidHash = sampleDidHash;
  const sampleIssuerDidHash = ethers.keccak256(ethers.toUtf8Bytes("did:trustgov:a0000000-0000-4000-8000-000000000001"));

  beforeEach(async function () {
    [owner, unauthorizedUser] = await ethers.getSigners();
    const TrustGovRegistryFactory = await ethers.getContractFactory("TrustGovRegistry");
    registry = await TrustGovRegistryFactory.deploy();
    await registry.waitForDeployment();
  });

  describe("1. Deployment & Ownership", function () {
    it("should deploy with deployer as owner", async function () {
      expect(await registry.owner()).to.equal(owner.address);
    });

    it("should allow owner to transfer ownership", async function () {
      await registry.transferOwnership(unauthorizedUser.address);
      expect(await registry.owner()).to.equal(unauthorizedUser.address);
    });

    it("should reject ownership transfer to zero address", async function () {
      await expect(
        registry.transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(registry, "ZeroAddressNotAllowed");
    });
  });

  describe("2. DID Registration", function () {
    it("should allow owner to register a valid DID hash", async function () {
      await expect(registry.registerDID(sampleDidHash))
        .to.emit(registry, "DIDRegistered");

      expect(await registry.isDIDRegistered(sampleDidHash)).to.be.true;

      const record = await registry.getDIDRecord(sampleDidHash);
      expect(record.didHash).to.equal(sampleDidHash);
      expect(record.registered).to.be.true;
      expect(record.registeredAt).to.be.gt(0);
    });

    it("should reject duplicate DID registration", async function () {
      await registry.registerDID(sampleDidHash);
      await expect(
        registry.registerDID(sampleDidHash)
      ).to.be.revertedWithCustomError(registry, "DIDAlreadyRegistered")
        .withArgs(sampleDidHash);
    });

    it("should reject zero hash DID registration", async function () {
      await expect(
        registry.registerDID(ethers.ZeroHash)
      ).to.be.revertedWithCustomError(registry, "ZeroHashNotAllowed");
    });

    it("should reject unauthorized DID registration", async function () {
      await expect(
        registry.connect(unauthorizedUser).registerDID(sampleDidHash)
      ).to.be.revertedWithCustomError(registry, "Unauthorized")
        .withArgs(unauthorizedUser.address);
    });
  });

  describe("3. Credential Registration", function () {
    it("should allow owner to register a credential with ACTIVE status", async function () {
      await expect(
        registry.registerCredential(
          sampleCredentialHash,
          sampleOfficerDidHash,
          sampleIssuerDidHash,
          1 // ACTIVE
        )
      ).to.emit(registry, "CredentialRegistered");

      expect(await registry.isCredentialRegistered(sampleCredentialHash)).to.be.true;

      const record = await registry.getCredentialRecord(sampleCredentialHash);
      expect(record.credentialHash).to.equal(sampleCredentialHash);
      expect(record.officerDIDHash).to.equal(sampleOfficerDidHash);
      expect(record.issuerDIDHash).to.equal(sampleIssuerDidHash);
      expect(record.status).to.equal(1); // ACTIVE
      expect(record.registered).to.be.true;
      expect(record.registeredAt).to.be.gt(0);
    });

    it("should allow verification of credential hash", async function () {
      await registry.registerCredential(
        sampleCredentialHash,
        sampleOfficerDidHash,
        sampleIssuerDidHash,
        1 // ACTIVE
      );

      const [registered, status, registeredAt] = await registry.verifyCredentialHash(sampleCredentialHash);
      expect(registered).to.be.true;
      expect(status).to.equal(1); // ACTIVE
      expect(registeredAt).to.be.gt(0);
    });

    it("should reject duplicate credential registration", async function () {
      await registry.registerCredential(
        sampleCredentialHash,
        sampleOfficerDidHash,
        sampleIssuerDidHash,
        1 // ACTIVE
      );

      await expect(
        registry.registerCredential(
          sampleCredentialHash,
          sampleOfficerDidHash,
          sampleIssuerDidHash,
          1
        )
      ).to.be.revertedWithCustomError(registry, "CredentialAlreadyRegistered")
        .withArgs(sampleCredentialHash);
    });

    it("should reject zero hash credential registration", async function () {
      await expect(
        registry.registerCredential(
          ethers.ZeroHash,
          sampleOfficerDidHash,
          sampleIssuerDidHash,
          1
        )
      ).to.be.revertedWithCustomError(registry, "ZeroHashNotAllowed");
    });

    it("should reject credential registration with NONE status", async function () {
      await expect(
        registry.registerCredential(
          sampleCredentialHash,
          sampleOfficerDidHash,
          sampleIssuerDidHash,
          0 // NONE
        )
      ).to.be.revertedWithCustomError(registry, "InvalidInitialStatus");
    });

    it("should reject credential registration with REVOKED status", async function () {
      await expect(
        registry.registerCredential(
          sampleCredentialHash,
          sampleOfficerDidHash,
          sampleIssuerDidHash,
          3 // REVOKED
        )
      ).to.be.revertedWithCustomError(registry, "CannotRegisterAsRevoked");
    });

    it("should reject unauthorized credential registration", async function () {
      await expect(
        registry.connect(unauthorizedUser).registerCredential(
          sampleCredentialHash,
          sampleOfficerDidHash,
          sampleIssuerDidHash,
          1
        )
      ).to.be.revertedWithCustomError(registry, "Unauthorized")
        .withArgs(unauthorizedUser.address);
    });
  });

  describe("4. Credential Lifecycle & Status Transitions", function () {
    beforeEach(async function () {
      await registry.registerCredential(
        sampleCredentialHash,
        sampleOfficerDidHash,
        sampleIssuerDidHash,
        1 // ACTIVE
      );
    });

    it("should allow transition: ACTIVE -> SUSPENDED", async function () {
      await expect(
        registry.updateCredentialStatus(sampleCredentialHash, 2) // SUSPENDED
      ).to.emit(registry, "CredentialStatusUpdated");

      const record = await registry.getCredentialRecord(sampleCredentialHash);
      expect(record.status).to.equal(2); // SUSPENDED
    });

    it("should allow transition: SUSPENDED -> ACTIVE", async function () {
      await registry.updateCredentialStatus(sampleCredentialHash, 2); // SUSPENDED
      await registry.updateCredentialStatus(sampleCredentialHash, 1); // ACTIVE

      const record = await registry.getCredentialRecord(sampleCredentialHash);
      expect(record.status).to.equal(1); // ACTIVE
    });

    it("should allow transition: ACTIVE -> REVOKED", async function () {
      await expect(
        registry.updateCredentialStatus(sampleCredentialHash, 3) // REVOKED
      ).to.emit(registry, "CredentialStatusUpdated");

      const record = await registry.getCredentialRecord(sampleCredentialHash);
      expect(record.status).to.equal(3); // REVOKED
    });

    it("should allow transition: SUSPENDED -> REVOKED", async function () {
      await registry.updateCredentialStatus(sampleCredentialHash, 2); // SUSPENDED
      await registry.updateCredentialStatus(sampleCredentialHash, 3); // REVOKED

      const record = await registry.getCredentialRecord(sampleCredentialHash);
      expect(record.status).to.equal(3); // REVOKED
    });

    it("should FORBID transition: REVOKED -> ACTIVE (Permanent Revocation)", async function () {
      await registry.updateCredentialStatus(sampleCredentialHash, 3); // REVOKED

      await expect(
        registry.updateCredentialStatus(sampleCredentialHash, 1) // Attempt ACTIVE
      ).to.be.revertedWithCustomError(registry, "RevocationIsPermanent");
    });

    it("should FORBID transition: REVOKED -> SUSPENDED (Permanent Revocation)", async function () {
      await registry.updateCredentialStatus(sampleCredentialHash, 3); // REVOKED

      await expect(
        registry.updateCredentialStatus(sampleCredentialHash, 2) // Attempt SUSPENDED
      ).to.be.revertedWithCustomError(registry, "RevocationIsPermanent");
    });

    it("should reject status update for unregistered credential", async function () {
      const unregisteredHash = ethers.keccak256(ethers.toUtf8Bytes("NON-EXISTENT"));
      await expect(
        registry.updateCredentialStatus(unregisteredHash, 2)
      ).to.be.revertedWithCustomError(registry, "CredentialNotRegistered")
        .withArgs(unregisteredHash);
    });

    it("should reject setting status to NONE", async function () {
      await expect(
        registry.updateCredentialStatus(sampleCredentialHash, 0)
      ).to.be.revertedWithCustomError(registry, "InvalidStatusTransition");
    });

    it("should reject updating to the same status", async function () {
      await expect(
        registry.updateCredentialStatus(sampleCredentialHash, 1) // Already ACTIVE
      ).to.be.revertedWithCustomError(registry, "StatusUnchanged");
    });

    it("should reject unauthorized status update", async function () {
      await expect(
        registry.connect(unauthorizedUser).updateCredentialStatus(sampleCredentialHash, 2)
      ).to.be.revertedWithCustomError(registry, "Unauthorized")
        .withArgs(unauthorizedUser.address);
    });
  });
});
