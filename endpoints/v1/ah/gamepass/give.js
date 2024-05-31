module.exports = {
  path: "",
  method: "POST",
  Auth: true,
  run: async (req, res, mongo_client) => {
    try {
      const user_id = req.query.id;
      const name = req.query.name;

      if (!user_id || !name)
        return res.status(400).send({ error: "Missing parameters" });

      const db = mongo_client.db("ArcadeHaven");
      const collection = db.collection("gifted_gamepasses");
      await collection.updateOne(
        { user_id },
        { $push: { gamepasses: name } },
        { upsert: true }
      );

      res.status(200).send({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).send({ error: "Internal server error" });
    }
  },
};
