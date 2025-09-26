/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removed output: 'export' for Capacitor builds to allow API routes
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
  },
  // Configuración para APIs en mobile
  async headers() {
    return [
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
    ];
  }
}

module.exports = nextConfig
