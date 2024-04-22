const _GAMEPASS_CACHE = {};
const _LOADING = {};

const Bottleneck = require("bottleneck");

const limiter = new Bottleneck({
  minTime: 100, // 100 ms minimum delay between requests
});

async function getUserCreatedGamepasses(userId) {
  if (_LOADING[userId]) {
    await new Promise((resolve) => {
      const checkLoaded = setInterval(() => {
        if (_GAMEPASS_CACHE[userId]) {
          clearInterval(checkLoaded);
          resolve();
        }
      }, 100); // Check every 100 ms
    });
    return _GAMEPASS_CACHE[userId];
  }

  _LOADING[userId] = true;
  const baseUrl = "https://games.roproxy.com";
  const userGamesUrl = `${baseUrl}/v2/users/${userId}/games?accessFilter=Public&sortOrder=Asc&limit=50`;
  const gamePassesUrl = `${baseUrl}/v1/games/%d/game-passes?limit=100&sortOrder=Asc`;
  let cursor = "";
  let gamepasses = [];

  try {
    do {
      const fullUserGamesUrl = `${userGamesUrl}&cursor=${cursor}`;
      const userGamesResponse = await fetch(fullUserGamesUrl);
      const gamesData = await userGamesResponse.json();

      console.log(gamesData);

      let progress = 0;
      for (let gameInfo of gamesData.data) {
        const gameId = gameInfo.id;
        const fullGamePassesUrl = gamePassesUrl.replace("%d", gameId);

        try {
          const gamePassesResponse = await limiter.schedule(() =>
            fetch(fullGamePassesUrl)
          );
          const passesData = await gamePassesResponse.json();

          for (let passDetail of passesData.data) {
            if (passDetail.price) {
              gamepasses.push({
                id: passDetail.id,
                price: passDetail.price,
              });
            }
          }
        } catch (error) {
          console.error("Failed to load game passes:", error);
        }
      }

      cursor = gamesData.nextPageCursor || "";
    } while (cursor !== "");
  } catch (error) {
    console.error("Failed to load user games:", error);
  } finally {
    _LOADING[userId] = false;
    _GAMEPASS_CACHE[userId] = gamepasses;
  }

  return gamepasses;
}

module.exports = {
  path: "",
  method: "GET",
  Auth: true,
  run: async (req, res, mongo_client) => {
    const { id: userid } = req.query;
    const gamepasses = await getUserCreatedGamepasses(userid);
    console.log(gamepasses);
    res.status(200).json({ status: "success", data: gamepasses });

    const database = await mongo_client.db("ArcadeHaven");
    const robux_market = await database.collection("robux_market");
    const passes = await database.collection("gamepasses");

    const updates = gamepasses.map((pass) =>
      passes.updateOne(
        { id: pass.id },
        {
          $set: {
            id: pass.id,
            price: pass.price,
            user_id: userid,
          },
        },
        { upsert: true }
      )
    );
    await Promise.all(updates);

    const all_saved = await passes.find({ user_id: userid }).toArray();
    const toDelete = all_saved.filter(
      (saved) => !gamepasses.find((p) => p.id === saved.id)
    );
    const deletions = toDelete.map((saved) =>
      passes.deleteOne({ id: saved.id })
    );
    await Promise.all(deletions);

    const listed = await robux_market.find({ userId: userid }).toArray();
    const marketUpdates = listed
      .map((listing) => {
        const pass = gamepasses.find((p) => p.id === listing.itemId);
        if (!pass) {
          return robux_market.deleteOne({ itemId: listing.itemId });
        } else if (pass.price !== listing.price) {
          return robux_market.updateOne(
            { itemId: listing.itemId },
            { $set: { price: pass.price } }
          );
        }
      })
      .filter(Boolean);
    await Promise.all(marketUpdates);
  },
};
