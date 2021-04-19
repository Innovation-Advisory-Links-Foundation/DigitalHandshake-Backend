import mongoose from "mongoose";

// User structure for MongoDB document schema definition.
export interface IUserModel extends mongoose.Document {
  account: string;
  role: string;
  name: string;
  surname: string;
  dateOfBirth: string;
  country: string;
  address: string;
  email: string;
  dataHash: string;
}

// MongoDB schema definition for a user.
const schema = new mongoose.Schema(
  {
    account: { type: String, unique: true, required: true },
    role: { type: String, required: true },
    name: { type: String, required: true },
    surname: { type: String, required: true },
    dateOfBirth: { type: String, required: false },
    country: { type: String, required: true },
    address: { type: String, required: false },
    email: { type: String, required: true },
    dataHash: { type: String, unique: true, required: true },
  },
  {
    collection: "users",
  }
);

// Export 'User' MongoDB model for documents definition.
export const User = mongoose.model<IUserModel>("User", schema);
