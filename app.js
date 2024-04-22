const cluster = require("cluster");
const numCPUs = require("os").cpus().length;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
  });

  process.on("SIGINT", () => {
    isShuttingDown = true;
    console.log("\nReceived SIGINT. Shutting down gracefully...");

    const url = `https://discord.com/api/webhooks/1232016132211343492/y3VQj_WWsQrDX0bG34JjNeg0KrDuBaHQgfICMPb7QYN7-lilgMS3jDMRGWLBzv48P8vF`;
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: null,
        embeds: [
          {
            title: "Arcade Haven is DOWN.",
            description:
              "You will be unable to join Arcade Haven at this time.",
            color: 16711680,
          },
        ],
        attachments: [],
      }),
    });

    for (const id in cluster.workers) {
      cluster.workers[id].process.kill("SIGINT");
      console.log(`Killed worker ${id}`);
    }
  });

  const url = `https://discord.com/api/webhooks/1232016132211343492/y3VQj_WWsQrDX0bG34JjNeg0KrDuBaHQgfICMPb7QYN7-lilgMS3jDMRGWLBzv48P8vF`;
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: null,
      embeds: [
        {
          title: "Arcade Haven is back up.",
          description:
            "Arcade Haven is responding again and you should be able to join the game as normal.",
          color: 8781568,
        },
      ],
      attachments: [],
    }),
  });
} else {
  const express = require("express");
  const fs = require("fs");
  const path = require("path");
  const mongodb = require("mongodb");
  const app = express();
  const port = 3030;

  const connection_string =
    "mongodb://admin:lJX1yIbq22zYs83WVCCXV4UrF@173.212.199.199:27017/";
  const client = new mongodb.MongoClient(connection_string);
  const auth_key = "0cd511e5-f109-4816-a5c8-37d3bee6acd3";

  app.use(require("cors")());
  app.use(express.json());

  function begin_listening(dir) {
    fs.readdir(dir, (err, files) => {
      if (err) {
        return;
      }

      files.forEach((file) => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
          begin_listening(filePath);
        } else if (stats.isFile()) {
          const endpoint = require(filePath);
          const relativePath = path
            .relative(path.join(__dirname, "endpoints"), filePath)
            .split(".")
            .slice(0, -1)
            .join(".");
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
                const collection = client
                  .db("ArcadeHaven")
                  .collection("roblox_requests");
                collection.updateOne(
                  { ip },
                  { $inc: { requests: 1 } },
                  { upsert: true }
                );
              }

              await endpoint.run(req, res, client);
            }
          );
        }
      });
    });
  }

  begin_listening(path.join(__dirname, "endpoints"));
  app.listen(port, () => {
    console.log(`Worker ${process.pid} is running on port ${port}`);
  });
}
