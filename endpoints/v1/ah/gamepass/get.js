module.exports = {
  path: "",
  method: "GET",
  Auth: false,
  run: async (req, res, mongo_client) => {
    try {
      const user_id = req.query.id;

      if (!user_id)
        return res.status(400).send({ error: "Missing parameters" });

      const db = mongo_client.db("ArcadeHaven");
      const collection = db.collection("gifted_gamepasses");
      const gamepasses =
        ((await collection.findOne({ user_id })) || {}).gamepasses || [];

      res.status(200).send({ success: true, gamepasses });
    } catch (error) {
      console.error(error);
      res.status(500).send({ error: "Internal server error" });
    }
  },
};
