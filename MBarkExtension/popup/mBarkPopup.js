//const log = chrome.extension.getBackgroundPage().console.log; //Note(Sam G): This failed to work for me?
const log = console.log;

const CourseCategories = {
	kCore: 			 		 "CS Major Core",
	kCommon: 				 "Common Requirements",
	
	kULCS: 					 "Upper Level CS",
	kFlexTech: 				 "CS Technical Elective",
	kGenElective: 			 "General Elective",
	kNotCounted: 			 "Not Counted",

	kHumanities: 			 "Humanities",
	kIntellectualBreadth: 	 "Intellectual Breadth",
	kIntellectualBreadth300: "Intellectual Breadth 300+"
};

const kSentinel = "|";
const kSentinelRegex = "\\|";

function kSentinelStr(...args) {
	var str = "";
	args.forEach(arg => str+= kSentinel+arg);
	return str.substr(1);
}

// Note: This strips out empty elements [IE: 'a, or b' -> 'a|b' instead of 'a||b']
function TextToKSentinelStr(text) { 
	if(text.indexOf(kSentinel) != -1) log("Text String["+text+"] has kSentinel["+kSentinel+"] in it!"); //sanity check
	return text.replace(/\s*(?:,|(?:(?<=\s|^)or(?=\s|$)))\s*/gm, kSentinel).replace(new RegExp("(?:"+kSentinelRegex+"){2,}", "gm"), kSentinel); 
}

function kSentinelStrToText(str)  { 
	var m = str.split(kSentinel);
	
	if(m.length > 1) {
		var n = m.slice(0, -1);
		return n.join(", ") + " or " + m[m.length-1];
	}

	return m.join(", ")
}

const CourseStatus = {
	kNotTaken: 		"Not Taken",
	kCompleted: 	"Completed",
	kInProgress : 	"In Progress",
};

class Course {
	constructor(category, name, credits) {

		this.name = name;
		this.category = category; 
		this.credits = credits;

		this.status = CourseStatus.kNotTaken;

		this.grade = ""; //TODO: should this be a number?

		this.desciption = "";
		this.numberOfTimesAttempted = 0; //Warn: don't know how we are going to get this value...
	
		this.hash = name;
	}
}

class VirtualCourse {
	constructor(category, distributionReq, courseLevel, credits) {
		
		this.category = category;
		this.distributionReq = distributionReq;
		this.courseLevel = courseLevel;
		this.credits = credits;

		this.creditsCompleted = 0;
		this.creditsInProgress = 0;
		this.courses = []; //courses used to fulfill the virtualCourse
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
		this.residentCredits = 0;
		this.coreResidentCredits = 0;
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
		return residentCredits >= 50;
	}

	CSResidencyRequirementMeet() {
		return this.coreResidentCredits >= 30;
	}

	CreditsTowardsProgramMeet() {
		return this.creditsTowardProgram >= 128;
	}

	async ParsePDF(path, onComplete) {

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
		(function parseTextBlocks(student) {

			const kNeededRegex = /([0-9]*\.?[0-9]*)(?=\sneeded)/gm;
			const kRequiredRegex = /([0-9]*\.?[0-9]*)(?=\srequired)/gm;
			const kCompleteAndProgressRegex = /([0-9]*\.?[0-9]*)(?=\scompleted\/in-progress)/gm;

			const kFieldRegex = new RegExp("((?<="+kSentinelRegex+")[^"+kSentinelRegex+"]*)", "gm");
			const kCourseRegex = new RegExp("(?<=^"+kSentinelRegex+")(?:(?:or )?(?:(?:[A-Z]+ [0-9]+)(?:(?:, | or | \\([^\\)]*\\), )[0-9]+)*)(?:, )?)+", "gm");
			const kCourseCommentRegex = new RegExp("\\([^\\)]*\\)", "gm");


			//Note: makes life easier to be guaranteed a string result  
			function FindInStr(str, regex) { var r = str.match(regex); return r ? r[0] : ""; }


			var fastforward = function(searchTerm) {
				while(fastforward.i < student.textBlocks.length && student.textBlocks[fastforward.i].search(searchTerm) == -1) ++fastforward.i;
				return fastforward.next();
			};
			fastforward.i = 0;

			fastforward.next = function() {
				if(fastforward.i >= student.textBlocks.length-1) return "";
				var str = student.textBlocks[++fastforward.i];
				
				// check for end of page condition - skip over header.
				// Warn: This assumes headers are always encoded with the same number of lines
				if(!str) {
					fastforward.i+=6;
					str = fastforward.current();
					// log("S: "+str);
				} else {
					// log("N: "+str);
				}

				return str;
			}

			fastforward.current = function() { return fastforward.i >= student.textBlocks.length ? "" : student.textBlocks[fastforward.i]; }



			function LoadCourse(course, fields, fieldOffset=0) {
				
				if(fieldOffset+1 >= fields.length) {
					log("malformed course entry. Expected at least 1 fields after fieldOffset of: "+fieldOffset+" | fields: ");
					log(fields);
					return false;
				}

				// log(fields);

				// student fields[0] says 'Course' or 'GPA' when nothing is taken
				if(fields[fieldOffset].trim().length) {
					var creditStr = FindInStr(fields[fieldOffset+1], kRequiredRegex);
					if(!creditStr) return false;

					course.credits = parseFloat(creditStr);
					course.status = CourseStatus.kNotTaken;
				
				} else {

					var maxFieldOffset = fields.length - 7;
					if(fieldOffset > maxFieldOffset) {
						log("malformed completed course entry. Expected at least 7 fields after fieldOffset: "+fieldOffset+" | fields:");
						log(fields);
						return false;
					}

					course.name = fields[fieldOffset+2]+fields[fieldOffset+3];
					
					// fastforward until we get to the gpa section of a course (description can be multiple lines)
					course.desciption = "";
					while(true) {
						course.desciption+= " "+fields[fieldOffset+4];
						course.credits = parseFloat(fields[fieldOffset+5].trim());

						//keep building description
						if(isNaN(course.credits) && fieldOffset < maxFieldOffset) fieldOffset++;
						else break;
						
					}
					course.desciption = course.desciption.substr(1); // remove leading space
		
					course.grade = fields[fieldOffset+6].trim();
					course.status = course.grade == "*" ? CourseStatus.kInProgress : CourseStatus.kCompleted;
				}

				return {
					course: course,
					fieldOffset: fieldOffset
				}
			}

			function processCourses(searchStr, numberOfSearchResults=1) {
				
				// process Common Requirements - TODO: pull student out to function so we can reuese - add offset for multiline courses?
				for(var j = 0; j < numberOfSearchResults; ++j) {

					for(var str = fastforward(searchStr); str; str = fastforward.next()) {

						var courseStr = FindInStr(str, kCourseRegex),
							courseName = TextToKSentinelStr(courseStr.replace(kCourseCommentRegex, "")),
							course = student.courses[courseName];
						
						if(!course) break;

						var fields = str.replace(courseStr, "").match(kFieldRegex); //Note: strip course name to remote text-group breaks caused by multiline course names [Ex: MDE],
						if(!LoadCourse(course, fields, 1)) break;
					}
				}
			}

			// Warn: student assumes intellectual property classes are in the same order across all audit pdfs
			// Warn: student alters str and i
			function processVCourses(params) {

				var vCourseSearchTerms = params.vCourseSearchTerms;
				for(var n = 0; n < vCourseSearchTerms.length; ++n) {

					var vCourses = params.vCourses[n],
						vCourseOffsets = params.vCourseOffsets[n],
						vCoursesSearchTerm = vCourseSearchTerms[n];

					var str = vCoursesSearchTerm ? fastforward(vCoursesSearchTerm) : fastforward.current();
					for(var m = 0; str && m < vCourses.length; ++m, str = fastforward.next()) {

						var vCourse = vCourses[m],
							vOffset = vCourseOffsets[m] + 1, // ignore the name field
							minFields = vOffset + 3;

						var fields = str.match(kFieldRegex);

						if(fields.length < minFields) {
							log("malformed virtual course entry. Expected at least "+minFields+" fields: "+str);
							break;
						}

						var creditHeader = fields[vOffset].trim();
						if(creditHeader.indexOf("Credits:") == -1) vCourse.status = CourseStatus.kCompleted;
						else {

							var creditField = fields[vOffset+1],
								creditsCompletedAndInProgress = parseFloat(FindInStr(creditField, kCompleteAndProgressRegex));

							vCourse.status = creditsCompletedAndInProgress > 0 ? CourseStatus.kInProgress : CourseStatus.kNotTaken;
							vOffset+= 2;
						}

						for(var offset = vOffset; offset < fields.length; offset+=7 ) {
							var result = LoadCourse(new Course(), fields, offset);
							if(!result) break;

							var credits = result.course.credits;
							switch(result.course.status) {
								case CourseStatus.kCompleted: vCourse.creditsCompleted+= credits;
								break;

								case CourseStatus.kInProgress: vCourse.creditsInProgress+= credits;
								break;								
							} 
							vCourse.credits+= credits;

							vCourse.courses.push(result.course);
							offset = result.fieldOffset;
						}
					}

				} 
			}

			// Process pdf header		
			var str = fastforward.current();
			if(!str) return;
			student.name = FindInStr(str, new RegExp("(?<="+kSentinelRegex+"Degree Audit Report"+kSentinelRegex+"For:"+kSentinelRegex+")([^"+kSentinelRegex+"]*)", "gm")).trim();
			student.lastCourseAudit = FindInStr(str, new RegExp("(?<="+kSentinelRegex+"Generated On:"+kSentinelRegex+")([^"+kSentinelRegex+"]*)", "gm")).trim();

			student.creditsTowardProgram = parseFloat(FindInStr(str, new RegExp("(?<="+kSentinelRegex+"CTP"+kSentinelRegex+": )([0-9]+\.?[0-9]*)", "gm")));
			student.creditsInProgress = parseFloat(FindInStr(str, new RegExp("(?<="+kSentinelRegex+"In Progress:"+kSentinelRegex+" )([0-9]+\.?[0-9]*)", "gm")));
			student.cumulativeGPA = parseFloat(FindInStr(str, new RegExp("(?<="+kSentinelRegex+"GPA"+kSentinelRegex+": )([0-9]+\.?[0-9]*)", "gm")));

			// Process Core box 
			processCourses(/\(RQ (6667|4789|4634|4685)\)/gm, 4);

			// Process Intellectual Breadth box
			processVCourses({
				vCourseSearchTerms: [/\(RQ (6387)\)/gm],
				vCourses: [ [student.courses[CourseCategories.kHumanities],  student.courses[CourseCategories.kIntellectualBreadth300], student.courses[CourseCategories.kIntellectualBreadth]] ],
				vCourseOffsets: [[0, 0, 3]],
			});

			// Process Residency Box
			if(!(str = fastforward(/\(RQ (4000)\)/gm))) return;
			student.residentCredits = parseFloat(FindInStr(str, kCompleteAndProgressRegex));

			// Process GPA box
			if(!(str = fastforward(/\(RQ (3992)\)/gm))) return;
			student.coreResidentCredits = parseFloat(FindInStr(str, kCompleteAndProgressRegex));

			// sanity check - we already pulled this from the header, but this way we make sure it's the same value
			if(!(str = fastforward.next())) return;
			var gpa = parseFloat(FindInStr(str, /([0-9]*\.?[0-9]*)(?=\scompleted)/gm));
			if(student.cumulativeGPA != gpa) {
				log("Error! - cumulativeGPA["+gpa+"] is different from header["+student.cumulativeGPA+"]?");
				student.cumulativeGPA = gpa;
			}

			// Process Core box
			processCourses(/\(RQ (5673|5659)\)/gm, 2);

			// Process Tech Elective Box 
			processVCourses({
				vCourseSearchTerms: [/\(RQ (5660)\)/gm],
				vCourses: [ [student.courses[CourseCategories.kULCS],  student.courses[CourseCategories.kFlexTech]] ],
				vCourseOffsets: [[0, 0]],
			});

			// Process CS Residency Box
			if(!(str = fastforward(/\(RQ (5675)\)/gm))) return;
			student.coreResidentCredits = parseFloat(FindInStr(str, kCompleteAndProgressRegex));

			if(!(str = fastforward.next())) return;
			student.coreGPA = parseFloat(FindInStr(str, kCompleteAndProgressRegex));

			processVCourses({
				vCourseSearchTerms: [/.*/gm, null],
				vCourses: [ [student.courses[CourseCategories.kGenElective]], [student.courses[CourseCategories.kNotCounted]] ],
				vCourseOffsets: [[0], [1]],
			});


		})(this);

		log("DONE!");

		if(onComplete) onComplete();
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
				new Course(CourseCategories.kCommon, kSentinelStr("MATH 215", "216"), 4),
				
				new Course(CourseCategories.kCommon, "ENGR 100", 3),
				new Course(CourseCategories.kCommon, kSentinelStr("ENGR 101", "151"), 4),
				
				new Course(CourseCategories.kCommon, kSentinelStr("CHEM 125", "126"), 1),
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
				
				new Course(CourseCategories.kCore, kSentinelStr("STATS 250", "412", "426", "IOE 265", "EECS 301"), 4),
				new Course(CourseCategories.kCore, kSentinelStr("EECS 441", "467", "470", "473", "480", "481", "494", "495", "497"), 4),
				
				new VirtualCourse(CourseCategories.kHumanities, 			"HU",						"100+", 3),
				new VirtualCourse(CourseCategories.kIntellectualBreadth300, kSentinelStr("HU", "SS"), 	"300+", 3),
				new VirtualCourse(CourseCategories.kIntellectualBreadth, 	kSentinelStr("HU", "SS"), 	"100+", 16), //NOTE: This technically can be fulfilled with PCDC: https://bulletin.engin.umich.edu/ug-ed/reqs/#subnav-14
	
				new VirtualCourse(CourseCategories.kULCS, 		 "Upper Level CS", 		"100+", 16),
				new VirtualCourse(CourseCategories.kFlexTech, 	 "FlexTech", 			"100+", 10),
				new VirtualCourse(CourseCategories.kGenElective, "General Elective", 	"100+", 12), //TODO: Sam Confirm this
				new VirtualCourse(CourseCategories.kNotCounted,  "Not Counted", 		"100+", 0),
			]);

			SaveStudent();    	
			log("Created default courses");
    	}

    	gStudent.ParsePDF("../files/auditSamG.pdf", onLoadCallback);
    });	
}

function InitPopupPage() {

	var table = document.getElementById("creditTable");

	sum = 0;
	courses = gStudent.GetCourses();
	for(var i = 0; i < courses.length; ++i) {

		var row = document.createElement("tr"),
			course = courses[i];

		row.innerHTML = "<td class='reqCourse'>"+kSentinelStrToText(course instanceof VirtualCourse ? course.category : course.name)+"</td><td>"+course.status+"</td><td>"+course.credits+"</td>"
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
							var cs = [];
							elmt = elmt.innerText.split(" and ");
							log(elmt.length);
							for (var i = 0; i < elmt.length; ++i) {
								//log("hi");
								cs[cs.length] = elmt[i].split(" or ");
							}
							
							log(cs);
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
