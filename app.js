require("dotenv").config();

const cluster = require("cluster");
const numCPUs = require("os").cpus().length;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });

  process.on("SIGINT", () => {
    console.log("\nReceived SIGINT. Shutting down gracefully...");

    for (const id in cluster.workers) {
      cluster.workers[id].process.kill("SIGINT");
      console.log(`Killed worker ${id}`);
    }
    process.exit(0);
  });

} else {
  const express = require("express");
  const fs = require("fs").promises;
  const path = require("path");
  const mongodb = require("mongodb");
  const app = express();
  const port = 3030;

  const connection_string = process.env.MONGO_URI;
  const client = new mongodb.MongoClient(connection_string, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  const auth_key = process.env.API_AUTH;

  app.use(require("cors")());
  app.use(express.json());

  async function begin_listening(dir) {
    try {
      const files = await fs.readdir(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = await fs.stat(filePath);

        if (stats.isDirectory()) {
          await begin_listening(filePath);
        } else if (stats.isFile()) {
          const endpoint = require(filePath);
          const relativePath = path
            .relative(path.join(__dirname, "endpoints"), filePath)
            .replace(/\.[^/.]+$/, "");
          app[endpoint.method.toLowerCase()](
            `/${relativePath}/${endpoint.path}`,
            async (req, res) => {
              if (endpoint.Auth) {
                const token = req.headers.authorization || "";
                if (token !== auth_key) {
                  res.status(401).json({
                    status: "error",
                    error: "Unauthorized",
                  });
                  return;
                }
              }

              const ip =
                req.headers["x-forwarded-for"] || req.connection.remoteAddress;
              const is_roblox_server =
                req.headers["user-agent"] == "Roblox/Linux";

              if (is_roblox_server) {
                try {
                  const collection = client
                    .db("ArcadeHaven")
                    .collection("roblox_requests");
                  await collection.updateOne(
                    { ip },
                    { $inc: { requests: 1 } },
                    { upsert: true }
                  );
                } catch (err) {
                  console.error("Error updating Roblox requests:", err);
                }
              }

              try {
                await endpoint.run(req, res, client);
              } catch (err) {
                console.error("Error running endpoint:", err);
                res.status(500).json({
                  status: "error",
                  error: "Internal Server Error",
                });
              }
            }
          );
        }
      }
    } catch (err) {
      console.error(`Error reading directory ${dir}:`, err);
    }
  }

  app.get("/", (req, res) => {
    res.json({
      status: "ok",
    });
  });

  client.connect().then(async () => {
    console.log("Connected to MongoDB");
    await begin_listening(path.join(__dirname, "endpoints"));
    app.listen(port, () => {
      console.log(`Worker ${process.pid} is running on port ${port}`);
    });
  }).catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });
}
