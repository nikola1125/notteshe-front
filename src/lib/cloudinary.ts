import { createServerFn } from "@tanstack/react-start";

export const uploadImageFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => data as { base64: string; folder?: string })
  .handler(async ({ data }) => {
    const { uploadToCloudinary } = await import("./cloudinary.server");
    return uploadToCloudinary(data.base64, data.folder);
  });

export const deleteImageFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => data as { publicId: string })
  .handler(async ({ data }) => {
    const { deleteFromCloudinary } = await import("./cloudinary.server");
    await deleteFromCloudinary(data.publicId);
    return { success: true };
  });
