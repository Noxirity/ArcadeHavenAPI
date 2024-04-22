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
  method: "GET",
  Auth: false,
  run: async (req, res, mongo_client) => {
    try {
      let { userid } = req.query;
      userid = parseInt(userid);

      if (!userid || isNaN(userid)) {
        sendErrorResponse(res, 400, "Invalid or missing queries");
        return;
      }

      const collection = mongo_client.db("TradingParadise").collection("Items");
      const array = await collection.find({}).toArray();
      const inventory = [];

      array.forEach((item) => {
        const copies = item.Data.Copies;
        const owned_copies = [];
        let i = 0;
        copies.forEach((copy) => {
          i++;
          if (copy.u === userid) {
            owned_copies.push(i);
          }
        });

        if (owned_copies.length > 0) {
          inventory.push(`${item.ItemId}-${owned_copies.join("-")}`);
        }
      });

      res.status(200).json({
        status: "success",
        inventory,
      });
    } catch (error) {
      console.error(error);
      sendErrorResponse(res, 500, "Internal server error");
    }
  },
};
