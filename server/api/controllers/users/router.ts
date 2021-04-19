import express from "express";
import controller from "./controller";

// Export a router with some routes.
export default express
  .Router()
  .post("/", controller.createUser)
  .get("/", controller.getAll)
  .get("/:account", controller.getByAccount);
