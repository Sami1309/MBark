
chrome.runtime.onInstalled.addListener(function() {

	chrome.storage.sync.set({credits: {}}, function() {
		console.log("Initialized credit storage");
	});

});