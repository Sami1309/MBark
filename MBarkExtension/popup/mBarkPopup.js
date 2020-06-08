//const log = chrome.extension.getBackgroundPage().console.log; //Note(Sam G): This failed to work for me?

const mBark = new class {		

	log = console.log;
	//log = chrome.extension.getBackgroundPage().console.log;
	kSentinel = "|";
	kSentinelRegex = "\\|";

	kSentinelStr(...args) {
		var str = "";
		args.forEach(arg => str+= mBark.kSentinel+arg);
		return str.substr(1);
	}

	// Note: This strips out empty elements [IE: 'a, or b,' -> 'a|b' instead of 'a||b|']
	TextToKSentinelStr(text) { 
		if(text.indexOf(mBark.kSentinel) != -1) mBark.log("Text String["+text+"] has mBark.kSentinel["+mBark.kSentinel+"] in it!"); //sanity check
		return text.replace(/\s*(?:,|(?:(?<=\s|^)or(?=\s|$)))\s*/gm, mBark.kSentinel).replace(new RegExp("(?:"+mBark.kSentinelRegex+"){2,}", "gm"), mBark.kSentinel).replace(new RegExp(mBark.kSentinelRegex+"+$", "gm"), ""); 
	}

	kSentinelStrToText(str)  { 
		var m = str.split(mBark.kSentinel);
		
		if(m.length > 1) {
			var n = m.slice(0, -1);
			return n.join(", ") + " or " + m[m.length-1];
		}

		return m.join(", ")
	}

	CourseCategories = {
		kCore: 			 		 "CS Major Core",
		kCommon: 				 "Common Requirements",
		
		kULCS: 					 "CS Upper Level",
		kFlexTech: 				 "CS Technical Elective",
		kGenElective: 			 "General Elective",
		kNotCounted: 			 "Not Counted",

		kHumanities: 			 "Humanities",
		kIntellectualBreadth: 	 "Intellectual Breadth",
		kIntellectualBreadth300: "Intellectual Breadth 300+"
	};

	CourseStatus = {
		kNotTaken: 		"Not Taken",
		kCompleted: 	"Completed",
		kInProgress : 	"In Progress",
	};

	CourseOpenStatus = {
		kOpen: 			"Open",
		kClosed: 		"Closed",
		kWeightList: 	"WeightListed"
	};

	Dom = {
		kBrowserId: 		"browser",
		kCreditTableBodyId: "creditTableBody",

		kAuditInfoId: 				"auditInfo",
		kAuditRefreshId: 			"auditRefresh",
		kAuditNameId: 				"auditName",
		kAuditDateId: 				"auditDate",
		kAuditResCreditsId: 		"auditResidentCredits",
		kAuditMajorResCreditsId:	"auditMajorResidentCredits",
		kAuditCumulativeGPAId: 		"auditCumulativeGPA",
		kAuditMajorGPAId: 			"auditMajorGPA",
		kAuditCTPId: 				"auditCTP",

		kMainPageId: 				"mainPage",
		kCategoryPageId: 			"categoryPage",
		kContentPageId: 			"content",
		kClassTableBodyId: 			"classTableBody",
		kCategoryTitleId: 			"categoryTitle",
		kCategoryBackButtonId: 		"categoryBackButton",
		kClassSearchButtonDivId: 	"classSearchButtonDiv",

		kStatusNotTakenClass: 		"statusNotTaken",
		kStatusCompletedClass: 		"statusCompleted",
		kStatusInProgressClass: 	"statusInProgress",

		kAuditIframeName: "auditIframe",
	};

	kAuditURL = "https://webapps.lsa.umich.edu/UGStuFileV2/App/AuditSumm/MyLSAAudChklst.aspx?_MBARK_=1";


	CourseStatusDomClass(status) {
		switch(status) {
			case mBark.CourseStatus.kNotTaken: 	 return mBark.Dom.kStatusNotTakenClass;
			case mBark.CourseStatus.kCompleted:  return mBark.Dom.kStatusCompletedClass;
			case mBark.CourseStatus.kInProgress: return mBark.Dom.kStatusInProgressClass;
			default: return "";
		}
	} 

	RecreateEventListener(element, eventName, func) {
		var elementClone = element.cloneNode(true);
		elementClone.addEventListener(eventName, func);
		element.parentNode.replaceChild(elementClone, element);		
	}


	Course = class {
		constructor(category, name, credits) {

			this.name = name;
			this.category = category; 
			this.credits = credits;

			this.status = mBark.CourseStatus.kNotTaken;

			this.grade = ""; //TODO: should this be a number?

			this.desciption = "";
			this.numberOfTimesAttempted = 0; //Warn: don't know how we are going to get this value...
		
			this.hash = name;
		}
	}

	VirtualCourse = class {
		constructor(category, distributionReq, courseLevel, credits) {
			
			this.isVirtual = true; //Note: data gets stored as JSON so this is needed to check if a course is virtual [Cannot use 'isinstance']
			this.category = category;
			this.distributionReq = distributionReq;
			this.courseLevel = courseLevel;
			this.credits = credits;

			this.creditsCompleted = 0;
			this.creditsInProgress = 0;
			this.courses = []; //courses used to fulfill the virtualCourse
			this.status = mBark.CourseStatus.kNotTaken;

			this.hash = category;
		}
	}

	// ---TODO: Pull these requirements from the audit in case they change
	StudentRequirements = {
		kCoreGPA: 2,
		kCumulativeGPA: 2,

		kCoreResidentCredit: 30,
		kResidentCredit: 50,

		kCreditsTowardsProgram: 128		
	};

	Student = class {

		constructor(courses) {

			this.courses = {};
			if(courses) {
				for(var i = 0; i < courses.length; ++i) this.courses[courses[i].hash] = courses[i];
			}
			
			this.name = "";
			this.lastCourseAudit = "";
			this.creditsInProgress = 0;	

			this.creditsTowardProgram = 0;
			this.residentCredits = 0;
			this.coreResidentCredits = 0;
			this.cumulativeGPA = 0;
			this.coreGPA = 0;

			this.searchCourses = []
		}

		static LoadFromData(studentData) {

			var student = new mBark.Student();
			student.name = studentData.name;
			student.courses = studentData.courses;			
			student.lastCourseAudit = studentData.lastCourseAudit;

			student.coreGPA = studentData.coreGPA;
			student.cumulativeGPA = studentData.cumulativeGPA;
			student.residentCredits = studentData.residentCredits;
			student.creditsInProgress = studentData.creditsInProgress;	
			student.coreResidentCredits = studentData.coreResidentCredits;
			student.creditsTowardProgram = studentData.creditsTowardProgram;

			return student;
		}

		CanTakeCourse(courseName) {
			return  {
				canTake: false,
				reason: "Not Offered"
			};
		}

		GetCourses(courseCategory) {
			var val = Object.values(this.courses);
			val.sort(function(a,b) {
				return 	a.category < b.category ? -1 : 
						a.category > b.category ? 1 : 0;
			});
			return val; 
		}

		AddSearchCourse(course) {
			this.searchCourses.push(course)
		}

		RemoveSearchCourse(course) {
			const index = this.searchCourses.indexOf(course)
			if(index > -1)
			{
				this.searchCourses.splice(index, 1)
			}
		}

		GetSearchCourses()
		{
			return this.searchCourses;
			//TODO alphabetize, add more information? just reference getcourses but specific indices?
		}

		ClearSearchCourses() {
			this.searchCourses = []
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
								mBark.log("Error: ShowText args Array not 1!");
								mBark.log(args);
							}

							args = args[0];
							blockStr+= mBark.kSentinel;
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
				const kCompletedRegex = /([0-9]*\.?[0-9]*)(?=\scompleted)/gm;
				const kCompleteAndProgressRegex = /([0-9]*\.?[0-9]*)(?=\scompleted\/in-progress)/gm;

				const kFieldRegex = new RegExp("((?<="+mBark.kSentinelRegex+")[^"+mBark.kSentinelRegex+"]*)", "gm");
				const kCourseRegex = new RegExp("(?<=^"+mBark.kSentinelRegex+")(?:(?:or )?(?:(?:[A-Z]+ [0-9]+)(?:(?:, | or |,? and | \\([^\\)]*\\), )[0-9]+)*)(?:, )?)+", "gm");
				const kCourseCommentRegex = new RegExp("\\([^\\)]*\\)", "gm");

				const kCourseNameRegex = /(^[A-Z]+.*)/gm;
				const kCourseNumbersRegexp = /([^A-Z]+)/gm; //Note: used after we split on kCourseSubjectRegex
				const kCourseSubjectRegex = /([A-Z]+ )/gm;
				const kCourseLastSubjectRegex = /([A-Z]+)(?=[^A-Z]+$)/gm;
				
				const kCourseFieldLength = 7;


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
						// mBark.log("S: "+str);
					} else {
						// mBark.log("N: "+str);
					}

					return str;
				}

				fastforward.current = function() { return fastforward.i >= student.textBlocks.length ? "" : student.textBlocks[fastforward.i]; }



				function LoadCourse(course, fields, fieldOffset=0) {
					
					if(fieldOffset+1 >= fields.length) {
						mBark.log("malformed course entry. Expected at least 1 fields after fieldOffset of: "+fieldOffset+" | fields: ");
						mBark.log(fields);
						return false;
					}

					// mBark.log(fields);

					// student fields[0] says 'Course' or 'GPA' when nothing is taken
					if(fields[fieldOffset].trim().length) {
						var creditStr = FindInStr(fields[fieldOffset+1], kRequiredRegex);
						if(!creditStr) return false;

						course.credits = parseFloat(creditStr);
						course.status = mBark.CourseStatus.kNotTaken;
					
					} else {

						var maxFieldOffset = fields.length - 7;
						if(fieldOffset > maxFieldOffset) {
							mBark.log("malformed completed course entry. Expected at least 7 fields after fieldOffset: "+fieldOffset+" | fields:");
							mBark.log(fields);
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
						course.status = course.grade == "*" ? mBark.CourseStatus.kInProgress : mBark.CourseStatus.kCompleted;
					}

					return {
						course: course,
						fieldOffset: fieldOffset
					}
				}

				function processCourses(searchStr, numberOfSearchResults=1) {
					
					for(var j = 0; j < numberOfSearchResults; ++j) {

						courseSearchLoop: 
						for(var str = fastforward(searchStr); str; str = fastforward.next()) {

							var courseStrs = FindInStr(str, kCourseRegex),
								fields = str.replace(courseStrs, "").match(kFieldRegex), //Note: strip course name to remote text-group breaks caused by multiline course names [Ex: MDE],
								fieldOffset = 1;

							// build courses  from 'and' split [Ex: {'CHEM 125|126', '130'} -> {'CHEM 125|126', 'CHEM 130'}]
							courseStrs = courseStrs.replace(kCourseCommentRegex, "").split("and");
							// mBark.log(str);
							// mBark.log(courseStrs);
							
							var oldSubject = "";
							for(var i = 0; i < courseStrs.length; ++i) {

								var courseStr =  courseStrs[i].trim(),
									courseKSentinelStr = mBark.TextToKSentinelStr(courseStr),
									courseName = FindInStr(courseKSentinelStr, kCourseNameRegex);

								// cache last subject or build course name from previous subject if subject is not found
								if(courseName) oldSubject = FindInStr(courseName, kCourseLastSubjectRegex);
								else courseName = oldSubject+" "+courseKSentinelStr;

								var course = student.courses[courseName];
								if(!course) {

									// mBark.log("NOT Found: "+courseName);
									break courseSearchLoop;
								}

								// mBark.log("Found: "+courseName);


								// generate valid course that fulfill this course
								var courseSubjects = courseName.match(kCourseSubjectRegex) || [],
									courseNumbers = courseName.match(kCourseNumbersRegexp) || [],
									validCourses = {};

								// sanity check
								if(courseSubjects.length != courseNumbers.length) {
									mBark.log("Warning - courseSubjects.length["+courseSubjects.length+"] != courseNumbers.length["+courseNumbers.length+"] For: "+courseName);
								}

								var len = courseSubjects.length < courseNumbers.length ? courseSubjects.length : courseNumbers.length;
								for(var k = 0; k < len; ++k) {
									
									var val = courseNumbers[k].split(mBark.kSentinel),
										valDict = {};

									for(var n = 0; n < val.length; ++n) {
										var v = val[n].trim();
										if(v) valDict[v] = true;
									}
									
									validCourses[courseSubjects[k].trim()] = valDict;
								}

								// Keep Loading courses until the course is valid
								var lastLoadableCourseOffset = fieldOffset;
								while(fieldOffset < fields.length) {
									
									var result = LoadCourse(course, fields, fieldOffset);
									if(!result) {

										// Reload last known good course - really should just cache the result, but to lazy to write a copy method
										// Warn: if copy method is written know that courses are loaded from memory as serialized data [not an instance of Course] 
										// 		so the copy function needs to be not part of the course class  
										LoadCourse(course, fields, lastLoadableCourseOffset);
										break;
									}
	
									lastLoadableCourseOffset = fieldOffset;
									fieldOffset = result.fieldOffset + kCourseFieldLength;

									var validCourse = validCourses[FindInStr(course.name, kCourseSubjectRegex).trim()];
									if(validCourse) {
										if(validCourse[FindInStr(course.name, kCourseNumbersRegexp).trim()]) {
											// mBark.log("BREAK: "+course.name);
											break;
										}
									}
									
									// mBark.log("CONTINUE: "+course.name);
								}
							}
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
								mBark.log("malformed virtual course entry. Expected at least "+minFields+" fields: "+str);
								break;
							}

							var creditHeader = fields[vOffset].trim();
							if(creditHeader.indexOf("Credits:") == -1) vCourse.status = mBark.CourseStatus.kCompleted;
							else {


								var creditField = fields[vOffset+1],
									creditsCompletedAndInProgress = parseFloat(FindInStr(creditField, kCompleteAndProgressRegex));

								vCourse.status = creditsCompletedAndInProgress > 0 ? mBark.CourseStatus.kInProgress : mBark.CourseStatus.kNotTaken;
								vOffset+= 2;
							}

							// mBark.log(vCourse.status);
							// mBark.log(creditHeader);
							
							vCourse.credits = 0;
							vCourse.creditsCompleted = 0;
							vCourse.creditsInProgress = 0;

							for(var offset = vOffset; offset < fields.length; offset+=kCourseFieldLength) {
								var result = LoadCourse(new mBark.Course(), fields, offset);
								if(!result) break;

								var credits = result.course.credits;
								switch(result.course.status) {
									case mBark.CourseStatus.kCompleted: vCourse.creditsCompleted+= credits;
									break;

									case mBark.CourseStatus.kInProgress: vCourse.creditsInProgress+= credits;
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
				student.name = FindInStr(str, new RegExp("(?<="+mBark.kSentinelRegex+"Degree Audit Report"+mBark.kSentinelRegex+"For:"+mBark.kSentinelRegex+")([^"+mBark.kSentinelRegex+"]*)", "gm")).trim();
				student.lastCourseAudit = FindInStr(str, new RegExp("(?<="+mBark.kSentinelRegex+"Generated On:"+mBark.kSentinelRegex+")([^"+mBark.kSentinelRegex+"]*)", "gm")).trim();

				student.creditsTowardProgram = parseFloat(FindInStr(str, new RegExp("(?<="+mBark.kSentinelRegex+"CTP"+mBark.kSentinelRegex+": )([0-9]+\.?[0-9]*)", "gm")));
				student.creditsInProgress = parseFloat(FindInStr(str, new RegExp("(?<="+mBark.kSentinelRegex+"In Progress:"+mBark.kSentinelRegex+" )([0-9]+\.?[0-9]*)", "gm")));
				student.cumulativeGPA = parseFloat(FindInStr(str, new RegExp("(?<="+mBark.kSentinelRegex+"GPA"+mBark.kSentinelRegex+": )([0-9]+\.?[0-9]*)", "gm")));

				// Process Core box 
				processCourses(/\(RQ (6667|(?:4789|4635)|4634|4685)\)/gm, 4);

				// Process Intellectual Breadth box
				processVCourses({
					vCourseSearchTerms: [/\(RQ (6387)\)/gm],
					vCourses: [ [student.courses[mBark.CourseCategories.kHumanities],  student.courses[mBark.CourseCategories.kIntellectualBreadth300], student.courses[mBark.CourseCategories.kIntellectualBreadth]] ],
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
					mBark.log("Error! - cumulativeGPA["+gpa+"] is different from header["+student.cumulativeGPA+"]?");
					student.cumulativeGPA = gpa;
				}

				// Process Core box
				processCourses(/\(RQ (5673|5659)\)/gm, 2);

				// Process Tech Elective Box 
				processVCourses({
					vCourseSearchTerms: [/\(RQ (5660)\)/gm],
					vCourses: [ [student.courses[mBark.CourseCategories.kULCS],  student.courses[mBark.CourseCategories.kFlexTech]] ],
					vCourseOffsets: [[0, 0]],
				});

				// Process CS Residency Box
				if(!(str = fastforward(/\(RQ (5675)\)/gm))) return;
				student.coreResidentCredits = parseFloat(FindInStr(str, kCompleteAndProgressRegex));

				if(!(str = fastforward.next())) return;
				student.coreGPA = parseFloat(FindInStr(str, kCompletedRegex));

				processVCourses({
					vCourseSearchTerms: [/.*/gm, null],
					vCourses: [ [student.courses[mBark.CourseCategories.kGenElective]], [student.courses[mBark.CourseCategories.kNotCounted]] ],
					vCourseOffsets: [[0], [1]],
				});


			})(this);

			mBark.log("Done Parsing credit PDF!");

			if(onComplete) onComplete();
		}	
	}

	AuditRequester = class {

		RequestAudit(onComplete) {

			//TODO: add a timeout feature to make sure we don't soft lock! 
			if(this.iframe) {
				mBark.log("Warning - Canceling old audit request");
				this.TerminateRequest()
			}

			this.onComplete = onComplete;

			this.iframe = document.createElement("iframe");
			this.iframe.src = mBark.kAuditURL;
			this.iframe.name = mBark.Dom.kAuditIframeName;

			this.waitingOnForm = false;
			this.waitingOnInputs = ["__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION" ];
			this.inputs = []

			var browser = document.getElementById(mBark.Dom.kBrowserId);
			browser.appendChild(this.iframe);
		}

		Update(auditMsg) {

			for(var i = this.waitingOnInputs.length-1; i >= 0; --i) {

				var inputName = this.waitingOnInputs[i],
					inputVal = auditMsg[inputName];
				
				if(inputVal) {
					this.inputs.push({
						name: inputName,
						value: inputVal
					});
				
					this.waitingOnInputs.pop();
				}

			}

			if(!this.waitingOnInputs.length) {
				
				if(this.waitingOnForm) {

					var pdf = auditMsg["PDF"];
					if(pdf) {

						mBark.log("GOT Audit PDF: "+pdf);
						if(this.onComplete) this.onComplete(pdf);
						this.TerminateRequest();
					}

				} else {
					mBark.log("Got All audit inputs - Submitting audit form...");					
					this.CreateAndSendForm();
					this.waitingOnForm = true;
				}
			}
		}


		CreateAndSendForm() {
			var form = document.createElement("form");

			form.target = mBark.Dom.kAuditIframeName;
			form.method = "post";
			form.action = mBark.kAuditURL;
			form.innerHTML = "<input type='hidden' name='ctl00$cphMain$rblType' value='pdf-auddet'>" +
							 "<input type='hidden' name='__EVENTTARGET' value='ctl00$cphMain$btnGen'>" +
							 "<input type='hidden' name='__EVENTARGUMENT' value=''>";

			var inputs = this.inputs;
			for(var i = 0; i < inputs.length; ++i) {
				var input = inputs[i];
				form.innerHTML+= "<input type='hidden' name='"+input.name+"' value='"+input.value+"'>";
			}

			this.iframe.appendChild(form);
			form.submit();
		}

		TerminateRequest() {
			this.iframe.parentNode.removeChild(this.iframe);
			this.iframe = undefined;
		}

	}


	gStudent = undefined;
	gAuditRequester = new this.AuditRequester;

	SaveMemory() {
		chrome.storage.local.set({'gStudent': mBark.gStudent}, function() {
			mBark.log("Saved Local Memory");
		});
	} 

	ResetMemory(callback) {

		chrome.storage.local.clear(function() {
			mBark.log("Reset Local Memory");
			if(typeof callback !== 'undefined') callback();
		});		
	}

	GetPreReqs(courseName) {
		return []; //return list of valid Courses
	}

	IsOpen(course) {
		return mBark.CourseOpenStatus.kClosed;
	}

	InitStudent(onLoadCallback) {

		// try to load from storage or create a blank one on fail
	    chrome.storage.local.get(['gStudent'], function(result) {

	    	var initFromMemory;
	    	if(result.gStudent) {

	    		initFromMemory = true;
	    		mBark.gStudent = mBark.Student.LoadFromData(result.gStudent);
	    		mBark.log("Loaded mBark.gStudent from storage:");
	    		mBark.log(mBark.gStudent);

	    	} else {

	    		initFromMemory = false;
				mBark.gStudent = new mBark.Student([
					new mBark.Course(mBark.CourseCategories.kCommon, "MATH 115", 4),
					new mBark.Course(mBark.CourseCategories.kCommon, "MATH 116", 4),
					new mBark.Course(mBark.CourseCategories.kCommon, "MATH 214", 4),
					new mBark.Course(mBark.CourseCategories.kCommon, mBark.kSentinelStr("MATH 215", "216"), 4),
					
					new mBark.Course(mBark.CourseCategories.kCommon, "ENGR 100", 3),
					new mBark.Course(mBark.CourseCategories.kCommon, mBark.kSentinelStr("ENGR 101", "151"), 4),
					
					new mBark.Course(mBark.CourseCategories.kCommon, mBark.kSentinelStr("CHEM 125", "126"), 1),
					new mBark.Course(mBark.CourseCategories.kCommon, "CHEM 130", 3),
					
					new mBark.Course(mBark.CourseCategories.kCommon, "PHYSICS 140", 4),
					new mBark.Course(mBark.CourseCategories.kCommon, "PHYSICS 141", 1),
					new mBark.Course(mBark.CourseCategories.kCommon, "PHYSICS 240", 4),
					new mBark.Course(mBark.CourseCategories.kCommon, "PHYSICS 241", 1),
				

					new mBark.Course(mBark.CourseCategories.kCore, "EECS 203", 4),
					new mBark.Course(mBark.CourseCategories.kCore, "EECS 280", 4),
					new mBark.Course(mBark.CourseCategories.kCore, "EECS 281", 4),
					new mBark.Course(mBark.CourseCategories.kCore, "EECS 370", 4),
					new mBark.Course(mBark.CourseCategories.kCore, "EECS 376", 4),
					new mBark.Course(mBark.CourseCategories.kCore, "EECS 496", 1),

					new mBark.Course(mBark.CourseCategories.kCore, "TCHNCLCM 300", 1),
					new mBark.Course(mBark.CourseCategories.kCore, "TCHNCLCM 497", 1),
					
					new mBark.Course(mBark.CourseCategories.kCore, mBark.kSentinelStr("STATS 250", "412", "426", "IOE 265", "EECS 301"), 4),
					new mBark.Course(mBark.CourseCategories.kCore, mBark.kSentinelStr("EECS 441", "467", "470", "473", "480", "481", "494", "495", "497"), 4),
					
					new mBark.VirtualCourse(mBark.CourseCategories.kHumanities, 			"HU",								"100+", 3),
					new mBark.VirtualCourse(mBark.CourseCategories.kIntellectualBreadth300, mBark.kSentinelStr("HU", "SS"), 	"300+", 3),
					new mBark.VirtualCourse(mBark.CourseCategories.kIntellectualBreadth, 	mBark.kSentinelStr("HU", "SS"), 	"100+", 16), //NOTE: This technically can be fulfilled with PCDC: https://bulletin.engin.umich.edu/ug-ed/reqs/#subnav-14
		
					new mBark.VirtualCourse(mBark.CourseCategories.kULCS, 		 "Upper Level CS", 		"100+", 16),
					new mBark.VirtualCourse(mBark.CourseCategories.kFlexTech, 	 "FlexTech", 			"100+", 10),
					new mBark.VirtualCourse(mBark.CourseCategories.kGenElective, "General Elective", 	"100+", 12), //TODO: Sam Confirm this
					new mBark.VirtualCourse(mBark.CourseCategories.kNotCounted,  "Not Counted", 		"100+", 0),
				]);

				mBark.log("Created default student");
	    	}

	    	if(onLoadCallback) onLoadCallback(initFromMemory);
	    });	
	}

	GenerateCategoryPage(category) {

		var categoryPage = document.getElementById(mBark.Dom.kCategoryPageId),
			mainPage 	 = document.getElementById(mBark.Dom.kMainPageId);

		mainPage.style.display = "none";		
		categoryPage.style.display = "";


		var title = document.getElementById(mBark.Dom.kCategoryTitleId);
		title.innerText = category;
				
		mBark.RecreateEventListener(document.getElementById(mBark.Dom.kCategoryBackButtonId), "click", function(e) {
			mBark.GenerateMainPage();
		});

		var courses = mBark.gStudent.GetCourses()

		//generate checkboxes

		//generate search button
		var content = document.getElementById(mBark.Dom.kClassTableBodyId);
		content.style.display = "";		
		content.innerHTML = "<tr><th>Class</th> <th>Status</th> <th>Credits</th> <th>Select</th></tr>";

		//TODO Make button search categories

		var buttonText = "",
			searchFn = undefined;
		switch(category) {

			case mBark.CourseCategories.kULCS: {
				buttonText = "Search ULCS";
			} break;

			case mBark.CourseCategories.kFlexTech: {
				buttonText = "Search FlexTech";
			} break;
			case mBark.CourseCategories.kGenElective: {
				buttonText = "Search Electives";
			} break;

			case mBark.CourseCategories.kHumanities: {
				buttonText = "Search Humanities";
			} break;

			case mBark.CourseCategories.kIntellectualBreadth: {
				buttonText = "Search LSA/HU";
			} break;

			case mBark.CourseCategories.kIntellectualBreadth300: {
				buttonText = "Search LSA/HU 300+";

			} break;

			default: {
				buttonText = "Search Classes";
			}			
		}

		var buttonDiv = document.getElementById(mBark.Dom.kClassSearchButtonDivId),
			button = document.createElement("button");		
		buttonDiv.innerHTML = "";

		button.innerHTML = buttonText;
		button.disabled = true;
		button.addEventListener("click", function(e) {

			mBark.log(e)
			//TODO OZAN  the classes to search for can be retrieved with mBark.gStudent.GetSearchCourses(), implement a function that queries the LSA course guide for those and redirects
			mBark.log("searching for selected classes")

			mBark.log("Classes are " + mBark.gStudent.GetSearchCourses())
			mBark.log(category)
			//if category == "CS Major Core" || category == "Common Requirements" , then search selected classes, otherwise search the whole category
			//var category = e.currentTarget.getAttribute("category");
			//mBark.log("CAT: "+category);
			
			//mBark.GenerateCategoryPage(category);
		});
		buttonDiv.appendChild(button);


		function updateButton() {
			button.disabled = !mBark.gStudent.searchCourses.length;			
		}

		for(var i = 0; i < courses.length; ++i)
		{
			var course = courses[i],
				courseArray = course.isVirtual ? course.courses : [course],
				selectCategory = course.category;

			if(selectCategory == category)
			{
				for(var j = 0; j < courseArray.length; ++j)
				{
					var row = document.createElement("tr")
				

					row.className = "myCourse";
				
					row.innerHTML = "<td>"+courseArray[j].name+"</td>" +
									"<td class='"+mBark.CourseStatusDomClass(courseArray[j].status)+"'>"+courseArray[j].status+"</td><td>"+courseArray[j].credits;

					
					var td = document.createElement("td"),
						input = document.createElement("input");

					input.type = 'checkbox';
					input.disabled = courseArray[j].status == mBark.CourseStatus.kCompleted;

					input.setAttribute("courseName", courseArray[j].name);
					input.addEventListener("click", function(e) {
						
						mBark.log(e);
						mBark.log(e.currentTarget);

						var elmt = e.currentTarget; 
						
						var courseName = elmt.getAttribute("courseName");
						if(elmt.checked) {
							mBark.log("Added course " + courseName  + " to search");
							mBark.gStudent.AddSearchCourse(courseName);						
						} else {
							mBark.log("Removed course " + courseName + " from search");
							mBark.gStudent.RemoveSearchCourse(courseName);							
						}

						updateButton();

					});

					td.appendChild(input);
					row.appendChild(td);

					content.appendChild(row);
				}
				
			}
		}
	}


	GenerateMainPage() {

		var categoryPage = document.getElementById(mBark.Dom.kCategoryPageId),
			mainPage 	 = document.getElementById(mBark.Dom.kMainPageId),
			table = document.getElementById(mBark.Dom.kCreditTableBodyId),
			content = document.getElementById(mBark.Dom.kClassTableBodyId);

		categoryPage.style.display = "none";
		content.style.display = "none"
		mainPage.style.display = "";

		mBark.gStudent.ClearSearchCourses();

		table.innerHTML = "<tr><th>Class</th> <th>Status</th> <th>Credits</th></tr>";

		var courses = mBark.gStudent.GetCourses(),
			categories = {};
		
		// group courses by category
		for(var i = 0; i < courses.length; ++i) {
			
			var course = courses[i],
				courseArray = course.isVirtual ? course.courses : [course],
				category = course.category;

			if(!categories[category]) {
				categories[category] = {
					name: category,
					status: mBark.CourseStatus.kNotTaken,
					creditsRequired: 0,
					creditsCompleted: 0,
					creditsInProgress: 0
				};
			}


			for(var j = 0; j < courseArray.length; ++j) {
				
				course = courseArray[j];
	
				// add up status
				switch(categories[category].status) {
					case mBark.CourseStatus.kNotTaken: categories[category].status = course.status;
					break;

					case mBark.CourseStatus.kCompleted: {
						if(course.status == mBark.CourseStatus.kInProgress || course.status == mBark.CourseStatus.kNotTaken) {
							categories[category].status = mBark.CourseStatus.kInProgress;
						} 
					} break;
				}

				// add up credits
				categories[category].creditsRequired+= course.credits;
				switch(course.status) {
					case mBark.CourseStatus.kCompleted: categories[category].creditsCompleted+= course.credits;
					break;

					case mBark.CourseStatus.kInProgress: categories[category].creditsInProgress+= course.credits;
					break;
				}
			}
		}
		categories = Object.values(categories);

		// generate table rows
		for(var i = 0; i < categories.length; ++i) {

			var row = document.createElement("tr"),
				category = categories[i];

			row.className = "reqCourse";
			row.setAttribute("category", category.name);
			
			row.innerHTML = "<td>"+category.name+"</td>" +
							"<td>"+category.status+"</td>" + 
							"<td class="+mBark.CourseStatusDomClass(category.status)+">"+(category.creditsCompleted + category.creditsInProgress)+"/"+category.creditsRequired+"</td>";
			
			table.appendChild(row);

			row.addEventListener("click", function(e) {

				var category = e.currentTarget.getAttribute("category");
				mBark.GenerateCategoryPage(category);
			});
		}

		mBark.log("Init creditTable");
	}

	UpdateAuditInfo() {

		function RequirementSpan(val, req, digits = 0) {
			var spanClass = val == 0 	? mBark.Dom.kStatusNotTakenClass :
							val >= req 	? mBark.Dom.kStatusCompletedClass :
										  mBark.Dom.kStatusInProgressClass;

			return "<span class="+spanClass+">"+Number.parseFloat(val).toFixed(digits)+"/"+Number.parseFloat(req).toFixed(digits)+"</span>";
		}

		document.getElementById(mBark.Dom.kAuditNameId).innerHTML = mBark.gStudent.name; 
		document.getElementById(mBark.Dom.kAuditDateId).innerHTML = mBark.gStudent.lastCourseAudit;
		
		document.getElementById(mBark.Dom.kAuditResCreditsId).innerHTML = RequirementSpan(mBark.gStudent.residentCredits, mBark.StudentRequirements.kResidentCredit);
		document.getElementById(mBark.Dom.kAuditMajorResCreditsId).innerHTML = RequirementSpan(mBark.gStudent.coreResidentCredits, mBark.StudentRequirements.kCoreResidentCredit);

		document.getElementById(mBark.Dom.kAuditCumulativeGPAId).innerHTML = RequirementSpan(mBark.gStudent.cumulativeGPA, mBark.StudentRequirements.kCumulativeGPA, 3);
		document.getElementById(mBark.Dom.kAuditMajorGPAId).innerHTML = RequirementSpan(mBark.gStudent.coreGPA, mBark.StudentRequirements.kCoreGPA, 3);

		document.getElementById(mBark.Dom.kAuditCTPId).innerHTML = RequirementSpan(mBark.gStudent.creditsTowardProgram, mBark.StudentRequirements.kCreditsTowardsProgram)+" ("+mBark.gStudent.creditsInProgress+" In Progress)";

		mBark.RecreateEventListener(document.getElementById(mBark.Dom.kAuditRefreshId), "click", function(e) {
			mBark.UpdateAudit();
		});
	}

	DisplayText() {
		mBark.log("some example text")
	}

	UpdateLSASearch() {

			// --TODO: CHECK FOR BUGS

		var requiredCourses = document.getElementsByClassName("reqCourse");

		for(var i = 0; i < requiredCourses.length; ++i) {

			var registerCourseElemt = requiredCourses[i], 
				registerCourseName = registerCourseElemt.innerText;
			
			registerCourseElemt.addEventListener("click", function(e) {
				
				var clickedCourseName = e.target.innerText;
				var str = clickedCourseName.split(" ");
				//clickedCourseName = clickedCourseName.replace(/ /g,'');
				mBark.log("Requesting info for: "+clickedCourseName);

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
								//mBark.log(elmt[i].href);
								if (((elmt[i].href).search(str[0]+str[1])) != -1) {
									lnk = elmt[i].href
								}
							}

							xhttp.abort();
							
							Next();

						} else {
							mBark.log("Failed to get response for xhttp request '"+this.responseURL+"' status: "+this.status);
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
								var elmt = responseDocument.getElementById("contentMain_lblEnfPre"); //ERROR? this sometimes is null 
							//var str = elmt.innerText;
							//str = str.replace(/ /g,'');
								mBark.log(elmt.innerText);
								var cs = [];
								elmt = elmt.innerText.split(" and ");
								mBark.log(elmt.length);
								for (var i = 0; i < elmt.length; ++i) {
									//mBark.log("hi");
									cs[cs.length] = elmt[i].split(" or ");

								}
					
								mBark.log(cs);
								for (var t1 = 0; t1 < cs.length; ++t1) {
									var app = cs[t1];
									for (var t2 = 0; t2 < app.length; ++t2) {
										mBark.log(app[t2]);
									}
									mBark.log(app.length);
								}
							//mBark.log(str);

							} else {
								mBark.log("Failed to get response for xhttp request '"+this.responseURL+"' status: "+this.status);
							}
						}
					};
					xhttp.open("GET", url, true);
					xhttp.send();
	            }

			});

		}

		mBark.log("Init LSA Search");
	}

	InitMessgePump() {
		// setup message pump for cross script communication
		chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
		 	
		 	if(!msg) return;
			
			switch(msg.TYPE) {
				case "PING": mBark.log("popup.js - got ping");
				break;

				case "auditInfo": {
					mBark.log("Got audit info message: ");
					mBark.log(msg);
					mBark.gAuditRequester.Update(msg);
				} break;

				default: {
					mBark.log("Received Unknown Message type["+msg.TYPE+"]. MSG:");
					mBark.log(msg);
				}
			}
		});

	}

	UpdateStudentDependencies() {
		mBark.UpdateAuditInfo();
		mBark.GenerateMainPage();
		mBark.UpdateLSASearch();						
	}

	UpdateAudit() {
	
		mBark.ResetMemory(); //flush old student in case its corrupt
		mBark.InitStudent(function(initFromMemory) {
	
			var content = document.getElementById(mBark.Dom.kContentPageId),
				auditInfo = document.getElementById(mBark.Dom.kAuditInfoId);
			
				content.style.display = "none";

				mBark.gAuditRequester.RequestAudit(function(pdf) {
					
					content.style.display = "";

					mBark.gStudent.ParsePDF(pdf, function() {
						mBark.UpdateStudentDependencies();
						mBark.SaveMemory();
					});

				});
		});
	}

	Init() {

		mBark.InitMessgePump();

		window.addEventListener("load", function(e) { 
			mBark.log("Popup Ready!");

			// // WARNING: DEBUGGING!
			// mBark.ResetMemory();

			mBark.InitStudent(function(initFromMemory) {

				// // WARNING: DEBUGGING
				// mBark.gStudent.ParsePDF("../files/auditSamG.pdf", function() {
				// 	mBark.UpdateStudentDependencies()
				// });


				if(initFromMemory) mBark.UpdateStudentDependencies();
				else mBark.UpdateAudit();
			
			});
		});	
	}
};
mBark.Init();