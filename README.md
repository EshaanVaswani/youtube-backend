# 🧠 VideoTube Backend

This is the backend server for **[VideoTube](https://videotube-swart.vercel.app)** — a full-stack video sharing platform inspired by YouTube. It is built using **Node.js**, **Express.js**, and **MongoDB**, and provides a secure, RESTful API for video content management, user authentication, and interactions like likes, comments, and subscriptions.

> 🔗 **Frontend Repository**: [VideoTube Frontend](https://github.com/EshaanVaswani/videotube)

---

## 📑 Table of Contents

-  [Features](#-features)
-  [Tech Stack](#-tech-stack)
-  [Environment Variables](#-environment-variables)
-  [Getting Started](#-getting-started)
-  [Contributing](#-contributing)
-  [Acknowledgements](#-acknowledgements)

---

## ✨ Features

-  JWT-based authentication and authorization
-  Video upload & processing with Cloudinary
-  Channel creation and management
-  Like/Dislike system
-  Commenting system
-  Subscriptions and user feed
-  Watch history tracking
-  Aggregated statistics for creators (views, uploads, subscribers)
-  MongoDB Aggregation Pipelines for dashboard analytics

---

## 🛠 Tech Stack

-  **Runtime**: Node.js
-  **Framework**: Express.js
-  **Database**: MongoDB (with Mongoose ODM)
-  **Authentication**: JWT (JSON Web Tokens)
-  **File Storage**: Cloudinary (for videos and thumbnails)
-  **Utilities**:
   -  bcryptjs (password hashing)
   -  cookie-parser (for session cookies)
   -  cors
   -  dotenv
   -  morgan (logging)

---

## 🧩 Environment Variables

Create a `.env` file in the root directory and add the following:

```env
PORT=8000
MONGODB_URI=your_mongodb_connection_string
CORS_ORIGIN=your_frontend_url
ACCESS_TOKEN_SECRET=your_access_token_secret
ACCESS_TOKEN_EXPIRY=1d
REFRESH_TOKEN_SECRET=your_refresh_token_secret
REFRESH_TOKEN_EXPIRY=10d
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

> 🔐 Keep these variables secret in production environments.

---

## 🚀 Getting Started

### Clone the repository

```bash
git clone https://github.com/EshaanVaswani/videotube-backend.git
cd videotube-backend
```

### Install dependencies

```bash
npm install
```

### Start the server

```bash
npm run dev
```

The server will start on `http://localhost:8000` (or the port you set in `.env`).

---

## 🧑‍💻 Contributing

Contributions are welcome! Whether it's fixing bugs, suggesting enhancements, or improving documentation — feel free to open issues or submit pull requests.

---

## 🙌 Acknowledgements

-  Inspired by the core functionality of [YouTube](https://www.youtube.com)
-  Special thanks to the open-source community
