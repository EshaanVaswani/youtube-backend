import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { User } from "../models/user.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createPlaylist = asyncHandler(async (req, res) => {
   const { name, description, visibility } = req.body;

   if (!name) {
      throw new ApiError(400, "Playlist name is required");
   }

   const playlist = await Playlist.create({
      name,
      description: description || "",
      videos: [],
      owner: req.user?._id,
      visibility,
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
            owner: { $first: "$playlistOwner" },
            totalVideos: {
               $size: "$playlistVideos",
            },
         },
      },
      {
         $project: {
            playlistOwner: 0,
         },
      },
   ]);

   return res
      .status(200)
      .json(
         new ApiResponse(
            200,
            playlists || [],
            playlists.length
               ? "Playlists fetched successfully"
               : "No playlists found"
         )
      );
});

const getPlaylistById = asyncHandler(async (req, res) => {
   const { playlistId } = req.params;

   if (!playlistId || !isValidObjectId(playlistId)) {
      throw new ApiError("Playlist id is missing or invalid");
   }

   const playlist = await Playlist.aggregate([
      {
         $match: {
            _id: new mongoose.Types.ObjectId(playlistId),
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
            ],
         },
      },
      {
         $addFields: {
            owner: { $first: "$owner" },
            totalVideos: {
               $size: "$playlistVideos",
            },
         },
      },
   ]);

   if (!playlist?.length) {
      throw new ApiError(404, "Playlist not found");
   }

   if (
      playlist[0].visibility === false &&
      !playlist[0].owner._id.equals(req.user?._id)
   ) {
      throw new ApiError(401, "Unauthorized request to view the playlist");
   }

   return res
      .status(200)
      .json(new ApiResponse(200, playlist[0], "Playlist fetched successfully"));
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

   if (!playlist.owner.equals(req.user?._id)) {
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
            `Video added to ${updatedPlaylist.name}`
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

   if (!playlist.owner.equals(req.user?._id)) {
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
            `Video removed from ${updatedPlaylist.name}`
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

   if (!playlist.owner.equals(req.user?._id)) {
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
   const { name, description, visibility } = req.body;

   if (!playlistId || !isValidObjectId(playlistId)) {
      throw new ApiError(400, "Playlist id is missing or invalid");
   }

   const playlist = await Playlist.findById(playlistId);

   if (!playlist) {
      throw new ApiError(404, "Playlist not found");
   }

   if (!playlist.owner.equals(req.user?._id)) {
      throw new ApiError(401, "Unauthorized request to update playlist");
   }

   if (!name) {
      throw new ApiError(400, "Name cannot be empty");
   }

   const updatedPlaylist = await Playlist.findByIdAndUpdate(
      playlistId,
      {
         $set: {
            name,
            description,
            visibility,
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

const toggleVisibility = asyncHandler(async (req, res) => {
   const { playlistId } = req.params;

   if (!playlistId || !isValidObjectId(playlistId)) {
      throw new ApiError(400, "Playlist id is missing or invalid");
   }

   const playlist = await Playlist.findById(playlistId);

   if (!playlist) {
      throw new ApiError(404, "Playlist not found");
   }

   if (!playlist.owner.equals(req.user?._id)) {
      throw new ApiError(401, "Unauthorized request to update playlist");
   }

   playlist.visibility = !playlist.visibility;
   await playlist.save();

   return res
      .status(200)
      .json(
         new ApiResponse(
            200,
            playlist,
            "Playlist visibility updated successfully"
         )
      );
});

const saveVideoToWatchLater = asyncHandler(async (req, res) => {
   const { videoId } = req.params;

   if (!videoId || !isValidObjectId(videoId)) {
      throw new ApiError(400, "Video id is missing or invalid");
   }

   const video = await Video.findById(videoId);

   if (!video) {
      throw new ApiError(404, "Video not found");
   }

   const watchLater = await Playlist.findOne({
      owner: req.user?._id,
      name: "Watch Later",
   });

   if (!watchLater) {
      const newWatchLater = await Playlist.create({
         name: "Watch Later",
         description: "Videos to watch later",
         videos: [videoId],
         owner: req.user?._id,
         visibility: false,
      });

      return res
         .status(200)
         .json(
            new ApiResponse(200, newWatchLater, "Video added to watch later")
         );
   } else if (watchLater.videos.includes(videoId)) {
      return res
         .status(200)
         .json(new ApiResponse(400, {}, "Video already exists in watch later"));
   } else {
      watchLater.videos.push(videoId);
      await watchLater.save();
   }

   return res
      .status(200)
      .json(new ApiResponse(200, watchLater, "Video added to watch later"));
});

const getWatchLaterVideos = asyncHandler(async (req, res) => {
   const watchLater = await Playlist.findOne({
      owner: req.user._id,
      name: "Watch Later",
   });

   if (!watchLater) {
      return res
         .status(200)
         .json(new ApiResponse(200, [], "No videos in watch later"));
   }

   const videos = await Video.find({
      _id: { $in: watchLater.videos },
   }).populate("owner", "fullName username avatar");

   return res.status(200).json(
      new ApiResponse(
         200,
         {
            videos: videos,
            videosCount: videos.length,
         },
         videos.length
            ? "Watch later videos fetched successfully"
            : "No videos in watch later"
      )
   );
});

const removeFromWatchLater = asyncHandler(async (req, res) => {
   const { videoId } = req.params;
   if (!videoId || !isValidObjectId(videoId)) {
      throw new ApiError(400, "Video id is missing or invalid");
   }

   const watchLater = await Playlist.findOne({
      owner: req.user._id,
      name: "Watch Later",
   });

   if (!watchLater) {
      return res
         .status(200)
         .json(new ApiResponse(400, {}, "No videos in watch later"));
   }

   if (!watchLater.videos.includes(videoId)) {
      return res
         .status(200)
         .json(new ApiResponse(400, {}, "Video doesn't exist in watch later"));
   }

   watchLater.videos.pull(videoId);
   await watchLater.save();

   return res
      .status(200)
      .json(new ApiResponse(200, {}, "Video removed from watch later"));
});

export {
   createPlaylist,
   getUserPlaylists,
   getPlaylistById,
   addVideoToPlaylist,
   removeVideoFromPlaylist,
   deletePlaylist,
   updatePlaylist,
   toggleVisibility,
   saveVideoToWatchLater,
   getWatchLaterVideos,
   removeFromWatchLater,
};
