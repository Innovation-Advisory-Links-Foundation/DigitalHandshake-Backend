import mongoose from "mongoose";
import l from "./logger";

export interface IDatabase {
  init(): void;
}

export default class Database implements IDatabase {
  connectionURL: string; // MongoDB endpoint.

  /**
   * Construct a new MongoDB instance.
   * @param {string} connectionURL The endpoint URL where MongoDB instance is running.
   */
  constructor(connectionURL: string) {
    this.connectionURL = connectionURL;
  }

  /**
   * Open the connection to the MongoDB instance.
   */
  init(): void {
    mongoose
      .connect(this.connectionURL, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useCreateIndex: true,
        useFindAndModify: false,
        user: process.env.DB_USER, // The username of the MongoDB user (optional).
        pass: process.env.DB_PASS, // The password of the MongoDB user (optional).
      })
      .then(() => {
        l.info(
          `Successfully connected to the MongoDB instance running at ${this.connectionURL}.`
        );
      })
      .catch((err) => {
        l.error(
          `MongoDB connection error. Please make sure MongoDB is running.\n${err}`
        );
        process.exit(1);
      });

    const db = mongoose.connection;
    db.on("error", (err) => l.error(`MongoDB error: \n${err} `));
  }
}
