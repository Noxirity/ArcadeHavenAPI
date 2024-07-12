const crypto = require("crypto");

const BOT_WIN_CHANCE = 65; // Percentage chance for id2 to win if there are 4 hyphens

module.exports = {
  path: "",
  method: "GET",
  Auth: false,
  run: async (req, res, mongo_client) => {
    const check = req.query.check;
    if (check) {
      const decimal = parseInt(check.slice(-1), 16);
      const result = (decimal % 2) + 1;

      res.status(200).json({
        status: "success",
        result: result,
      });
      return;
    }

    const id1 = req.query.a || "0";
    const id2 = req.query.b || "0";
    const random_secret = crypto.randomBytes(16).toString("hex");
    const string = `${id1}|${id2}|${random_secret}`;
    const hash = crypto.createHash("sha256").update(string).digest("hex");
    const decimal = parseInt(hash.slice(-1), 16);
    let rigged = false;

    let result;
    if ((id2.match(/-/g) || []).length === 4) {
      rigged = true;
      const rigged_random = Math.floor(Math.random() * 100);
      if (rigged_random < BOT_WIN_CHANCE) {
        result = 2;
      } else {
        result = 1;
      }
    } else {
      result = (decimal % 2) + 1;
    }

    res.status(200).json({
      status: "success",
      server_seed: random_secret,
      client_seed: `${id1}|${id2}`,
      hash: hash,
      result: result,
      r: rigged,
    });
  },
};
