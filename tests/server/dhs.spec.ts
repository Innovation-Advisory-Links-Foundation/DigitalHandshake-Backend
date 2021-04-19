import "../../server/common/env";
import mongoose from "mongoose";
import { User } from "../../server/api/models/user";
import { Proposal } from "../../server/api/models/proposal";
import { Motivation } from "../../server/api/models/motivation";
import { expect } from "chai";
import axios from "axios";
import { SHA256, AES } from "crypto-js";
import mockedUsers from "../../server/mocks/users";

// Reset collection documents.
mongoose.connect(
  `${process.env.MONGO_DB_URL}/${process.env.MONGO_DB_DATABASE}`,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false,
  }
);
const db = mongoose.connection;

// Remove the collections documents for running tests in a clean environment.
db.on("error", console.error.bind(console, "Connection error:"));
db.once("open", async () => {
  await User.collection.drop();
  await Proposal.collection.drop();
  await Motivation.collection.drop();
});

console.log("===== Start testing =====");

// Start server testing.
describe("Digital Handshake Express/MongoDB Server", () => {
  // Retrieve data for the first user.
  const {
    privateKey,
    account,
    role,
    name,
    surname,
    dateOfBirth,
    country,
    address,
    email,
  } = mockedUsers[0];

  describe("# Users", () => {
    const userEncrypted0 = {
      account,
      role,
      name: AES.encrypt(name, privateKey).toString(),
      surname: AES.encrypt(surname, privateKey).toString(),
      dateOfBirth: AES.encrypt(dateOfBirth, privateKey).toString(),
      country: AES.encrypt(country, privateKey).toString(),
      address: AES.encrypt(address, privateKey).toString(),
      email: AES.encrypt(email, privateKey).toString(),
      dataHash: SHA256(
        account +
          role +
          name +
          surname +
          dateOfBirth +
          country +
          address +
          email
      ).toString(),
    };

    it("Should return an empty array of users", async () => {
      const response = await axios.get(
        `${process.env.SERVER_TEST_URL}/api/v1/users`
      );

      expect(response.status, "200");
      expect(response.data.length.toString(), "0");
    });

    it("Should create a new user", async () => {
      const response = await axios.post(
        `${process.env.SERVER_TEST_URL}/api/v1/users`,
        {
          account: userEncrypted0.account,
          role: userEncrypted0.role,
          name: userEncrypted0.name,
          surname: userEncrypted0.surname,
          dateOfBirth: userEncrypted0.dateOfBirth,
          country: userEncrypted0.country,
          address: userEncrypted0.address,
          email: userEncrypted0.email,
          dataHash: userEncrypted0.dataHash,
        }
      );

      expect(response.status, "201");
    });

    it("Should return a user with a specific account name", async () => {
      const response = await axios.get(
        `${process.env.SERVER_TEST_URL}/api/v1/users/alice`
      );

      expect(response.status, "200");
      expect(response.data.account, userEncrypted0.account);
      expect(response.data.role, userEncrypted0.role);
      expect(response.data.name, userEncrypted0.name);
      expect(response.data.surname, userEncrypted0.surname);
      expect(response.data.dateOfBirth, userEncrypted0.dateOfBirth);
      expect(response.data.country, userEncrypted0.country);
      expect(response.data.address, userEncrypted0.address);
      expect(response.data.email, userEncrypted0.email);
      expect(response.data.dataHash, userEncrypted0.dataHash);
    });

    it("Should return all users", async () => {
      const response = await axios.get(
        `${process.env.SERVER_TEST_URL}/api/v1/users`
      );

      expect(response.status, "200");
      expect(response.data.length.toString(), "1");
      expect(response.data[0].account, userEncrypted0.account);
      expect(response.data[0].role, userEncrypted0.role);
      expect(response.data[0].name, userEncrypted0.name);
      expect(response.data[0].surname, userEncrypted0.surname);
      expect(response.data[0].dateOfBirth, userEncrypted0.dateOfBirth);
      expect(response.data[0].country, userEncrypted0.country);
      expect(response.data[0].address, userEncrypted0.address);
      expect(response.data[0].email, userEncrypted0.email);
      expect(response.data[0].dataHash, userEncrypted0.dataHash);
    });

    it("Shouldn't be possible to create a new user with the same account", async () => {
      try {
        await axios.post(`${process.env.SERVER_TEST_URL}/api/v1/users`, {
          account: userEncrypted0.account,
          role: userEncrypted0.role,
          name: userEncrypted0.name,
          surname: userEncrypted0.surname,
          dateOfBirth: userEncrypted0.dateOfBirth,
          country: userEncrypted0.country,
          address: userEncrypted0.address,
          email: userEncrypted0.email,
          dataHash: userEncrypted0.dataHash,
        });
      } catch (error) {
        expect(error.response.status.toString(), "500");
      }
    });
  });
  describe("# Negotiations", () => {
    const proposal1 = {
      handshakeId: "1",
      contractualTerms: "Terms 1",
      contractualTermsHash: SHA256("Terms 1").toString(),
    };

    const proposal2 = {
      handshakeId: "1",
      contractualTerms: "Terms 2",
      contractualTermsHash: SHA256("Terms 2").toString(),
    };

    const proposal3 = {
      handshakeId: "2",
      contractualTerms: "Terms 1",
      contractualTermsHash: SHA256("Terms 1").toString(),
    };

    it("Should return an empty array", async () => {
      const response = await axios.get(
        `${process.env.SERVER_TEST_URL}/api/v1/negotiations`
      );

      expect(response.status, "200");
      expect(response.data.length.toString(), "0");
    });

    it("Should create a new proposal", async () => {
      const response = await axios.post(
        `${process.env.SERVER_TEST_URL}/api/v1/negotiations`,
        {
          handshakeId: proposal1.handshakeId,
          contractualTerms: proposal1.contractualTerms,
          contractualTermsHash: proposal1.contractualTermsHash,
        }
      );

      expect(response.status, "201");
    });

    it("Should create a new proposal with the same handshake identifier", async () => {
      const response = await axios.post(
        `${process.env.SERVER_TEST_URL}/api/v1/negotiations`,
        {
          handshakeId: proposal2.handshakeId,
          contractualTerms: proposal2.contractualTerms,
          contractualTermsHash: proposal2.contractualTermsHash,
        }
      );

      expect(response.status, "201");
    });

    it("Should create a new proposal with a different handshake identifier", async () => {
      const response = await axios.post(
        `${process.env.SERVER_TEST_URL}/api/v1/negotiations`,
        {
          handshakeId: proposal3.handshakeId,
          contractualTerms: proposal3.contractualTerms,
          contractualTermsHash: proposal3.contractualTermsHash,
        }
      );

      expect(response.status, "201");
    });

    it("Should return all proposals for a given handshake", async () => {
      const response = await axios.get(
        `${process.env.SERVER_TEST_URL}/api/v1/negotiations/1`
      );

      expect(response.status, "200");
      expect(response.data[0].handshakeId, proposal1.handshakeId);
      expect(response.data[1].handshakeId, proposal2.handshakeId);
      expect(response.data[0].contractualTerms, proposal1.contractualTerms);
      expect(response.data[1].contractualTerms, proposal2.contractualTerms);
      expect(
        response.data[0].contractualTermsHash,
        proposal1.contractualTermsHash
      );
      expect(
        response.data[1].contractualTermsHash,
        proposal2.contractualTermsHash
      );
    });

    it("Should return the last proposal for a given handshake", async () => {
      const response = await axios.get(
        `${process.env.SERVER_TEST_URL}/api/v1/negotiations/last/1`
      );

      expect(response.status, "200");
      expect(response.data.handshakeId, proposal1.handshakeId);
      expect(response.data.contractualTerms, proposal1.contractualTerms);
      expect(
        response.data.contractualTermsHash,
        proposal1.contractualTermsHash
      );
    });
  });
  describe("# Motivations", () => {
    const motivation1 = {
      handshakeId: "1",
      motivation: "Motivation 1",
      motivationHash: SHA256("Motivation 1").toString(),
    };

    const motivation2 = {
      handshakeId: "1",
      motivation: "Motivation 2",
      motivationHash: SHA256("Motivation 2").toString(),
    };

    const motivation3 = {
      handshakeId: "2",
      motivation: "Motivation 3",
      motivationHash: SHA256("Motivation 3").toString(),
    };

    it("Should return an empty array", async () => {
      const response = await axios.get(
        `${process.env.SERVER_TEST_URL}/api/v1/motivations`
      );

      expect(response.status, "200");
      expect(response.data.length.toString(), "0");
    });

    it("Should create a new motivation", async () => {
      const response = await axios.post(
        `${process.env.SERVER_TEST_URL}/api/v1/motivations`,
        {
          handshakeId: motivation1.handshakeId,
          motivation: motivation1.motivation,
          motivationHash: motivation1.motivationHash,
        }
      );

      expect(response.status, "201");
    });

    it("Should create a new motivation with the same handshake identifier", async () => {
      const response = await axios.post(
        `${process.env.SERVER_TEST_URL}/api/v1/motivations`,
        {
          handshakeId: motivation2.handshakeId,
          motivation: motivation2.motivation,
          motivationHash: motivation2.motivationHash,
        }
      );

      expect(response.status, "201");
    });

    it("Should create a new proposal with a different handshake identifier", async () => {
      const response = await axios.post(
        `${process.env.SERVER_TEST_URL}/api/v1/motivations`,
        {
          handshakeId: motivation3.handshakeId,
          motivation: motivation3.motivation,
          motivationHash: motivation3.motivationHash,
        }
      );

      expect(response.status, "201");
    });

    it("Should return all motivations for a given handshake", async () => {
      const response = await axios.get(
        `${process.env.SERVER_TEST_URL}/api/v1/motivations/1`
      );

      expect(response.status, "200");
      expect(response.data[0].handshakeId, motivation1.handshakeId);
      expect(response.data[1].handshakeId, motivation2.handshakeId);
      expect(response.data[0].motivation, motivation1.motivation);
      expect(response.data[1].motivation, motivation2.motivation);
      expect(response.data[0].motivationHash, motivation1.motivationHash);
      expect(response.data[1].motivationHash, motivation2.motivationHash);
    });
  });
});
