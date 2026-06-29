import type { NextConfig } from "next";

function validateProductionApiUrl() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const configuredUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!configuredUrl) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL must be set before creating a production build.",
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(configuredUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_API_BASE_URL must be a valid absolute URL.");
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error("Production NEXT_PUBLIC_API_BASE_URL must use HTTPS.");
  }
}

validateProductionApiUrl();

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
