const Crawler = require("crawler");
const db = require("./database.js");
const { indexDoc, storeIndex } = require("./indexing.js");
const { pageRank } = require("./rank.js");

let personal_page_num = 0;

const c = new Crawler({
  maxConnections: 10,
  skipDuplicates: true,

  // Callback for the fruits page
  callback: (error, res, done) => fruitCallback(error, res, done)
});

// Triggered when the queue becomes empty
c.on("drain", function() {
  db.addIncoming(() => {
    console.log("Done crawling.");
    pageRank();
  });
});

function crawl(url, collection) {
  console.log("Starting Crawl");

  // Callback for personal site
  if (collection == "personal") {
    c.queue([
      {
        uri: url,
        callback: (error, res, done) => personalCallback(error, res, done),
        page_num: 0
      }
    ]);
  } else {
    // Queue the URL, which starts the crawl
    c.queue(url);
  }
}

function fruitCallback(error, res, done) {
  if (error) {
    console.log(error);
    done();
  } else {
    let $ = res.$; //get cheerio data, see cheerio docs for info
    let links = $("a");
    let outgoing = [];

    $(links).each(function(i, link) {
      outgoing.push(
        "https://people.scs.carleton.ca/~davidmckenney/fruitgraph" +
          $(link)
            .attr("href")
            .substring(1)
      );
    });

    // Add links to queue
    c.queue(outgoing);

    const page = {
      page_id: $("title").text(),
      page_num: parseInt(
        $("title")
          .text()
          .slice(2)
      ),
      url: res.options.uri,
      content: $("p").text(),
      outgoing
    };

    // Add page to the db
    db.addPage(page, "fruits", done);
  }
}

function personalCallback(error, res, done) {
  if (error) {
    console.log(error);
    done();
  } else {
    let $ = res.$; //get cheerio data, see cheerio docs for info
    let links = $("a");
    let outgoing = [];

    let page_num = personal_page_num++;

    $(links).each(function(i, link) {
      let href = $(link).attr("href");
      // Slice off the /index.html
      let updatedLink = res.options.uri.slice(
        0,
        res.options.uri.lastIndexOf("/")
      );

      // Num times to trim
      var count = (href.match(/\.\.\//g) || []).length;

      for (let i = 0; i < count; i++) {
        updatedLink = updatedLink.slice(0, updatedLink.lastIndexOf("/"));
        href = href.slice(href.indexOf("/") + 1);
      }

      if (updatedLink.slice(-1) != "/") {
        updatedLink = updatedLink + "/";
      }

      outgoing.push(updatedLink + href);
    });

    // Add links to queue
    outgoing.forEach(link => {
      c.queue([
        {
          uri: link,
          callback: (error, res, done) => personalCallback(error, res, done)
        }
      ]);
    });

    // Data formatting
    let title = $("title").text();
    title = title.slice(0, title.indexOf("|")).trim();

    let pagination = $("li:contains('Page')").text();
    pagination = pagination
      .slice(pagination.indexOf("e") + 1, pagination.indexOf("o"))
      .trim();

    let page_id = pagination.length > 0 ? title + "-" + pagination : title;
    page_id = page_id.replace(/\s/g, "-").toLowerCase();

    let content = [];

    $("p").each((i, p) => {
      if (
        [
          ".star-rating One",
          ".star-rating Two",
          ".star-rating Three",
          ".star-rating Four",
          ".star-rating Five"
        ].includes($(p).attr("class"))
      ) {
        return;
      }
      content.push(
        $(p)
          .text()
          .trim()
          .replace(/\s/g, "\n")
      );
    });

    content = content.filter(word => word != "");
    content = content.join("\n");

    const page = {
      page_id,
      page_num,
      url: res.options.uri,
      content,
      outgoing
    };

    // Add page to the db
    db.addPage(page, "personal", done);
  }
}

module.exports = {
  crawl
};
