import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const healthcheck = asyncHandler(async (req, res) => {
   const healthCheck = {
      uptime: process.uptime(),
      message: "ok",
      responseTime: process.hrtime(),
      timestamp: Date.now(),
   };

   try {
      res.status(200).json(
         new ApiResponse(200, healthCheck, "Server is healthy and running")
      );
   } catch (error) {
      console.error("ERROR :: Error in healthcheck", error);
      healthCheck.message = error;
      throw new ApiError(503, "Error in healthcheck");
   }
});

export { healthcheck };
