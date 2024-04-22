const { getGamePassProductInfo } = require("noblox.js");

// Database operations
async function getRobuxMarket(mongo_client) {
  const database = await mongo_client.db("ArcadeHaven");
  return await database.collection("robux_market");
}

async function getItems(mongo_client) {
  const database = await mongo_client.db("ArcadeHaven");
  return await database.collection("items");
}

// Input validation
function validateInput(req) {
  const { user_id, item, gamepass_id } = req.body;
  if (!user_id || !item || !gamepass_id) {
    throw new Error("Invalid Input");
  }
}

const log = require("../../../../post-log");

module.exports = {
  path: "",
  method: "POST",
  Auth: false,
  run: async (req, res, mongo_client) => {
    try {
      validateInput(req);

      let { user_id, item, gamepass_id } = req.body;
      let [itemid, serial] = item;
      itemid = parseInt(itemid);
      serial = parseInt(serial) - 1;

      const robux_market = await getRobuxMarket(mongo_client);
      const items = await getItems(mongo_client);

      const listed_doc = await robux_market.findOne({ itemId: itemid, serial });
      if (listed_doc) {
        return res.status(400).json({
          status: "error",
          error: "Item already listed",
        });
      }

      // lets make sure they have less than 10 items listed at a time
      const listed_count = await robux_market.countDocuments({
        userId: user_id,
      });
      if (listed_count >= 10) {
        return res.status(400).json({
          status: "error",
          error: "You can only list 10 items at a time",
        });
      }

      const item_doc = await items.findOne(
        { itemId: itemid },
        { projection: { "serials.h": 0, history: 0, reselling: 0 } }
      );

      if (!item_doc) {
        console.log("item not found");
        return res.status(400).json({ status: "error", error: "Invalid Item" });
      }

      if (item_doc.tradeable !== true) {
        console.log("item not tradeable");
        return res.status(400).json({
          status: "error",
          error: "Item not tradeable",
        });
      }

      const serial_info = item_doc.serials[serial];
      if (!serial_info || serial_info.u !== user_id) {
        console.log("serial not found or invalid owner");
        return res.status(400).json({ status: "error", error: "Invalid Item" });
      }

      const gamepass_info = await getGamePassProductInfo(gamepass_id);
      if (gamepass_info.Creator.Id !== user_id) {
        console.log("invalid gamepass owner");
        return res.status(400).json({
          status: "error",
          error: "Invalid Owner",
        });
      }

      const insert_doc = {
        userId: user_id,
        itemId: itemid,
        serial,
        gamepassId: gamepass_id,
        price: gamepass_info.PriceInRobux,
      };

      await robux_market.insertOne(insert_doc);
      return res.json({
        status: "success",
        data: insert_doc,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        status: "error",
        error: error.message,
      });
    }
  },
};
