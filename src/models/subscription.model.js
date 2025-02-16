import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
   {
      subscriber: {
         type: mongoose.Schema.Types.ObjectId, // user is subscribing
         ref: "User",
      },
      channel: {
         type: mongoose.Schema.Types.ObjectId, // user to whom subscriber is subscribing
         ref: "User",
      },
   },
   { timestamps: true }
);

export const Subscription = mongoose.model("Subscription", subscriptionSchema);
