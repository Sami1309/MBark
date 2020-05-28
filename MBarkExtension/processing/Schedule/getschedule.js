const CSVtoJSON = require("csvtojson")
const JSONtoCSV = require("json2csv").parse
const FileSystem = require("fs")

const fileName = "./FA2020.csv"

CSVtoJSON().fromFile(fileName).then(source => {
    console.log(source)
    FileSystem.writeFileSync("./schedule.json",JSON.stringify(source))
})