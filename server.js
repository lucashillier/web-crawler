// Lucas Hillier 101013357
// COMP 4601 Assignment 1

const pug = require("pug");
const fs = require("fs");
const express = require("express");
const crawler = require("./crawler.js");
const db = require("./database.js");
const index = require("./indexing.js");

const app = express();

// Automatically parse JSON data
app.use(express.json());

// Middleware
app.get("/reset", function(req, res, next) {
  db.reset(() => {
    let data = pug.renderFile("pug_templates/reset.pug");
    res.status(200).send(data);
  });
});

app.get("/", function(req, res, next) {
  // Send the response
  let data = pug.renderFile("pug_templates/index.pug", { pages: [] });
  res.status(200).end(data);
});

app.get("/fruits", function(req, res, next) {
  // Indexing
  index.query("fruits", req, res, result => {
    req.top = result;
    // Use indexing to get full data from db
    db.getPages("fruits", req, res, pages => {
      // Send the response
      let data = pug.renderFile("pug_templates/index.pug", {
        collection: "fruits",
        query: req.query.q,
        pages
      });
      res.status(200).end(data);
    });
  });
});

app.get("/personal", function(req, res, next) {
  // Indexing
  index.query("personal", req, res, result => {
    req.top = result;
    // Use indexing to get full data from db
    db.getPages("personal", req, res, pages => {
      // Send the response
      let data = pug.renderFile("pug_templates/index.pug", {
        collection: "personal",
        query: req.query.q,
        pages
      });
      res.status(200).end(data);
    });
  });
});

// For any request string containing :id, find the matching page
app.param("id", function(req, res, next) {
  db.getPage(req, res, next);
});

app.get("/fruits/:id", function(req, res, next) {
  let data = pug.renderFile("pug_templates/page.pug", { page: req.page });
  res.status(200).end(data);
});

app.get("/personal/:id", function(req, res, next) {
  let data = pug.renderFile("pug_templates/personalPage.pug", {
    page: req.page
  });
  res.status(200).end(data);
});

app.get("/search.js", function(req, res, next) {
  fs.readFile("./search.js", function(err, data) {
    if (err) {
      res.status(500).send();
    } else {
      res.setHeader("Content-Type", "application/json");
      res.status(200).end(data);
    }
  });
});

app.get("/crawl", function(req, res, next) {
  crawler.crawl(
    "https://people.scs.carleton.ca/~davidmckenney/fruitgraph/N-0.html",
    "fruit"
  );
  crawler.crawl("http://books.toscrape.com/index.html", "personal");
  // Send the OK response
  res.status(200).send();
});

db.initialize(() =>
  index.getIndex(() => {
    app.listen(3000);
    console.log("Server listening at http://localhost:3000");
  })
);
