// Keep this bootstrap compatible with both Passenger's require() and node ESM.
import("./build/server/start.js")
  .then(({ startServer }) => startServer())
  .catch((error) => {
    console.error("Unable to start Hamper", error);
    // Passenger keeps stdin open, so exitCode alone leaves a failed worker alive.
    process.exit(1);
  });
