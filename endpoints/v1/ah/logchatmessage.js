const axios = require("axios");

module.exports = {
  path: "",
  method: "POST",
  Auth: true,
  run: async (req, res, mongo_client) => {
    const body = req.body;
    const { messages, server_id } = body;

    const logs = messages.map((log) => ({ ...log, server_id }));
    const db = mongo_client.db("ArcadeHaven");
    const collection = db.collection("chat_logs");

    try {
      await collection.insertMany(logs);
      res.status(200).send({ status: "success" });
    } catch (error) {
      console.error("Error inserting logs:", error);
      res
        .status(500)
        .send({ status: "error", message: "Failed to insert logs" });
    }
  },
};
