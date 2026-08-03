const CLOUD_NAME = () => process.env["CLOUDINARY_CLOUD_NAME"]!;
const API_KEY = () => process.env["CLOUDINARY_API_KEY"]!;
const API_SECRET = () => process.env["CLOUDINARY_API_SECRET"]!;

async function sha1(str: string): Promise<string> {
  const buffer = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(str)
  );
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function uploadToCloudinary(
  base64DataUrl: string,
  folder = "notteshe/products"
): Promise<{ url: string; publicId: string }> {
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = await sha1(paramsToSign + API_SECRET());

  const body = new FormData();
  body.append("file", base64DataUrl);
  body.append("timestamp", String(timestamp));
  body.append("api_key", API_KEY());
  body.append("signature", signature);
  body.append("folder", folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME()}/image/upload`,
    { method: "POST", body }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudinary upload failed: ${text}`);
  }

  const data = (await res.json()) as {
    secure_url: string;
    public_id: string;
  };
  return { url: data.secure_url, publicId: data.public_id };
}

export async function deleteFromCloudinary(publicId: string): Promise<void> {
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}`;
  const signature = await sha1(paramsToSign + API_SECRET());

  const body = new FormData();
  body.append("public_id", publicId);
  body.append("timestamp", String(timestamp));
  body.append("api_key", API_KEY());
  body.append("signature", signature);

  await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME()}/image/destroy`,
    { method: "POST", body }
  );
}
