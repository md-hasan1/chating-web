import multer from "multer";
import { randomUUID } from "crypto";
import path from "path";
import os from "os";
import fs from "fs/promises";
import {
  S3Client,
  PutObjectCommand,
  ObjectCannedACL,
} from "@aws-sdk/client-s3";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
// @ts-ignore
import streamifier from "streamifier";
import dotenv from "dotenv";

dotenv.config();

const hasCloudinaryConfig =
  !!process.env.CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET;

const hasDigitalOceanConfig =
  !!process.env.DO_SPACE_ENDPOINT &&
  !!process.env.DO_SPACE_BUCKET &&
  !!process.env.DO_SPACE_ACCESS_KEY &&
  !!process.env.DO_SPACE_SECRET_KEY;

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

// Configure DigitalOcean Spaces
const s3Client = new S3Client({
  region: "us-east-1",
  endpoint: process.env.DO_SPACE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.DO_SPACE_ACCESS_KEY || "",
    secretAccessKey: process.env.DO_SPACE_SECRET_KEY || "",
  },
});

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer configuration using memoryStorage (for DigitalOcean & Cloudinary)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

// ✅ Fixed Cloudinary Storage
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    // @ts-ignore
    public_id: (req, file) => `${Date.now()}_${file.originalname}`,
  },
});

const cloudinaryUpload = multer({ storage: cloudinaryStorage });

// Upload single image
const uploadSingle = upload.single("image");
const uploadFile = upload.single("file");

// Upload multiple images
const uploadMultipleImage = upload.fields([{ name: "images", maxCount: 15 }]);

// Upload profile and banner images
const updateProfile = upload.fields([
  { name: "profile", maxCount: 1 },
  { name: "banner", maxCount: 1 },
]);

const uploadToCloudinary = async (
  file: Express.Multer.File,
): Promise<{ Location: string; public_id: string }> => {
  if (!file) {
    throw new Error("File is required for uploading.");
  }
  if (!file.buffer || file.buffer.length === 0) {
    throw new Error("Uploaded file is empty after processing.");
  }
  if (!hasCloudinaryConfig) {
    throw new Error("Cloudinary is not configured.");
  }

  const uniqueFileName = `file_${Date.now()}_${randomUUID()}`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "uploads",
        resource_type: "auto", // Supports images, videos, etc.
        use_filename: true,
        public_id: uniqueFileName,
        overwrite: false,
      },
      (error, result) => {
        if (error) {
          console.error("Error uploading file to Cloudinary:", error);
          return reject(error);
        }

        // ✅ Explicitly return `Location` and `public_id`
        resolve({
          Location: result?.secure_url || "", // Cloudinary URL
          public_id: result?.public_id || "",
        });
      },
    );

    // Convert buffer to stream and upload
    streamifier.createReadStream(file.buffer).pipe(uploadStream);
  });
};

const compressImageFile = async (
  file: Express.Multer.File,
): Promise<Express.Multer.File> => {
  const extension = path.extname(file.originalname).toLowerCase();
  if (extension === ".svg" || extension === ".gif") {
    return file;
  }

  try {
    const compressedBuffer = await sharp(file.buffer)
      .rotate()
      .resize({
        width: 1920,
        height: 1920,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();

    const baseName = path.basename(file.originalname, path.extname(file.originalname));
    const compressedName = `${baseName}.jpg`;

    if (!compressedBuffer || compressedBuffer.length === 0) {
      return file;
    }

    return {
      ...file,
      buffer: compressedBuffer,
      size: compressedBuffer.length,
      mimetype: "image/jpeg",
      originalname: compressedName,
    };
  } catch (error) {
    console.warn("Image compression failed, using original file:", error);
    return file;
  }
};

const compressVideoFile = async (
  file: Express.Multer.File,
): Promise<Express.Multer.File> => {
  if (!ffmpegStatic) {
    return file;
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "chat-video-"));
  const inputPath = path.join(tmpDir, `input-${randomUUID()}.mp4`);
  const outputPath = path.join(tmpDir, `output-${randomUUID()}.mp4`);

  try {
    await fs.writeFile(inputPath, file.buffer);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          "-c:v libx264",
          "-preset veryfast",
          "-crf 30",
          "-vf scale='min(1280,iw)':-2",
          "-movflags +faststart",
          "-c:a aac",
          "-b:a 96k",
        ])
        .save(outputPath)
        .on("end", () => resolve())
        .on("error", (err) => reject(err));
    });

    const outputBuffer = await fs.readFile(outputPath);
    const baseName = path.basename(file.originalname, path.extname(file.originalname));

    if (!outputBuffer || outputBuffer.length === 0 || outputBuffer.length >= file.buffer.length) {
      return file;
    }

    return {
      ...file,
      buffer: outputBuffer,
      size: outputBuffer.length,
      mimetype: "video/mp4",
      originalname: `${baseName}.mp4`,
    };
  } catch (error) {
    console.warn("Video compression failed, using original file:", error);
    return file;
  } finally {
    await Promise.allSettled([
      fs.unlink(inputPath),
      fs.unlink(outputPath),
    ]);
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
};

const prepareMediaForUpload = async (
  file: Express.Multer.File,
): Promise<Express.Multer.File> => {
  if (!file.buffer || file.buffer.length === 0) {
    throw new Error("The selected file is empty.");
  }

  if (file.mimetype.startsWith("image/")) {
    return compressImageFile(file);
  }

  if (file.mimetype.startsWith("video/")) {
    return compressVideoFile(file);
  }

  return file;
};

// ✅ Unchanged: DigitalOcean Upload
const uploadToDigitalOcean = async (file: Express.Multer.File) => {
  if (!file) {
    throw new Error("File is required for uploading.");
  }

  if (!hasDigitalOceanConfig) {
    throw new Error("DigitalOcean Spaces is not configured.");
  }

  try {
    const fileExtension = file.originalname.split('.').pop() || '';
    const Key = `nathancloud/${Date.now()}_${randomUUID()}${fileExtension ? '.' + fileExtension : ''}`;
    const uploadParams = {
      Bucket: process.env.DO_SPACE_BUCKET || "",
      Key,
      Body: file.buffer, // ✅ Use buffer instead of file path
      ACL: "public-read" as ObjectCannedACL,
      ContentType: file.mimetype,
    };

    // Upload file to DigitalOcean Spaces
    await s3Client.send(new PutObjectCommand(uploadParams));

    // Format the URL
    const fileURL = `${process.env.DO_SPACE_ENDPOINT}/${process.env.DO_SPACE_BUCKET}/${Key}`;
    return {
      Location: fileURL,
      Bucket: process.env.DO_SPACE_BUCKET || "",
      Key,
    };
  } catch (error) {
    console.error("Error uploading file to DigitalOcean:", error);
    throw error;
  }
};

const uploadMedia = async (
  file: Express.Multer.File,
): Promise<{ Location: string; public_id?: string; Bucket?: string; Key?: string }> => {
  if (hasCloudinaryConfig) {
    return uploadToCloudinary(file);
  }

  if (hasDigitalOceanConfig) {
    return uploadToDigitalOcean(file);
  }

  throw new Error(
    "No file storage provider configured. Set Cloudinary or DigitalOcean environment variables.",
  );
};

// ✅ No Name Changes, Just Fixes
export const fileUploader = {
  upload,
  uploadSingle,
  uploadMultipleImage,
  updateProfile,
  uploadFile,
  cloudinaryUpload,
  uploadToDigitalOcean,
  uploadToCloudinary,
  uploadMedia,
  prepareMediaForUpload,
};
