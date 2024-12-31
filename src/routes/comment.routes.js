import { Router } from "express";
import {
   addComment,
   deleteComment,
   getVideoComments,
   updateComment,
} from "../controllers/comment.controller.js";
import {
   verifyJWT,
   verifyJWTOptional,
} from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/:videoId").get(verifyJWTOptional, getVideoComments);

router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router.route("/:videoId").post(addComment);
router.route("/c/:commentId").delete(deleteComment).patch(updateComment);

export default router;
