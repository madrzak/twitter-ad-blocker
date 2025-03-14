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
        '[aria-label="Ad"]', // Explicitly labeled ads
        '[data-testid="placementTracking"]', // Promoted tweets
        'div[data-testid="top-impression-pixel"]', // Impression pixels
        'div[data-testid="bottom-impression-pixel"]',
        'div[data-testid="right-impression-pixel"]',
        'div[data-testid="left-impression-pixel"]',
        'a[href*="referring_page=ad_static_general"]', // Ad tracking links
        'a[href*="premium_sign_up"]' // "Subscribe to Premium" ads
        // Removed the UserAvatar-Container selector that was hiding legitimate profile pictures
    ];

    // Check for promoted content in spans
    const promotedElements = document.querySelectorAll('span');
    promotedElements.forEach(element => {
        if (element.textContent.includes('Promoted') && !element.dataset.hidden) {
            const tweetContainer = element.closest('[data-testid="tweet"]');
            if (tweetContainer) {
                console.log(`❌ Hiding Twitter/X Ad: "${tweetContainer.innerText.slice(0, 100)}..."`);
                tweetContainer.style.display = "none";
                tweetContainer.dataset.hidden = "true";
                
                // Increment counter and update storage
                adsBlockedCount++;
                browser.storage.local.set({ 'adsBlocked': adsBlockedCount });
                
                // Report to background script
                browser.runtime.sendMessage({ adBlocked: tweetContainer.innerText.slice(0, 50) });
            }
        }
    });

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
