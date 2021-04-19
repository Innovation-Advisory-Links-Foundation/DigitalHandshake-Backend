import { Request, Response, NextFunction } from "express";
import { IMotivationModel, Motivation } from "../../models/motivation";
import MotivationService from "../../services/motivation.services";

export class Controller {
  /**
   * Fetch all the documents from the motivations collection.
   * @param {Request} req The Request object generated from the user API call.
   * @param {Response} res The Response object generated in response to the user API call.
   * @param {NextFunction} next The middleware to execute when catching the error.
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const docs: Array<IMotivationModel> = await MotivationService.getAll();

      // Sending response back.
      return res.status(200).json(docs);
    } catch (err) {
      // Running error handling middleware.
      return next(err);
    }
  }

  /**
   * Fetch all the documents from the motivations collection which have the same handshake identifier.
   * @param {Request} req The Request object generated from the user API call.
   * @param {Response} res The Response object generated in response to the user API call.
   * @param {NextFunction} next The middleware to execute when catching the error.
   */
  async getMotivationsForHandshake(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const docs: Array<IMotivationModel> = await MotivationService.getMotivationsForHandshake(
        req.params.handshakeId
      );

      if (docs) {
        // Sending response back.
        return res.status(200).json(docs);
      }

      // Create a custom NOT FOUND error message.
      const errors = [
        {
          message: `No motivations found for digital handshake with id : ${req.params.handshakeId}`,
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
   * Create a new document for the motivations collection.
   * @param {Request} req The Request object generated from the user API call.
   * @param {Response} res The Response object generated in response to the user API call.
   * @param {NextFunction} next The middleware to execute when catching the error.
   */
  async createMotivation(req: Request, res: Response, next: NextFunction) {
    try {
      const doc = await MotivationService.createMotivation(req.body);

      // Sending response back.
      return res.status(201).location(`/api/v1/motivations/${doc._id}`).end();
    } catch (err) {
      // Running error handling middleware.
      return next(err);
    }
  }
}

export default new Controller();
