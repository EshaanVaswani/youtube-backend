import { Router } from "express";
import {
   addVideoToPlaylist,
   createPlaylist,
   deletePlaylist,
   getPlaylistById,
   getUserPlaylists,
   removeVideoFromPlaylist,
   toggleVisibility,
   updatePlaylist,
} from "../controllers/playlist.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/user/:userId").get(getUserPlaylists);

router.use(verifyJWT);

router.route("/").post(createPlaylist);

router
   .route("/:playlistId")
   .get(getPlaylistById)
   .patch(updatePlaylist)
   .delete(deletePlaylist);

router.route("/add/:videoId/:playlistId").patch(addVideoToPlaylist);
router.route("/remove/:videoId/:playlistId").patch(removeVideoFromPlaylist);

router.route("/toggle/:playlistId").patch(toggleVisibility);

export default router;
