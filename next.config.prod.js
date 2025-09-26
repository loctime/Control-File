/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removed output: 'export' to allow API routes to work
  trailingSlash: true,
  distDir: 'out',
  images: {
    domains: ['s3.us-west-004.backblazeb2.com'],
    unoptimized: true
  },
  // Configuración para evitar errores durante el build
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin']
  },
  // Configuración para el build
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Evitar errores de Firebase Admin durante el build
      config.externals = config.externals || [];
      config.externals.push('firebase-admin');
    }
    return config;
  }
}

module.exports = nextConfig
