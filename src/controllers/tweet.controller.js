import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Like } from "../models/like.model.js";

const createTweet = asyncHandler(async (req, res) => {
   const { content } = req.body;

   if (!content) {
      throw new ApiError(400, "Content is required");
   }

   const tweet = await Tweet.create({
      content,
      owner: req.user?._id,
   });

   if (!tweet) {
      throw new ApiError(500, "Something went wrong while creating tweet");
   }

   return res
      .status(200)
      .json(new ApiResponse(200, tweet, "Tweet created successfully"));
});

const getUserTweets = asyncHandler(async (req, res) => {
   const { userId } = req.params;

   if (!userId || !isValidObjectId(userId)) {
      throw new ApiError(400, "User id is missing or invalid");
   }

   const tweets = await Tweet.aggregate([
      {
         $match: {
            owner: new mongoose.Types.ObjectId(userId),
         },
      },
      {
         $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "owner",
            pipeline: [
               {
                  $project: {
                     username: 1,
                     avatar: 1,
                     fullName: 1,
                  },
               },
            ],
         },
      },
      {
         $lookup: {
            from: "likes",
            localField: "_id",
            foreignField: "tweet",
            as: "likes",
         },
      },
      {
         $addFields: {
            likeCount: {
               $size: "$likes",
            },
            owner: {
               $first: "$owner",
            },
            isLiked: {
               $cond: {
                  if: { $in: [req.user?._id, "$likes.likedBy"] },
                  then: true,
                  else: false,
               },
            },
         },
      },
   ]);

   if (!tweets || !tweets.length) {
      throw new ApiError(404, "No tweets found");
   }

   return res
      .status(200)
      .json(new ApiResponse(200, tweets, "Tweets fetched successfully"));
});

const updateTweet = asyncHandler(async (req, res) => {
   const { tweetId } = req.params;
   const { content } = req.body;

   if (!tweetId || !isValidObjectId(tweetId)) {
      throw new ApiError(400, "Tweet id is missing or invalid");
   }

   if (!content) {
      throw new ApiError(400, "Content is required");
   }

   const tweet = await Tweet.findById(tweetId);

   if (tweet.owner.toString() !== req.user?._id.toString()) {
      throw new ApiError(401, "Unauthorized request to update tweet");
   }

   const updatedTweet = await Tweet.findByIdAndUpdate(
      tweetId,
      {
         $set: {
            content,
         },
      },
      { new: true }
   );

   return res
      .status(200)
      .json(new ApiResponse(200, updatedTweet, "Tweet updated successfully"));
});

const deleteTweet = asyncHandler(async (req, res) => {
   const { tweetId } = req.params;

   if (!tweetId || !isValidObjectId(tweetId)) {
      throw new ApiError(400, "Tweet id is missing or invalid");
   }

   const tweet = await Tweet.findById(tweetId);

   if (!tweet) {
      throw new ApiError(404, "Tweet not found");
   }

   if (tweet.owner.toString() !== req.user?._id.toString()) {
      throw new ApiError(401, "Unauthorized request to delete tweet");
   }

   const deletedTweet = await Tweet.findByIdAndDelete(tweetId);

   if (deletedTweet) {
      await Like.deleteMany({ tweet: tweetId });
   }

   return res
      .status(200)
      .json(new ApiResponse(200, {}, "Tweet deleted successfully"));
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };
