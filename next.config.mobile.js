/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
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
  // Manejar errores de build de manera más suave
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
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
  // Evitar pre-renderizado de APIs durante el build
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
  },
}

module.exports = nextConfig
