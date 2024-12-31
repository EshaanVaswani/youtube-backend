import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
   // find the channel
   // check if user is subscribed or not in db
   // if yes, delete the subscription
   // if no, create new subscription

   const { channelId } = req.params;

   if (!channelId || !isValidObjectId(channelId)) {
      throw new ApiError(400, "Channel id is missing or invalid");
   }

   const channel = await User.findById(channelId);

   if (!channel) {
      throw new ApiError(404, "Channel not found");
   }

   if (channel._id.toString() === req.user?._id.toString()) {
      throw new ApiError(403, "You cannot subscribe to your own channel");
   }

   const isAlreadySubscribed = await Subscription.findOne({
      channel: channelId,
      subscriber: req.user?._id,
   });

   if (!isAlreadySubscribed) {
      const newSubscription = await Subscription.create({
         channel: channelId,
         subscriber: req.user?._id,
      });

      if (!newSubscription) {
         throw new ApiError(500, "Unable to subscribe to the channel");
      }

      return res
         .status(200)
         .json(
            new ApiResponse(
               200,
               newSubscription,
               "Successfully subscribed to the channel"
            )
         );
   } else {
      const deleteSubscription = await Subscription.deleteOne({
         channel: channelId,
         subscriber: req.user?._id,
      });

      if (!deleteSubscription) {
         throw new ApiError(500, "Unable to unsubscribe to the channel");
      }

      return res
         .status(200)
         .json(
            new ApiResponse(200, {}, "Sucessfully unsubscribed to the channel")
         );
   }
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
   const { channelId } = req.params;

   if (!channelId || !isValidObjectId(channelId)) {
      throw new ApiError(400, "Channel id is missing or invalid");
   }

   const channel = await User.findById(channelId);

   if (!channel) {
      throw new ApiError(404, "Channel not found");
   }

   const subscribers = await Subscription.find({ channel: channelId }).populate(
      {
         path: "subscriber",
         select: "-watchHistory -password -refreshToken -createdAt -updatedAt",
      }
   );

   if (!subscribers) {
      throw new ApiError(
         500,
         "Something went wrong while fetching channel subscribers"
      );
   }

   return res
      .status(200)
      .json(
         new ApiResponse(200, subscribers, "Subscribers fetched successfully")
      );
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
   const { subscriberId } = req.params;

   if (!subscriberId || !isValidObjectId(subscriberId)) {
      throw new ApiError(400, "Subscriber id is missing or invalid");
   }

   const user = await User.findById(subscriberId);

   if (!user) {
      throw new ApiError(404, "User not found");
   }

   const channels = await Subscription.aggregate([
      {
         $match: { subscriber: new mongoose.Types.ObjectId(subscriberId) },
      },
      {
         $lookup: {
            from: "users",
            localField: "channel",
            foreignField: "_id",
            as: "channel",
            pipeline: [
               {
                  $project: {
                     watchHistory: 0,
                     password: 0,
                     refreshToken: 0,
                     createdAt: 0,
                     updatedAt: 0,
                  },
               },
            ],
         },
      },
      {
         $lookup: {
            from: "subscriptions",
            localField: "channel._id",
            foreignField: "channel",
            as: "subscribers",
         },
      },
      {
         $addFields: {
            subscriberCount: { $size: "$subscribers" },
            channel: { $arrayElemAt: ["$channel", 0] },
         },
      },
      {
         $project: {
            subscribers: 0,
         },
      },
   ]);

   if (!channels) {
      throw new ApiError(
         500,
         "Something went wrong while fetching subscribed channels"
      );
   }

   return res
      .status(200)
      .json(
         new ApiResponse(
            200,
            channels,
            "Subscribed channels fetched successfully"
         )
      );
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
