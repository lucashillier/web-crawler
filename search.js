let search = document.getElementById("search");
search.onclick = searchPages;

function searchPages() {
  // Get values from the form
  let query = document.getElementById("query").value;
  let boost = document.getElementById("boost").checked;
  let collection = document.getElementById("siteSelect").value;
  let limit = parseInt(document.getElementById("limit").value);

  if (isNaN(limit) || limit < 1 || limit > 50) {
    window.alert("You must specify between 1 and 50 pages.");
  } else {
    // Search for the product
    window.location.href =
      "/" + collection + "?q=" + query + "&boost=" + boost + "&limit=" + limit;
  }
}
