import mongoose from "mongoose";

// Motivation structure for MongoDB document schema definition.
export interface IMotivationModel extends mongoose.Document {
  handshakeId: string;
  motivation: string;
  motivationHash: string;
}

// MongoDB schema definition for a Proposal.
const schema = new mongoose.Schema(
  {
    handshakeId: { type: String, required: true },
    motivation: { type: String, required: true },
    motivationHash: { type: String, unique: true, required: true },
  },
  {
    collection: "motivations",
  }
);

// Export 'Motivation' MongoDB model for documents definition.
export const Motivation = mongoose.model<IMotivationModel>(
  "Motivation",
  schema
);
