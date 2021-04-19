import l from "../../common/logger";

import { User, IUserModel } from "../models/user";

export class UserService {
  /**
   * Fetch all the documents from the users collection.
   * @returns {Promise<IUserModel[]>} The array of documents (w/ an User structure).
   */
  async getAll(): Promise<IUserModel[]> {
    // Logger info message for debugging purposes.
    l.info("Fetching all users");

    // Fetch.
    const users = (await User.find().lean()) as IUserModel[];

    return users;
  }

  /**
   * Fetch a document with the requested account from the users collection.
   * @param {string} account The account of the user to fetch.
   * @returns {Promise<IUserModel>} The requested document (w/ an User structure).
   */
  async getByAccount(account: string): Promise<IUserModel> {
    // Logger info message for debugging purposes.
    l.info(`Fetch the user with account ${account}`);

    // Find the document.
    const user = (await User.findOne({ account }).lean()) as IUserModel;

    return user;
  }

  /**
   * Create a new document for the users collection.
   * @param {IUserModel} data The information of the new user.
   * @returns {Promise<IUserModel>} The newly created document (w/ an User structure).
   */
  async createUser(data: IUserModel): Promise<IUserModel> {
    // Logger info message for debugging purposes.
    l.info(`Create a new user with data ${data}`);

    // Create.
    const user = new User(data);
    const doc = (await user.save()) as IUserModel;

    return doc;
  }
}

export default new UserService();
