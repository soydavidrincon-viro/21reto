import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Las fotos de perfil viven en el bucket público de Supabase.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
