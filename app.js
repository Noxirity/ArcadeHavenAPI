require("dotenv").config();
const cluster = require("cluster");
const numCPUs = require("os").cpus().length;
const express = require("express");
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);
  Array.from({ length: numCPUs }).forEach(() => cluster.fork());

  cluster.on("exit", (worker, code, signal) => {
    console.log(`[PID ${worker.process.pid}] died. Restarting...`);
    cluster.fork();
  });

  process.on("SIGINT", () => {
    console.log(`\n[MASTER] Killing all workers...`);
    Object.values(cluster.workers).forEach((worker) => {
      worker.process.kill("SIGINT");
    });
    console.log("[MASTER] All workers killed.");
    process.exit();
  });
} else {
  const app = express();
  const port = process.env.PORT || 3001;
  const connectionString = process.env.MONGO_URI;
  const client = new MongoClient(connectionString);
  const authKey = process.env.AUTH_KEY;

  app.use(express.json());

  client.connect((err) => {
    if (err) {
      console.error("Failed to connect to MongoDB", err);
      process.exit(1);
    }
    console.log("Connected to MongoDB");
  });

  const beginListening = (dir) => {
    fs.readdir(dir, (err, files) => {
      if (err) {
        console.error("Failed to read directory", err);
        return;
      }

      files.forEach((file) => {
        const filePath = path.join(dir, file);
        fs.stat(filePath, (error, stats) => {
          if (error) {
            console.error("Failed to get file stats", error);
            return;
          }

          if (stats.isDirectory()) {
            beginListening(filePath);
          } else if (stats.isFile()) {
            const endpoint = require(filePath);
            app[endpoint.method.toLowerCase()](
              endpoint.path,
              async (req, res) => {
                if (endpoint.authRequired && req.headers.authorization !== authKey) {
                  res.status(401).json({ status: "error", error: "Unauthorized" });
                  return;
                }

                try {
                  await endpoint.run(req, res, client);
                } catch (handlerError) {
                  console.error("Endpoint handler error", handlerError);
                  res.status(500).json({ status: "error", error: "Internal Server Error" });
                }
              }
            );
          }
        });
      });
    });
  };

  beginListening(path.join(__dirname, "endpoints"));

  app.listen(port, () => {
    console.log(`[PID ${process.pid}] Listening on http://localhost:${port}/`);
  });
}
