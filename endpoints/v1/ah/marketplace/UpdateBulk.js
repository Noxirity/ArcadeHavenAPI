module.exports = {
  path: "",
  method: "POST",
  Auth: true,
  run: async (req, res, mongo_client) => {
    try {
      const collection = mongo_client.db("ArcadeHaven").collection("items");
      const bulkOps = [];

      const updates = req.body.updates;

      if (!updates || !Array.isArray(updates)) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            status: "error",
            message: "Missing or invalid `updates` array in the request body",
          })
        );
        return;
      }

      updates.forEach((updateObj) => {
        const filter = updateObj.filter;
        const update = updateObj.update;

        if (!filter || !update) {
          return;
        }

        bulkOps.push({
          updateOne: {
            filter,
            update,
            upsert: false,
          },
        });
      });

      if (bulkOps.length === 0) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            status: "error",
            message: "No valid updates found in the request",
          })
        );
        return;
      }

      const result = await collection.bulkWrite(bulkOps, { ordered: false });

      const updatedDocumentsCount = result.modifiedCount;
      const upsertedDocumentsCount = result.upsertedCount;

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          status: "success",
          message: "Bulk update successful",
          updatedDocumentsCount,
          upsertedDocumentsCount,
        })
      );
    } catch (error) {
      console.log(error);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          status: "error",
          message: "Internal Server Error",
        })
      );
    }
  },
};
