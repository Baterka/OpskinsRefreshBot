//CONFIGURATION
const APIkey = "<APIKEY>";
let appidList = [730, 440, 570, 295110, 433850, 578080, 218620, 304930, 252490, 232090, 753]; //List of AppID's what will bot check
let debug = true; //Print more info

//DEPENDENCIES
const OPSkinsAPI = require('@opskins/api');
const fs = require('fs');
const async = require('async');
const opskins = new OPSkinsAPI(APIkey);
const readline = require('readline');
const clc = require('cli-color');

let title = clc.cyanBright.bold;
let text = clc.yellowBright;
let error = clc.redBright;
let success = clc.greenBright;
let debugc = clc.magentaBright;

console.log(title("OPSkins Prices Parser Bot by Baterka (https://baterka.xyz)"));
console.log(title("Version 1.0.0"));
console.log("\r");

run();

function run() {
    console.log(text("Downloading prices... (Can take few seconds)"));

    if (!fs.existsSync("prices/")) {
        fs.mkdirSync("prices/");
    }

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
            console.log(error("Something went wrong when saving prices. (" + err + ")"));
            process.exit(0);
        }
        console.log(success("Prices downloaded and saved!"));
        process.exit(0);
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