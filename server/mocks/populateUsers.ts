import "../common/env";
import { readFileSync } from "fs";
import mongoose from "mongoose";
import { User } from "../api/models/user";
import axios from "axios";
import { SHA256, AES } from "crypto-js";
import mockedUsers from "../mocks/users";

// // Reset collection documents.
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

  console.log(`\n${"Start Populating with Mock Data"}`);

  // Populate MongoDB through Express server API with mock users.
  for (let i = 0; i < mockedUsers.length; i++) {
    const mockedUser = mockedUsers[i];
    console.log(mockedUser);
    console.log(`\n${"User - "} ${mockedUser.account}`);

    // Call the API and send the user' data.
    const response = await axios.post(
      `http://${process.env.SERVER_ENDPOINT}:${process.env.SERVER_PORT}/api/v1/users`,
      {
        account: mockedUser.account,
        role: mockedUser.role,
        name: AES.encrypt(mockedUser.name, mockedUser.privateKey).toString(),
        surname: AES.encrypt(
          mockedUser.surname,
          mockedUser.privateKey
        ).toString(),
        dateOfBirth: AES.encrypt(
          mockedUser.dateOfBirth,
          mockedUser.privateKey
        ).toString(),
        country: AES.encrypt(
          mockedUser.country,
          mockedUser.privateKey
        ).toString(),
        address: AES.encrypt(
          mockedUser.address,
          mockedUser.privateKey
        ).toString(),
        email: AES.encrypt(mockedUser.email, mockedUser.privateKey).toString(),
        dataHash: SHA256(
          mockedUser.account +
            mockedUser.role +
            mockedUser.name +
            mockedUser.surname +
            mockedUser.dateOfBirth +
            mockedUser.country +
            mockedUser.address +
            mockedUser.email
        ).toString(),
      }
    );

    if (response.status == 201) console.log(`\n${"Done!"}`);
    else console.log(`\n${"Something went wrong!"}`);
  }

  console.log(`\n${"Operation completed"}`);
});
