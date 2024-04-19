import "dotenv/config";
import connectDB from "./db/index.js";
import app from "./app.js";

connectDB()
   .then(() => {
      const port = process.env.PORT || 8000;
      app.on("error", (err) => {
         console.log("ERROR :: EXPRESS APP ON :: ", err);
         throw err;
      });
      app.listen(port, () => {
         console.log(`Server is running on port : ${port}`);
      });
   })
   .catch((err) => {
      console.log("ERROR :: MONGODB CONNECTION FAILED :: ", err);
   });
