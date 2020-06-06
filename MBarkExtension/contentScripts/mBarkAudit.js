function ParseUrl(url) {

	var getStart = url.indexOf("?");

	var getEnd = url.indexOf("#");
	if(getEnd == -1) getEnd = url.length;

	var parsedUrl = {getData: {}};

	if(getStart == -1) parsedUrl.base = url.substr(0, getEnd);
	else {

		parsedUrl.base = url.substr(0, getStart);

		var getstr = url.substring(getStart+1, getEnd).replace(/\+/g, " "),
			getArray = getstr.split("&");
	
		for(var i = 0, len = getArray.length; i < len; ++i) {

			var kv = getArray[i].split("=", 2),
				key = kv[0],
				val = (kv.length == 2) ? decodeURIComponent(kv[1]) : null;
			
			parsedUrl.getData[decodeURIComponent(key)] = val;;
		}
	}
	parsedUrl.hashData = url.substr(getEnd+1);
	return parsedUrl;
}

if(ParseUrl(location.href).getData["_MBARK_"]) {

	// hide content
	// TODO: make this look good
	//		 this takes ~5 - 10 seconds to complete so make sure we have a proper loading screen!	
	console.log("MBARK audit detected - Hiding page");

	var html = document.getElementsByTagName("html")[0],
		loadingDiv = document.createElement("div");

	html.className = "mBarkWrapper";
	loadingDiv.className = "mBarkLoading";
	loadingDiv.innerHTML = "<p>Generating Course Audit PDF...</p>";
	html.appendChild(loadingDiv);


	// report the most recent audit to the popup
	window.addEventListener("load", function(e) {
	

		var info = {
			TYPE: "auditInfo",
			__VIEWSTATE: document.getElementsByName("__VIEWSTATE"),
			__VIEWSTATEGENERATOR: document.getElementsByName("__VIEWSTATEGENERATOR"),
			__EVENTVALIDATION: document.getElementsByName("__EVENTVALIDATION"),
			PDF: ""
		};

		if(info.__VIEWSTATE.length) info.__VIEWSTATE = info.__VIEWSTATE[0].value;
		if(info.__VIEWSTATEGENERATOR.length) info.__VIEWSTATEGENERATOR = info.__VIEWSTATEGENERATOR[0].value;
		if(info.__EVENTVALIDATION.length) info.__EVENTVALIDATION = info.__EVENTVALIDATION[0].value;

		var rows = document.getElementById("ctl00_cphMain_gvAuditHist").children[0].children;
		for(var i = 0; i < rows.length; ++i) {
			
			var trChildren = rows[i].children;
			if(trChildren.length > 3 && trChildren[3].innerText.trim() == "Audit Detail") {
				
				var tdChildren = trChildren[0].children;
				if(tdChildren.length < 1) break; 

				info.PDF = tdChildren[0].href;
				break;
			}
		}

		// console.log("Sending Audit Info: ");
		// console.log(info);
		chrome.runtime.sendMessage(info);
	});
}