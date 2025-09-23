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
  // Configuración para el build
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Evitar errores de Firebase Admin durante el build
      config.externals = config.externals || [];
      config.externals.push('firebase-admin');
    }
    return config;
  },
  // Excluir rutas API del build estático
  async rewrites() {
    return []
  },
  // Solo incluir páginas estáticas
  async generateStaticParams() {
    return []
  }
}

module.exports = nextConfig
