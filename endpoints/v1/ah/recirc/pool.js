module.exports = {
  path: "",
  method: "GET",
  Auth: false,
  run: async (req, res, mongo_client) => {
    const items = require("../../../../data/recircpool.json");
    res.status(200).json(items);
  },
};
