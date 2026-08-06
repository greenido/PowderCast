const pkg = require('./package.json');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  env: {
    // Used to cache-bust public/resorts.json. It sits at a fixed URL that
    // static hosts cache aggressively, so without a version in the query a
    // browser can keep serving a payload from an older schema to new code.
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  images: {
    unoptimized: true,
    domains: ['api.weather.gov'],
  },
};

module.exports = nextConfig;
