function sendErrorResponse(res, statusCode, errorMessage) {
  res.status(statusCode).json({
    status: "error",
    error: errorMessage,
  });
}

module.exports = {
  path: "",
  method: "GET",
  Auth: false,
  run: async (req, res, mongo_client) => {
    const { userid, item_string } = req.query;

    if (!userid || !item_string)
      return sendErrorResponse(res, 400, "Invalid or missing queries");

    let [item_id, serial] = item_string.split("-");
    if (!item_id || !serial)
      return sendErrorResponse(res, 400, "Invalid item string");
    item_id = parseInt(item_id);
    serial = parseInt(serial);

    const collection = mongo_client.db("TradingParadise").collection("Items");
    const item = await collection.findOne({ ItemId: item_id });
    if (!item) return sendErrorResponse(res, 400, "Invalid item");

    const copies = item.Data.Copies;
    const copy = copies[serial - 1];
    if (!copy) return sendErrorResponse(res, 400, "Invalid serial");

    const owner = copy.u;
    if (owner !== parseInt(userid))
      return sendErrorResponse(res, 400, "Invalid owner");

    const timestamp = Date.now();
    await collection.updateOne(
      { ItemId: item_id },
      {
        $set: {
          [`Data.Copies.${serial - 1}.h`]: [],
          [`Data.Copies.${serial - 1}.u`]: "DELETED",
        },
      }
    );

    return res.status(200).json({
      status: "success",
      data: Math.floor(item.Value * 0.6),
    });
  },
};
