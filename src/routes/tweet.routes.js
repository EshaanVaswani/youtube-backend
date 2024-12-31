import { Router } from "express";
import {
   createTweet,
   deleteTweet,
   getUserTweets,
   updateTweet,
} from "../controllers/tweet.controller.js";
import {
   verifyJWT,
   verifyJWTOptional,
} from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/user/:userId").get(verifyJWTOptional, getUserTweets);

router.use(verifyJWT);

router.route("/").post(createTweet);
router.route("/:tweetId").patch(updateTweet).delete(deleteTweet);

export default router;
