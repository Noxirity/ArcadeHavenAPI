module.exports = {
    path: "",
    method: "GET",
    Auth: false,
    run: async (req, res, mongo_client) => {
        const valueToMatch = req.query.value;
        const maxItemsAllowed = req.query.max_items;

        try {
            const collection = mongo_client.db("ArcadeHaven").collection("items");

            let docs = await collection
                .find(
                    { "serials.u": 1, value: { $gt: 0, $lt: 80000000 } },
                    {
                        projection: { "serials.u": 1, itemId: 1, value: 1, name: 1 },
                    }
                )
                .toArray();

            let newInventory = {};
            let itemValues = {};
            let totalOfEachItem = {};
            let itemNames = {};

            const processItems = async () => {
                docs.forEach((item) => {
                    const userSerials = item.serials
                        .map((serial_info, index) =>
                            serial_info &&
                                serial_info.u === 1 &&
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
                const MAX_COMBINATIONS = 5000;
                const items = Object.keys(itemValues)
                    .map((itemId) => ({
                        itemId,
                        value: itemValues[itemId],
                        serials: newInventory[itemId],
                        name: itemNames[itemId],
                    }))
                    .filter((item) => item.value > 0);

                const targetValue = valueToMatch;
                const minValue = targetValue * 0.6;
                const maxValue = targetValue
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

            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.send({
                matchedItems,
                totalMatchedValue,
                totalMatchedItems,
            })

        } catch (error) {
            console.log(error);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(
                JSON.stringify({
                    status: "error",
                    message: "Internal Server Error",
                    error: error.message,
                })
            );
        }
    },
};