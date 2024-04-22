module.exports = {
  path: "",
  method: "GET",
  Auth: false,
  run: async (req, res, mongo_client) => {
    // return all robux market items
    const database = await mongo_client.db("ArcadeHaven");
    const robux_market = await database.collection("robux_market");
    const documents = await robux_market
      .find({}, { projection: { _id: 0 } })
      .toArray();

    // remove the document with the itemId of "analytics"
    documents.forEach((document, index) => {
      if (document.itemId === "analytics") {
        documents.splice(index, 1);
      }
    });

    // add 1 to each serial number
    documents.forEach((document) => {
      document.serial += 1;
    });

    res.status(200).json({ status: "success", data: documents });
  },
};
