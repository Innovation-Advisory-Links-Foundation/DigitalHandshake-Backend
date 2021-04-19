import l from "../../common/logger";

import { Proposal, IProposalModel } from "../models/proposal";

export class ProposalService {
  /**
   * Fetch all the documents from the negotiations collection.
   * @returns {Promise<IProposalModel[]>} The array of documents (w/ a Proposal structure).
   */
  async getAll(): Promise<IProposalModel[]> {
    // Logger info message for debugging purposes.
    l.info("Fetching all proposals from negotiations collection");

    // Fetch.
    const proposals = (await Proposal.find().lean()) as IProposalModel[];

    return proposals;
  }

  /**
   * Fetch all the documents from the negotiations collection which have the same handshake identifier.
   * @param {string} handshakeId The id of the digital handshake relative to the proposals.
   * @returns {Promise<IProposalModel[]>} The array of documents (w/ a Proposal structure).
   */
  async getAllProposalsForHandshake(
    handshakeId: string
  ): Promise<IProposalModel[]> {
    // Logger info message for debugging purposes.
    l.info(
      `Fetching all proposals from negotiations collection for digital handshake with id: ${handshakeId}`
    );

    // Fetch.
    const proposals = (await Proposal.find({
      handshakeId,
    }).lean()) as IProposalModel[];

    return proposals;
  }

  /**
   * Fetch the last document from all proposals in the negotiations collection which have the same handshake identifier.
   * @param {string} handshakeId The id of the digital handshake relative to the proposals.
   * @returns {Promise<IProposalModel[]>} The array of documents (w/ a Proposal structure).
   */
  async getLastProposalForHandshake(
    handshakeId: string
  ): Promise<IProposalModel> {
    // Logger info message for debugging purposes.
    l.info(
      `Fetch the last proposal from negotiations collection for digital handshake with id: ${handshakeId}`
    );

    // Find the document.
    const proposals: any = (await Proposal.find({
      handshakeId,
    }).lean()) as IProposalModel;

    return proposals[proposals.length - 1];
  }

  /**
   * Create a new document for the negotiations collection.
   * @param {IProposalModel} data The information of the new proposal.
   * @returns {Promise<IProposalModel>} The requested document (w/ a Proposal structure).
   */
  async createProposal(data: IProposalModel): Promise<IProposalModel> {
    // Logger info message for debugging purposes.
    l.info(`Create a new proposal with data ${data}`);

    // Create.
    const proposal = new Proposal(data);
    const doc = (await proposal.save()) as IProposalModel;

    return doc;
  }
}

export default new ProposalService();
