import { Router } from "express";
import {
   loginUser,
   logoutUser,
   refreshAccessToken,
   registerUser,
   changePassword,
   getCurrentUser,
   updateAccountDetails,
   updateUserAvatar,
   updateUserCoverImage,
   getUserChannelProfile,
   getWatchHistory,
   removeVideoFromWatchHistory,
   clearWatchHistory,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import {
   verifyJWT,
   verifyJWTOptional,
} from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
   upload.fields([
      {
         name: "avatar",
         maxCount: 1,
      },
      {
         name: "coverImage",
         maxCount: 1,
      },
   ]),
   registerUser
);
router.route("/login").post(loginUser);

router.route("/logout").post(verifyJWT, logoutUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/change-password").post(verifyJWT, changePassword);
router.route("/current-user").get(verifyJWT, getCurrentUser);
router.route("/update-account").patch(verifyJWT, updateAccountDetails);
router
   .route("/update-avatar")
   .patch(verifyJWT, upload.single("avatar"), updateUserAvatar);
router
   .route("/update-cover-img")
   .patch(verifyJWT, upload.single("coverImage"), updateUserCoverImage);
router
   .route("/channel/:username")
   .get(verifyJWTOptional, getUserChannelProfile);
router
   .route("/watch-history")
   .get(verifyJWT, getWatchHistory)
   .patch(verifyJWT, clearWatchHistory);
router
   .route("/watch-history/:videoId")
   .patch(verifyJWT, removeVideoFromWatchHistory);

export default router;
