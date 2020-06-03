const log = chrome.extension.getBackgroundPage().console.log;

class Course {
	constructor(name, credits) {
		this.name = name;
		this.credits = credits;
		this.creditsCompleted = 0;
	}
}
gCourses = undefined;

function SaveCourses() {
	chrome.storage.sync.set({'gCourses': gCourses}, function() {
		log("saved courses");
	});
} 

function ResetMemory(callback) {
	chrome.storage.sync.clear(function() {
		log("Reset Memory");
		if(typeof callback !== 'undefined') callback();
	});
}

function InitCourses(onLoadCallback) {

	// try to load from storage or create a blank one on fail

    chrome.storage.sync.get(['gCourses'], function(result) {

    	if(result.gCourses) {

    		gCourses = result.gCourses;
    		console.log("Loaded courses from storage");

    	} else {
			gCourses = [
				new Course("ENG 100", 4),
				new Course("ENG 101", 4),
				new Course("CHEM 125", 1),
				new Course("CHEM 126", 1),
				new Course("CHEM 130", 3),
				new Course("PHYS 140", 4),
				new Course("PHYS 141", 1),
				new Course("PHYS 240", 4),
				new Course("PHYS 241", 1),
				new Course("MATH 115", 4),
				new Course("MATH 116", 4),
				new Course("MATH 214", 4),
				new Course("MATH 215", 4),
				new Course("EECS 203", 4),
				new Course("EECS 280", 4),
				new Course("EECS 281", 4),
				new Course("EECS 370", 4),
				new Course("EECS 376", 4),
				new Course("EECS 496", 2),
				new Course("STATS 250", 3),
				new Course("TCHNCLCM 300", 1),
				new Course("TCHNCLCM 497", 2)
			];

			SaveCourses();    	
			log("Created default courses");
    	}

		if(typeof onLoadCallback !== 'undefined') onLoadCallback();
    });
}

function InitPopupPage() {

	var table = document.getElementById("creditTable");

	for(var i = 0; i < gCourses.length; ++i) {

		var row = document.createElement("tr"),
			course = gCourses[i];

		row.innerHTML = "<td class='reqCourse'>"+course.name+"</td><td>"+course.creditsCompleted+"</td><td>"+course.credits+"</td>"
		table.appendChild(row);
	}

	log("Init creditTable");
}

function InitLSASearch() {

	var requiredCourses = document.getElementsByClassName("reqCourse");

	for(var i = 0; i < requiredCourses.length; ++i) {

		var registerCourseElemt = requiredCourses[i], 
			registerCourseName = registerCourseElemt.innerText;
		
		registerCourseElemt.addEventListener("click", function(e) {
			
			var clickedCourseName = e.target.innerText;
			var str = clickedCourseName.split(" ");
			//clickedCourseName = clickedCourseName.replace(/ /g,'');
			log("Requesting info for: "+clickedCourseName);

			// send out webrequest
			var url = "https://www.lsa.umich.edu/cg/cg_results.aspx?termArray=f_20_2310&show=1&department=" + str[0] + "&catalog=" + str[1],
				xhttp = new XMLHttpRequest();

			var lnk = "";

			xhttp.onreadystatechange = function() {
				if(this.readyState == XMLHttpRequest.DONE) {
					
					// request succeeded
					if(this.status == 200) {
						
						// parse the http response into a separate document 
						var responseDocument = document.implementation.createHTMLDocument("responeDocument");
						responseDocument.write(this.responseText);

						// TODO: OZAN IMPLENT THIS WITH SOME COOL STUFF
						//var elmt = responseDocument.getElementsByTagName("a");
						var elmt = responseDocument.links;
						for (i = 0; i < elmt.length; i++) {
							//log(elmt[i].href);
							if (((elmt[i].href).search(str[0]+str[1])) != -1) {
								lnk = elmt[i].href
							}
						}

						xhttp.abort();
						
						Next();

					} else {
						log("Failed to get response for xhttp request '"+this.responseURL+"' status: "+this.status);
					}
				}
			};
			xhttp.open("GET", url, true);
			xhttp.send();

			function Next() {
            	lnk = lnk.split("?");
			// send out webrequest
			//url = "https://www.lsa.umich.edu/cg/cg_detail.aspx?content=2310"+clickedCourseName+"001",
				//xhttp = new XMLHttpRequest();
				url = "https://www.lsa.umich.edu/cg/cg_detail.aspx?"+lnk[lnk.length-1],
					xhttp = new XMLHttpRequest();

				xhttp.onreadystatechange = function() {
					if(this.readyState == XMLHttpRequest.DONE) {
					
					// request succeeded
						if(this.status == 200) {
						
						// parse the http response into a separate document 
							var responseDocument = document.implementation.createHTMLDocument("responeDocument");
							responseDocument.write(this.responseText);


						// TODO: OZAN IMPLENT THIS WITH SOME COOL STUFF
							var elmt = responseDocument.getElementById("contentMain_lblEnfPre");
						//var str = elmt.innerText;
						//str = str.replace(/ /g,'');
							log(elmt.innerText);
						//log(str);

						} else {
							log("Failed to get response for xhttp request '"+this.responseURL+"' status: "+this.status);
						}
					}
				};
				xhttp.open("GET", url, true);
				xhttp.send();
            }

		});

	}

	log("Init LSA Search");
}

window.addEventListener("load", function(e) { 
	console.log("Popup Ready!");

	InitCourses(function() {

		InitPopupPage();
		InitLSASearch();

		SaveCourses();
	});


});
