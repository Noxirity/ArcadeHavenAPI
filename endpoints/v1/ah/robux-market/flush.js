module.exports = {
  path: "",
  method: "GET",
  Auth: false,
  run: async (req, res, mongo_client) => {
    const Redis = require("ioredis");
    const redis_client = new Redis({
      host: "127.0.0.1",
      port: 6379,
    });
    redis_client.flushall(function (err, succeeded) {
      if (err) {
        res.status(500).send({
          error: "Internal Server Error",
        });
      } else {
        res.status(200).send({
          success: "Cache Flushed",
        });
      }
    });
  },
};
