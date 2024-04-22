module.exports = {
  path: "",
  method: "GET",
  Auth: false,
  run: async (req, res, mongo_client) => {
    try {
      let UserIds = req.query.ids;

      if (!UserIds) {
        return res.status(400).json({
          status: "error",
          message: "Invalid User IDs",
        });
      }

      let userIdArray = UserIds.split("-").map(Number);

      if (userIdArray.some(isNaN)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid User IDs",
        });
      }

      let db = mongo_client.db("ArcadeHaven");
      let itemsCollection = db.collection("items");
      let data = {};
      let docs = await itemsCollection
        .find(
          { "serials.u": { $in: userIdArray.map(Number) } },
          {
            projection: { "serials.u": 1, "serials._id": 1, itemId: 1 },
          }
        )
        .toArray();

      docs.forEach((item) => {
        item.serials.forEach((serial_info, serial) => {
          if (serial_info && userIdArray.includes(serial_info.u)) {
            const user_id = serial_info.u;
            if (!data[user_id]) {
              data[user_id] = [];
            }
            data[user_id].push(`${item.itemId}-${serial + 1}`);
          }
        });
      });

      docs = null;
      itemsCollection = null;
      db = null;
      UserIds = null;
      userIdArray = null;

      res.status(200).json({
        status: "success",
        data,
      });

      data = null;
      return;
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        status: "error",
        message: "Internal Server Error",
      });
    }
  },
};
