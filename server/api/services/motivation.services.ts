import l from "../../common/logger";

import { Motivation, IMotivationModel } from "../models/motivation";

export class MotivationService {
  /**
   * Fetch all the documents from the motivations collection.
   * @returns {Promise<IMotivationModel[]>} The array of documents (w/ a Motivation structure).
   */
  async getAll(): Promise<IMotivationModel[]> {
    // Logger info message for debugging purposes.
    l.info("Fetching all proposals from motivations collection");

    // Fetch.
    const motivations = (await Motivation.find().lean()) as IMotivationModel[];

    return motivations;
  }

  /**
   * Fetch all the documents from the motivations collection which have the same handshake identifier.
   * @param {string} handshakeId The id of the digital handshake relative to the motivations.
   * @returns {Promise<IMotivationModel[]>} The array of documents (w/ a Motivation structure).
   */
  async getMotivationsForHandshake(
    handshakeId: string
  ): Promise<IMotivationModel[]> {
    // Logger info message for debugging purposes.
    l.info(
      `Fetching all motivations from motivations collection for digital handshake with id: ${handshakeId}`
    );

    // Fetch.
    const motivations = (await Motivation.find({
      handshakeId,
    }).lean()) as IMotivationModel[];

    return motivations;
  }

  /**
   * Create a new document for the motivations collection.
   * @param {IProposalModel} data The information of the new motivation.
   * @returns {Promise<IMotivationModel>} The requested document (w/ a Motivation structure).
   */
  async createMotivation(data: IMotivationModel): Promise<IMotivationModel> {
    // Logger info message for debugging purposes.
    l.info(`Create a new motivation with data ${data}`);

    // Create.
    const motivation = new Motivation(data);
    const doc = (await motivation.save()) as IMotivationModel;

    return doc;
  }
}

export default new MotivationService();
