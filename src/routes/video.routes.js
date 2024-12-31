import { Router } from "express";
import {
   deleteVideo,
   getAllVideos,
   getVideoById,
   getVideoStats,
   publishAVideo,
   togglePublishStatus,
   updateVideo,
   viewVideo,
} from "../controllers/video.controller.js";
import {
   verifyJWT,
   verifyJWTOptional,
} from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.route("/").get(getAllVideos);
router.route("/:videoId").get(verifyJWTOptional, getVideoById);
router.route("/view/:videoId").patch(verifyJWTOptional, viewVideo);
router.route("/stats/:videoId").get(verifyJWTOptional, getVideoStats);

router.use(verifyJWT);

router.route("/").post(
   upload.fields([
      {
         name: "videoFile",
         maxCount: 1,
      },
      {
         name: "thumbnail",
         maxCount: 1,
      },
   ]),
   publishAVideo
);

router
   .route("/:videoId")
   .delete(deleteVideo)
   .patch(upload.single("thumbnail"), updateVideo);

router.route("/toggle/publish/:videoId").patch(togglePublishStatus);

export default router;
