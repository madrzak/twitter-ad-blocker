browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Received request: ", request);

    if (request.greeting === "hello")
        return Promise.resolve({ farewell: "goodbye" });
    
    if (request.adBlocked) {
        console.log(`Ad blocked: ${request.adBlocked}`);
        // Could be used for counting blocked ads or other statistics
        return Promise.resolve({ status: "recorded" });
    }
    
    if (request.adMarked) {
        console.log(`Ad marked: ${request.adMarked}`);
        // Could be used for counting marked ads or other statistics
        return Promise.resolve({ status: "recorded" });
    }
});

// Log when extension is installed or updated
browser.runtime.onInstalled.addListener((details) => {
    console.log("Twitter/X Ad Blocker & Marker installed/updated:", details.reason);
});

console.log("Twitter/X Ad Blocker & Marker background script running");
