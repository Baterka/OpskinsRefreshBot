//CONFIGURATION
const APIkey = "<api_key>";
let appidList = [730, 440, 570, 295110, 433850, 578080, 218620, 304930, 252490, 232090, 753]; //List of AppID's what will bot check
let treshold = 0;
let interval = 60 * 60 * 24; //In seconds
let debug = false; //Print more info
let blacklist = ["item1","item2"];

//DEPENDENCIES
const OPSkinsAPI = require('@opskins/api');
const fs = require('fs');
const async = require('async');
const opskins = new OPSkinsAPI(APIkey);
const SaleStatus = OPSkinsAPI.SaleStatus;
const readline = require('readline');
const clc = require('cli-color');

let title = clc.cyanBright.bold;
let text = clc.yellowBright;
let error = clc.redBright;
let success = clc.greenBright;
let debugc = clc.magentaBright;

let updateType;

console.log(title("OPSkins Refresh Bot by Baterka (https://baterka.xyz)"));
console.log(title("Version 1.1.1"));
console.log("\r");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let start = function () {
    rl.question('What update type do you want use? [individual-serial/individual-parallel/bulk]: ', (answer) => {
        if (answer === "individual-serial" || answer === "individual-parallel" || answer === "bulk") {
            updateType = answer;
            console.log(text("Using update type: " + answer));
            console.log(text("Starting refresh cycle..."));
            console.log("\r");
            cycle();

            setTimeout(function () {
                cycle();
            }, 1000 * interval);

            rl.close();
        } else {
            console.log(error("Selection not recognized."));
            start();
        }
    });
};

start();

function cycle() {
    console.log(text("Downloading prices... (Can take few seconds)"));
    async.eachSeries(appidList, function (appid, callback) {
        opskins.getLowestPrices(appid, function (err, prices) {
            if (err) {
                console.log(error("[" + appid + "]" + err.message));
            } else {
                prices = processPrices(prices);
                fs.writeFile("prices/" + appid + ".json", JSON.stringify(prices, null, 2), function (err) {
                    if (err) {
                        console.log(error("[" + appid + "] " + err))
                        callback(true);
                    }

                    if (debug)
                        console.log(debugc("[" + appid + "] Prices saved!"));
                    callback();
                });
            }
        });
    }, function (err) {
        if (err) {
            console.log(error("Something went wrong when saving prices. I will stop now."));
            process.exit(0);
        }
        console.log(success("Prices downloaded and saved!"));
        console.log(text("Checking items on sale... (Can take few seconds)"));
        let filters = {
            type: SaleStatus.OnSale
        };
        opskins.getSales(filters, function (err, totalPages, sales) {
            if (err) {
                console.log(error("Error when fetching sales: " + err.message));
            } else {
                var items = {};

                for (var i = 0, len = appidList.length; i < len; i++) {
                    items[appidList[i]] = [];
                }

                for (var i = 0, len = sales.length; i < len; i++) {
                    if (appidList.includes(sales[i].appid)) {
                        if (!containsAny(sales[i].name, blacklist)) {
                            items[sales[i].appid].push({
                                id: sales[i].id,
                                name: sales[i].name,
                                listedPrice: sales[i].price,
                                minPrice: Infinity,
                                needUpdate: false
                            });
                        } else
                            console.log(debugc("Item '" + sales[i].name + "' not added because is in blacklist."));
                    } else
                        console.log(debugc("Item '" + sales[i].name + "' not added because not included in appID list."));
                }
                var toUpdate = {};
                async.forEachOfSeries(items, function (value, key, callback) {
                    var appid = key;
                    var itemsArr = [];
                    var keys2 = Object.keys(items[appid]);
                    for (var j = 0, len2 = keys2.length; j < len2; j++) {
                        itemsArr.push(items[appid][keys2[j]].name);
                    }
                    if (itemsArr.length > 0) {
                        var prices = JSON.parse(fs.readFileSync("prices/" + appid + ".json", 'utf8'));
                        var keys = Object.keys(items[appid]);

                        for (var i = 0, len = keys.length; i < len; i++) {
                            if (appid === "753") {
                                var steamItem = itemInclude(prices, items[appid][i].name);
                                if (steamItem[0]) {
                                    items[appid][i].minPrice = steamItem[1].price * 100;
                                    if (items[appid][i].minPrice < items[appid][i].listedPrice) {
                                        items[appid][i].needUpdate = true;
                                        toUpdate[items[appid][i].id] = items[appid][i].minPrice + treshold;
                                    }
                                } else
                                    console.log(debugc("Item '" + items[appid][i].name + "' not found in prices. Skipping..."));
                            } else if (typeof prices[items[appid][i].name] !== 'undefined') {
                                items[appid][i].minPrice = prices[items[appid][i].name].price * 100;
                                if (items[appid][i].minPrice < items[appid][i].listedPrice) {
                                    items[appid][i].needUpdate = true;
                                    toUpdate[items[appid][i].id] = items[appid][i].minPrice + treshold;
                                }
                            } else
                                console.log(debugc("Item '" + items[appid][i].name + "' not found in prices. Skipping..."));
                        }
                        callback();
                    } else {
                        if (debug)
                            console.log(debugc("[" + appid + "] No items in sale."));
                        callback();
                    }
                }, function (err) {
                    if (err) {
                        console.log(error("Something went wrong when processing items. I will stop now."));
                        process.exit(0);
                    }

                    var size = 0;
                    while (size < 11) {
                        size++;
                        toUpdate[size] = 123;
                    }

                    if (Object.keys(toUpdate).length > 0) {
                        switch (updateType) {
                            case "individual-serial":
                                //individualUpdateSerial(toUpdate);
                                break;
                            case "individual-parallel":
                                //individualUpdateParallel(toUpdate);
                                break;
                            case "bulk":
                               // bulkUpdate(toUpdate);
                                break;
                        }
                    } else {
                        console.log(text("######################################"));
                        console.log(success("Nothing to update.\r\nFinished! Next cycle in " + interval / 60 + " hours."));
                        console.log(text("######################################"));
                    }
                });
            }
        });
    });
}

function itemInclude(prices, name) {
    var keys = Object.keys(prices);
    var itemname;
    for (var j = 0, len = keys.length; j < len; j++) {
        itemname = keys[j].split("-")[1];
        if (itemname === name)
            return [true, prices[keys[j]]];
    }
    return [false, false];
}

function individualUpdateSerial(toUpdate) {
    let toUpdateKeys = Object.keys(toUpdate);
    console.log(text("######################################"));
    var updated = 0;
    async.forEachOfSeries(toUpdate, function (value, key, callback) {
        opskins.editPrice(key, value, function (err) {
            if (err) {
                console.log(key + " -> " + err.message);
            } else {
                updated++;
            }
            callback();
        });
    }, function (err) {
        console.log(text("######################################"));
        console.log(success("Updated " + updated + "/" + toUpdateKeys.length));
        console.log(success("Finished! Next cycle in " + interval / 60 + " hours."));
        console.log(text("######################################"));
    });
}

function individualUpdateParallel(toUpdate) {
    let toUpdateKeys = Object.keys(toUpdate);
    console.log(text("######################################"));
    var updated = 0;
    async.forEachOf(toUpdate, function (value, key, callback) {
        opskins.editPrice(key, value, function (err) {
            if (err) {
                console.log(key + " -> " + err.message);
            } else {
                updated++;
            }
            callback();
        });
    }, function (err) {
        console.log(text("######################################"));
        console.log(success("Updated " + updated + "/" + toUpdateKeys.length));
        console.log(success("Finished! Next cycle in " + interval / 60 + " hours."));
        console.log(text("######################################"));
    });
}

function bulkUpdate(toUpdate) {
    let toUpdateSplit = [];
    let toUpdateKeys = Object.keys(toUpdate);
    let splitSize = 500;
    if (toUpdateKeys.length > splitSize) {
        for (var i = 0, len = Math.ceil(toUpdateKeys.length / splitSize); i < len; i++) {
            toUpdateSplit.push({});
        }

        let index = 0;
        for (var i = 0, len = toUpdateKeys.length; i < len; i++) {
            toUpdateSplit[index][toUpdateKeys[i]] = toUpdate[toUpdateKeys[i]];
            if (i >= ((index + 1) * splitSize) - 1)
                index++;
        }
        if (debug)
            console.log(debugc("Too much items to update. Divided to " + toUpdateSplit.length + " update queries."));
    } else
        toUpdateSplit.push(toUpdate);


    console.log(text("######################################"));
    async.eachSeries(toUpdateSplit, function (items, callback) {
        opskins.editPrices(items, function (err) {
            if (err) {
                callback(err);
            } else {
                if (err)
                    callback(err);
                else {
                    console.log(success("Bulk update queued for " + Object.keys(items).length + " items."));
                    callback();
                }
            }
        });
    }, function (err) {
        if (err)
            console.log(error("Finished with error: " + err + "\r\nNext cycle in " + interval / 60 + " hours."));
        else
            console.log(success("Finished! Next cycle in " + interval / 60 / 60 + " hours."));
        console.log(text("######################################"));
    });
}

function processPrices(data) {
    let sortable = [];
    for (let item in data) {
        sortable.push([item, data[item].price]);
    }
    sortable.sort(function (a, b) {
        return b[1] - a[1];
    });
    let object = {};
    for (let i in sortable) {
        object[sortable[i][0]] = {
            price: sortable[i][1] / 100
        };
    }
    return object;
}

function containsAny(str, substrings) {
    for (let i = 0; i !== substrings.length; i++) {
        let substring = substrings[i];
        if (str.indexOf(substring) !== -1) {
            return true;
        }
    }
    return false;
}