module.exports = {
  path: "",
  method: "GET",
  Auth: false,
  run: async (req, res, mongo_client) => {
    try {
      let userid = req.query.id;
      if (isNaN(Number(userid))) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            status: "error",
            message: `Invalid User ID`,
          })
        );
        return;
      }
      
      let docs = await mongo_client
        .db("ArcadeHaven")
        .collection("items")
        .find(
          { "serials.u": parseInt(userid) },
          { projection: { "serials.u": 1, "serials._id": 1, itemId: 1 } }
        )
        .toArray();

      let newInventory = {};
      const processItems = async () => {
        docs.forEach((item) => {
          const userSerials = item.serials
            .map((serial_info, index) =>
              serial_info && serial_info.u === parseInt(userid)
                ? (index + 1).toString()
                : null
            )
            .filter((serial) => serial !== null);

          if (userSerials.length > 0) {
            newInventory[item.itemId] = newInventory[item.itemId] || [];
            newInventory[item.itemId].push(...userSerials);
          }
        });
      };

      await processItems();

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({
          status: "success",
          data: newInventory,
        })
      );
    } catch (error) {
      console.error(error);
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
