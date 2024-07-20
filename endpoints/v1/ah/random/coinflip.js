const crypto = require("crypto");

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

    const settings_db = mongo_client.db("ArcadeHaven");
    const settings_col = settings_db.collection("game_settings");
    const settings = await settings_col.findOne({ tag: "private_settings" });
    const bot_win_chance = settings.bot_win_chance || 50;
    const id1 = req.query.a || "0";
    const id2 = req.query.b || "0";
    const is_bot = id2.split("-").length === 5;

    const random_secret = crypto.randomBytes(16).toString("hex");
    const string = `${id1}|${id2}|${random_secret}`;
    const hash = crypto.createHash("sha256").update(string).digest("hex");
    const decimal = parseInt(hash.slice(-1), 16);
    let result = (decimal % 2) + 1;

    RegisterBotStat(is_bot && result === 2, mongo_client);

    res.status(200).json({
      status: "success",
      server_seed: random_secret,
      client_seed: `${id1}|${id2}`,
      hash: hash,
      result: result,
    });
  },
};

async function RegisterBotStat(won, mongo_client) {
  const database = mongo_client.db("ArcadeHaven");
  const collection = database.collection("user_analytics");
  if (won) {
    collection.updateOne({ userId: 2 }, { $inc: { coinflips_won: 1 } });
  } else {
    collection.updateOne({ userId: 2 }, { $inc: { coinflips_lost: 1 } });
  }
}
