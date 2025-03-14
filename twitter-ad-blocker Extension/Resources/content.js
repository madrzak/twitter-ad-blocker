browser.runtime.sendMessage({ greeting: "hello" }).then((response) => {
    console.log("Received response: ", response);
});

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Received request: ", request);
});

// Track how many ads we've blocked
let adsBlockedCount = 0;

function hideTwitterAds() {
    const adSelectors = [
        '[data-testid="placementTracking"]', // Most promoted tweets
        '[aria-label="Ad"]', // Explicitly labeled ads
        'span:contains("Promoted")', // Promoted label
        'div[data-testid="tweet"] a[rel="noopener noreferrer nofollow"]', // External ad links
        'div[data-testid^="UserAvatar-Container-"]' // Some promoted avatars
    ];

    adSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(ad => {
            if (!ad.dataset.hidden) { // Avoid re-hiding the same ad
                console.log(`❌ Hiding Twitter/X Ad: "${ad.innerText.slice(0, 100)}..."`);
                ad.style.display = "none";
                ad.dataset.hidden = "true"; // Mark as hidden
                
                // Increment counter and update storage
                adsBlockedCount++;
                browser.storage.local.set({ 'adsBlocked': adsBlockedCount });
                
                // Report to background script
                browser.runtime.sendMessage({ adBlocked: ad.innerText.slice(0, 50) });
            }
        });
    });
}

// Get existing count from storage
browser.storage.local.get('adsBlocked').then(result => {
    adsBlockedCount = result.adsBlocked || 0;
}).catch(error => {
    console.error('Error getting ad count:', error);
});

// Monitor Twitter's dynamically loaded feed
const observer = new MutationObserver(hideTwitterAds);
observer.observe(document.body, { childList: true, subtree: true });

// Initial execution to catch existing ads
hideTwitterAds();

console.log("🚀 Twitter/X Ad Blocker is active!");
