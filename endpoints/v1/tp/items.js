module.exports = {
  path: "",
  method: "GET",
  run: async (req, res, mongo_client) => {
    try {
      const startMemory = process.memoryUsage().heapUsed;

      const collection = mongo_client
        .db("TradingParadise")
        .collection("Items");
      const cursor = collection.find({}, { projection: { _id: 0 } });

      res.write('{"status":"success","data":[');
      let isFirstItem = true;

      await cursor.forEach((item) => {
        if (!isFirstItem) {
          res.write(",");
        }
        res.write(JSON.stringify(item));
        isFirstItem = false;
      });

      const endMemory = process.memoryUsage().heapUsed;
      const memoryUsage = (endMemory - startMemory) / 1024; // convert to kilobytes

      console.log(`Memory usage: ${memoryUsage} KB`);

      res.write("]}");
      res.status(200).end();
    } catch (error) {
      console.error(error);
      res.status(500).json({
        status: "error",
        error: "Internal server error",
      });
    }
  },
};
