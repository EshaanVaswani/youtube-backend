import mongoose, { isValidObjectId, mongo } from "mongoose";
import { User } from "../models/user.model.js";
import { Video } from "../models/video.model.js";
import { Like } from "../models/like.model.js";
import { Comment } from "../models/comment.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
   deleteFromCloudinary,
   uploadOnCloudinary,
} from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
   const {
      page = 1,
      limit = 10,
      query,
      sortBy = "createdAt",
      sortType = "desc",
   } = req.query;

   const pipeline = [];

   const matchConditions = [];

   if (req.query.userId && isValidObjectId(req.query.userId)) {
      matchConditions.push({
         owner: new mongoose.Types.ObjectId(req.query.userId),
      });
   }

   if (query) {
      matchConditions.push({
         $or: [
            { title: { $regex: query, $options: "i" } },
            { description: { $regex: query, $options: "i" } },
         ],
      });
   }

   if (matchConditions.length > 0) {
      pipeline.push({
         $match:
            matchConditions.length > 1
               ? { $and: matchConditions }
               : matchConditions[0],
      });
   }

   pipeline.push({
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
   });

   pipeline.push({
      $lookup: {
         from: "likes",
         localField: "_id",
         foreignField: "video",
         as: "likes",
      },
   });

   pipeline.push({
      $addFields: {
         owner: { $first: "$owner" },
         likesCount: { $size: "$likes" },
      },
   });

   pipeline.push({
      $project: {
         likes: 0,
         __v: 0,
      },
   });

   pipeline.push({
      $sort: {
         [sortBy]: sortType === "asc" ? 1 : -1,
      },
   });

   const options = {
      page: Number(page) || 1,
      limit: Number(limit) || 10,
   };

   try {
      const videos = await Video.aggregatePaginate(
         Video.aggregate(pipeline),
         options
      );

      return res
         .status(200)
         .json(
            new ApiResponse(
               200,
               videos,
               videos.docs.length
                  ? "Videos fetched successfully"
                  : "No videos found"
            )
         );
   } catch (error) {
      console.error("Error fetching videos:", error);
      throw new ApiError(500, "Error fetching videos");
   }
});

const publishAVideo = asyncHandler(async (req, res) => {
   const { title, description } = req.body;

   if ([title, description].some((field) => field?.trim() === "")) {
      throw new ApiError(400, "Title and description are required");
   }

   const thumbnailLocalPath = req.files?.thumbnail[0]?.path;
   const videoFileLocalPath = req.files?.videoFile[0]?.path;

   if (!thumbnailLocalPath) {
      throw new ApiError(400, "Thumbnail is required");
   }

   if (!videoFileLocalPath) {
      throw new ApiError(400, "Video file is required");
   }

   const thumbnailOnCloud = await uploadOnCloudinary(thumbnailLocalPath);
   const videoFileOnCloud = await uploadOnCloudinary(videoFileLocalPath);

   if (!thumbnailOnCloud || !videoFileOnCloud) {
      throw new ApiError(
         400,
         "Thumbnail or video file didn't get uploaded to cloudinary"
      );
   }

   const video = await Video.create({
      title,
      description,
      thumbnail: thumbnailOnCloud.url,
      videoFile: videoFileOnCloud.url,
      owner: req.user._id,
      duration: videoFileOnCloud.duration,
      views: 0,
      isPublished: true,
   });

   if (!video) {
      throw new ApiError(
         500,
         "Something went wrong while publishing the video"
      );
   }

   return res
      .status(200)
      .json(new ApiResponse(200, video, "Video published successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
   const { videoId } = req.params;

   if (!videoId || !isValidObjectId(videoId)) {
      throw new ApiError(400, "Video id missing or invalid");
   }

   const video = await Video.aggregate([
      {
         $match: {
            _id: new mongoose.Types.ObjectId(videoId),
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
            likeCount: {
               $size: "$likes",
            },
            isLiked: {
               $in: [req.user?._id, "$likes.likedBy"],
            },
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
                     fullName: 1,
                     avatar: 1,
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
                  $addFields: {
                     subscriberCount: {
                        $size: "$subscribers",
                     },
                     isSubscribed: {
                        $in: [req.user?._id, "$subscribers.subscriber"],
                     },
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
   ]);

   if (!video?.length) {
      throw new ApiError(404, "Video not found");
   }

   return res
      .status(200)
      .json(new ApiResponse(200, video[0], "Video found successfully"));
});

const getVideoStats = asyncHandler(async (req, res) => {
   const { videoId } = req.params;

   if (!videoId || !isValidObjectId(videoId)) {
      throw new ApiError(400, "Video id is missing or invalid");
   }

   const video = await Video.aggregate([
      {
         $match: {
            _id: new mongoose.Types.ObjectId(videoId),
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
            likeCount: {
               $size: "$likes",
            },
            isLiked: {
               $in: [req.user?._id, "$likes.likedBy"],
            },
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
                     fullName: 1,
                     avatar: 1,
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
                  $addFields: {
                     subscriberCount: {
                        $size: "$subscribers",
                     },
                     isSubscribed: {
                        $in: [req.user?._id, "$subscribers.subscriber"],
                     },
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
      {
         $project: {
            owner: 1,
            likeCount: 1,
            isLiked: 1,
            views: 1,
         },
      },
   ]);

   if (!video?.length) {
      throw new ApiError(404, "Video not found");
   }

   const stats = {
      likeCount: video[0].likeCount,
      isLiked: video[0].isLiked,
      subscriberCount: video[0].owner.subscriberCount,
      isSubscribed: video[0].owner.isSubscribed,
      views: video[0].views,
   };

   return res
      .status(200)
      .json(new ApiResponse(200, stats, "Video stats found successfully"));
});

const viewVideo = asyncHandler(async (req, res) => {
   const { videoId } = req.params;

   if (!videoId || !isValidObjectId(videoId)) {
      throw new ApiError(400, "Video id is missing or invalid");
   }

   const video = await Video.findById(videoId);

   if (!video) {
      throw new ApiError(404, "Video not found");
   }

   await Video.findByIdAndUpdate(
      videoId,
      {
         $inc: {
            views: 1,
         },
      },
      { new: true }
   );

   await User.findOneAndUpdate(
      {
         _id: req.user?._id,
         "watchHistory.video": { $ne: videoId },
      },
      {
         $push: {
            watchHistory: {
               video: videoId,
               watchedAt: new Date(),
            },
         },
      },
      { new: true }
   );

   return res.status(200).json(new ApiResponse(200, {}, "Video viewed"));
});

const updateVideo = asyncHandler(async (req, res) => {
   const { videoId } = req.params;

   const { title, description } = req.body;

   if (!title || !description) {
      throw new ApiError(400, "Title or description cannot be empty");
   }

   if (!videoId || !isValidObjectId(videoId)) {
      throw new ApiError(400, "Video id is missing or invalid");
   }

   const video = await Video.findById(videoId);

   if (!video) {
      throw new ApiError(404, "Video not found");
   }

   if (!video.owner.equals(req.user?._id)) {
      throw new ApiError(401, "Unauthorized request to update video");
   }

   const thumbnailLocalPath = req.file?.path;

   let updatedVideo;
   if (thumbnailLocalPath) {
      const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

      if (!deleteFromCloudinary("youtube-clone", video.thumbnail)) {
         throw new ApiError(400, "Error while deleting file from cloudinary");
      }

      updatedVideo = await Video.findByIdAndUpdate(
         videoId,
         {
            $set: {
               title,
               description,
               thumbnail: thumbnail?.url,
            },
         },
         { new: true }
      );
   } else {
      updatedVideo = await Video.findByIdAndUpdate(
         videoId,
         {
            $set: {
               title,
               description,
            },
         },
         { new: true }
      );
   }

   if (!updatedVideo) {
      throw new ApiError(500, "Something went wrong while updating video");
   }

   return res
      .status(200)
      .json(new ApiResponse(200, updatedVideo, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
   const { videoId } = req.params;

   if (!videoId || !isValidObjectId(videoId)) {
      throw new ApiError(400, "Video id is missing or invalid");
   }

   const video = await Video.findById(videoId);

   if (!video) {
      throw new ApiError(404, "Video not found");
   }

   if (!video.owner.equals(req.user?._id)) {
      throw new ApiError(401, "Unauthorized request to delete video");
   }

   const deleteVideo = await Video.findByIdAndDelete(videoId);

   if (deleteVideo) {
      await Like.deleteMany({ video: videoId });
      await Comment.deleteMany({ video: videoId });
      deleteFromCloudinary("youtube-clone", video.thumbnail);
      deleteFromCloudinary("youtube-clone", video.videoFile);
   } else {
      throw new ApiError(500, "Something went wrong while deleting video");
   }

   res.status(200).json(new ApiResponse(200, {}, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
   const { videoId } = req.params;

   if (!videoId || !isValidObjectId(videoId)) {
      throw new ApiError(400, "Video id is missing or invalid");
   }

   const video = await Video.findById(videoId);

   if (!video) {
      throw new ApiError(404, "Video not found");
   }

   if (!video.owner.equals(req.user?._id)) {
      throw new ApiError(401, "Unauthorized request to update video");
   }

   video.isPublished = !video.isPublished;
   await video.save();

   return res
      .status(200)
      .json(new ApiResponse(200, video, "Publish status toggled successfully"));
});

export {
   getAllVideos,
   publishAVideo,
   getVideoById,
   getVideoStats,
   viewVideo,
   updateVideo,
   deleteVideo,
   togglePublishStatus,
};
