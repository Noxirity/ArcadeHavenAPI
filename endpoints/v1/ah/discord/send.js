const axios = require("axios");

const discordBotUrl = "http://localhost:3003";

const isServerUp = async () => {
  try {
    await axios.get(discordBotUrl);
    return true;
  } catch (error) {
    return false;
  }
};

const sendToDiscordBot = async (data) => {
  try {
    await axios.post(discordBotUrl, data);
    return true;
  } catch (error) {
    throw error; // Rethrow the error for better handling in the caller function
  }
};

module.exports = {
  path: "",
  method: "POST",
  Auth: true,
  run: async (req, res, mongo_client) => {
    if (!(await isServerUp())) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          status: "error",
          message: "Discord bot server is not running.",
        })
      );
      return;
    }

    try {
      await sendToDiscordBot(req.body);

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          status: "success",
        })
      );
    } catch (error) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          status: "error",
          message: `${error}`,
        })
      );
    }
  },
};
