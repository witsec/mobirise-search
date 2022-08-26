defineM("witsec-search", function (g, mbrApp, TR) {
	mbrApp.regExtension({
		name: "witsec-search",
		events: {
			load: function() {
				var a = this;
				var db = "";
				var pages = "";

				// Stop processing if the current website is AMP or M/M3
				if (mbrApp.isAMP() || mbrApp.theme.type === "primary" )
					return;

				// Add site settings
				a.addFilter("sidebarProjectSettings", function (b) {
					const ws = a.projectSettings["witsec-search"] || false;

					const c = {
						title: "witsec",
						name: "witsec-site-settings",
						html: [
							'<div class="form-group col-md-12">',
							'  <div class="row">',
							'    <label for="witsec-search" class="control-label col">' + TR("Search") + '</label>',
							'    <div class="togglebutton col-auto">',
							'      <label>',
							'        <input type="checkbox" name="witsec-search" id="witsec-search" ' + (ws ? "checked" : "") + '>',
							'        <span class="toggle" style="margin:0;"></span>',
							'      </label>',
							'    </div>',
							'  </div>',
							'</div>',
							'<div class="form-group col-md-12" id="witsec-search-editbtn-div" ' + (ws ? "" : 'style="display:none;"') + '>',
							'  <div class="row">',
							'    <div class="col-md-12">',
							'      <button class="btn btn-primary pull-right" id="witsec-search-editbtn" type="button">' + TR("Edit") + '</button>',
							'    </div>',
							'  </div>',
							'</div>'
						].join("\n")
					};
					b.push(c);
					return b
				});

				// Respond to enabling/disabling search by showing/hiding the edit button
				mbrApp.$body.on("change", "#witsec-search", function () {
					if ($("#witsec-search").prop("checked")) {
						$("#witsec-search-editbtn-div").show();

						// Open the settings window
						$("#witsec-search-editbtn").trigger("click");
					}
					else {
						$("#witsec-search-editbtn-div").hide();
						a.projectSettings["witsec-search"] = false;
					}
				});

				// Show settings window
				mbrApp.$body.on("click", "#witsec-search-editbtn", function () {
					a.projectSettings["witsec-search-excluded-sections"] = a.projectSettings["witsec-search-excluded-sections"] || "";
					a.projectSettings["witsec-search-excluded-pages"]    = a.projectSettings["witsec-search-excluded-pages"]    || "404.html";

					// Display modal window with settings
					mbrApp.showDialog({
						title: TR("Search Settings"),
						className: "witsec-search-modal",
						body: [
							'<form>',
							'<div class="form-group row">',
							'  <label for="witsec-search-to" class="col-sm-5 col-form-label">' + TR("Excluded Sections") + '</label>',
							'  <div class="col-sm-7">',
							'    <textarea class="form-control" style="height:188px; white-space:nowrap" id="witsec-search-excluded-sections" placeholder="One exclusion per line">' + a.projectSettings["witsec-search-excluded-sections"] + '</textarea>',
							'  </div>',
							'</div>',
							'<div class="form-group row">',
							'  <label for="witsec-search-to-alt" class="col-sm-5 col-form-label">' + TR("Excluded Pages") + '</label>',
							'  <div class="col-sm-7">',
							'    <textarea class="form-control" style="height:188px; white-space:nowrap" id="witsec-search-excluded-pages" placeholder="One excluded page per line">' + a.projectSettings["witsec-search-excluded-pages"] + '</textarea>',
							'  </div>',
							'</div>',
							'</form>'
						].join("\n"),
						buttons: [
							{
								label: TR("HELP"),
								default: false,
								callback: function () {
									let help = `
									<h4>Help - Search</h4>
				
									<i>Excluding sections</i><br>
									If you wish to exclude specific sections from being indexed, you can list a specific class, an id, etc. It'll take the exact same arguments as JavaScript's
									<a href="javascript:mbrApp.openUrl('https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector')">querySelector</a>. One exclusion per line.<br><br>

									Valid examples:<br>
									<code>.myClass<br>
									#sectionID<br>
									.thisClass.andAlsoThisOne</code><br><br>

									By default, all sections that have the <code>menu</code> class or a class that begins with <code>footer</code> will be excluded from being indexed. Buttons with the <code>btn</code>
									class will also be excluded. The same goes for sections or <u>any other element</u> with the <code>noindex</code> class.<br>
									Script, style and form tags will also be ignored.<br><br>

									<i>Excluded pages</i><br>
									To exclude an entire page from being indexed, simply mention the name of the page. One page per line.
									`;
				
									mbrApp.alertDlg(help);
									return false;
								}
							},
							{
								label: TR("CANCEL"),
								default: false,
								callback: function () {
								}
							},
							{
								label: TR("OK"),
								default: true,
								callback: function () {
									// Everything seems OK, let's save it
									a.projectSettings["witsec-search-excluded-sections"] = $("#witsec-search-excluded-sections").val();
									a.projectSettings["witsec-search-excluded-pages"]    = $("#witsec-search-excluded-pages").val();
									mbrApp.runSaveProject();
								}
							}
						]
					});
				});

				// Change the <a> submit button to an actual <button>
				a.Core.addFilter("getResultHTMLcomponent", function (html, block) {
					if (a.projectSettings["witsec-search"] && /<\s*section[^>]*witsec-search[^>]*>/gmi.test(html)) {
						html = html.replace(/(<\s*)a([^>]*type=['"]{1}submit['"]{1}[^>]*>[\w\W]*?)(<\/a>)/gmi, "$1button$2</button>");
					}

					return html;
				});

				// Add our own file to the list of to-publish files
				a.addFilter("publishFiles", function(b, c) {
					// Prepare the database for publishing and grab the list of pages
					db = [];
					pages = mbrApp.Core.getPages();

					if (a.projectSettings["witsec-search"]) {
						b.push(
							{ srcList: [{ src: "search.json", filter: "template" }], dest: "assets/witsec-search/search.json" }
						);
					}

					return b;
				});

				// Loop through all the files that need to be published (this is all CSS and HTML files, plus whatever we defined ourselves)
				a.addFilter("publishTemplating", function(html, filename) {
					if (a.projectSettings["witsec-search"]) {
						// Index any html pages if the filename has -not- been excluded
						if (filename.match(/.+(asp*|htm*|php*)/i) && !a.projectSettings["witsec-search-excluded-pages"].split("\n").includes(filename)) {
							wsIndexPage(filename, html);
						}
					}

					return filename == "search.json" ? JSON.stringify(db) : html;
				});

				function wsIndexPage(filename, html) {
					// Check if the page that's being indexed is an actual page (for example, the mailform generates a mail.php file, that's not an actual page in Mobirise)
					if (pages[filename] === undefined)
						return false;

					// Set title and description
					let pageTitle = pages[filename].settings.title || filename;
					let pageDesc = pages[filename].settings.meta_descr || "";

					// Exclusions
					let excludedSections = (a.projectSettings["witsec-search-excluded-sections"].trim() || "");
					if (excludedSections)
						excludedSections = excludedSections.split("\n").map(s => ":not(" + s + ")").join();
					excludedSections += ":not(.menu):not([class^=footer]):not(.noindex)";

					// Extract body contents of the HTML string
					const regex = /<body>([^]*)<\/body>/gmi;
					const match = regex.exec(html);

					if (match[1] !== undefined) {
						let htmlBody = wsHtmlToElement(match[1]);

						let sections = htmlBody.querySelectorAll("section" + excludedSections);
						sections.forEach(function(section, i) {
							let sectionHeader = "";
							let sectionBody = "";
						
							// Remove unwanted tags
							const removeEls = section.querySelectorAll("script, style, form, a.btn, .noindex");
							removeEls.forEach(s => {
								s.remove();
							});

							// Find the first header you find (H1-H6)
							for (let i=1; i<7; i++) {
								let el = section.querySelector("H" + i);

								if (el && el.innerText.trim() !== "") {
									sectionHeader = el.innerText.trim();
									el.remove();
									break;
								}
							}
							
							// Set the body, replace new lines, replace double spaces
							sectionBody = section.innerText.replace(/\n/g, " ").replace(/  +/g, " ").trim();
							
							// If nothing was found, do nothing. Otherwise, store it
							if (sectionHeader === "" && sectionBody === "") {
								// Do nothing
							} else {
								let hash = {};
								hash.page = filename;
								hash.anchor = section.id || "";
								hash.header = sectionHeader || pageTitle;
								hash.body = sectionBody || pageDesc;
								db[db.length] = hash;
							}
						});

						// Cleaning up
						htmlBody = null;
					}
				}

				// Turn a HTML string into a DOM object
				function wsHtmlToElement(html) {
					let template = document.createElement("template");
					template.innerHTML = html.trim();
					return template.content;
				}
			}
		}
	})
}, ["jQuery", "mbrApp", "TR()"]);