import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev indicator would sit on top of the OSD timecode in screenshots.
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
      // `import source from "./file.ts?raw"`: the room's monitor shows the site's own code.
      "*.ts": {
        condition: { query: "?raw" },
        type: "raw",
      },
    },
  },
};

export default nextConfig;
