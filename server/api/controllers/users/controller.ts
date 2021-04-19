import UserService from "../../services/user.services";
import { Request, Response, NextFunction } from "express";

export class Controller {
  /**
   * Fetch all documents from 'users' collection.
   * @param {Request} req The Request object generated from the user API call.
   * @param {Response} res The Response object generated in response to the user API call.
   * @param {NextFunction} next The middleware to execute when catching the error.
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const docs = await UserService.getAll();

      // Sending response back.
      return res.status(200).json(docs);
    } catch (err) {
      // Running error handling middleware.
      return next(err);
    }
  }

  /**
   * Fetch a document with the requested 'account' from 'users' collection.
   * @param {Request} req The Request object generated from the user API call.
   * @param {Response} res The Response object generated in response to the user API call.
   * @param {NextFunction} next The middleware to execute when catching the error.
   */
  async getByAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const doc = await UserService.getByAccount(req.params.account);

      if (doc) {
        // Sending response back.
        return res.status(200).json(doc);
      }

      // Create a custom NOT FOUND error message.
      const errors = [
        { message: `User not found with account: ${req.params.account}` },
      ];

      // Sending error back.
      return res.status(404).json({ errors });
    } catch (err) {
      // Running error handling middleware.
      return next(err);
    }
  }

  /**
   * Create a new document in the 'user' collection.
   * @param {Request} req The Request object generated from the user API call.
   * @param {Response} res The Response object generated in response to the user API call.
   * @param {NextFunction} next The middleware to execute when catching the error.
   */
  async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const doc = await UserService.createUser(req.body);

      // Sending response back.
      return res.status(201).location(`/api/v1/users/${doc.id}`).end();
    } catch (err) {
      // Running error handling middleware.
      return next(err);
    }
  }
}

export default new Controller();
