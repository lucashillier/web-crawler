const elasticlunr = require("elasticlunr");
const db = require("./database.js");

// Create the index
const fruitIndex = elasticlunr(function() {
  this.addField("content");
  this.addField("page_id");
  this.setRef("page_num");
});

const personalIndex = elasticlunr(function() {
  this.addField("content");
  this.addField("page_id");
  this.setRef("page_num");
});

// Add document to the index
function indexDoc(index, doc) {
  if (index == "fruits") {
    fruitIndex.addDoc(doc);
  } else if (index == "personal") {
    personalIndex.addDoc(doc);
  } else {
    console.error("Unknown Index");
  }
}

// Query the index
// https://stackoverflow.com/questions/41447001/elasticlunr-search-to-return-document-object-based-on-the-index
function query(indexName, req, res, callback) {
  const query = req.query.q;
  const limit = req.query.limit;
  const boost = req.query.boost;
  const index = indexName == "fruits" ? fruitIndex : personalIndex;

  console.log(
    `Querying ${indexName}: ${query}. Limit: ${limit}. Boost: ${boost}`
  );

  if (boost == "true") {
    db.getRank(indexName, rankResult => {
      // Multiply indexResult and rankResult for the callback
      // Need to update score in object passed back
      let rankArray = index.search(query, {});
      rankArray.forEach((page, i, array) => {
        page.score *= rankResult.rank.data[0][i];
        array[i] = page;
      });

      callback(
        rankArray
          .sort((page1, page2) => {
            if (page1.score < page2.score) {
              return 1;
            }
            if (page1.score > page2.score) {
              return -1;
            }
            return 0;
          })
          .slice(0, limit)
      );
    });
  } else {
    callback(index.search(query, {}).slice(0, limit));
  }
}

function getIndex(callback) {
  db.getAll("fruits", fruitResult => {
    createIndex(fruitResult, "fruits");
    db.getAll("personal", personalResult => {
      createIndex(personalResult, "personal");
      callback();
    });
  });
}

function createIndex(result, collectionName) {
  result.forEach(page => {
    indexDoc(collectionName, page);
  });
}

module.exports = {
  indexDoc,
  query,
  getIndex
};
