let Processing = {};

module.exports = {
  path: "",
  method: "POST",
  Auth: true,
  run: async (req, res, mongo_client) => {
    try {
      const collection = mongo_client.db("ArcadeHaven").collection("items");
      const filter = req.body.filter;
      const update = req.body.update;

      if (!filter || !update) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            status: "error",
            message: `Missing \`update\` or \`filter\` from json body`,
          })
        );
        return;
      }

      try {
        // if (update["$inc"] && update["$inc"].quantitySold === 1) {
        //   const item_id = filter.itemId;
        //   const user_id = update["$push"].serials.u;
        //   console.log(`User_${user_id} bought Item_${item_id}!`)
        // }
      } catch (error) {
        console.log(error)
      }

      const start = Date.now();
      const result = await collection.findOneAndUpdate(filter, update, {
        returnDocument: "after",
      });
      const end = Date.now();
      if (result) {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            status: "success",
            message: "Update successful",
            data: result,
          })
        );
      } else {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        // await new Promise((r) => setTimeout(r, Math.floor(Math.random() * (15000 - 50000 + 1)) + 50000));
        res.end(
          JSON.stringify({
            status: "error",
            message: "No documents matched the filter",
          })
        );
      }
    } catch (error) {
      console.log(error);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          status: "error",
          message: `Internal Server Error`,
        })
      );
    }
  },
};
