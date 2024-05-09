import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { User } from "../models/user.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createPlaylist = asyncHandler(async (req, res) => {
   const { name, description } = req.body;

   if (!name) {
      throw new ApiError(400, "Playlist name is required");
   }

   const playlist = await Playlist.create({
      name,
      description: description || "",
      videos: [],
      owner: req.user?._id,
   });

   if (!playlist) {
      throw new ApiError(500, "Something went wrong while creating playlist");
   }

   return res
      .status(200)
      .json(
         new ApiResponse(200, playlist, "New playlist created successfully")
      );
});

const getUserPlaylists = asyncHandler(async (req, res) => {
   const { userId } = req.params;

   if (!userId || !isValidObjectId(userId)) {
      throw new ApiError(400, "User id is missing or invalid");
   }

   const user = await User.findById(userId);

   if (!user) {
      throw new ApiError(404, "User not found");
   }

   const playlists = await Playlist.aggregate([
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
            as: "playlistOwner",
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
            from: "videos",
            localField: "videos",
            foreignField: "_id",
            as: "playlistVideos",
            pipeline: [
               {
                  $lookup: {
                     from: "users",
                     localField: "owner",
                     foreignField: "_id",
                     as: "videoOwner",
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
            ],
         },
      },
      {
         $addFields: {
            totalVideos: {
               $size: "$playlistVideos",
            },
         },
      },
   ]);

   if (!playlists || !playlists.length) {
      throw new ApiError(404, "No playlists found");
   }

   return res
      .status(200)
      .json(new ApiResponse(200, playlists, "Playlists fetched successfully"));
});

const getPlaylistById = asyncHandler(async (req, res) => {
   const { playlistId } = req.params;

   if (!playlistId || !isValidObjectId(playlistId)) {
      throw new ApiError("Playlist id is missing or invalid");
   }

   const playlist = await Playlist.findById(playlistId).populate(
      "owner",
      "fullName avatar username"
   );

   if (!playlist) {
      throw new ApiError(404, "Playlist not found");
   }

   return res
      .status(200)
      .json(new ApiResponse(200, playlist, "Playlist fetched successfully"));
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
   const { playlistId, videoId } = req.params;

   if (!playlistId || !isValidObjectId(playlistId)) {
      throw new ApiError("Playlist id is missing or invalid");
   }

   if (!videoId || !isValidObjectId(videoId)) {
      throw new ApiError("Video id is missing or invalid");
   }

   const playlist = await Playlist.findById(playlistId);

   if (!playlist) {
      throw new ApiError(404, "Playlist not found");
   }

   if (playlist.owner !== req.user?._id) {
      throw new ApiError(401, "Unauthorized request to add video to playlist");
   }

   const video = await Video.findById(videoId);

   if (!video) {
      throw new ApiError(404, "Video not found");
   }

   if (playlist?.videos.includes(videoId)) {
      return res
         .status(200)
         .json(
            new ApiResponse(400, {}, "Video already exists in the playlist")
         );
   }

   const updatedPlaylist = await Playlist.findByIdAndUpdate(
      playlistId,
      {
         $push: {
            videos: videoId,
         },
      },
      { new: true }
   );

   if (!updatedPlaylist) {
      throw new ApiError(
         500,
         "Something went wrong while adding video to playlist"
      );
   }

   return res
      .status(200)
      .json(
         new ApiResponse(
            200,
            updatedPlaylist,
            "Video added to the playlist successfully"
         )
      );
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
   const { playlistId, videoId } = req.params;

   if (!playlistId || !isValidObjectId(playlistId)) {
      throw new ApiError("Playlist id is missing or invalid");
   }

   if (!videoId || !isValidObjectId(videoId)) {
      throw new ApiError("Video id is missing or invalid");
   }

   const playlist = await Playlist.findById(playlistId);

   if (!playlist) {
      throw new ApiError(404, "Playlist not found");
   }

   if (playlist.owner !== req.user?._id) {
      throw new ApiError(
         401,
         "Unauthorized request to delete video from playlist"
      );
   }

   const video = await Video.findById(videoId);

   if (!video) {
      throw new ApiError(404, "Video not found");
   }

   if (!playlist?.videos.includes(videoId)) {
      return res
         .status(200)
         .json(new ApiResponse(400, {}, "Video doesn't exist in the playlist"));
   }

   const updatedPlaylist = await Playlist.findByIdAndUpdate(
      playlistId,
      {
         $pull: {
            videos: videoId,
         },
      },
      { new: true }
   );

   if (!updatedPlaylist) {
      throw new ApiError(
         500,
         "Something went wrong while removing video from playlist"
      );
   }

   return res
      .status(200)
      .json(
         new ApiResponse(
            200,
            updatedPlaylist,
            "Video removed from the playlist successfully"
         )
      );
});

const deletePlaylist = asyncHandler(async (req, res) => {
   const { playlistId } = req.params;

   if (!playlistId || !isValidObjectId(playlistId)) {
      throw new ApiError(400, "Playlist id is missing or invalid");
   }

   const playlist = await Playlist.findById(playlistId);

   if (!playlist) {
      throw new ApiError(404, "Playlist not found");
   }

   if (playlist.owner !== req.user?._id) {
      throw new ApiError(401, "Unauthorized request to delete the playlist");
   }

   const deleted = await Playlist.deleteOne({ _id: playlistId });

   if (!deleted) {
      throw new ApiError(500, "Something went wrong while deleting playlist");
   }

   return res
      .status(200)
      .json(new ApiResponse(200, {}, "Playlist deleted successfully"));
});

const updatePlaylist = asyncHandler(async (req, res) => {
   const { playlistId } = req.params;
   const { name, description } = req.body;

   if (!playlistId || !isValidObjectId(playlistId)) {
      throw new ApiError(400, "Playlist id is missing or invalid");
   }

   const playlist = await Playlist.findById(playlistId);

   if (!playlist) {
      throw new ApiError(404, "Playlist not found");
   }

   if (playlist.owner !== req.user?._id) {
      throw new ApiError(401, "Unauthorized request to update playlist");
   }

   if (!name || !description) {
      throw new ApiError(400, "Name or description cannot be empty");
   }

   const updatedPlaylist = await Playlist.findByIdAndUpdate(
      playlistId,
      {
         $set: {
            name,
            description,
         },
      },
      { new: true }
   );

   if (!updatedPlaylist) {
      throw new ApiError(
         500,
         "Something went wrong while updating the playlist"
      );
   }

   return res
      .status(200)
      .json(
         new ApiResponse(200, updatedPlaylist, "Playlist updated successfully")
      );
});

export {
   createPlaylist,
   getUserPlaylists,
   getPlaylistById,
   addVideoToPlaylist,
   removeVideoFromPlaylist,
   deletePlaylist,
   updatePlaylist,
};
