let wsSearchDB = [];
let wsScoreDB = [];
let wsQ = null;
let wsQinternal = null;
let wsSearchResultsDiv = 0;
let wsSearchResultsDivTotal = 0;
let wsSearchLoadMore = false;
let wsSearchLoadMoreBatch = 5;

// Display the results to the page
function wsDisplayResults() {
	const section = document.querySelector(".witsec-search");

	try {
		// Change page title
		const searchTitle = (section.dataset.wssearchtitle || "");
		document.title = document.title + " " + searchTitle.replace(/{searchString}/g, wsQ);

		// Use 'load more'?
		wsSearchLoadMore = (section.dataset.wssearchloadmore ? section.dataset.wssearchloadmore : false);
		wsSearchLoadMoreBatch = (!isNaN(section.dataset.wssearchloadmorebatch) ? section.dataset.wssearchloadmorebatch : 5);

		// Change search input
		section.querySelector(".wsSearchInput").value = wsQ;

		// If no results were found
		if (wsScoreDB.length === 0) {
			const noResults = section.querySelector(".wsSearchNoResults");
			noResults.innerHTML = noResults.innerHTML.replace(/{searchString}/g, wsQ);
			noResults.classList.remove("d-none");
			wsToggleSpinner(false);
			return true;
		}

		// Show "results for"
		let resultsFor = section.querySelector(".wsSearchResultsFor");
		resultsFor.classList.remove("d-none");
		resultsFor.innerHTML = resultsFor.innerHTML
			.replace(/{searchString}/g, wsQ)
			.replace(/{searchTotal}/g, wsScoreDB.length);

		// Prepare search string highlighting
		const regex =  new RegExp(wsQinternal, "gi");
		const searchHighlightMarkup = "<mark>$&</mark>";

		// Grab search result template
		const template = section.querySelector(".wsSearchResultTemplate").outerHTML;

		// Clear the results area
		wsSearchResults = section.querySelector(".wsSearchResults");
		wsSearchResults.innerHTML = "";
		wsSearchResults.classList.remove("d-none");

		// Let's show the results now
		wsScoreDB.forEach((entry, index) => {
			// Cut off text from the body, if necessary
			entry = wsCutOffText(entry);

			// Always mark the search result, but the class will determine what it'll look like
			entry.header = entry.header.replace(regex, searchHighlightMarkup);
			entry.body = entry.body.replace(regex, searchHighlightMarkup);

			// Replace all 'variables' with the value of this index
			let res = template
				.replace(/{index.*?}/gm, index + 1)
				.replace(/{page.*?}/gm, entry.page)
				.replace(/{anchor}/gm, entry.anchor)
				.replace(/{link}/gm, entry.page + (entry.anchor ? "#" + entry.anchor : ""))
				.replace(/{header.*?}/gm, entry.header)
				.replace(/{body.*?}/gm, entry.body)
				.replace(/{score}/gm, entry.score);

			// Variable used to store the class of the block in (used with 'load more')
			let blockClass = "";

			// Determine search results block class (if enabled) - used with 'load more'
			if (wsSearchLoadMore) {
				wsSearchResultsDivTotal = Math.floor(index / wsSearchLoadMoreBatch);
				blockClass = "wsSearchResultsBlock_" + wsSearchResultsDivTotal + (wsSearchResultsDivTotal > 0 ? " d-none" : "");
			}

			// Display the results
			wsSearchResults.innerHTML += "<div class='" + blockClass + "'>" + res + "</div>";
		});

		// Display 'load more' button (if enabled)
		wsShowLoadMore();

		// Hide loading icon
		wsToggleSpinner(false);
	} catch(err) {
		wsSearchShowError(err);
	}
}

// Alright, so my guy is searching for something and we got the database ready, let's browse through the json then...
function wsPerformSearch() {
	try {
		// Don't search for words that are too short
		wsQinternal = wsStripShortWords(wsQ);

		// Handle diacritics
		wsQinternal = wsHandleDiacritics(wsQinternal);

		// If nothing's left after stripping, we shouldn't perform a search
		if (wsQinternal.length !== 0) {
			// Prepare the regex, so it searches for all words in the search string
			wsQinternal = wsQinternal.replace(/ /g, "|");
			const regex =  new RegExp(wsQinternal, "gi");

			// If a match is found in the header, it's worth more than if a match is found in the body
			const scoreHeader = 3;
			const scoreBody = 1;

			// Loop through the database
			wsSearchDB.forEach(entry => {
				let countHeader = (entry.header.match(regex) || []).length;
				let countBody =  (entry.body.match(regex) || []).length;

				// If there's a match, save it
				if (countHeader > 0 || countBody > 0) {
					entry.score = countHeader * scoreHeader + countBody * scoreBody;
					const bodyPos = regex.exec(entry.body);
					entry.bodyPos = (bodyPos ? bodyPos.index : 0);
					wsScoreDB.push(entry);
				}
			});

			// Sort the wsScoreDB by score (highest score comes first)
			wsScoreDB = wsScoreDB.sort(function (a, b) {
				if (a.score > b.score)
					return -1;
				else
					return 1;
			});
		}

		// Display the results
		wsDisplayResults();
	} catch(err) {
		wsSearchShowError(err);
	}
}

// Get rid of words that are too short
function wsStripShortWords(q) {
	const section = document.querySelector(".witsec-search");
	const minChars = (!isNaN(section.dataset.wssearchminchars) ? section.dataset.wssearchminchars : 3);
	q = q.split(" ");
	q = q.filter(s => s.length >= minChars);
	q = q.join(" ").trim();
	return q;
}

// Read the online "database"
function wsReadDatabase() {
	let xhr = new XMLHttpRequest();
	let url = "assets/witsec-search/search.json" + "?" + Date.now();
	xhr.open("GET", url, true);
	xhr.onreadystatechange = function () {
		if (xhr.readyState == 4) {
			if (xhr.status == 200) {
				try {
					wsSearchDB = JSON.parse(xhr.responseText);
				}
				catch (e) {
					wsSearchShowError("Couldn't parse returned JSON");
				}

				wsPerformSearch();
			} else {
				wsSearchShowError("XHR status was not the expected 200");
			}
		}
	};
	xhr.send();
}

// Get search parameter (q)
function wsGetParameterByName(name) {
	const url = new URL(window.location.href);
	const searchParams = url.searchParams;

	let q = searchParams.get("q");
	if (q) {
		// Get rid of crap and return it
		q = q
			.replace(/<[^>]+>/g, "") // HTML tags
			.replace(/[^\s\-\u00BF-\u1FFF\u2C00-\uD7FF\w']/g, "") // Any unwanted characters other than letters (of any character set) and some other allowed chars
			.replace(/\n/g, " ")
			.trim();

		return (q === "" ? null : q);
	} else
		return null
}

// Show error if anything goes wrong
function wsSearchShowError(err) {
	console.error("Search: " + err);
	document.querySelector(".witsec-search .wsSearchError").classList.remove("d-none");
	wsToggleSpinner(false);
}

// Remove diacritics, then add variants of letters, so it doesn't matter if you're using diacritics in your search string or not - it'll search for anything
function wsHandleDiacritics(str) {
	const dc = {
		"a": ["à", "á", "â", "ã", "ä", "å", "ā", "ă", "ą"],
		"c": ["ç", "ć", "ĉ", "ċ", "č"],
		"d": ["ď"],
		"e": ["è", "é", "ê", "ë", "ē", "ĕ", "ė", "ę", "ě"],
		"g": ["ĝ", "ğ", "ġ", "ģ"],
		"h": ["ĥ"],
		"i": ["ì", "í", "î", "ï", "ĩ", "ī", "ĭ", "į"],
		"j": ["ĵ"],
		"k": ["ķ"],
		"l": ["ĺ", "ļ", "ľ"],
		"n": ["ñ", "ń", "ņ", "ň"],
		"o": ["ò", "ó", "ô", "ö", "õ", "ō", "ŏ", "ő"],
		"r": ["ŕ", "ŗ", "ř"],
		"s": ["ś", "ŝ", "ş", "š"],
		"t": ["ţ", "ť"],
		"u": ["ù", "ú", "û", "ü", "ũ", "ů", "ū", "ŭ", "ű", "ų"],
		"w": ["ŵ"],
		"y": ["ý", "ÿ", "ŷ"],
		"z": ["ź", "ż", "ž"]
	};

	// Replace any existing diacritics with their 'normal' counterpart
	str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, "")

	// Turn "lorem" into "l[o|ò|ó|ô|ö|õ|ō|ŏ|ő]rem". Not the most fancy way, but considering this runs on a client, it's fine
	for (const key in dc) {
		const r = "[" + key + "|" + dc[key].join("|") + "]";
		const regex = new RegExp(key, "gi");
		str = str.replace(regex, r);
	}

	return str;
}

// Cut off text if necessary
function wsCutOffText(entry) {
	const section = document.querySelector(".witsec-search");
	const searchMaxChars = (section.dataset.wssearchbodymaxchars !== undefined && !isNaN(section.dataset.wssearchbodymaxchars) ? section.dataset.wssearchbodymaxchars : "9999");

	// Check if we need to cutoff the body text
	if (entry.body.length > searchMaxChars) {
		let strStart = 0;
		let strEnd = searchMaxChars;
		let shifted = false;
		let endOfString = false;

		// If we need to shift, shift the body to the point where the first match is found (to not display results that don't have any of the matches mentioned)
		if (entry.bodyPos >= searchMaxChars) {
			shifted = true;
			if (entry.body.length - entry.bodyPos - 15 >= searchMaxChars) {					
				strStart = entry.bodyPos - 15;
			}
			else {
				strStart = entry.body.length - searchMaxChars;
				endOfString = true;
			}
		}
		entry.body = (shifted ? "..." : "") + entry.body.substr(strStart, strEnd).trim();

		// If the end of the string was *not* reached, add dots...
		if (!endOfString) {
			while (entry.body[entry.body.length-1] === ".")	// Remove trailing dots
				entry.body = entry.body.slice(0, -1);
			entry.body = entry.body.trim() + "...";
		}
	}

	return entry;
}

// Toggle the search spinner
function wsToggleSpinner(show) {
	const section = document.querySelector(".witsec-search");

	if (section.dataset.wssearchtitle) {
		if (show)
			section.querySelector(".wsSearchSpinner").classList.remove("d-none");
		else
			section.querySelector(".wsSearchSpinner").classList.add("d-none");
	}
}

// On local, use dummy data
function wsDummySearch() {
	wsQ = "lorem dummy";
	wsQinternal = "lorem|dummy";

	wsScoreDB = [
	{
		anchor: "what-is-lorem-ipsum",
		body: "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.",
		bodyPos: 0,
		header: "What is Lorem Ipsum?",
		page: "index.html",
		score: 5
	},
	{
		anchor: "origins",
		body: "Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of 'de Finibus Bonorum et Malorum' (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, 'Lorem ipsum dolor sit amet..', comes from a line in section 1.10.32.",
		bodyPos: 29,
		header: "Where does it come from?",
		page: "origins.html",
		score: 3
	},
	{
		anchor: "standard-passage",
		body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
		bodyPos: 0,
		header: "The standard Lorem Ipsum passage, used since the 1500s",
		page: "passage.html",
		score: 2
	}];

	wsDisplayResults();
}

// Show 'load more' button and add listener
function wsShowLoadMore() {
	const section = document.querySelector(".witsec-search");

	// If 'load more' is enabled and we have more than one results block
	if (wsSearchLoadMore && wsSearchResultsDivTotal > 0) {
		section.querySelector(".wsSearchLoadMore").classList.remove("d-none");
		section.querySelector(".wsSearchLoadMoreButton").addEventListener("click", function() {
			wsSearchResultsDiv += 1;
			const blocks = section.querySelectorAll(".wsSearchResultsBlock_" + wsSearchResultsDiv);
			for (const b of blocks)
				b.classList.remove("d-none")

			// Remove the 'load more' button if we've reached the end
			if (wsSearchResultsDiv === wsSearchResultsDivTotal)
				section.querySelector(".wsSearchLoadMore").classList.add("d-none");
		});
	}
}

// Display the spinner if needed - do this as soon as this gets
if (wsGetParameterByName("q") !== null)
	wsToggleSpinner(true);

// When you're ready, let's go
document.addEventListener("DOMContentLoaded", function(e) { 
	// Get query parameter
	wsQ = wsGetParameterByName("q");
	if (wsQ !== null) {
		if (window.location.href.startsWith("file://")) {
			alert("Unfortunately, the search feature only works online. We'll display dummy data instead.");
			wsDummySearch();
		}
		else
			wsReadDatabase();
	}

	// Remove GDPR block, if present
	const gdpr = document.querySelector(".witsec-search .gdpr-block");
	if (gdpr)
		gdpr.remove();
});