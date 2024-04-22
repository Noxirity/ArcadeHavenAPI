module.exports = {
  path: "",
  method: "GET",
  Auth: false,
  run: async (req, res, mongo_client) => {
    try {
      const database = await mongo_client.db("ArcadeHaven");
      const robux_market = await database.collection("robux_market");
      let document = await robux_market.findOne(
        { itemId: "analytics" },
        { projection: { _id: 0 } }
      );

      const result = await robux_market
        .aggregate([
          {
            $group: {
              _id: null,
              total_robux: { $sum: "$price" },
              total_documents: { $sum: 1 },
            },
          },
        ])
        .toArray();

      const total_robux = result[0]?.total_robux || 0;
      const total_documents = result[0]?.total_documents || 0;

      return res.status(200).json({
        total_robux: document.total_robux,
        total_sales: document.total_sales,
        total_listings: total_documents,
        total_robux_in_market: total_robux,
      });
    } catch (error) {
      return res.status(500).json({
        error: "Internal server error",
        message: error,
      });
    }
  },
};
