function sendErrorResponse(res, statusCode, errorMessage) {
  res.status(statusCode).json({
    status: "error",
    error: errorMessage,
  });
}

function getRandomItemByChance(items) {
  const totalChance = items.reduce((sum, item) => sum + item.Chance, 0);
  const randomValue = Math.random() * totalChance;

  let cumulativeChance = 0;
  for (const item of items) {
    cumulativeChance += item.Chance;
    if (randomValue <= cumulativeChance) {
      return item;
    }
  }

  return null;
}

module.exports = {
  path: "",
  method: "POST",
  Auth: true,
  run: async (req, res, mongo_client) => {
    try {
      let { min, max, userid } = req.query;

      if (!min || !max || isNaN(min) || isNaN(max) || isNaN(userid)) {
        sendErrorResponse(res, 400, "Invalid or missing queries");
        return;
      }

      min = parseInt(min);
      max = parseInt(max);
      userid = parseInt(userid);

      const collection = mongo_client.db("TradingParadise").collection("Items");
      const array = await collection
        .find({ Value: { $gte: min, $lte: max } }, { projection: { _id: 0 } })
        .toArray();

      if (array.length === 0) {
        sendErrorResponse(res, 400, "No items found within range");
        return;
      }

      const totalValue = array.reduce((acc, element) => acc + element.Value, 0);
      const chances = array.map((element) => ({
        ItemId: element.ItemId,
        Chance: (element.Value / totalValue) * 100,
      }));

      const randomItem = getRandomItemByChance(chances);
      const item_id = randomItem.ItemId;

      const timestamp = Date.now();
      await collection.updateOne(
        { ItemId: item_id },
        {
          $push: {
            "Data.Copies": { u: userid, t: timestamp, h: [] },
          },
        }
      );

      const updatedDocument = await collection.findOne({ ItemId: item_id });
      const index = updatedDocument.Data.Copies.findIndex(
        (copy) => copy.u === userid && copy.t === timestamp
      );

      res.status(200).json({
        status: "success",
        data: {
          item_id: item_id,
          index: index,
        },
      });
    } catch (error) {
      console.error(error);
      sendErrorResponse(res, 500, "Internal server error");
    }
  },
};
