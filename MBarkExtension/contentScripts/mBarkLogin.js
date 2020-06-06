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

// Note: This doesn't work on login fail attempt (url gets passed in post data)
// TODO: think of way to hadled login fail 
if(ParseUrl(location.href).getData["https://webapps.lsa.umich.edu/UGStuFileV2/App/AuditSumm/MyLSAAudChklst.aspx?_MBARK_"]) {
	console.log("MBARK weblogon detected - hidding scrollbar");
	var html = document.getElementsByTagName("html")[0];
	html.className = "mBarkHideScrollbar";
}