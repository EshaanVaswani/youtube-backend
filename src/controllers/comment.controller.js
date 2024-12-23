import mongoose, { isValidObjectId } from "mongoose";
import { Comment } from "../models/comment.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getVideoComments = asyncHandler(async (req, res) => {
   const { videoId } = req.params;
   const { page = 1, limit = 10, sortBy = "latest" } = req.query;

   if (!videoId || !isValidObjectId(videoId)) {
      throw new ApiError(400, "Video id is missing or invalid");
   }

   const video = await Video.findById(videoId);

   if (!video) {
      throw new ApiError(404, "Video not found");
   }

   let sortStage = {};
   switch (sortBy) {
      case "oldest":
         sortStage = { $sort: { createdAt: 1 } };
         break;
      case "mostLiked":
         sortStage = { $sort: { likeCount: -1 } };
         break;
      case "latest":
      default:
         sortStage = { $sort: { createdAt: -1 } };
         break;
   }

   const aggregatePipeline = [
      {
         $match: {
            video: new mongoose.Types.ObjectId(videoId),
         },
      },
      {
         $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "owner",
         },
      },
      {
         $lookup: {
            from: "likes",
            localField: "_id",
            foreignField: "comment",
            as: "likes",
         },
      },
      {
         $addFields: {
            owner: { $first: "$owner" },
            likeCount: { $size: "$likes" },
            isLiked: {
               $cond: {
                  if: { $in: [req.user?._id, "$likes.likedBy"] },
                  then: true,
                  else: false,
               },
            },
         },
      },
      {
         $project: {
            content: 1,
            video: 1,
            owner: {
               _id: 1,
               username: 1,
               avatar: 1,
               fullName: 1,
            },
            likeCount: 1,
            isLiked: 1,
            createdAt: 1,
            updatedAt: 1,
         },
      },
      sortStage,
   ];

   const comments = await Comment.aggregatePaginate(
      Comment.aggregate(aggregatePipeline),
      {
         page: Number(page) || 1,
         limit: Number(limit) || 10,
      }
   );

   return res
      .status(200)
      .json(
         new ApiResponse(
            200,
            comments,
            comments.docs.length > 0
               ? "Comments fetched successfully"
               : "No comments found"
         )
      );
});

const addComment = asyncHandler(async (req, res) => {
   // take video id from url and content from user
   // validation
   // find video using id
   // create a new comment

   const { videoId } = req.params;
   const { content } = req.body;

   if (!videoId || !isValidObjectId(videoId)) {
      throw new ApiError(400, "Video id is missing or invalid");
   }

   const video = await Video.findById(videoId);

   if (!video) {
      throw new ApiError(404, "Video not found");
   }

   if (!content || content?.trim() === "") {
      throw new ApiError(400, "Comment cannot be empty");
   }

   const comment = await Comment.create({
      content,
      video: video._id,
      owner: req.user._id,
   });

   if (!comment) {
      throw new ApiError(500, "Something went wrong while creating comment");
   }

   return res
      .status(200)
      .json(new ApiResponse(200, comment, "Comment added successfully"));
});

const updateComment = asyncHandler(async (req, res) => {
   // take updated comment from user
   // find comment in db based on id
   // check if the user is authorized to update
   // update it and return

   const { commentId } = req.params;
   const { content } = req.body;

   if (!content || content?.trim() === "") {
      throw new ApiError(400, "Comment cannot be empty");
   }

   if (!commentId || !isValidObjectId(commentId)) {
      throw new ApiError(400, "Comment id is missing or invalid");
   }

   const comment = await Comment.findById(commentId);

   if (!comment.owner.equals(req.user?._id)) {
      throw new ApiError(401, "Unauthorized request to update comment");
   }

   const updatedComment = await Comment.findByIdAndUpdate(
      commentId,
      {
         $set: {
            content,
         },
      },
      { new: true }
   );

   return res
      .status(200)
      .json(
         new ApiResponse(200, updatedComment, "Comment updated successfully")
      );
});

const deleteComment = asyncHandler(async (req, res) => {
   // find comment in db based on id
   // check if the user is authorized to delete
   // delete it

   const { commentId } = req.params;

   if (!commentId || !isValidObjectId(commentId)) {
      throw new ApiError(400, "Comment id is missing or invalid");
   }

   const comment = await Comment.findById(commentId);

   if (!comment) {
      throw new ApiError(404, "Comment not found");
   }

   if (!comment.owner.equals(req.user?._id)) {
      throw new ApiError(401, "Unauthorized request to delete comment");
   }

   await Comment.findByIdAndDelete(commentId);

   res.status(200).json(
      new ApiResponse(200, {}, "Comment deleted successfully")
   );
});

export { getVideoComments, addComment, updateComment, deleteComment };
