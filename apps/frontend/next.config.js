/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['antd', '@ant-design/icons', '@ant-design/charts', 'rc-util', 'rc-pagination', 'rc-picker'],
  output: 'standalone',
};
module.exports = nextConfig;
