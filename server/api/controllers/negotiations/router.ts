import express from "express";
import controller from "./controller";

// Export a router with some routes.
export default express
  .Router()
  .get("/:handshakeId", controller.getAllProposalsForHandshake)
  .get("/last/:handshakeId", controller.getLastProposalForHandshake)
  .get("/", controller.getAll)
  .post("/", controller.createProposal);
