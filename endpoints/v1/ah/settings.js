const axios = require("axios");

module.exports = {
    path: "",
    method: "GET",
    Auth: false,
    run: async (req, res, mongo_client) => {
        const db = mongo_client.db("ArcadeHaven");
        const game_settings = db.collection("game_settings");
        const settings = await game_settings.findOne({}, { projection: { _id: 0 } });
        if (settings) {
            res.status(200).send({ status: "success", data: settings });
        } else {
            res.status(404).send({ status: "error", message: "No settings found" });
        }
    },
};
