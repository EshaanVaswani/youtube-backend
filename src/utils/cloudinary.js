import { v2 as cloudinary } from "cloudinary";
import { log } from "console";
import fs from "fs";

cloudinary.config({
   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
   api_key: process.env.CLOUDINARY_API_KEY,
   api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
   try {
      if (!localFilePath) return null;

      //upload file on cloudinary
      const response = await cloudinary.uploader.upload(localFilePath, {
         resource_type: "auto",
         folder: "youtube-clone",
      });

      //file uploaded successfully
      fs.unlinkSync(localFilePath);

      return response;
   } catch (error) {
      fs.unlinkSync(localFilePath); // remove the locally saved temp file as upload operation failed

      return null;
   }
};

const deleteFromCloudinary = async (folder, cloudPath) => {
   try {
      if (!cloudPath) return null;

      // extract publicId from cloudPath
      const parts = cloudPath.split("/");
      const file = parts[parts.length - 1];
      const id = file.split(".")[0];

      const publicId = `${folder}/${id}`;

      // delete file from cloudinary
      const resource = cloudPath.includes("video") ? "video" : "image";

      const response = await cloudinary.uploader.destroy(publicId, {
         resource_type: resource,
      });

      return response;
   } catch (error) {
      console.log(
         "ERROR :: Error while deleting file from cloudinary :: ",
         error
      );
      return null;
   }
};

export { uploadOnCloudinary, deleteFromCloudinary };
