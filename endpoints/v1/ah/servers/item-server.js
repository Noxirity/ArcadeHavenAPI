const axios = require("axios");

module.exports = {
  path: "",
  method: "GET",
  Auth: false,
  run: async (req, res, mongo_client) => {
    try {
      const db = mongo_client.db("ArcadeHaven");
      const col = db.collection("ServerCache");
      const doc = (await col.findOne({ id: 1 })) || { id: 1 };

      const lastFetch = doc.lastFetch || 0;
      const now = Date.now();
      const diff = now - lastFetch;
      // only fetch every 30 seconds
      if (diff < 30000) {
        return res.status(200).json({
          status: "success",
          servers: doc.servers,
          nextFetch: lastFetch + 30000,
        });
      } else {
        console.log("Fetching new servers");
        col.updateOne(
          { id: 1 },
          {
            $set: {
              lastFetch: now,
            },
          },
          { upsert: true }
        );
      }

      const response = await axios.get(
        "https://games.roblox.com/v1/games/15162498073/servers/0?sortOrder=2&excludeFullGames=true&limit=10"
      );

      const servers = response.data.data;
      col.updateOne(
        { id: 1 },
        {
          $set: {
            servers,
            lastFetch: now,
          },
        },
        { upsert: true }
      );

      res.status(200).json({
        status: "success",
        servers,
        nextFetch: now + 30000,
      });
    } catch (error) {
      return res.status(500).json({
        error: "Internal server error",
        message: error,
      });
    }
  },
};
