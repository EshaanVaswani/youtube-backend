import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getChannelStats = asyncHandler(async (req, res) => {
   const stats = await Video.aggregate([
      {
         $match: {
            owner: new mongoose.Types.ObjectId(req.user?._id),
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
                     fullName: 1,
                     avatar: 1,
                     username: 1,
                  },
               },
            ],
         },
      },
      {
         $lookup: {
            from: "likes",
            localField: "_id",
            foreignField: "video",
            as: "likes",
         },
      },
      {
         $group: {
            _id: null,
            owner: { $first: "$owner" },
            totalViews: {
               $sum: "$views",
            },
            totalVideos: {
               $sum: 1,
            },
            totalLikes: {
               $sum: { $size: "$likes" },
            },
         },
      },
      {
         $lookup: {
            from: "subscriptions",
            localField: "_id",
            foreignField: "channel",
            as: "subscribers",
         },
      },
      {
         $project: {
            owner: 1,
            totalViews: 1,
            totalLikes: 1,
            totalVideos: 1,
            totalSubscribers: { $size: "$subscribers" },
         },
      },
   ]);

   if (!stats?.length) {
      throw new ApiError(
         500,
         "Something went wrong while fetching channel stats"
      );
   }

   return res
      .status(200)
      .json(
         new ApiResponse(200, stats[0], "Channel stats fetched successfully")
      );
});

const getChannelVideos = asyncHandler(async (req, res) => {
   const videos = await Video.aggregate([
      {
         $match: {
            owner: new mongoose.Types.ObjectId(req.user?._id),
         },
      },
      {
         $lookup: {
            from: "likes",
            localField: "_id",
            foreignField: "video",
            as: "likes",
         },
      },
      {
         $addFields: {
            likesCount: {
               $size: "$likes",
            },
         },
      },
      {
         $sort: {
            createdAt: -1,
         },
      },
   ]);

   if (!videos || !videos.length) {
      throw new ApiError(404, "Videos not found");
   }

   return res
      .status(200)
      .json(
         new ApiResponse(
            200,
            videos,
            "Successfully fetched all videos of channel"
         )
      );
});

export { getChannelStats, getChannelVideos };
