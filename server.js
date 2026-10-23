// Hostland Passenger starts this file from the application's root directory.
// Environment variables set in the hosting panel take precedence over the file.
// Keep this bootstrap compatible with both Passenger's require() and node ESM.
import("node:fs")
  .then(({ existsSync }) => {
    if (existsSync(".env.server")) process.loadEnvFile(".env.server");
    return import("./build/server/start.js");
  })
  .then(({ startServer }) => startServer())
  .catch((error) => {
    console.error("Unable to start Hamper", error);
    process.exitCode = 1;
  });
