import { createServerFn } from "@tanstack/react-start";

export const uploadImageFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => data as { base64: string; folder?: string })
  .handler(async ({ data }) => {
    // Admin-only: without this, anyone can push arbitrary files to our Cloudinary account.
    const { requireAdmin } = await import("@/lib/admin/auth");
    await requireAdmin();
    const { uploadToCloudinary } = await import("./cloudinary.server");
    return uploadToCloudinary(data.base64, data.folder);
  });

export const deleteImageFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => data as { publicId: string })
  .handler(async ({ data }) => {
    // Admin-only: without this, anyone can delete any image by its public ID.
    const { requireAdmin } = await import("@/lib/admin/auth");
    await requireAdmin();
    const { deleteFromCloudinary } = await import("./cloudinary.server");
    await deleteFromCloudinary(data.publicId);
    return { success: true };
  });
