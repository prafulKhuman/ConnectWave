
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
  devIndicators: {
    allowedDevOrigins: [
      'https://6000-firebase-studio-1753445839615.cluster-iktsryn7xnhpexlu6255bftka4.cloudworkstations.dev',
    ],
  },
   webpack: (config, { isServer }) => {
    // Exclude bcrypt from client-side bundle
    config.externals.push('bcrypt');
    return config;
  },
};

export default nextConfig;
