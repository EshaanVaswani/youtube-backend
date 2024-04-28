import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { User } from "../models/user.model";

// this middleware checks if there exists cookie and if it does then that means an user is logged in
// hence it adds that user's info from the db in the req as "req.user" so that the next handler can use it accordingly
export const verifyJWT = asyncHandler(async (req, _, next) => {
   try {
      const token =
         req.cookies?.accessToken ||
         req.header("Authorization")?.replace("Bearer ", "");

      if (!token) {
         throw new ApiError(401, "Unauthorized Request");
      }

      const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

      const user = await User.findById(decodedToken?._id).select(
         "-password -refreshToken"
      );

      if (!user) {
         throw new ApiError(401, "Invalid Access Token");
      }

      req.user = user;
      next();
   } catch (error) {
      throw new ApiError(401, error?.message || "Invalid Access Token");
   }
});
