import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La hoja Tailwind pequeña bloqueaba el primer render en la traza de auditoría.
  // Solo producción: evita ese viaje de red; el coste es repetir CSS en el HTML.
  experimental: {
    inlineCss: true,
  },
};

export default nextConfig;
