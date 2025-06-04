
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
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
    ],
  },
  allowedDevOrigins: [
    'https://6000-firebase-studio-1748576929604.cluster-ikxjzjhlifcwuroomfkjrx437g.cloudworkstations.dev',
    'http://6000-firebase-studio-1748576929604.cluster-ikxjzjhlifcwuroomfkjrx437g.cloudworkstations.dev',
    'https://9000-firebase-studio-1748576929604.cluster-ikxjzjhlifcwuroomfkjrx437g.cloudworkstations.dev',
    'http://9000-firebase-studio-1748576929604.cluster-ikxjzjhlifcwuroomfkjrx437g.cloudworkstations.dev',
  ],
  // reactStrictMode: false, // Intentionally commented out or removed to allow default (true)
};

export default nextConfig;
