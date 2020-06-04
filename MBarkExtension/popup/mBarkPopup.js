// const log = chrome.extension.getBackgroundPage().console.log; //Note(Sam G): This failed to work for me?
const log = console.log;

const CourseCategories = {
	kCommon: 				"Common Requirements",
	kIntellectualBreadth: 	"Intellectual Breadth",
	kMajorCore: 			"CS Major Core",
	
	kULCS: 					"Upper Level CS",
	kFlexTech: 				"CS Technical Elective",
	kGenElective: 			"General Elective",
};

const kSentinel = "|";

class Course {
	constructor(category, name, credits) {

		this.category = category; 
		this.name = name; 		//Math, phys
		this.credits = credits;

		this.grade = "";
		this.numberOfTimesAttempted = 0;
		this.passed = false;
	}
}

class VirtualCourse {
	constructor(category, distributionReq, courseLevel, credits) {
		this.category = category;
		this.distributionReq = distributionReq;
		this.courseLevel = courseLevel;
		this.credits = credits;
	}
}

class Student {

	constructor(coursesRequiredForGraduation) {

		this.coursesTake = [];
		this.coursesInProgress = [];
		this.coursesNeededForGraduation = coursesRequiredForGraduation;
	
		this.creditsTowardProgram = 0;
		this.creditsInProgress = 0;	
		this.residentClasses = 0;
		this.cumulativeGPA = 0;
		this.coreGPA = 0;
	}

	CanTakeCourse(courseName) {
		return  {
			canTake: false,
			reason: "Not Offered"
		};
	}

	GetCourses(courseCategory) {
		return [];
	}

	CoreGPAMeet() {
		return false;
	}

	CummulativeGPAMeet() {
		return false;
	}

	ResidencyReqMeet() {
		return false;
	}

	CSResidencyRequirementMeet() {
		return false;
	}

	CreditsTowardsProgramMeet() {
		return false;
	}

	CumulativeCreditsMeet() {
		return false;
	}


}

gCourses = undefined;
gStudent = undefined; //TODO: load this from memory

function GetPreReqs(courseName) {
	return []; //return list of valid Courses
}

const CourseOpenStatus = {
	kOpen: 			"Open",
	kClosed: 		"Closed",
	kWeightList: 	"WeightListed"
};

function IsOpen(course) {
	return CourseOpenStatus.kClosed;
}

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


async function ParsePDF(path, onComplete) {
	
		// Note: used to separate text groups in a text block
	this.textBlocks = [];

	// strip all the text block from the pdf
	var pdfDoc = await pdfjsLib.getDocument(path).promise;

	var n = pdfDoc._pdfInfo.numPages;
	for(var i = 1; i <= n; ++i) {

		var pdfPage = await pdfDoc.getPage(i),
			opList = await pdfPage.getOperatorList();

		var blockStr = "";
		for(var j = 0; j < opList.fnArray.length; ++j) {

			switch(opList.fnArray[j]) {
				case pdfjsLib.OPS.beginText: blockStr = "";
				break;

				case pdfjsLib.OPS.showText: {
					var args = opList.argsArray[j];
					
					// sanity check - there is like 0 documentation on this stuff, but I believe this is always 1 arg
					if(args.length != 1) {
						log("Error: ShowText args Array not 1!");
						log(args);
					}

					args = args[0];
					blockStr+= kSentinel;
					for(var x = 0; x < args.length; ++x) blockStr+= args[x].unicode; 

				} break;

				case pdfjsLib.OPS.endText: this.textBlocks.push(blockStr);
				break;
			}
		}
	}

	log(this.textBlocks);

	// parse the text blocks to pull out meaningful data


	if(onComplete) onComplete(this);
}

function InitStudent(onLoadCallback) {

	// try to load from storage or create a blank one on fail
    chrome.storage.sync.get(['gStudent'], function(result) {

    	if(result.gStudent) {

    		gStudent = result.gCourses;
    		console.log("Loaded gStudent from storage");

    	} else {
			gStudent = new Student([
				new Course(CourseCategories.kCommon, "MATH 115", 4),
				new Course(CourseCategories.kCommon, "MATH 116", 4),
				new Course(CourseCategories.kCommon, "MATH 214", 4),
				new Course(CourseCategories.kCommon, "MATH 215 "+kSentinel+" MATH 216", 4),
				
				new Course(CourseCategories.kCommon, "ENGR 100", 3),
				new Course(CourseCategories.kCommon, "ENGR 101 "+kSentinel+" ENGR 151", 4),
				
				new Course(CourseCategories.kCommon, "CHEM 125 "+kSentinel+" CHEM 126", 1),
				new Course(CourseCategories.kCommon, "CHEM 130", 3),
				
				new Course(CourseCategories.kCommon, "PHYSICS 140", 4),
				new Course(CourseCategories.kCommon, "PHYSICS 141", 1),
				new Course(CourseCategories.kCommon, "PHYSICS 240", 4),
				new Course(CourseCategories.kCommon, "PHYSICS 241", 1),
			

				new Course(CourseCategories.kMajorCore, "EECS 203", 4),
				new Course(CourseCategories.kMajorCore, "EECS 280", 4),
				new Course(CourseCategories.kMajorCore, "EECS 281", 4),
				new Course(CourseCategories.kMajorCore, "EECS 370", 4),
				new Course(CourseCategories.kMajorCore, "EECS 376", 4),
				new Course(CourseCategories.kMajorCore, "EECS 496", 1),
				new Course(CourseCategories.kMajorCore, "TCHNCLCM 300", 1),
				new Course(CourseCategories.kMajorCore, "TCHNCLCM 497", 1),
				new Course(CourseCategories.kMajorCore, "STATS 250 "+kSentinel+" STATS 412"+kSentinel+" STATS 426"+kSentinel+" IOE 265"+kSentinel+" EECS 301", 4),
				new Course(CourseCategories.kMajorCore, "EECS 441 "+kSentinel+" EECS 467 "+kSentinel+" EECS470 "+kSentinel+" EECS 473 "+kSentinel+" EECS 480 "+kSentinel+" EECS 494 "+kSentinel+" EECS 495"+kSentinel+" EECS 497", 4),
				

				new VirtualCourse(CourseCategories.kIntellectualBreadth, "HU", "100+", 3),
				new VirtualCourse(CourseCategories.kIntellectualBreadth, "HU "+kSentinel+" SS", "300+", 3),
				new VirtualCourse(CourseCategories.kIntellectualBreadth, "HU "+kSentinel+" SS", "100+", 16), //NOTE: This technically can be fulfilled with PCDC: https://bulletin.engin.umich.edu/ug-ed/reqs/#subnav-14
	
				new VirtualCourse(CourseCategories.kULCS, "Upper Level CS", "100+", 16),
				new VirtualCourse(CourseCategories.kFlexTech, "FlexTech", "100+", 10),
				new VirtualCourse(CourseCategories.kGenElective,  "General Elective", "100+", 12), //TODO: Sam Confirm this
			]);

			SaveCourses();    	
			log("Created default courses");
    	}

		if(typeof onLoadCallback !== 'undefined') onLoadCallback();
    });	
}

function InitPopupPage() {

	var table = document.getElementById("creditTable");

	sum = 0;
	courses = gStudent.coursesNeededForGraduation;
	for(var i = 0; i < courses.length; ++i) {

		var row = document.createElement("tr"),
			course = courses[i];

		row.innerHTML = "<td class='reqCourse'>"+(course instanceof VirtualCourse ? course.category : course.name)+"</td><td>"+course.creditsCompleted+"</td><td>"+course.credits+"</td>"
		table.appendChild(row);

		sum+= course.credits;
	}

	log("Init creditTable: "+ sum);
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

	ResetMemory();

	InitStudent(function() {

		InitPopupPage();
		InitLSASearch();

		SaveCourses();
	});

});
