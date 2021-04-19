import express from "express";
import controller from "./controller";

// Export a router with some routes.
export default express
  .Router()
  .post("/", controller.createMotivation)
  .get("/", controller.getAll)
  .get("/:handshakeId", controller.getMotivationsForHandshake);
