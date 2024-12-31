import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";

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

// this middleware is similar to the above one but the only difference is that it doesn't throw an error if the token is invalid
// it just skips the verification part and moves on to the next handler
// this is useful when you want to make a route accessible to both logged in and logged out users
export const verifyJWTOptional = asyncHandler(async (req, _, next) => {
   try {
      const token =
         req.cookies?.accessToken ||
         req.header("Authorization")?.replace("Bearer ", "");

      if (!token) {
         return next();
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
