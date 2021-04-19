import { Application } from "express";
import usersRouter from "./api/controllers/users/router";
import negotiationsRouter from "./api/controllers/negotiations/router";
import motivationsRouter from "./api/controllers/motivations/router";

// Server Routes.
export default function routes(app: Application): void {
  // Example APIs.
  app.use("/api/v1/users", usersRouter);
  app.use("/api/v1/negotiations", negotiationsRouter);
  app.use("/api/v1/motivations", motivationsRouter);
}
