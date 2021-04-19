import express, { Application } from "express";
import { IDatabase } from "./database";
import path from "path";
import http from "http";
import errorHandler from "../api/middlewares/error.handler";
import cors from "cors";

// Top-level express.
const app = express();

export default class ExpressServer {
  /**
   * Construct a new express server.
   */
  constructor() {
    const root = path.normalize(`${__dirname}/../..`);

    // Middlewares.
    app.use(cors());

    app.set("appPath", `${root}client`);
    app.use(express.static(`${root}/public`));

    app.use(
      express.urlencoded({
        extended: true,
        limit: process.env.REQUEST_LIMIT || "100kb",
      })
    );
    app.use(express.text({ limit: process.env.REQUEST_LIMIT || "100kb" }));
    app.use(express.json({ limit: process.env.REQUEST_LIMIT || "100kb" }));
  }

  /**
   * Enable routes inclusion for subsequent API call.
   * @param {(app: Application) => void)} routes An object containing the list of routes to include.
   * @returns {ExpressServer} An express server with routes.
   */
  router(routes: (app: Application) => void): ExpressServer {
    routes(app);

    // Custom error handler middleware.
    app.use(errorHandler);

    return this;
  }

  /**
   * Open the connection with the MongoDB instance.
   * @param {IDatabase} db The MongoDB database instance.
   */
  database(db: IDatabase): ExpressServer {
    db.init();

    return this;
  }

  /**
   * Open the connection with the express server at the specified host and port.
   * @param {number} port The port number where the server is running.
   * @returns {Application} An Application instance (running server).
   */
  listen(port: number): Application {
    http.createServer(app).listen(port, process.env.SERVER_ENDPOINT);

    return app;
  }
}
