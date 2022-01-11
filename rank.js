const { Matrix } = require("ml-matrix");
const db = require("./database.js");

let x0fruit;
let x0personal;

function pageRank() {
  // Get the pages from the db
  db.getAdjacency((fruitResult, personalResult) => {
    const euclidean = 0.0001;

    // Fruit Transition probability matrix
    let Pfruit = createMatrix(fruitResult);

    // Initial PageRank vector
    x0fruit = Matrix.eye(1, fruitResult.length);

    // Power iteration
    let previousFruit;
    do {
      previousFruit = x0fruit;
      x0fruit = x0fruit.mmul(Pfruit);
    } while (difference(previousFruit, x0fruit) >= euclidean);

    // Fruit Transition probability matrix
    let Ppersonal = createMatrix(personalResult);

    // Initial PageRank vector
    x0personal = Matrix.eye(1, personalResult.length);

    // Power iteration
    let previousPersonal;
    do {
      previousFruit = x0personal;
      x0personal = x0personal.mmul(Ppersonal);
    } while (difference(previousFruit, x0personal) >= euclidean);

    // Store in db
    db.addRank(
      { rank_id: "fruits", rank: x0fruit },
      { rank_id: "personal", rank: x0personal }
    );
  });
}

// Calculates the difference between 2 PageRank vectors
function difference(current, previous) {
  let sum = 0;
  for (x = 0; x < previous.columns; x++) {
    sum += Math.pow(previous.get(0, x) - current.get(0, x), 2);
  }

  return Math.sqrt(sum);
}

function createMatrix(result) {
  const n = result.length;
  const a = 0.1;

  // Start with NxN matrix of ones
  let aN = Matrix.ones(n, n);
  // Divide each entry by N -> NxN matrix of 1/N
  aN.div(n);
  // Multiply by a -> NxN matrix of a/N
  aN.mul(a);

  // Map the result into matrix form
  const resultMatrix = result.map(page => {
    // if no links -> page array = [1/n ... 1/n]
    if (page.outgoing.length == 0) {
      return new Array(n).fill(1 / n);
    } else {
      // pageArray = [0 ... 0]
      let pageArray = new Array(n).fill(0);
      // pageArray[link->page_id] = 1/numLinks
      page.outgoing.forEach(link => {
        let linkID = link.slice(59, -5);
        pageArray[linkID] = 1 / page.outgoing.length;
      });
      return pageArray;
    }
  });

  // Transition probability matrix
  let P = new Matrix(resultMatrix);

  // multiply by 1-a
  P.mul(1 - a);
  // add a/n to each entry
  P.add(aN);

  return P;
}

function getRank(collectionName) {}

module.exports = {
  pageRank,
  getRank
};
