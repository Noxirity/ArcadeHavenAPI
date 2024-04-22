const { default: axios } = require("axios");
const Redis = require("ioredis");
const {
  getGamePassProductInfo,
  getUsernameFromId,
  getThumbnails,
} = require("noblox.js");
const redis_client = new Redis({
  host: "127.0.0.1",
  port: 6379,
});

const log = require("../../../../post-log");

module.exports = {
  path: "",
  method: "POST",
  Auth: false,
  run: async (req, res, mongo_client) => {
    // // down for maintenance
    // return res.status(503).json({
    //   status: "error",
    //   error: "Service Unavailable",
    // });

    const { user_id, item, token } = req.body;
    let [itemid, serial] = item;
    const unique_token = Buffer.from(JSON.stringify(item)).toString("base64");
    itemid = parseInt(itemid);
    serial = parseInt(serial) - 1;

    redis_client.get(unique_token, async (err, reply) => {
      if (reply) {
        console.log(unique_token);
        return res
          .status(400)
          .json({ status: "error", error: "Item already processing" });
      }
      redis_client.set(unique_token, "processing", "EX", 300);

      const database = await mongo_client.db("ArcadeHaven");
      const robux_market = await database.collection("robux_market");
      const items = await database.collection("items");
      const listed_doc = await robux_market.findOne({ itemId: itemid, serial });

      if (!listed_doc) {
        redis_client.del(unique_token);
        return res
          .status(400)
          .json({ status: "error", error: "Item not listed" });
      }

      const item_doc = await items.findOne(
        { itemId: itemid },
        { projection: { "serials.h": 0, history: 0, reselling: 0 } }
      );
      if (!item_doc) {
        redis_client.del(unique_token);
        return res.status(400).json({ status: "error", error: "Invalid Item" });
      }
      const serial_info = item_doc.serials[serial];
      if (!serial_info || serial_info.u !== listed_doc.userId) {
        redis_client.del(unique_token);
        if (listed_doc) {
          await robux_market.deleteOne({ itemId: itemid, serial });
        }

        log("1203327439883866163", {
          embeds: [
            {
              title: "Process Request Cancelled",
              description: `**Reason**: Item ownership changed\n**Unique Token**: \`${unique_token}\`\n**Item**: \`${itemid}-${
                serial + 1
              }\`\nBuyer: \`${user_id}\`\nSeller: \`${listed_doc.userId}`,
              color: 16745728,
            },
          ],
        });

        return res
          .status(400)
          .json({ status: "error", error: "Item ownership changed" });
      }

      if (!listed_doc) {
        redis_client.del(unique_token);
        console.log("item not listed");
        return res
          .status(400)
          .json({ status: "error", error: "Item not listed" });
      }
      if (listed_doc.userId == user_id) {
        redis_client.del(unique_token);
        return res
          .status(400)
          .json({ status: "error", error: "Cannot buy your own item" });
      }
      if (listed_doc._PROCESSING && !token) {
        if ((listed_doc._PROCESSING_TIME || 0) + 300000 < Date.now()) {
          await robux_market.updateOne(
            { itemId: itemid, serial },
            { $unset: { _PROCESSING: "", _PROCESSING_TIME: "" } }
          );
        } else {
          redis_client.del(unique_token);

          return res.status(400).json({
            status: "error",
            error: "Item already processing and no token provided",
          });
        }
      }

      if (token) {
        if (listed_doc._PROCESSING !== token) {
          redis_client.del(unique_token);

          log("1203327439883866163", {
            content: `\n\`\`\`\n${JSON.stringify(listed_doc)}\n\`\`\``,
            embeds: [
              {
                title: "[CRITICAL] Process Request Cancelled",
                description: `**Reason**: Invalid token provided\n**Unique Token**: \`${unique_token}\`\n**Item**: \`${itemid}-${
                  serial + 1
                }\`\nBuyer: \`${user_id}\`\nSeller: \`${
                  listed_doc.userId
                }\`\n\nExpected Token: \`${
                  listed_doc._PROCESSING
                }\`\nProvided Token: \`${token}\``,
                color: 16745728,
                footer: {
                  text: "THERE IS A HIGH CHANCE THEY BOUGHT THE GAMEPASS BUT DIDN'T GET THE ITEM.",
                },
              },
            ],
          });

          return res
            .status(400)
            .json({ status: "error", error: "Invalid token" });
        }

        if (req.body.cancel == true) {
          await robux_market.updateOne(
            { itemId: itemid, serial: serial },
            { $unset: { _PROCESSING: "" } }
          );

          log("1203327439883866163", {
            content: `🗑️ [${user_id}](<https://www.roblox.com/users/${user_id}/profile>) has deleted the token for ${item_doc.name} (#${serial}), [R$${listed_doc.price}](<https://www.roblox.com/game-pass/${listed_doc.gamepassId}/>) (Token: \`${token}\`)`,
          });

          redis_client.del(unique_token);
          return res.status(200).json({
            status: "success",
            data: "success",
          });
        }

        await items.updateOne(
          { itemId: itemid },
          {
            $set: {
              [`serials.${serial}.u`]: user_id,
              [`serials.${serial}.t`]: Math.floor(Date.now() / 1000),
            },
            $unset: {
              [`reselling.${serial}`]: "",
            },
            $push: {
              [`serials.${serial}.h`]: [
                "robux_market", // context
                listed_doc.userId, // seller
                user_id, // buyer
                listed_doc.price, // price
                Date.now(), // timestamp
              ],
            },
          }
        );

        await robux_market.updateOne(
          { itemId: "analytics" },
          { $inc: { total_sales: 1, total_robux: listed_doc.price } },
          { upsert: true }
        );

        const user_analytics = await database.collection("user_analytics");
        const buyer_analytics = await user_analytics.findOneAndUpdate(
          { userId: user_id },
          { $inc: { total_spent: listed_doc.price } },
          { returnDocument: "after", upsert: true }
        );
        const seller_analytics = await user_analytics.findOneAndUpdate(
          { userId: listed_doc.userId },
          { $inc: { total_raised: listed_doc.price } },
          { returnDocument: "after", upsert: true }
        );

        // let awarded_violet_valk = false;
        // if (seller_analytics.total_raised >= 5000) {
        //   const violet_valk = await items.findOne(
        //     { itemId: 1402432199 },
        //     { projection: { serials: 1 } }
        //   );
        //   let already_owns_violet_valk = false;
        //   for (let i = 0; i < violet_valk.serials.length; i++) {
        //     if (violet_valk.serials[i].u == listed_doc.userId) {
        //       already_owns_violet_valk = true;
        //       break;
        //     }
        //   }
        //   if (!already_owns_violet_valk) {
        //     awarded_violet_valk = true;
        //     items.updateOne(
        //       { itemId: 1402432199 },
        //       {
        //         $push: {
        //           serials: {
        //             u: listed_doc.userId,
        //             t: Math.floor(Date.now() / 1000),
        //             h: [],
        //           },
        //         },
        //         $inc: {
        //           quantitySold: 1,
        //           totalQuantity: 1,
        //         },
        //       },
        //       { upsert: true }
        //     );
        //   }
        // }

        // let awarded_dominus_azurelight = false;
        // if (buyer_analytics.total_spent >= 10000) {
        //   const dominus_azurelight = await items.findOne(
        //     { itemId: 14565851673 },
        //     { projection: { serials: 1 } }
        //   );
        //   let already_owns_dominus_azurelight = false;
        //   for (let i = 0; i < dominus_azurelight.serials.length; i++) {
        //     if (dominus_azurelight.serials[i].u == user_id) {
        //       already_owns_dominus_azurelight = true;
        //       break;
        //     }
        //   }

        //   if (!already_owns_dominus_azurelight) {
        //     awarded_dominus_azurelight = true;
        //     items.updateOne(
        //       { itemId: 14565851673 },
        //       {
        //         $push: {
        //           serials: {
        //             u: user_id,
        //             t: Math.floor(Date.now() / 1000),
        //             h: [],
        //           },
        //         },
        //         $inc: {
        //           quantitySold: 1,
        //           totalQuantity: 1,
        //         },
        //       },
        //       { upsert: true }
        //     );
        //   }
        // }

        await robux_market.deleteOne({ itemId: itemid, serial });
        redis_client.del(unique_token);
        res.status(200).json({
          status: "success",
          data: "success",
        });

        log("1203327439883866163", {
          content: `**🎉 [${user_id}](<https://www.roblox.com/users/${user_id}/profile>) has been purchased ${item_doc.name} (#${serial}) for [R$${listed_doc.price}](<https://www.roblox.com/game-pass/${listed_doc.gamepassId}/>)**`,
        });

        let thumbnail;

        try {
          const t = await getThumbnails([
            {
              type: "Asset",
              format: "png",
              targetId: itemid,
              size: "150x150",
              isCircular: false,
            },
          ]);

          thumbnail = t[0].imageUrl;
        } catch (error) {
          console.error(error);
          thumbnail =
            "https://static.wikia.nocookie.net/0db62102-0e94-49ad-919d-6e1f5ef969bf/scale-to-width/755";
        }

        try {
          const seller_username = await getUsernameFromId(listed_doc.userId);
          const buyer_username = await getUsernameFromId(user_id);

          // if (awarded_violet_valk) {
          //   log("1089320905395667045", {
          //     content: `🎉 [${seller_username}](<https://www.roblox.com/users/${listed_doc.userId}/profile>) has been awarded the Violet Valkyrie!`,
          //   });
          // }

          // if (awarded_dominus_azurelight) {
          //   log("1089320905395667045", {
          //     content: `🎉 [${buyer_username}](<https://www.roblox.com/users/${user_id}/profile>) has been awarded the Dominus Azurelight!`,
          //   });
          // }

          require("../../../../post-log")("1201249045771984936", {
            content: null,
            embeds: [
              {
                title: `${item_doc.name} (#${serial + 1})`,
                color: 3438079,
                fields: [
                  {
                    name: "Buyer",
                    value: `[@${buyer_username}](https://www.roblox.com/users/${user_id}/profile)`,
                    inline: true,
                  },
                  {
                    name: "Seller",
                    value: `[@${seller_username}](https://www.roblox.com/users/${listed_doc.userId}/profile)`,
                    inline: true,
                  },
                  {
                    name: "Sale Price",
                    value: `<:robux:1201873435652010045> ${listed_doc.price.toLocaleString()}`,
                  },
                  {
                    name: "Item Value",
                    value: `$${(
                      item_doc.value ||
                      item_doc.rap ||
                      0
                    ).toLocaleString()}`,
                    inline: true,
                  },
                ],
                thumbnail: {
                  url: thumbnail,
                },
                footer: {
                  text: `This seller has now raised R$${seller_analytics.total_raised.toLocaleString()}`,
                },
              },
            ],
          });
        } catch (error) {
          console.log(error);
        }
      } else {
        // disable new listings
        // redis_client.del(unique_token);
        // return res.status(503).json({
        //   status: "error",
        //   error: "Service Unavailable",
        // });

        const processing_token = require("crypto")
          .randomBytes(16)
          .toString("hex");
        const gamepass_info = await getGamePassProductInfo(
          listed_doc.gamepassId
        );
        if (gamepass_info.PriceInRobux !== listed_doc.price) {
          redis_client.del(unique_token);
          robux_market.deleteOne({ itemId: itemid, serial });
          return res.status(400).json({
            status: "error",
            error: "Price changed",
          });
        }

        try {
          const processing_token_check = await robux_market.findOneAndUpdate(
            { itemId: itemid, serial },
            {
              $set: {
                _PROCESSING: processing_token,
                _PROCESSING_TIME: Date.now(),
              },
            },
            { returnDocument: "after" }
          );

          if (processing_token_check._PROCESSING !== processing_token) {
            redis_client.del(unique_token);
            return res.status(400).json({
              status: "error",
              error: "Failed to set processing token",
            });
          }
        } catch (error) {
          console.error(error);
          return res.status(500).json({
            status: "error",
            error: "An error occurred while processing the request",
          });
        }

        log("1203327439883866163", {
          content: `🪄 [${user_id}](<https://www.roblox.com/users/${user_id}/profile>) has created a token for ${item_doc.name} (#${serial}), [R$${listed_doc.price}](<https://www.roblox.com/game-pass/${listed_doc.gamepassId}/>). (Token: \`${processing_token}\`)`,
        });

        redis_client.del(unique_token);
        return res.status(200).json({
          status: "success",
          data: processing_token,
        });
      }
    });
  },
};
