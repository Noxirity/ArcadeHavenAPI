module.exports = {
  path: "",
  method: "GET",
  Auth: true,
  run: async (req, res, mongo_client) => {
    try {
      const { code } = req.query;
      if (!code) {
        return sendResponse(res, 400, { error: "Missing parameters" });
      }

      const collection = mongo_client.db("ArcadeHaven").collection("codes");
      const code_data = await collection.findOne({ code });
      if (!code_data) {
        return sendResponse(res, 200, { status: "Invalid Code" });
      }

      const { max_uses, expiration, uses } = code_data;
      if (
        (max_uses !== 0 && uses >= max_uses) ||
        (expiration !== 0 && expiration < Date.now())
      ) {
        return sendResponse(res, 200, { status: "Code Expired" });
      }

      sendResponse(res, 200, {
        status: "Valid Code",
        script: code_data.script,
        notification: code_data.notification,
      });
    } catch (error) {
      console.error("Error accessing the database: ", error);
      sendResponse(res, 500, { error: "Internal server error" });
    }
  },
};

function sendResponse(res, status, content) {
  res.status(status).send(content);
}
