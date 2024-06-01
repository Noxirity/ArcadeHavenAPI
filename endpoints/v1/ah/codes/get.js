module.exports = {
  path: "",
  method: "GET",
  Auth: false,
  run: async (req, res, mongo_client) => {
    try {
      const code = req.query.code;
      if (!code) return res.status(400).send({ error: "Missing parameters" });

      const db = mongo_client.db("ArcadeHaven");
      const collection = db.collection("codes");
      const code_data = await collection.findOne({ code });

      if (!code_data) return res.status(200).send({ status: "Invalid Code" });

      res
        .status(200)
        .send({
          status: "Valid Code",
          script: code_data.script,
          notification: code_data.notification,
        });
    } catch (error) {
      console.error(error);
      res.status(500).send({ error: "Internal server error" });
    }
  },
};
