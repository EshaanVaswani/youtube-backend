import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import { Video } from "../models/video.model.js";
import { Comment } from "../models/comment.model.js";
import { Tweet } from "../models/tweet.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
   const { videoId } = req.params;

   if (!videoId || !isValidObjectId(videoId)) {
      throw new ApiError(400, "Video id is missing or invalid");
   }

   const video = await Video.findById(videoId);

   if (!video) {
      throw new ApiError(404, "Video not found");
   }

   const isLiked = await Like.findOne({
      video: videoId,
      likedBy: req.user?._id,
   });

   if (isLiked) {
      await Like.findByIdAndDelete(isLiked._id);

      return res
         .status(200)
         .json(new ApiResponse(200, {}, "Like removed from the video"));
   } else {
      const like = await Like.create({
         video: videoId,
         likedBy: req.user?._id,
      });

      return res
         .status(200)
         .json(new ApiResponse(200, like, "Liked the video"));
   }
});

const toggleCommentLike = asyncHandler(async (req, res) => {
   const { commentId } = req.params;

   if (!commentId || !isValidObjectId(commentId)) {
      throw new ApiError(400, "Comment id is missing or invalid");
   }

   const comment = await Comment.findById(commentId);

   if (!comment) {
      throw new ApiError(404, "Comment not found");
   }

   const isLiked = await Like.findOne({
      comment: commentId,
      likedBy: req.user?._id,
   });

   if (isLiked) {
      await Like.findByIdAndDelete(isLiked._id);

      return res
         .status(200)
         .json(new ApiResponse(200, {}, "Like removed from the comment"));
   } else {
      const like = await Like.create({
         comment: commentId,
         likedBy: req.user?._id,
      });

      return res
         .status(200)
         .json(new ApiResponse(200, like, "Liked the comment"));
   }
});

const toggleTweetLike = asyncHandler(async (req, res) => {
   const { tweetId } = req.params;

   if (!tweetId || !isValidObjectId(tweetId)) {
      throw new ApiError(400, "Tweet id is missing or invalid");
   }

   const tweet = await Tweet.findById(tweetId);

   if (!tweet) {
      throw new ApiError(404, "Tweet not found");
   }

   const isLiked = await Like.findOne({
      tweet: tweetId,
      likedBy: req.user?._id,
   });

   if (isLiked) {
      await Like.findByIdAndDelete(isLiked._id);

      return res
         .status(200)
         .json(new ApiResponse(200, {}, "Like removed from the tweet"));
   } else {
      const like = await Like.create({
         tweet: tweetId,
         likedBy: req.user?._id,
      });

      return res
         .status(200)
         .json(new ApiResponse(200, like, "Liked the tweet"));
   }
});

const getLikedVideos = asyncHandler(async (req, res) => {
   const videos = await Like.aggregate([
      {
         $match: {
            likedBy: new mongoose.Types.ObjectId(req.user?._id),
            video: { $exists: true },
         },
      },
      {
         $lookup: {
            from: "videos",
            localField: "video",
            foreignField: "_id",
            as: "likedVideos",
            pipeline: [
               {
                  $lookup: {
                     from: "users",
                     localField: "owner",
                     foreignField: "_id",
                     as: "owner",
                  },
               },
               { $unwind: "$owner" },
               {
                  $project: {
                     title: 1,
                     description: 1,
                     url: 1,
                     "owner.fullName": 1,
                     "owner.username": 1,
                     "owner.avatar": 1,
                  },
               },
            ],
         },
      },
      {
         $unwind: "$likedVideos",
      },
      {
         $group: {
            _id: "$likedBy",
            likedVideos: {
               $push: "$likedVideos",
            },
         },
      },
      {
         $addFields: {
            videosCount: { $size: "$likedVideos" },
         },
      },
      {
         $project: {
            _id: 0,
            likedVideos: 1,
            videosCount: 1,
         },
      },
   ]);

   if (!videos || !videos.length) {
      throw new ApiError(404, "No videos found");
   }

   return res
      .status(200)
      .json(
         new ApiResponse(200, videos[0], "Liked videos fetched successfully")
      );
});

export { toggleCommentLike, toggleTweetLike, toggleVideoLike, getLikedVideos };
