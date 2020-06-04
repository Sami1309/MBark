// const log = chrome.extension.getBackgroundPage().console.log; //Note(Sam G): This failed to work for me?
const log = console.log;

const CourseCategories = {
	kCore: 			 		 "CS Major Core",
	kCommon: 				 "Common Requirements",
	
	kULCS: 					 "Upper Level CS",
	kFlexTech: 				 "CS Technical Elective",
	kGenElective: 			 "General Elective",

	kHumanities: 			 "Humanities",
	kIntellectualBreadth: 	 "Intellectual Breadth",
	kIntellectualBreadth300: "Intellectual Breadth 300+"
};

const kSentinel = "|";

const CourseStatus = {
	kNotTaken: "Not Taken",
	kFailed: "Failed",
	kPassed: "Passed",
	kInProgress : "In Progress"
};

class Course {
	constructor(category, name, credits) {

		this.name = name;
		this.category = category; 
		this.credits = credits;

		this.status = CourseStatus.kNotTaken;

		this.grade = ""; //TODO: should this be a number?
		this.numberOfTimesAttempted = 0;
	
		this.hash = name;
	}
}

class VirtualCourse {
	constructor(category, distributionReq, courseLevel, credits) {
		
		this.category = category;
		this.distributionReq = distributionReq;
		this.courseLevel = courseLevel;
		this.credits = credits;

		this.status = CourseStatus.kNotTaken;
	
		this.hash = category;
	}
}

class Student {

	constructor(courses) {

		this.courses = {};
		for(var i = 0; i < courses.length; ++i) this.courses[courses[i].hash] = courses[i];
		
		this.name = "";
		this.lastCourseAudit = "";
		this.creditsInProgress = 0;	

		this.creditsTowardProgram = 0;
		this.residentCourseCount = 0;
		this.coreResidentCourseCount = 0;
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
		return Object.values(this.courses);
	}

	CoreGPAMeet() {
		return this.coreGPA >= 2;
	}

	CummulativeGPAMeet() {
		return this.cumulativeGPA >= 2.0;
	}

	ResidencyReqMeet() {
		return residentCourseCount >= 50;
	}

	CSResidencyRequirementMeet() {
		return this.coreResidentCourseCount >= 30;
	}

	CreditsTowardsProgramMeet() {
		return this.creditsTowardProgram >= 128;
	}

	async ParsePDF(path) {

		// strip all the text block from the pdf
		var pdfDoc = await pdfjsLib.getDocument(path).promise;
		this.textBlocks = [];

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

		// Note: this assumes that COE CS audit pdfs all share the same format
		// for() 

		log(this.textBlocks);
		if(!this.textBlocks.length) return;

		var i = 0,
			str = this.textBlocks[i];

		// Process pdf header		
		this.name = str.match(/(?<=\|Degree Audit Report\|For:\|)([^\|]*)/gm)[0].trim();
		this.lastCourseAudit = str.match(/(?<=\|Generated On:\|)([^\|]*)/gm)[0].trim();

		this.creditsTowardProgram = str.match(/(?<=\|CTP\|: )([0-9]+.?[0-9]*)/gm)[0];
		this.creditsInProgress = str.match(/(?<=\|In Progress:\| )([0-9]+.?[0-9]*)/gm)[0];
		this.cumulativeGPA = str.match(/(?<=\|GPA\|: )([0-9]+.?[0-9]*)/gm)[0];
			
		// skip to Math Requirement


		for(++i; i < this.textBlocks.length && (str = this.textBlocks[i]).search(/\|\(RQ 6667\)/gm) == -1; ++i);
		if(i == this.textBlocks.length) return;

		str = this.textBlocks[++i];

		var courseName = str.match(/(?<=^\|)(?:(?:or )?(?:(?:[A-Z]+ [0-9]+)(?:, [0-9]+)*)(?:, )?)+/gm)[0];
		var course = courses[courseName]
		if(!course) {
			log("Course '"+courseName+"' not found in course dictionary!");
			// continue;
		}

		// course. 


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

function SaveStudent() {
	chrome.storage.sync.set({'gStudent': gStudent}, function() {
		log("saved courses");
	});
} 

function ResetMemory(callback) {
	chrome.storage.sync.clear(function() {
		log("Reset Memory");
		if(typeof callback !== 'undefined') callback();
	});
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
			

				new Course(CourseCategories.kCore, "EECS 203", 4),
				new Course(CourseCategories.kCore, "EECS 280", 4),
				new Course(CourseCategories.kCore, "EECS 281", 4),
				new Course(CourseCategories.kCore, "EECS 370", 4),
				new Course(CourseCategories.kCore, "EECS 376", 4),
				new Course(CourseCategories.kCore, "EECS 496", 1),

				new Course(CourseCategories.kCore, "TCHNCLCM 300", 1),
				new Course(CourseCategories.kCore, "TCHNCLCM 497", 1),
				
				new Course(CourseCategories.kCore, "STATS 250 "+kSentinel+" STATS 412"+kSentinel+" STATS 426"+kSentinel+" IOE 265"+kSentinel+" EECS 301", 4),
				new Course(CourseCategories.kCore, "EECS 441 "+kSentinel+" EECS 467 "+kSentinel+" EECS470 "+kSentinel+" EECS 473 "+kSentinel+" EECS 480 "+kSentinel+" EECS 494 "+kSentinel+" EECS 495"+kSentinel+" EECS 497", 4),
				
				new VirtualCourse(CourseCategories.kHumanities, 			"HU",					"100+", 3),
				new VirtualCourse(CourseCategories.kIntellectualBreadth300, "HU "+kSentinel+" SS", 	"300+", 3),
				new VirtualCourse(CourseCategories.kIntellectualBreadth, 	"HU "+kSentinel+" SS", 	"100+", 16), //NOTE: This technically can be fulfilled with PCDC: https://bulletin.engin.umich.edu/ug-ed/reqs/#subnav-14
	
				new VirtualCourse(CourseCategories.kULCS, 		 "Upper Level CS", 		"100+", 16),
				new VirtualCourse(CourseCategories.kFlexTech, 	 "FlexTech", 			"100+", 10),
				new VirtualCourse(CourseCategories.kGenElective, "General Elective", 	"100+", 12), //TODO: Sam Confirm this
			]);

			SaveStudent();    	
			log("Created default courses");
    	}


    	gStudent.ParsePDF("../files/auditSamG.pdf");

		if(typeof onLoadCallback !== 'undefined') onLoadCallback();
    });	
}

function InitPopupPage() {

	var table = document.getElementById("creditTable");

	sum = 0;
	courses = gStudent.GetCourses();
	for(var i = 0; i < courses.length; ++i) {

		var row = document.createElement("tr"),
			course = courses[i];

		row.innerHTML = "<td class='reqCourse'>"+(course instanceof VirtualCourse ? course.category : course.name)+"</td><td>"+course.status+"</td><td>"+course.credits+"</td>"
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


	// WARNING: REMOVE THIS WHEN DONE - MEMORY GETS FLUSHED JUST FOR DEBUGGING
	ResetMemory();

	InitStudent(function() {

		InitPopupPage();
		InitLSASearch();

		SaveStudent();
	});

});
