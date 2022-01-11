const MongoClient = require("mongodb").MongoClient;
const url = "mongodb://localhost:27017";
const dbName = "assignment1";

function initialize(callback) {
  const client = new MongoClient(url);

  client.connect(function(err) {
    if (err) throw err;
    const db = client.db(dbName);
    const fruits = db.collection("fruits");
    const personal = db.collection("personal");
    const index = db.collection("index");
    const rank = db.collection("rank");

    fruits.createIndex({ page_id: 1 }, { unique: true }, function(err, result) {
      if (err) throw err;
      personal.createIndex({ page_id: 1 }, { unique: true }, function(
        err,
        result
      ) {
        if (err) throw err;
        index.createIndex({ index_id: 1 }, { unique: true }, function(
          err,
          result
        ) {
          if (err) throw err;
          rank.createIndex({ rank_id: 1 }, { unique: true }, function(
            err,
            result
          ) {
            if (err) throw err;
            client.close();

            callback();
          });
        });
      });
    });
  });
}

function reset(callback) {
  const client = new MongoClient(url);

  client.connect(function(err) {
    if (err) throw err;
    const db = client.db(dbName);
    db.dropDatabase({}, function(err, result) {
      if (err) throw err;

      console.log("DB Reset");
      client.close();
      callback();
    });
  });
}

// Add a page to the db
function addPage(page, collectionName, callback) {
  const client = new MongoClient(url);

  client.connect(function(err) {
    if (err) throw err;
    const db = client.db(dbName);

    const pages = db.collection(collectionName);
    pages.updateOne(
      { page_id: page.page_id },
      { $set: page },
      { upsert: true },
      function(err, result) {
        if (err) throw err;

        client.close();
        callback();
      }
    );
  });
}

// Get a page from the db
function getPage(req, res, next) {
  const query = { page_id: req.params.id };

  const client = new MongoClient(url);
  client.connect(function(err) {
    if (err) throw err;
    const db = client.db(dbName);

    let collectionName;
    let incomingCollectionName;
    if (req.path.includes("fruits")) {
      collectionName = "fruits";
      incomingCollectionName = "incomingFruits";
    } else {
      collectionName = "personal";
      incomingCollectionName = "incomingPersonal";
    }

    const pages = db.collection(collectionName);
    const incoming = db.collection(incomingCollectionName);
    pages.findOne(query, function(err, result) {
      if (err) throw err;

      if (result == null) {
        client.close();
        res.status(404).send("Unknown page ID");
      } else {
        req.page = result;

        // Calc word frequency
        // https://stackoverflow.com/questions/30906807/word-frequency-in-javascript
        let frequencyMap = {};
        result.content
          .split("\n")
          .filter(word => word != "")
          .forEach(word => {
            if (!frequencyMap[word]) {
              frequencyMap[word] = 0;
            }
            frequencyMap[word]++;
          });

        req.page.wordFrequency = frequencyMap;

        const incomingQuery = { pageID: req.params.id };
        incoming.findOne(incomingQuery, function(err, incomingResult) {
          if (err) throw err;

          req.page.incoming = incomingResult.incoming;
          client.close();
          next();
        });
      }
    });
  });
}

// Get pages from the db
function getPages(collection, req, res, next) {
  const topArray = req.top.map(page => parseInt(page.ref));

  const query = { page_num: { $in: topArray } };

  const client = new MongoClient(url);
  client.connect(function(err) {
    if (err) throw err;
    const db = client.db(dbName);

    const pages = db.collection(collection);
    pages.find(query).toArray(function(err, result) {
      if (err) throw err;

      if (result == null) {
        client.close();
        res.status(404).send("Unknown page ID");
      } else {
        client.close();
        // Returns the sorted result
        next(
          req.top.map(page => {
            const resultPage = result.find(aPage => aPage.page_num == page.ref);
            return {
              page_id: resultPage.page_id,
              url: resultPage.url,
              content: resultPage.content,
              outgoing: resultPage.outgoing,
              score: page.score
            };
          })
        );
      }
    });
  });
}

// Update the incoming links collection
function addIncoming(callback) {
  let incomingFruitLinks = {};
  let incomingPersonalLinks = {};

  const client = new MongoClient(url);
  client.connect(function(err) {
    if (err) throw err;
    const db = client.db(dbName);

    const fruits = db.collection("fruits");
    const personal = db.collection("personal");
    const incomingFruits = db.collection("incomingFruits");
    const incomingPersonal = db.collection("incomingPersonal");

    fruits.find({}).toArray(function(err, fruitResult) {
      if (err) throw err;
      personal.find({}).toArray(function(err, personalResult) {
        if (err) throw err;
        if (fruitResult == null && personalResult == null) {
          console.log("No pages to update");
          client.close();
        } else {
          // Get the fruit incoming links
          for (page of fruitResult) {
            const pageID = page.url.slice(57, -5);
            for (link of page.outgoing) {
              const linkID = link.slice(57, -5);
              if (!(linkID in incomingFruitLinks)) {
                incomingFruitLinks[linkID] = [];
              }
              incomingFruitLinks[linkID].push(pageID);
            }
          }

          // Get the personal incoming links
          for (page of personalResult) {
            const pageID = page.page_id;
            for (link of page.outgoing) {
              // Get linkID from the url
              let linkID = link.slice(0, link.indexOf("_"));
              if (link.indexOf("_") == -1) {
                linkID = "/all-products";
              }
              linkID = linkID.slice(linkID.lastIndexOf("/") + 1);
              if (link.includes("page")) {
                linkID += link.slice(
                  link.indexOf("page") + 4,
                  link.indexOf(".html")
                );
              }

              if (!(linkID in incomingPersonalLinks)) {
                incomingPersonalLinks[linkID] = [];
              }
              incomingPersonalLinks[linkID].push(pageID);
            }
          }

          const fruitLinksArray = Object.keys(incomingFruitLinks).map(
            pageID => ({
              pageID,
              incoming: incomingFruitLinks[pageID],
              numLinks: incomingFruitLinks[pageID].length
            })
          );

          const personalLinksArray = Object.keys(incomingPersonalLinks).map(
            pageID => ({
              pageID,
              incoming: incomingPersonalLinks[pageID],
              numLinks: incomingPersonalLinks[pageID].length
            })
          );

          // Clear the existing links to update the new ones
          incomingFruits.deleteMany({}, function(err, result) {
            if (err) throw err;
            incomingPersonal.deleteMany({}, function(err, result) {
              if (err) throw err;
              if (fruitLinksArray.length != 0) {
                incomingFruits.insertMany(fruitLinksArray, function(
                  err,
                  result
                ) {
                  if (err) throw err;
                  if (personalLinksArray.length != 0) {
                    incomingPersonal.insertMany(personalLinksArray, function(
                      err,
                      result
                    ) {
                      if (err) throw err;
                      client.close();
                      callback();
                    });
                  } else {
                    client.close();
                    callback();
                  }
                });
              } else {
                if (personalLinksArray.length != 0) {
                  incomingPersonal.insertMany(personalLinksArray, function(
                    err,
                    result
                  ) {
                    if (err) throw err;
                    client.close();
                    callback();
                  });
                } else {
                  client.close();
                  callback();
                }
              }
            });
          });
        }
      });
    });
  });
}

function addIndex(fruitIndex, personalIndex) {
  const client = new MongoClient(url);

  client.connect(function(err) {
    if (err) throw err;
    const db = client.db(dbName);

    const index = db.collection("index");
    index.updateOne(
      { index_id: fruitIndex.index_id },
      { $set: fruitIndex },
      { upsert: true },
      function(err, result) {
        if (err) throw err;

        index.updateOne(
          { index_id: personalIndex.index_id },
          { $set: personalIndex },
          { upsert: true },
          function(err, result) {
            if (err) throw err;
            client.close();
          }
        );
      }
    );
  });
}

function getAll(collectionName, callback) {
  const client = new MongoClient(url);
  client.connect(function(err) {
    if (err) throw err;
    const db = client.db(dbName);

    const collection = db.collection(collectionName);
    collection.find({}).toArray(function(err, result) {
      if (err) throw err;

      client.close();
      callback(result);
    });
  });
}

// Get all pages in order for Adjacency Matrix
function getAdjacency(callback) {
  const client = new MongoClient(url);
  client.connect(function(err) {
    if (err) throw err;
    const db = client.db(dbName);

    const fruits = db.collection("fruits");
    const personal = db.collection("personal");
    fruits
      .find({})
      .sort({ page_num: 1 })
      .toArray(function(err, fruitResult) {
        if (err) throw err;
        personal
          .find({})
          .sort({ page_num: 1 })
          .toArray(function(err, personalResult) {
            if (err) throw err;

            client.close();
            // Returns the sorted result
            callback(fruitResult, personalResult);
          });
      });
  });
}

function addRank(fruitRank, personalRank) {
  const client = new MongoClient(url);

  client.connect(function(err) {
    if (err) throw err;
    const db = client.db(dbName);

    const rank = db.collection("rank");
    rank.updateOne(
      { rank_id: fruitRank.rank_id },
      { $set: fruitRank },
      { upsert: true },
      function(err, result) {
        if (err) throw err;

        rank.updateOne(
          { rank_id: personalRank.rank_id },
          { $set: personalRank },
          { upsert: true },
          function(err, result) {
            if (err) throw err;

            client.close();
          }
        );
      }
    );
  });
}

function getRank(collection, callback) {
  const query = { rank_id: collection };

  const client = new MongoClient(url);
  client.connect(function(err) {
    if (err) throw err;
    const db = client.db(dbName);

    const rank = db.collection("rank");
    rank.findOne(query, function(err, result) {
      if (err) throw err;

      client.close();
      callback(result);
    });
  });
}

module.exports = {
  initialize,
  reset,
  addPage,
  getPage,
  getPages,
  addIncoming,
  addIndex,
  getAll,
  getAdjacency,
  addRank,
  getRank
};
