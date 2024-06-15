const axios = require("axios");

module.exports = {
    path: "",
    method: "POST",
    Auth: true,
    run: async (req, res, mongo_client) => {
        const body = req.body;
        const { logs, server_id } = body;

        logs.forEach(async (log) => {
            log.server_id = server_id;

            if (log.context === undefined) {
                log.context = "QuickSell";
            }

            const db = mongo_client.db("ArcadeHaven");
            const collection = db.collection("cash_logs");
            await collection.insertOne(log);
        })

        res.status(200).send({ status: "success" });
    },
};
