import { Response } from "express";

/**
 * Custom middleware for handling generic errors.
 * @param {any} err The object containing the error.
 * @param {Response} res A generic JSON response to the error.
 */
export default function errorHandler(err: any, res: Response) {
  // Retrieve the error message.
  const errors = err.errors || [{ message: err.message }];

  // Response.
  res.status(err.status || 500).json({ errors });
}
