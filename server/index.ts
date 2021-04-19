import "./common/env";
import Database from "./common/database";
import Server from "./common/server";
import routes from "./routes";

const port = parseInt(process.env.SERVER_PORT || "8080");

// Instantiate and connects to a MongoDB database.
const db = new Database(
  `${process.env.MONGO_DB_ENDPOINT}/${process.env.MONGO_DB_DATABASE}`
);

// Instantiate and run the express node server for MongoDB.
export default new Server().database(db).router(routes).listen(port);
