import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
   try {
      const user = await User.findById(userId);

      const accessToken = user.generateAccessToken();
      const refreshToken = user.generateRefreshToken();

      user.refreshToken = refreshToken;
      await user.save({ validateBeforeSave: false });

      return { accessToken, refreshToken };
   } catch (error) {
      throw new ApiError(
         500,
         "Something went wrong while generating access and refresh token"
      );
   }
};

const registerUser = asyncHandler(async (req, res) => {
   // get user details from frontend
   // validation
   // check if user already exists
   // check for images
   // upload them to cloudinary (check for avatar)
   // create user object - create entry in db
   // remove password and refresh token field from response
   // check for user creation
   // return response

   const { fullName, email, username, password } = req.body;

   if (
      [fullName, email, username, password].some(
         (field) => field?.trim() === ""
      )
   ) {
      throw new ApiError(400, "All fields are required");
   }

   const existingUser = await User.findOne({
      $or: [{ username }, { email }],
   });

   if (existingUser) {
      throw new ApiError(409, "User already exists");
   }

   const avatarLocalPath = req.files?.avatar[0]?.path;
   //const coverImgLocalPath = req.files.coverImage[0]?.path;

   let coverImgLocalPath;
   if (
      req.files &&
      Array.isArray(req.files.coverImage) &&
      req.files.coverImage.length > 0
   ) {
      coverImgLocalPath = req.files.coverImage[0].path;
   }

   if (!avatarLocalPath) {
      throw new ApiError(400, "Avatar file is required");
   }

   const avatarOnCloud = await uploadOnCloudinary(avatarLocalPath);
   const coverImageOnCloud = await uploadOnCloudinary(coverImgLocalPath);

   if (!avatarOnCloud) {
      throw new ApiError(400, "Avatar file not uploaded to cloudinary");
   }

   const user = await User.create({
      fullName,
      avatar: avatarOnCloud.url,
      coverImage: coverImageOnCloud?.url || "",
      username: username.toLowerCase(),
      email,
      password,
   });

   const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
   );

   if (!createdUser) {
      throw new ApiError(500, "Something went wrong while creating user");
   }

   return res
      .status(201)
      .json(new ApiResponse(200, createdUser, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
   // req body -> data
   // username or email
   // find the user
   // password check
   // access token and refresh token
   // send cookies

   const { username, email, password } = req.body;

   if (!username && !email) {
      throw new ApiError(400, "username or email is required");
   }

   const user = await User.findOne({
      $or: [{ username }, { email }],
   });

   if (!user) {
      throw new ApiError(404, "User does not exist");
   }

   const isPasswordValid = await user.isPasswordCorrect(password);

   if (!isPasswordValid) {
      throw new ApiError(401, "Invalid user credentials");
   }

   const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
      user._id
   );

   const loggedInUser = await User.findById(user._id).select(
      "-password -refreshToken"
   );

   const options = {
      httpOnly: true,
      secure: true,
   };

   return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
         new ApiResponse(
            200,
            { user: loggedInUser, accessToken, refreshToken },
            "User logged in successfully"
         )
      );
});

const logoutUser = asyncHandler(async (req, res) => {
   // clear the cookies
   // reset refresh token of user in db

   await User.findByIdAndUpdate(
      req.user._id,
      {
         $set: {
            refreshToken: undefined,
         },
      },
      {
         new: true,
      }
   );

   const options = {
      httpOnly: true,
      secure: true,
   };

   return res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json(new ApiResponse(200, {}, "User logged out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
   // this path should be used when access token has been expired
   //   1. we will get the refresh token from the cookies
   //   2. match it from the db
   //   3. if it is correct then regenerate the access token and refresh token

   const incomingRefreshToken =
      req.cookies.refreshToken || req.body.refreshToken;

   if (!incomingRefreshToken) {
      throw new ApiError(401, "Unauthorized request");
   }

   try {
      const decodedToken = jwt.verify(
         incomingRefreshToken,
         process.env.REFRESH_TOKEN_SECRET
      );

      const user = await User.findById(decodedToken?._id);

      if (!user) {
         throw new ApiError(401, "Invalid refesh token");
      }

      if (incomingRefreshToken !== user?.refreshToken) {
         throw new ApiError(401, "Refresh token is verified or used");
      }

      const options = {
         httpOnly: true,
         secure: true,
      };

      const { accessToken, refreshToken } =
         await generateAccessAndRefreshTokens(user._id);

      return res
         .status(200)
         .cookie("accessToken", accessToken, options)
         .cookie("refreshToken", newRefreshToken, options)
         .json(
            new ApiResponse(
               200,
               { accessToken, refreshToken: newRefreshToken },
               "Access and refresh token generated successfully"
            )
         );
   } catch (error) {
      throw new ApiError(401, error?.message || "Invalid refresh token");
   }
});

const changePassword = asyncHandler(async (req, res) => {
   // take old and new password from user
   // check if old password is correct in db
   // update user password to new password

   const { oldPassword, newPassword } = req.body;

   const user = await User.findById(req.user?._id);

   const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

   if (!isPasswordCorrect) {
      throw new ApiError(400, "Invalid new password");
   }

   user.password = newPassword;

   await user.save({ validateBeforeSave: false });

   return res
      .status(200)
      .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
   const user = req.user; // from auth middleware

   return res
      .status(200)
      .json(new ApiResponse(200, user, "User found successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
   // remember to write different methods for updating text related data and files related data
   // take updated fields from user
   // validation
   // find user in db and update the fields

   const { fullName, email } = req.body;

   if (!fullName || !email) {
      throw new ApiError(400, "All fields are required");
   }

   const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
         $set: {
            fullName,
            email,
         },
      },
      { new: true }
   ).select("-password -refreshToken");

   return res
      .status(200)
      .json(new ApiResponse(200, user, "Account details updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
   const avatarLocalPath = req.file?.path;

   if (!avatarLocalPath) {
      throw new ApiError(400, "Avatar file is missing");
   }

   const avatar = await uploadOnCloudinary(avatarLocalPath);

   if (!avatar) {
      throw new ApiError(400, "Error while uploading the file");
   }

   const user = await User.findByIdAndUpdate(
      req.user._id,
      {
         $set: {
            avatar: avatar.url,
         },
      },
      { new: true }
   ).select("-password -refreshToken");

   return res
      .status(200)
      .json(new ApiResponse(200, user, "Avatar image updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
   const coverImgLocalPath = req.file?.path;

   if (!coverImgLocalPath) {
      throw new ApiError(400, "Cover Image file is missing");
   }

   const coverImage = await uploadOnCloudinary(coverImgLocalPath);

   if (!coverImage) {
      throw new ApiError(400, "Error while uploading the file");
   }

   const user = await User.findByIdAndUpdate(
      req.user._id,
      {
         $set: {
            coverImage: coverImage.url,
         },
      },
      { new: true }
   ).select("-password -refreshToken");

   return res
      .status(200)
      .json(new ApiResponse(200, user, "Cover image updated successfully"));
});

export {
   registerUser,
   loginUser,
   logoutUser,
   refreshAccessToken,
   changePassword,
   getCurrentUser,
   updateAccountDetails,
   updateUserAvatar,
   updateUserCoverImage,
};
