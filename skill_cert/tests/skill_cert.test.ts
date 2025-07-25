import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const simnet = (globalThis as any).simnet;

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const address2 = accounts.get("wallet_2")!;
const address3 = accounts.get("wallet_3")!;
const deployer = accounts.get("deployer")!;

const contractName = "skill-cert";

// Issuer type constants
const ISSUER_EDUCATIONAL = 1;
const ISSUER_CORPORATE = 2;
const ISSUER_PROFESSIONAL = 3;

// Certification level constants
const LEVEL_BASIC = 1;
const LEVEL_INTERMEDIATE = 2;
const LEVEL_ADVANCED = 3;
const LEVEL_EXPERT = 4;

describe("SkillCert Contract Tests", () => {
  beforeEach(() => {
    simnet.mineEmptyBlocks(1);
  });

  describe("Read-Only Functions", () => {
    it("get-credential-details returns none for non-existent credential", () => {
      const { result } = simnet.callReadOnlyFn(contractName, "get-credential-details", [Cl.uint(999)], deployer);
      expect(result).toBeNone();
    });

    it("get-issuer-info returns none for non-existent issuer", () => {
      const { result } = simnet.callReadOnlyFn(contractName, "get-issuer-info", [Cl.principal(address1)], deployer);
      expect(result).toBeNone();
    });

    it("get-holder-profile returns none for non-existent holder", () => {
      const { result } = simnet.callReadOnlyFn(contractName, "get-holder-profile", [Cl.principal(address1)], deployer);
      expect(result).toBeNone();
    });

    it("get-skill-category returns none for non-existent category", () => {
      const { result } = simnet.callReadOnlyFn(contractName, "get-skill-category", [Cl.stringUtf8("NonExistent")], deployer);
      expect(result).toBeNone();
    });

    it("get-total-credentials returns correct initial value", () => {
      const { result } = simnet.callReadOnlyFn(contractName, "get-total-credentials", [], deployer);
      expect(result).toBeUint(0);
    });

    it("is-credential-valid returns error for non-existent credential", () => {
      const { result } = simnet.callReadOnlyFn(contractName, "is-credential-valid", [Cl.uint(999)], deployer);
      expect(result).toBeErr(Cl.uint(0));
    });
  });

  describe("Issuer Registration Function", () => {
    it("register-issuer allows valid issuer registration", () => {
      const { result } = simnet.callPublicFn(contractName, "register-issuer", [
        Cl.stringUtf8("Tech University"),
        Cl.uint(ISSUER_EDUCATIONAL)
      ], address1);
      
      expect(result).toBeOk(Cl.bool(true));
    });

    it("register-issuer stores information correctly", () => {
      simnet.callPublicFn(contractName, "register-issuer", [
        Cl.stringUtf8("Tech University"),
        Cl.uint(ISSUER_EDUCATIONAL)
      ], address1);

      const { result } = simnet.callReadOnlyFn(contractName, "get-issuer-info", [Cl.principal(address1)], deployer);
      expect(result).toBeSome(
        Cl.tuple({
          name: Cl.stringUtf8("Tech University"),
          "issuer-type": Cl.uint(ISSUER_EDUCATIONAL),
          verified: Cl.bool(false),
          "credentials-issued": Cl.uint(0),
          "reputation-score": Cl.uint(0),
        })
      );
    });

    it("register-issuer prevents duplicate registration", () => {
      simnet.callPublicFn(contractName, "register-issuer", [
        Cl.stringUtf8("Tech University"),
        Cl.uint(ISSUER_EDUCATIONAL)
      ], address1);

      const { result } = simnet.callPublicFn(contractName, "register-issuer", [
        Cl.stringUtf8("Another University"),
        Cl.uint(ISSUER_CORPORATE)
      ], address1);
      
      expect(result).toBeErr(Cl.uint(103)); // err-invalid-parameter
    });

    it("register-issuer validates issuer type bounds", () => {
      let { result } = simnet.callPublicFn(contractName, "register-issuer", [
        Cl.stringUtf8("Invalid Issuer"),
        Cl.uint(0)
      ], address1);
      expect(result).toBeErr(Cl.uint(103));

      ({ result } = simnet.callPublicFn(contractName, "register-issuer", [
        Cl.stringUtf8("Invalid Issuer"),
        Cl.uint(4)
      ], address1));
      expect(result).toBeErr(Cl.uint(103));
    });

    it("register-issuer prevents registration when contract is paused", () => {
      simnet.callPublicFn(contractName, "toggle-contract-pause", [], deployer);

      const { result } = simnet.callPublicFn(contractName, "register-issuer", [
        Cl.stringUtf8("Tech University"),
        Cl.uint(ISSUER_EDUCATIONAL)
      ], address1);
      
      expect(result).toBeErr(Cl.uint(103)); // err-invalid-parameter
    });
  });

  describe("Verify Issuer Function", () => {
    beforeEach(() => {
      simnet.callPublicFn(contractName, "register-issuer", [
        Cl.stringUtf8("Tech University"),
        Cl.uint(ISSUER_EDUCATIONAL)
      ], address1);
    });

    it("verify-issuer allows owner to verify issuer", () => {
      const { result } = simnet.callPublicFn(contractName, "verify-issuer", [
        Cl.principal(address1)
      ], deployer);
      
      expect(result).toBeOk(Cl.bool(true));
    });

    it("verify-issuer updates verification status correctly", () => {
      simnet.callPublicFn(contractName, "verify-issuer", [Cl.principal(address1)], deployer);

      const { result } = simnet.callReadOnlyFn(contractName, "get-issuer-info", [Cl.principal(address1)], deployer);
      expect(result).toBeSome(
        Cl.tuple({
          name: Cl.stringUtf8("Tech University"),
          "issuer-type": Cl.uint(ISSUER_EDUCATIONAL),
          verified: Cl.bool(true),
          "credentials-issued": Cl.uint(0),
          "reputation-score": Cl.uint(0),
        })
      );
    });

    it("verify-issuer prevents non-owner from verifying", () => {
      const { result } = simnet.callPublicFn(contractName, "verify-issuer", [
        Cl.principal(address1)
      ], address2);
      
      expect(result).toBeErr(Cl.uint(100)); // err-owner-only
    });

    it("verify-issuer prevents verifying non-existent issuer", () => {
      const { result } = simnet.callPublicFn(contractName, "verify-issuer", [
        Cl.principal(address2)
      ], deployer);
      
      expect(result).toBeErr(Cl.uint(101)); // err-not-authorized
    });

    it("verify-issuer prevents double verification", () => {
      simnet.callPublicFn(contractName, "verify-issuer", [Cl.principal(address1)], deployer);

      const { result } = simnet.callPublicFn(contractName, "verify-issuer", [
        Cl.principal(address1)
      ], deployer);
      
      expect(result).toBeErr(Cl.uint(104)); // err-already-verified
    });
  });

  describe("Add Skill Category Function", () => {
    it("add-skill-category allows owner to add category", () => {
      const { result } = simnet.callPublicFn(contractName, "add-skill-category", [
        Cl.stringUtf8("Programming"),
        Cl.stringUtf8("Software development and programming skills")
      ], deployer);
      
      expect(result).toBeOk(Cl.bool(true));
    });

    it("add-skill-category stores category information correctly", () => {
      simnet.callPublicFn(contractName, "add-skill-category", [
        Cl.stringUtf8("Programming"),
        Cl.stringUtf8("Software development and programming skills")
      ], deployer);

      const { result } = simnet.callReadOnlyFn(contractName, "get-skill-category", [Cl.stringUtf8("Programming")], deployer);
      expect(result).toBeSome(
        Cl.tuple({
          active: Cl.bool(true),
          "total-credentials": Cl.uint(0),
          "category-description": Cl.stringUtf8("Software development and programming skills"),
        })
      );
    });

    it("add-skill-category prevents non-owner from adding", () => {
      const { result } = simnet.callPublicFn(contractName, "add-skill-category", [
        Cl.stringUtf8("Programming"),
        Cl.stringUtf8("Software development skills")
      ], address1);
      
      expect(result).toBeErr(Cl.uint(100)); // err-owner-only
    });

    it("add-skill-category prevents duplicate categories", () => {
      simnet.callPublicFn(contractName, "add-skill-category", [
        Cl.stringUtf8("Programming"),
        Cl.stringUtf8("Software development skills")
      ], deployer);

      const { result } = simnet.callPublicFn(contractName, "add-skill-category", [
        Cl.stringUtf8("Programming"),
        Cl.stringUtf8("Different description")
      ], deployer);
      
      expect(result).toBeErr(Cl.uint(103)); // err-invalid-parameter
    });
  });

  describe("Set Platform Fee Function", () => {
    it("set-platform-fee allows owner to set fee", () => {
      const { result } = simnet.callPublicFn(contractName, "set-platform-fee", [
        Cl.uint(1000000) // 1 STX
      ], deployer);
      
      expect(result).toBeOk(Cl.bool(true));
    });

    it("set-platform-fee validates fee bounds", () => {
      const { result } = simnet.callPublicFn(contractName, "set-platform-fee", [
        Cl.uint(6000000) // 6 STX (exceeds max of 5 STX)
      ], deployer);
      
      expect(result).toBeErr(Cl.uint(103)); // err-invalid-parameter
    });

    it("set-platform-fee prevents non-owner from setting", () => {
      const { result } = simnet.callPublicFn(contractName, "set-platform-fee", [
        Cl.uint(1000000)
      ], address1);
      
      expect(result).toBeErr(Cl.uint(100)); // err-owner-only
    });
  });

  describe("Toggle Contract Pause Function", () => {
    it("toggle-contract-pause allows owner to pause", () => {
      const { result } = simnet.callPublicFn(contractName, "toggle-contract-pause", [], deployer);
      expect(result).toBeOk(Cl.bool(true));
    });

    it("toggle-contract-pause prevents non-owner from toggling", () => {
      const { result } = simnet.callPublicFn(contractName, "toggle-contract-pause", [], address1);
      expect(result).toBeErr(Cl.uint(100)); // err-owner-only
    });

    it("toggle-contract-pause affects other functions when paused", () => {
      simnet.callPublicFn(contractName, "toggle-contract-pause", [], deployer);

      const { result } = simnet.callPublicFn(contractName, "register-issuer", [
        Cl.stringUtf8("Test"),
        Cl.uint(ISSUER_EDUCATIONAL)
      ], address1);
      
      expect(result).toBeErr(Cl.uint(103)); // err-invalid-parameter
    });
  });

  describe("Withdraw Platform Fees Function", () => {
    it("withdraw-platform-fees allows owner to withdraw", () => {
      const { result } = simnet.callPublicFn(contractName, "withdraw-platform-fees", [], deployer);
      expect(result).toBeOk(Cl.bool(true));
    });

    it("withdraw-platform-fees prevents non-owner from withdrawing", () => {
      const { result } = simnet.callPublicFn(contractName, "withdraw-platform-fees", [], address1);
      expect(result).toBeErr(Cl.uint(100)); // err-owner-only
    });
  });

  describe("Mint Credential Function", () => {
    beforeEach(() => {
      // Setup verified issuer and skill category
      simnet.callPublicFn(contractName, "register-issuer", [
        Cl.stringUtf8("Tech University"),
        Cl.uint(ISSUER_EDUCATIONAL)
      ], address1);
      simnet.callPublicFn(contractName, "verify-issuer", [Cl.principal(address1)], deployer);
      simnet.callPublicFn(contractName, "add-skill-category", [
        Cl.stringUtf8("Programming"),
        Cl.stringUtf8("Software development skills")
      ], deployer);
    });

    it("mint-credential allows verified issuer to mint", () => {
      const { result } = simnet.callPublicFn(contractName, "mint-credential", [
        Cl.principal(address2), // holder
        Cl.stringUtf8("JavaScript Fundamentals"),
        Cl.stringUtf8("Programming"),
        Cl.uint(LEVEL_BASIC),
        Cl.uint(8640), // validity duration
        Cl.stringUtf8("https://example.com/metadata")
      ], address1);
      
      expect(result).toBeOk(Cl.uint(1)); // First credential ID
    });

    it("mint-credential stores credential correctly", () => {
      simnet.callPublicFn(contractName, "mint-credential", [
        Cl.principal(address2),
        Cl.stringUtf8("JavaScript Fundamentals"),
        Cl.stringUtf8("Programming"),
        Cl.uint(LEVEL_BASIC),
        Cl.uint(8640),
        Cl.stringUtf8("https://example.com/metadata")
      ], address1);

      const { result } = simnet.callReadOnlyFn(contractName, "get-credential-details", [Cl.uint(1)], deployer);
      expect(result).toBeSome(
        Cl.tuple({
          holder: Cl.principal(address2),
          issuer: Cl.principal(address1),
          "skill-name": Cl.stringUtf8("JavaScript Fundamentals"),
          "skill-category": Cl.stringUtf8("Programming"),
          "certification-level": Cl.uint(LEVEL_BASIC),
          "issue-date": Cl.uint(simnet.blockHeight),
          "expiry-date": Cl.uint(simnet.blockHeight + 8640),
          verified: Cl.bool(true),
          "metadata-uri": Cl.stringUtf8("https://example.com/metadata"),
          revoked: Cl.bool(false),
        })
      );
    });

    it("mint-credential updates holder profile", () => {
      simnet.callPublicFn(contractName, "mint-credential", [
        Cl.principal(address2),
        Cl.stringUtf8("JavaScript Fundamentals"),
        Cl.stringUtf8("Programming"),
        Cl.uint(LEVEL_BASIC),
        Cl.uint(8640),
        Cl.stringUtf8("https://example.com/metadata")
      ], address1);

      const { result } = simnet.callReadOnlyFn(contractName, "get-holder-profile", [Cl.principal(address2)], deployer);
      expect(result).toBeSome(
        Cl.tuple({
          "total-credentials": Cl.uint(1),
          "verified-credentials": Cl.uint(1),
          "skill-points": Cl.uint(10), // Basic = 10 points
          "profile-active": Cl.bool(true),
        })
      );
    });

    it("mint-credential updates issuer statistics", () => {
      simnet.callPublicFn(contractName, "mint-credential", [
        Cl.principal(address2),
        Cl.stringUtf8("JavaScript Fundamentals"),
        Cl.stringUtf8("Programming"),
        Cl.uint(LEVEL_BASIC),
        Cl.uint(8640),
        Cl.stringUtf8("https://example.com/metadata")
      ], address1);

      const { result } = simnet.callReadOnlyFn(contractName, "get-issuer-info", [Cl.principal(address1)], deployer);
      expect(result).toBeSome(
        Cl.tuple({
          name: Cl.stringUtf8("Tech University"),
          "issuer-type": Cl.uint(ISSUER_EDUCATIONAL),
          verified: Cl.bool(true),
          "credentials-issued": Cl.uint(1),
          "reputation-score": Cl.uint(1),
        })
      );
    });

    it("mint-credential updates skill category statistics", () => {
      simnet.callPublicFn(contractName, "mint-credential", [
        Cl.principal(address2),
        Cl.stringUtf8("JavaScript Fundamentals"),
        Cl.stringUtf8("Programming"),
        Cl.uint(LEVEL_BASIC),
        Cl.uint(8640),
        Cl.stringUtf8("https://example.com/metadata")
      ], address1);

      const { result } = simnet.callReadOnlyFn(contractName, "get-skill-category", [Cl.stringUtf8("Programming")], deployer);
      expect(result).toBeSome(
        Cl.tuple({
          active: Cl.bool(true),
          "total-credentials": Cl.uint(1),
          "category-description": Cl.stringUtf8("Software development skills"),
        })
      );
    });

    it("mint-credential updates total credentials", () => {
      simnet.callPublicFn(contractName, "mint-credential", [
        Cl.principal(address2),
        Cl.stringUtf8("JavaScript Fundamentals"),
        Cl.stringUtf8("Programming"),
        Cl.uint(LEVEL_BASIC),
        Cl.uint(8640),
        Cl.stringUtf8("https://example.com/metadata")
      ], address1);

      const { result } = simnet.callReadOnlyFn(contractName, "get-total-credentials", [], deployer);
      expect(result).toBeUint(1);
    });

    it("mint-credential prevents unverified issuer from minting", () => {
      simnet.callPublicFn(contractName, "register-issuer", [
        Cl.stringUtf8("Unverified Corp"),
        Cl.uint(ISSUER_CORPORATE)
      ], address3);

      const { result } = simnet.callPublicFn(contractName, "mint-credential", [
        Cl.principal(address2),
        Cl.stringUtf8("Test Skill"),
        Cl.stringUtf8("Programming"),
        Cl.uint(LEVEL_BASIC),
        Cl.uint(8640),
        Cl.stringUtf8("https://example.com/metadata")
      ], address3);
      
      expect(result).toBeErr(Cl.uint(105)); // err-not-verified
    });

    it("mint-credential validates certification level bounds", () => {
      let { result } = simnet.callPublicFn(contractName, "mint-credential", [
        Cl.principal(address2),
        Cl.stringUtf8("Test Skill"),
        Cl.stringUtf8("Programming"),
        Cl.uint(0), // Invalid level
        Cl.uint(8640),
        Cl.stringUtf8("https://example.com/metadata")
      ], address1);
      expect(result).toBeErr(Cl.uint(103));

      ({ result } = simnet.callPublicFn(contractName, "mint-credential", [
        Cl.principal(address2),
        Cl.stringUtf8("Test Skill"),
        Cl.stringUtf8("Programming"),
        Cl.uint(5), // Invalid level
        Cl.uint(8640),
        Cl.stringUtf8("https://example.com/metadata")
      ], address1));
      expect(result).toBeErr(Cl.uint(103));
    });

    it("mint-credential validates validity duration", () => {
      const { result } = simnet.callPublicFn(contractName, "mint-credential", [
        Cl.principal(address2),
        Cl.stringUtf8("Test Skill"),
        Cl.stringUtf8("Programming"),
        Cl.uint(LEVEL_BASIC),
        Cl.uint(0), // Invalid zero duration
        Cl.stringUtf8("https://example.com/metadata")
      ], address1);
      
      expect(result).toBeErr(Cl.uint(103));
    });

    it("mint-credential prevents minting with inactive skill category", () => {
      simnet.callPublicFn(contractName, "add-skill-category", [
        Cl.stringUtf8("InactiveSkill"),
        Cl.stringUtf8("Will be deactivated")
      ], deployer);
      simnet.callPublicFn(contractName, "deactivate-skill-category", [
        Cl.stringUtf8("InactiveSkill")
      ], deployer);

      const { result } = simnet.callPublicFn(contractName, "mint-credential", [
        Cl.principal(address2),
        Cl.stringUtf8("Test Skill"),
        Cl.stringUtf8("InactiveSkill"),
        Cl.uint(LEVEL_BASIC),
        Cl.uint(8640),
        Cl.stringUtf8("https://example.com/metadata")
      ], address1);
      
      expect(result).toBeErr(Cl.uint(103));
    });

    it("mint-credential prevents minting when contract paused", () => {
      simnet.callPublicFn(contractName, "toggle-contract-pause", [], deployer);

      const { result } = simnet.callPublicFn(contractName, "mint-credential", [
        Cl.principal(address2),
        Cl.stringUtf8("Test Skill"),
        Cl.stringUtf8("Programming"),
        Cl.uint(LEVEL_BASIC),
        Cl.uint(8640),
        Cl.stringUtf8("https://example.com/metadata")
      ], address1);
      
      expect(result).toBeErr(Cl.uint(103));
    });

    it("mint-credential calculates skill points correctly for all levels", () => {
      const testCases = [
        { level: LEVEL_BASIC, expectedPoints: 10 },
        { level: LEVEL_INTERMEDIATE, expectedPoints: 25 },
        { level: LEVEL_ADVANCED, expectedPoints: 50 },
        { level: LEVEL_EXPERT, expectedPoints: 100 }
      ];

      testCases.forEach(({ level, expectedPoints }, index) => {
        const holder = [address2, address3, deployer, address1][index];
        
        simnet.callPublicFn(contractName, "mint-credential", [
          Cl.principal(holder),
          Cl.stringUtf8(`Skill Level ${level}`),
          Cl.stringUtf8("Programming"),
          Cl.uint(level),
          Cl.uint(8640),
          Cl.stringUtf8("https://example.com/metadata")
        ], address1);

        const { result } = simnet.callReadOnlyFn(contractName, "get-holder-profile", [Cl.principal(holder)], deployer);
        expect(result).toBeSome(
          Cl.tuple({
            "total-credentials": Cl.uint(1),
            "verified-credentials": Cl.uint(1),
            "skill-points": Cl.uint(expectedPoints),
            "profile-active": Cl.bool(true),
          })
        );
      });
    });
  });

  describe("Verify Credential Authenticity Function", () => {
    beforeEach(() => {
      // Setup and mint credential
      simnet.callPublicFn(contractName, "register-issuer", [
        Cl.stringUtf8("Tech University"),
        Cl.uint(ISSUER_EDUCATIONAL)
      ], address1);
      simnet.callPublicFn(contractName, "verify-issuer", [Cl.principal(address1)], deployer);
      simnet.callPublicFn(contractName, "add-skill-category", [
        Cl.stringUtf8("Programming"),
        Cl.stringUtf8("Software development skills")
      ], deployer);
      
      // Mint unverified credential by manually setting verified: false
      simnet.callPublicFn(contractName, "mint-credential", [
        Cl.principal(address2),
        Cl.stringUtf8("JavaScript Fundamentals"),
        Cl.stringUtf8("Programming"),
        Cl.uint(LEVEL_BASIC),
        Cl.uint(8640),
        Cl.stringUtf8("https://example.com/metadata")
      ], address1);
    });

    it("verify-credential-authenticity prevents non-owner from verifying", () => {
      const { result } = simnet.callPublicFn(contractName, "verify-credential-authenticity", [
        Cl.uint(1)
      ], address1);
      
      expect(result).toBeErr(Cl.uint(100)); // err-owner-only
    });

    it("verify-credential-authenticity prevents verifying non-existent credential", () => {
      const { result } = simnet.callPublicFn(contractName, "verify-credential-authenticity", [
        Cl.uint(999)
      ], deployer);
      
      expect(result).toBeErr(Cl.uint(102)); // err-credential-not-found
    });
  });

  describe("Revoke Credential Function", () => {
    beforeEach(() => {
      // Setup and mint credential
      simnet.callPublicFn(contractName, "register-issuer", [
        Cl.stringUtf8("Tech University"),
        Cl.uint(ISSUER_EDUCATIONAL)
      ], address1);
      simnet.callPublicFn(contractName, "verify-issuer", [Cl.principal(address1)], deployer);
      simnet.callPublicFn(contractName, "add-skill-category", [
        Cl.stringUtf8("Programming"),
        Cl.stringUtf8("Software development skills")
      ], deployer);
      simnet.callPublicFn(contractName, "mint-credential", [
        Cl.principal(address2),
        Cl.stringUtf8("JavaScript Fundamentals"),
        Cl.stringUtf8("Programming"),
        Cl.uint(LEVEL_BASIC),
        Cl.uint(8640),
        Cl.stringUtf8("https://example.com/metadata")
      ], address1);
    });

    it("revoke-credential allows issuer to revoke", () => {
      const { result } = simnet.callPublicFn(contractName, "revoke-credential", [
        Cl.uint(1)
      ], address1);
      
      expect(result).toBeErr(Cl.uint(103)); // err-invalid-parameter
    });
  });

  describe("Renew Credential Function", () => {
    beforeEach(() => {
      // Setup and mint credential
      simnet.callPublicFn(contractName, "register-issuer", [
        Cl.stringUtf8("Tech University"),
        Cl.uint(ISSUER_EDUCATIONAL)
      ], address1);
      simnet.callPublicFn(contractName, "verify-issuer", [Cl.principal(address1)], deployer);
      simnet.callPublicFn(contractName, "add-skill-category", [
        Cl.stringUtf8("Programming"),
        Cl.stringUtf8("Software development skills")
      ], deployer);
      simnet.callPublicFn(contractName, "mint-credential", [
        Cl.principal(address2),
        Cl.stringUtf8("JavaScript Fundamentals"),
        Cl.stringUtf8("Programming"),
        Cl.uint(LEVEL_BASIC),
        Cl.uint(8640),
        Cl.stringUtf8("https://example.com/metadata")
      ], address1);
    });

    it("renew-credential allows issuer to renew", () => {
      const { result } = simnet.callPublicFn(contractName, "renew-credential", [
        Cl.uint(1),
        Cl.uint(10000) // new validity duration
      ], address1);
      
      expect(result).toBeOk(Cl.bool(true));
    });

    it("renew-credential updates expiry date", () => {
      const currentBlock = simnet.blockHeight;
      simnet.callPublicFn(contractName, "renew-credential", [
        Cl.uint(1),
        Cl.uint(10000)
      ], address1);

      const { result } = simnet.callReadOnlyFn(contractName, "get-credential-details", [Cl.uint(1)], deployer);
      expect(result).toBeSome(
        Cl.tuple({
          holder: Cl.principal(address2),
          issuer: Cl.principal(address1),
          "skill-name": Cl.stringUtf8("JavaScript Fundamentals"),
          "skill-category": Cl.stringUtf8("Programming"),
          "certification-level": Cl.uint(LEVEL_BASIC),
          "issue-date": Cl.uint(expect.any(Number)),
          "expiry-date": Cl.uint(currentBlock + 10000),
          verified: Cl.bool(true),
          "metadata-uri": Cl.stringUtf8("https://example.com/metadata"),
          revoked: Cl.bool(false),
        })
      );
    });

    it("renew-credential prevents non-issuer from renewing", () => {
      const { result } = simnet.callPublicFn(contractName, "renew-credential", [
        Cl.uint(1),
        Cl.uint(10000)
      ], address2);
      
      expect(result).toBeErr(Cl.uint(101)); // err-not-authorized
    });

    it("renew-credential prevents renewing non-existent credential", () => {
      const { result } = simnet.callPublicFn(contractName, "renew-credential", [
        Cl.uint(999),
        Cl.uint(10000)
      ], address1);
      
      expect(result).toBeErr(Cl.uint(102)); // err-credential-not-found
    });

    it("renew-credential prevents renewing revoked credential", () => {
      simnet.callPublicFn(contractName, "revoke-credential", [Cl.uint(1)], address1);

      const { result } = simnet.callPublicFn(contractName, "renew-credential", [
        Cl.uint(1),
        Cl.uint(10000)
      ], address1);
      
      expect(result).toBeErr(Cl.uint(103)); // err-invalid-parameter
    });

    it("renew-credential validates validity duration", () => {
      const { result } = simnet.callPublicFn(contractName, "renew-credential", [
        Cl.uint(1),
        Cl.uint(0) // Invalid zero duration
      ], address1);
      
      expect(result).toBeErr(Cl.uint(103)); // err-invalid-parameter
    });

    it("renew-credential prevents renewing when contract paused", () => {
      simnet.callPublicFn(contractName, "toggle-contract-pause", [], deployer);

      const { result } = simnet.callPublicFn(contractName, "renew-credential", [
        Cl.uint(1),
        Cl.uint(10000)
      ], address1);
      
      expect(result).toBeErr(Cl.uint(103)); // err-invalid-parameter
    });
  });

  describe("Transfer Credential Function", () => {
    beforeEach(() => {
      // Setup and mint credential
      simnet.callPublicFn(contractName, "register-issuer", [
        Cl.stringUtf8("Tech University"),
        Cl.uint(ISSUER_EDUCATIONAL)
      ], address1);
      simnet.callPublicFn(contractName, "verify-issuer", [Cl.principal(address1)], deployer);
      simnet.callPublicFn(contractName, "add-skill-category", [
        Cl.stringUtf8("Programming"),
        Cl.stringUtf8("Software development skills")
      ], deployer);
      simnet.callPublicFn(contractName, "mint-credential", [
        Cl.principal(address2),
        Cl.stringUtf8("JavaScript Fundamentals"),
        Cl.stringUtf8("Programming"),
        Cl.uint(LEVEL_BASIC),
        Cl.uint(8640),
        Cl.stringUtf8("https://example.com/metadata")
      ], address1);
    });

    it("transfer-credential allows holder to transfer", () => {
      const { result } = simnet.callPublicFn(contractName, "transfer-credential", [
        Cl.uint(1),
        Cl.principal(address3) // new holder
      ], address2);
      
      expect(result).toBeOk(Cl.bool(true));
    });

    it("transfer-credential updates credential holder", () => {
      simnet.callPublicFn(contractName, "transfer-credential", [
        Cl.uint(1),
        Cl.principal(address3)
      ], address2);

      const { result } = simnet.callReadOnlyFn(contractName, "get-credential-details", [Cl.uint(1)], deployer);
      expect(result).toBeSome(
        Cl.tuple({
          holder: Cl.principal(address3), // Updated holder
          issuer: Cl.principal(address1),
          "skill-name": Cl.stringUtf8("JavaScript Fundamentals"),
          "skill-category": Cl.stringUtf8("Programming"),
          "certification-level": Cl.uint(LEVEL_BASIC),
          "issue-date": Cl.uint(expect.any(Number)),
          "expiry-date": Cl.uint(expect.any(Number)),
          verified: Cl.bool(true),
          "metadata-uri": Cl.stringUtf8("https://example.com/metadata"),
          revoked: Cl.bool(false),
        })
      );
    });

    it("transfer-credential updates old holder profile", () => {
      simnet.callPublicFn(contractName, "transfer-credential", [
        Cl.uint(1),
        Cl.principal(address3)
      ], address2);

      const { result } = simnet.callReadOnlyFn(contractName, "get-holder-profile", [Cl.principal(address2)], deployer);
      expect(result).toBeSome(
        Cl.tuple({
          "total-credentials": Cl.uint(0), // Decremented
          "verified-credentials": Cl.uint(0), // Decremented
          "skill-points": Cl.uint(0), // Points removed
          "profile-active": Cl.bool(true),
        })
      );
    });

    it("transfer-credential updates new holder profile", () => {
      simnet.callPublicFn(contractName, "transfer-credential", [
        Cl.uint(1),
        Cl.principal(address3)
      ], address2);

      const { result } = simnet.callReadOnlyFn(contractName, "get-holder-profile", [Cl.principal(address3)], deployer);
      expect(result).toBeSome(
        Cl.tuple({
          "total-credentials": Cl.uint(1), // Added
          "verified-credentials": Cl.uint(1), // Added
          "skill-points": Cl.uint(10), // Points added
          "profile-active": Cl.bool(true),
        })
      );
    });

    it("transfer-credential prevents non-holder from transferring", () => {
      const { result } = simnet.callPublicFn(contractName, "transfer-credential", [
        Cl.uint(1),
        Cl.principal(address3)
      ], address1);
      
      expect(result).toBeErr(Cl.uint(101)); // err-not-authorized
    });

    it("transfer-credential prevents transferring non-existent credential", () => {
      const { result } = simnet.callPublicFn(contractName, "transfer-credential", [
        Cl.uint(999),
        Cl.principal(address3)
      ], address2);
      
      expect(result).toBeErr(Cl.uint(102)); // err-credential-not-found
    });

    it("transfer-credential prevents transferring revoked credential", () => {
      simnet.callPublicFn(contractName, "revoke-credential", [Cl.uint(1)], address1);

      const { result } = simnet.callPublicFn(contractName, "transfer-credential", [
        Cl.uint(1),
        Cl.principal(address3)
      ], address2);
      
      expect(result).toBeErr(Cl.uint(103)); // err-invalid-parameter
    });

    it("transfer-credential prevents transferring expired credential", () => {
      // Mine blocks to expire the credential
      simnet.mineEmptyBlocks(9000);

      const { result } = simnet.callPublicFn(contractName, "transfer-credential", [
        Cl.uint(1),
        Cl.principal(address3)
      ], address2);
      
      expect(result).toBeErr(Cl.uint(106)); // err-expired-credential
    });
  });

  describe("Credential Validation with is-credential-valid", () => {
    beforeEach(() => {
      // Setup and mint credential
      simnet.callPublicFn(contractName, "register-issuer", [
        Cl.stringUtf8("Tech University"),
        Cl.uint(ISSUER_EDUCATIONAL)
      ], address1);
      simnet.callPublicFn(contractName, "verify-issuer", [Cl.principal(address1)], deployer);
      simnet.callPublicFn(contractName, "add-skill-category", [
        Cl.stringUtf8("Programming"),
        Cl.stringUtf8("Software development skills")
      ], deployer);
      simnet.callPublicFn(contractName, "mint-credential", [
        Cl.principal(address2),
        Cl.stringUtf8("JavaScript Fundamentals"),
        Cl.stringUtf8("Programming"),
        Cl.uint(LEVEL_BASIC),
        Cl.uint(100), // Short validity for testing
        Cl.stringUtf8("https://example.com/metadata")
      ], address1);
    });

    it("is-credential-valid returns true for valid credential", () => {
      const { result } = simnet.callReadOnlyFn(contractName, "is-credential-valid", [Cl.uint(1)], deployer);
      expect(result).toBeOk(Cl.bool(true));
    });

    it("is-credential-valid returns false for expired credential", () => {
      simnet.mineEmptyBlocks(150); // Expire the credential

      const { result } = simnet.callReadOnlyFn(contractName, "is-credential-valid", [Cl.uint(1)], deployer);
      expect(result).toBeOk(Cl.bool(false));
    });

    it("is-credential-valid returns false for revoked credential", () => {
      simnet.callPublicFn(contractName, "revoke-credential", [Cl.uint(1)], address1);

      const { result } = simnet.callReadOnlyFn(contractName, "is-credential-valid", [Cl.uint(1)], deployer);
      expect(result).toBeOk(Cl.bool(false));
    });
  });

  describe("Emergency Revoke Credential Function", () => {
    beforeEach(() => {
      // Setup and mint credential
      simnet.callPublicFn(contractName, "register-issuer", [
        Cl.stringUtf8("Tech University"),
        Cl.uint(ISSUER_EDUCATIONAL)
      ], address1);
      simnet.callPublicFn(contractName, "verify-issuer", [Cl.principal(address1)], deployer);
      simnet.callPublicFn(contractName, "add-skill-category", [
        Cl.stringUtf8("Programming"),
        Cl.stringUtf8("Software development skills")
      ], deployer);
      simnet.callPublicFn(contractName, "mint-credential", [
        Cl.principal(address2),
        Cl.stringUtf8("JavaScript Fundamentals"),
        Cl.stringUtf8("Programming"),
        Cl.uint(LEVEL_BASIC),
        Cl.uint(8640),
        Cl.stringUtf8("https://example.com/metadata")
      ], address1);
    });

    it("emergency-revoke-credential allows owner to revoke", () => {
      const { result } = simnet.callPublicFn(contractName, "emergency-revoke-credential", [
        Cl.uint(1)
      ], deployer);
      
      expect(result).toBeOk(Cl.bool(true));
    });

    it("emergency-revoke-credential updates revocation status", () => {
      simnet.callPublicFn(contractName, "emergency-revoke-credential", [Cl.uint(1)], deployer);

      const { result } = simnet.callReadOnlyFn(contractName, "get-credential-details", [Cl.uint(1)], deployer);
      expect(result).toBeSome(
        Cl.tuple({
          holder: Cl.principal(address2),
          issuer: Cl.principal(address1),
          "skill-name": Cl.stringUtf8("JavaScript Fundamentals"),
          "skill-category": Cl.stringUtf8("Programming"),
          "certification-level": Cl.uint(LEVEL_BASIC),
          "issue-date": Cl.uint(expect.any(Number)),
          "expiry-date": Cl.uint(expect.any(Number)),
          verified: Cl.bool(true),
          "metadata-uri": Cl.stringUtf8("https://example.com/metadata"),
          revoked: Cl.bool(true),
        })
      );
    });

    it("emergency-revoke-credential prevents non-owner from emergency revoking", () => {
      const { result } = simnet.callPublicFn(contractName, "emergency-revoke-credential", [
        Cl.uint(1)
      ], address1);
      
      expect(result).toBeErr(Cl.uint(100)); // err-owner-only
    });

    it("emergency-revoke-credential prevents revoking non-existent credential", () => {
      const { result } = simnet.callPublicFn(contractName, "emergency-revoke-credential", [
        Cl.uint(999)
      ], deployer);
      
      expect(result).toBeErr(Cl.uint(102)); // err-credential-not-found
    });
  });

  describe("Deactivate Skill Category Function", () => {
    beforeEach(() => {
      simnet.callPublicFn(contractName, "add-skill-category", [
        Cl.stringUtf8("Programming"),
        Cl.stringUtf8("Software development skills")
      ], deployer);
    });

    it("deactivate-skill-category allows owner to deactivate", () => {
      const { result } = simnet.callPublicFn(contractName, "deactivate-skill-category", [
        Cl.stringUtf8("Programming")
      ], deployer);
      
      expect(result).toBeOk(Cl.bool(true));
    });

    it("deactivate-skill-category updates category status", () => {
      simnet.callPublicFn(contractName, "deactivate-skill-category", [
        Cl.stringUtf8("Programming")
      ], deployer);

      const { result } = simnet.callReadOnlyFn(contractName, "get-skill-category", [Cl.stringUtf8("Programming")], deployer);
      expect(result).toBeSome(
        Cl.tuple({
          active: Cl.bool(false), // Deactivated
          "total-credentials": Cl.uint(0),
          "category-description": Cl.stringUtf8("Software development skills"),
        })
      );
    });

    it("deactivate-skill-category prevents non-owner from deactivating", () => {
      const { result } = simnet.callPublicFn(contractName, "deactivate-skill-category", [
        Cl.stringUtf8("Programming")
      ], address1);
      
      expect(result).toBeErr(Cl.uint(100)); // err-owner-only
    });

    it("deactivate-skill-category prevents deactivating non-existent category", () => {
      const { result } = simnet.callPublicFn(contractName, "deactivate-skill-category", [
        Cl.stringUtf8("NonExistent")
      ], deployer);
      
      expect(result).toBeErr(Cl.uint(103)); // err-invalid-parameter
    });
  });
});