import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const registerUser = asyncHandler(async (req, res) => {
   // get user details from frontend
   // validation
   // check if user already exists
   // check for images
   // upload them to cloudinary (check for avatar)
   // create user object - create entry in db
   // remove password and refresh token field from response
   // check for user creation
   // return response

   const { fullName, email, username, password } = req.body;
   console.log(req.body);

   if (
      [fullName, email, username, password].some(
         (field) => field?.trim() === ""
      )
   ) {
      throw new ApiError(400, "All fields are required");
   }

   const existingUser = User.findOne({
      $or: [{ username }, { email }],
   });
   console.log(existingUser);

   if (existingUser) {
      throw new ApiError(409, "User already exists");
   }

   const avatarLocalPath = req.files?.avatar[0]?.path;
   const coverImgLocalPath = req.files.coverImage[0]?.path;
   console.log(req.files);

   if (!avatarLocalPath) {
      throw new ApiError(400, "Avatar file is required");
   }

   const avatarOnCloud = await uploadOnCloudinary(avatarLocalPath);
   const coverImageOnCloud = await uploadOnCloudinary(coverImgLocalPath);

   if (!avatarOnCloud) {
      throw new ApiError(400, "Avatar file not uploaded to cloudinary");
   }

   const user = await User.create({
      fullName,
      avatar: avatarOnCloud.url,
      coverImage: coverImageOnCloud?.url || "",
      username: username.toLowerCase(),
      email,
      password,
   });

   const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
   );

   if (!createdUser) {
      throw new ApiError(500, "Something went wrong while creating user");
   }

   return res
      .status(201)
      .json(new ApiResponse(200, createdUser, "User registered successfully"));
});

export { registerUser };
