import mongoose, { isValidObjectId, mongo } from "mongoose";
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
   const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;

   const matchStage = {};

   if (userId && isValidObjectId(userId)) {
      matchStage["$match"] = {
         owner: new mongoose.Types.ObjectId(userId),
      };
   } else if (query) {
      matchStage["$match"] = {
         $or: [
            {
               title: {
                  $regex: query,
                  $options: "i",
               },
            },
            {
               description: {
                  $regex: query,
                  $options: "i",
               },
            },
         ],
      };
   } else {
      matchStage["$match"] = {};
   }

   if (userId && query) {
      matchStage["$match"] = {
         $and: [
            {
               owner: new mongoose.Types.ObjectId(userId),
            },
            {
               $or: [
                  {
                     title: {
                        $regex: query,
                        $options: "i",
                     },
                  },
                  {
                     description: {
                        $regex: query,
                        $options: "i",
                     },
                  },
               ],
            },
         ],
      };
   }

   const sortStage = {};

   if (sortBy && sortType) {
      sortStage["$sort"] = {
         [sortBy]: sortType === "asc" ? 1 : -1,
      };
   } else {
      sortStage["$sort"] = {
         createdAt: -1,
      };
   }

   const allVideos = await Video.aggregate([
      matchStage,
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
         $lookup: {
            from: "likes",
            localField: "_id",
            foreignField: "video",
            as: "likes",
         },
      },
      sortStage,
      {
         $addFields: {
            owner: {
               $first: "$owner",
            },
            likeCount: {
               $size: "$likes",
            },
         },
      },
   ]);

   const videos = await Video.aggregatePaginate(allVideos, {
      page: isNaN(Number(page)) ? 1 : page,
      limit: isNaN(Number(limit)) ? 5 : limit,
   });

   if (!videos || !videos.docs.length) {
      throw new ApiError(404, "No videos found");
   }

   return res
      .status(200)
      .json(new ApiResponse(200, videos, "Videos fetched successfully"));
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

   if (!thumbnailOnCloud || videoFileOnCloud) {
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

   const video = await Video.findById(videoId);

   if (!video || (!video?.isPublished && !(video?.owner === req.user?._id))) {
      throw new ApiError(404, "Video not found");
   }

   return res
      .status(200)
      .json(new ApiResponse(200, video, "Video found successfully"));
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

   if (video.owner !== req.user?._id) {
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

   if (video.owner !== req.user?._id) {
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

   if (video.owner !== req.user?._id) {
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
   updateVideo,
   deleteVideo,
   togglePublishStatus,
};
