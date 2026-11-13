const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * resorts.json is fetched as ?v=<hash of its contents>. A package version
 * missed every data-only change (the webcam fixes shipped without a bump), and
 * covering for that with `cache: 'no-cache'` cost a revalidation round trip in
 * front of every forecast. With the content in the URL a changed file always
 * gets a new URL, so the browser may cache it normally.
 */
const resortsHash = crypto
  .createHash('sha256')
  .update(fs.readFileSync(path.join(__dirname, 'public', 'resorts.json')))
  .digest('hex')
  .slice(0, 12);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  env: {
    NEXT_PUBLIC_RESORTS_HASH: resortsHash,
  },
  images: {
    unoptimized: true,
    domains: ['api.weather.gov'],
  },
};

module.exports = nextConfig;
