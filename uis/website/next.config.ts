import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La web pública es 100% estática (no hay SSR, route handlers ni datos en
  // request). Exportamos a `out/` para servirla como estático en Netlify sin
  // runtime de Next.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
