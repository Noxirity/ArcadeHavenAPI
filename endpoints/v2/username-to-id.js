const { getIdFromUsername } = require("noblox.js");

module.exports = {
  path: "",
  method: "GET",
  Auth: false,
  run: async (req, res) => {
    try {
      const { username } = req.query;
      if (!username) {
        return res.status(400).json({ error: "Please provide a username." });
      }

      const id = await getIdFromUsername(username);

      if (!id) {
        return res.status(404).json({ error: "User not found." });
      }

      return res.status(200).json({ id: `${id}` });
    } catch {
      return res.status(500).json({ error: "An error occurred." });
    }
  },
};
