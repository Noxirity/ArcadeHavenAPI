// Input validation
function validateInput(req) {
  const { user_id, item } = req.body;
  if (!user_id || !item) {
    throw new Error("Invalid Input");
  }
}

const log = require("../../../../post-log");

module.exports = {
  path: "",
  method: "DELETE",
  Auth: false,
  run: async (req, res, mongo_client) => {
   try {
      console.log(req.body);
      validateInput(req);

      let { user_id, item } = req.body;
      let [itemid, serial] = item;
      itemid = parseInt(itemid);
      serial = parseInt(serial) - 1;

      const robux_market = await mongo_client
        .db("ArcadeHaven")
        .collection("robux_market");

      const listed_doc = await robux_market.findOne({
        userId: user_id,
        itemId: itemid,
        serial,
      });
      if (!listed_doc) {
        console.log("item not listed");
        return res.status(400).json({
          status: "error",
          error: "Item not listed",
        });
      }

      if (listed_doc._PROCESSING) {
        console.log("item is processing");
        return res.status(400).json({
          status: "error",
          error: "Item is processing",
        });
      }
      await robux_market.deleteOne({ userId: user_id, itemId: itemid, serial });
      return res.json({
        status: "success",
        message: "Item unlisted successfully",
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
