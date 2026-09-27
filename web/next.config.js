/** @type {import('next').NextConfig} */
const nextConfig = {
  // core/agents ships TypeScript source (no build step), so Next needs to
  // run it through its own compiler rather than treating it as a
  // pre-built node_modules package.
  transpilePackages: ['@bob-simulator/agents'],
};

module.exports = nextConfig;
