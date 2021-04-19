import { Request, Response, NextFunction } from "express";
import { IProposalModel, Proposal } from "../../models/proposal";
import ProposalService from "../../services/proposal.services";

export class Controller {
  /**
   * Fetch all the documents from the negotiations collection.
   * @param {Request} req The Request object generated from the user API call.
   * @param {Response} res The Response object generated in response to the user API call.
   * @param {NextFunction} next The middleware to execute when catching the error.
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const docs: Array<IProposalModel> = await ProposalService.getAll();

      // Sending response back.
      return res.status(200).json(docs);
    } catch (err) {
      // Running error handling middleware.
      return next(err);
    }
  }

  /**
   * Fetch all the documents from the negotiations collection which have the same handshake identifier.
   * @param {Request} req The Request object generated from the user API call.
   * @param {Response} res The Response object generated in response to the user API call.
   * @param {NextFunction} next The middleware to execute when catching the error.
   */
  async getAllProposalsForHandshake(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const docs: Array<IProposalModel> = await ProposalService.getAllProposalsForHandshake(
        req.params.handshakeId
      );

      if (docs) {
        // Sending response back.
        return res.status(200).json(docs);
      }

      // Create a custom NOT FOUND error message.
      const errors = [
        {
          message: `No proposals found for digital handshake with id : ${req.params.handshakeId}`,
        },
      ];

      // Sending error back.
      return res.status(404).json({ errors });
    } catch (err) {
      // Running error handling middleware.
      return next(err);
    }
  }

  /**
   * Fetch the last document from all proposals in the negotiations collection which have the same handshake identifier.
   * @param {Request} req The Request object generated from the user API call.
   * @param {Response} res The Response object generated in response to the user API call.
   * @param {NextFunction} next The middleware to execute when catching the error.
   */
  async getLastProposalForHandshake(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const doc: IProposalModel = await ProposalService.getLastProposalForHandshake(
        req.params.handshakeId
      );

      if (doc) {
        // Sending response back.
        return res.status(200).json(doc);
      }

      // Create a custom NOT FOUND error message.
      const errors = [
        {
          message: `No proposals found for digital handshake with id : ${req.params.handshakeId}`,
        },
      ];

      // Sending error back.
      return res.status(404).json({ errors });
    } catch (err) {
      // Running error handling middleware.
      return next(err);
    }
  }

  /**
   * Create a new document for the negotiations collection.
   * @param {Request} req The Request object generated from the user API call.
   * @param {Response} res The Response object generated in response to the user API call.
   * @param {NextFunction} next The middleware to execute when catching the error.
   */
  async createProposal(req: Request, res: Response, next: NextFunction) {
    try {
      const doc = await ProposalService.createProposal(req.body);

      // Sending response back.
      return res.status(201).location(`/api/v1/negotiations/${doc._id}`).end();
    } catch (err) {
      // Running error handling middleware.
      return next(err);
    }
  }
}

export default new Controller();
