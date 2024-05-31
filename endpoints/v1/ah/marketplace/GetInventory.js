module.exports = {
  path: "",
  method: "GET",
  Auth: false,
  run: async (req, res, mongoClient) => {
    const sendResponse = (statusCode, content) => {
      res.status(statusCode).json(content);
    };

    try {
      const { id: userId } = req.query;
      if (isNaN(Number(userId))) {
        return sendResponse(400, {
          status: "error",
          message: "Invalid User ID",
        });
      }

      const database = mongoClient.db("ArcadeHaven");
      const items = await getItems(database, userId);
      const gamepasses = await getGamePasses(database, userId);

      sendResponse(200, {
        success: true,
        data: formatInventory(items, userId),
        gamepasses,
      });
    } catch (error) {
      console.error(error);
      sendResponse(500, { status: "error", message: "Internal Server Error" });
    }
  },
};

async function getItems(database, userId) {
  const collection = database.collection("items");
  return collection
    .find(
      { "serials.u": parseInt(userId) },
      { projection: { "serials.u": 1, "serials._id": 1, itemId: 1 } }
    )
    .toArray();
}

async function getGamePasses(database, userId) {
  const collection = database.collection("gifted_gamepasses");
  const doc = (await collection.findOne({ user_id: userId })) || {};
  return doc.gamepasses || [];
}

function formatInventory(items, userId) {
  const inventory = {};
  items.forEach((item) => {
    const userSerials = item.serials
      .map((serial, index) =>
        serial && serial.u === parseInt(userId) ? String(index + 1) : null
      )
      .filter((serial) => serial !== null);

    if (userSerials.length > 0) {
      inventory[item.itemId] = inventory[item.itemId] || [];
      inventory[item.itemId].push(...userSerials);
    }
  });
  return inventory;
}
