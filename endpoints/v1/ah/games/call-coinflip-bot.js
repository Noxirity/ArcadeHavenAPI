const crypto = require("crypto");
const recent_cache = [];

module.exports = {
  path: "",
  method: "GET",
  Auth: true,
  run: async (req, res, mongo_client) => {
    const userid = 1;
    let data = req.query.data;
    data = Buffer.from(data, "base64").toString("utf-8");
    data = JSON.parse(data);

    // check if the request is in the cache
    let cache = recent_cache.find((cache) => cache[0] === req.query.data);
    if (cache) {
      const date = new Date(cache[1]);
      if (Date.now() - date.getTime() < 300000) {
        return res.status(400).send({
          error: "Request already processed",
        });
      }

      recent_cache.splice(recent_cache.indexOf(cache), 1);
    }

    const db = mongo_client.db("ArcadeHaven");
    const collection = db.collection("items");
    const settings = db.collection("game_settings");
    const setting_doc = await settings.findOne({ tag: "private_settings" });

    let docs = await collection
      .find(
        { "serials.u": parseInt(userid) },
        {
          projection: { "serials.u": 1, itemId: 1, value: 1, name: 1 },
        }
      )
      .toArray();

    let newInventory = {};
    let itemValues = {};
    let totalOfEachItem = {};
    let itemNames = {};

    let valueToMatch = data.value;
    let maxItemsAllowed = data.maxItems;
    const max_value = setting_doc.bot_max_value || 1000000;

    if (valueToMatch > max_value) {
      return res.status(400).send({
        error: "Value too high",
      });
    }

    const processItems = async () => {
      docs.forEach((item) => {
        const userSerials = item.serials
          .map((serial_info, index) =>
            serial_info &&
              serial_info.u === parseInt(userid) &&
              !serial_info.locked
              ? (index + 1).toString()
              : null
          )
          .filter((serial) => serial !== null);

        if (userSerials.length > 0) {
          if (!item.value || item.value <= 0) return;

          newInventory[item.itemId] = newInventory[item.itemId] || [];
          newInventory[item.itemId].push(...userSerials);
          itemValues[item.itemId] = item.value;
          totalOfEachItem[item.itemId] = userSerials.length;
          itemNames[item.itemId] = item.name;
        }
      });
    };

    const selectItems = async () => {
      const MAX_COMBINATIONS = 40000;
      const items = Object.keys(itemValues)
        .map((itemId) => ({
          itemId,
          value: itemValues[itemId],
          serials: newInventory[itemId],
          name: itemNames[itemId],
        }))
        .filter((item) => item.value > 0);

      const targetValue = valueToMatch;
      const minValue = targetValue * 0.9;
      const maxValue = targetValue * 1.1;
      const maxItems = maxItemsAllowed;
      const combinations = [];

      const shuffleArray = (array) => {
        for (let i = array.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [array[i], array[j]] = [array[j], array[i]];
        }
      };

      const generateCombination = () => {
        shuffleArray(items);
        let currentCombination = [];
        let currentValue = 0;
        let currentItems = 0;

        for (let item of items) {
          for (let serial of item.serials) {
            if (currentItems >= maxItems) {
              break;
            }

            if (currentValue + item.value <= maxValue) {
              currentCombination.push({ item, serial });
              currentValue += item.value;
              currentItems++;
            }

            if (currentValue >= minValue && currentValue <= maxValue) {
              break;
            }
          }

          if (currentValue >= minValue && currentValue <= maxValue) {
            break;
          }
        }

        return currentCombination;
      };

      for (let i = 0; i < MAX_COMBINATIONS; i++) {
        const combination = generateCombination();
        const totalCombinationValue = combination.reduce(
          (acc, { item }) => acc + item.value,
          0
        );
        if (
          combination.length > 0 &&
          totalCombinationValue >= minValue &&
          totalCombinationValue <= maxValue
        ) {
          combinations.push(combination);
          break;
        }
      }

      if (combinations.length === 0) {
        return {
          selectedItems: {},
          totalMatchedValue: 0,
          totalMatchedItems: 0,
        };
      }

      const randomCombination =
        combinations[Math.floor(Math.random() * combinations.length)];
      let totalMatchedValue = 0;
      let totalMatchedItems = 0;
      const selectedItems = {};

      randomCombination.forEach(({ item, serial }) => {
        if (!selectedItems[item.itemId]) {
          selectedItems[item.itemId] = [];
        }
        selectedItems[item.itemId].push(serial);
        totalMatchedValue += item.value;
        totalMatchedItems++;
      });

      return { selectedItems, totalMatchedValue, totalMatchedItems };
    };

    await processItems();

    const {
      selectedItems: matchedItems,
      totalMatchedValue,
      totalMatchedItems,
    } = await selectItems();

    const itemsToUpdate = Object.keys(matchedItems).map((itemId) => ({
      itemId,
      serials: matchedItems[itemId],
    }));

    let itemsToCheck = itemsToUpdate.map((item) => item.itemId);
    let docsToCheck = await collection
      .find(
        {
          itemId: {
            $in: itemsToCheck.map((itemId) => Number(itemId)),
          },
          serials: {
            $elemMatch: {
              u: parseInt(userid),
            },
          },
        },
        {
          projection: { itemId: 1 },
        }
      )
      .toArray();

    if (docsToCheck.length !== itemsToCheck.length) {
      recent_cache.push([req.query.data, Date.now()])

      return res.status(400).send({
        error: "Some items are no longer available",
      });
    }

    if (totalMatchedItems === 0) {
      recent_cache.push([req.query.data, Date.now()])
    }

    return res.status(200).send({
      matchedItems,
      totalMatchedValue,
      totalMatchedItems,
    });
  },
};
