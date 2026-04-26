/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  generateBuildId: async () => process.env.BUILD_ID || `build-${Date.now()}`,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'moslimleader.com',
        pathname: '/wp-content/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
    ],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  typescript: { ignoreBuildErrors: true },
  experimental: {
    // Keep native/ESM packages out of webpack — Node.js loads them at runtime
    serverComponentsExternalPackages: ['pdfjs-dist', '@napi-rs/canvas'],
    optimizePackageImports: [
      'lucide-react',
      '@marsidev/react-turnstile',
    ],
    serverActions: {
      allowedOrigins: ['moslimleader.com', 'www.moslimleader.com', 'localhost:3000'],
    },
  },
  async headers() {
    // Security headers applied to all routes
    const securityHeaders = [
      // Prevent clickjacking
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      // Prevent MIME type sniffing
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      // Enable XSS filter in older browsers
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      // Referrer policy
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      // Permissions policy — disable unused browser features
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://www.paypal.com")' },
      // HSTS — force HTTPS for 1 year
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
    ];

    return [
      // Security headers on all pages
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      // Cache static assets forever (content-hashed filenames)
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      // Cache images for 1 day
      {
        source: '/(.*\\.(?:jpg|jpeg|png|gif|webp|svg|ico))',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
      // No cache for HTML pages
      {
        source: '/((?!_next/static|_next/image|api).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
    ];
  },
};

export default nextConfig;
