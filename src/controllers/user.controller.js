import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import {
   deleteFromCloudinary,
   uploadOnCloudinary,
} from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";
import mongoose, { isValidObjectId } from "mongoose";

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
      sameSite: "none",
      // domain: process.env.DOMAIN,
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
         $unset: {
            refreshToken: 1, // this removes the field from document
         },
      },
      {
         new: true,
      }
   );

   const options = {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      // domain: process.env.DOMAIN,
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
         sameSite: "none",
         // domain: process.env.DOMAIN,
      };

      const { accessToken, refreshToken } =
         await generateAccessAndRefreshTokens(user._id);

      return res
         .status(200)
         .cookie("accessToken", accessToken, options)
         .cookie("refreshToken", refreshToken, options)
         .json(
            new ApiResponse(
               200,
               { accessToken, refreshToken },
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
      throw new ApiError(400, "Invalid old password");
   }

   user.password = newPassword;

   await user.save({ validateBeforeSave: false });

   const updatedUser = await User.findById(req.user?._id).select(
      "-password -refreshToken"
   );

   return res
      .status(200)
      .json(new ApiResponse(200, updatedUser, "Password changed successfully"));
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

   const { fullName, username, email } = req.body;

   if (!fullName || !username || !email) {
      throw new ApiError(400, "All fields are required");
   }

   const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
         $set: {
            fullName,
            username,
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

   if (!deleteFromCloudinary("youtube-clone", req.user?.avatar)) {
      throw new ApiError(400, "Error while deleting file from cloudinary");
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

   if (!deleteFromCloudinary("youtube-clone", req.user?.coverImage)) {
      throw new ApiError(400, "Error while deleting file from cloudinary");
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

const getUserChannelProfile = asyncHandler(async (req, res) => {
   const { username } = req.params;

   if (!username?.trim()) {
      throw new ApiError(400, "Username is missing");
   }

   const channel = await User.aggregate([
      {
         $match: {
            username: username?.toLowerCase(),
         },
      },
      {
         $lookup: {
            from: "subscriptions", // Subscription -> subscriptions
            localField: "_id",
            foreignField: "channel",
            as: "subscribers",
         },
      },
      {
         $lookup: {
            from: "subscriptions",
            localField: "_id",
            foreignField: "subsciber",
            as: "subscribedTo",
         },
      },
      {
         $lookup: {
            from: "videos",
            localField: "_id",
            foreignField: "owner",
            as: "videos",
         },
      },
      {
         $addFields: {
            subscribersCount: {
               $size: "$subscribers",
            },
            channelsSubscribedToCount: {
               $size: "$subscribedTo",
            },
            isSubscribed: {
               $in: [req.user?._id, "$subscribers.subscriber"],
            },
            videosCount: {
               $size: "$videos",
            },
         },
      },
      {
         $project: {
            fullName: 1,
            username: 1,
            avatar: 1,
            coverImage: 1,
            email: 1,
            subscribersCount: 1,
            channelsSubscribedToCount: 1,
            isSubscribed: 1,
            videosCount: 1,
         },
      },
   ]);

   if (!channel?.length) {
      throw new ApiError(404, "Channel doesn't exist");
   }

   return res
      .status(200)
      .json(
         new ApiResponse(200, channel[0], "User channel fetched successfully")
      );
});

const getWatchHistory = asyncHandler(async (req, res) => {
   const user = await User.aggregate([
      {
         $match: {
            _id: new mongoose.Types.ObjectId(req.user._id),
         },
      },
      {
         $unwind: "$watchHistory",
      },
      {
         $lookup: {
            from: "videos",
            localField: "watchHistory.video",
            foreignField: "_id",
            as: "videoData",
            pipeline: [
               {
                  $lookup: {
                     from: "users",
                     localField: "owner",
                     foreignField: "_id",
                     as: "owner",
                     pipeline: [
                        {
                           $project: {
                              fullName: 1,
                              username: 1,
                              avatar: 1,
                           },
                        },
                     ],
                  },
               },
               {
                  $addFields: {
                     owner: {
                        $first: "$owner",
                     },
                  },
               },
            ],
         },
      },
      {
         $addFields: {
            video: {
               $first: "$videoData",
            },
            watchedAt: "$watchHistory.watchedAt",
         },
      },
      {
         $project: {
            _id: "$video._id",
            title: "$video.title",
            description: "$video.description",
            thumbnail: "$video.thumbnail",
            duration: "$video.duration",
            views: "$video.views",
            owner: "$video.owner",
            watchedAt: 1,
         },
      },
      {
         $sort: {
            watchedAt: -1,
         },
      },
   ]);

   return res
      .status(200)
      .json(new ApiResponse(200, user, "Watch History fetched successfully"));
});

const removeVideoFromWatchHistory = asyncHandler(async (req, res) => {
   const { videoId } = req.params;

   if (!videoId || !isValidObjectId(videoId)) {
      throw new ApiError(400, "Video id is required");
   }

   await User.findByIdAndUpdate(
      req.user._id,
      {
         $pull: {
            watchHistory: {
               video: videoId,
            },
         },
      },
      { new: true }
   );

   return res
      .status(200)
      .json(new ApiResponse(200, {}, "Video removed from watch history"));
});

const clearWatchHistory = asyncHandler(async (req, res) => {
   await User.findByIdAndUpdate(
      req.user._id,
      {
         $set: {
            watchHistory: [],
         },
      },
      { new: true }
   );

   return res
      .status(200)
      .json(new ApiResponse(200, {}, "Watch history cleared successfully"));
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
   getUserChannelProfile,
   getWatchHistory,
   removeVideoFromWatchHistory,
   clearWatchHistory,
};
