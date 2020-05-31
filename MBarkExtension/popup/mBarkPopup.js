
function InitLSASearch() {

	var requiredCourses = document.getElementsByClassName("reqCourse");

	for(var i = 0; i < requiredCourses.length; ++i) {

		var registerCourseElemt = requiredCourses[i], 
			registerCourseName = registerCourseElemt.innerText;
		
		console.log(registerCourseElemt);

		registerCourseElemt.addEventListener("click", function(e) {
			
			var clickedCourseName = e.target.innerText;
			console.log("Requesting info for: "+clickedCourseName);

			// send out webrequest
			var url = "https://umich.edu",
				xhttp = new XMLHttpRequest();

			xhttp.onreadystatechange = function() {
				if(this.readyState == XMLHttpRequest.DONE) {
					
					// request succeeded
					if(this.status == 200) {
						
						// parse the http response into a separate document 
						var responseDocument = document.implementation.createHTMLDocument("responeDocument");
						responseDocument.write(this.responseText);


						// TODO: OZAN IMPLENT THIS WITH SOME COOL STUFF
						var elmts = responseDocument.getElementsByClassName("clear");
						console.log(elmts);

					} else {
						console.log("Failed to get response for xhttp request '"+this.responseURL+"' status: "+this.status);
					}
				}
			};
			xhttp.open("GET", url, true);
			xhttp.send();

		});

		console.log("Registering required course: "+registerCourseName);
	}

}

window.addEventListener("load", function(e) { 
	console.log("Popup Ready!");

	InitLSASearch();


});