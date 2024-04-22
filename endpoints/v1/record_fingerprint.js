module.exports = {
  path: "",
  method: "GET",
  Auth: false,
  run: async (req, res, mongo_client) => {
    return res.status(200).json({ message: "Hello World!" });
  },
};