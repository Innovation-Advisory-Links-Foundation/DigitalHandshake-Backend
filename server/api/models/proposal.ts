import mongoose from "mongoose";

// Proposal structure for MongoDB document schema definition.
export interface IProposalModel extends mongoose.Document {
  handshakeId: string;
  contractualTerms: string;
  contractualTermsHash: string;
}

// MongoDB schema definition for a Proposal.
const schema = new mongoose.Schema(
  {
    handshakeId: { type: String, required: true },
    contractualTerms: { type: String, required: true },
    contractualTermsHash: { type: String, unique: true, required: true },
  },
  {
    collection: "negotiations",
  }
);

// Export 'Proposal' MongoDB model for documents definition.
export const Proposal = mongoose.model<IProposalModel>("Proposal", schema);
