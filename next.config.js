/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['api.weather.gov'],
  },
};

module.exports = nextConfig;
