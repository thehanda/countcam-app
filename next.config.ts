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
  experimental: {
    allowedDevOrigins: [
      'https://6000-firebase-studio-1748576929604.cluster-ikxjzjhlifcwuroomfkjrx437g.cloudworkstations.dev',
      'https://9000-firebase-studio-1748576929604.cluster-ikxjzjhlifcwuroomfkjrx437g.cloudworkstations.dev',
      // You might see other ports or subdomains in the future.
      // If the random-looking parts of the domain change frequently,
      // a more generic pattern might be needed if Next.js supports it,
      // or you'll need to update this list.
    ],
  },
  // reactStrictMode: false, // Intentionally commented out or removed to allow default (true)
};

export default nextConfig;
