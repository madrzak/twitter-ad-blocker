browser.runtime.sendMessage({ greeting: "hello" }).then((response) => {
    console.log("Received response: ", response);
});

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Received request: ", request);
});

// Track how many ads we've blocked or marked
let adsBlockedCount = 0;
let adsMarkedCount = 0;

// Create and inject CSS for the promoted badge
function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .twitter-ad-blocker-badge {
            display: inline-flex;
            align-items: center;
            background-color: rgba(255, 0, 0, 0.1);
            color: #FF3333;
            border-radius: 4px;
            padding: 0 6px;
            margin-left: 4px;
            font-size: 12px;
            font-weight: bold;
            height: 18px;
        }
        
        .twitter-ad-blocker-badge-container {
            display: flex;
            align-items: center;
        }
        
        [data-ad-marked="true"] {
            border: 1px solid rgba(255, 0, 0, 0.2) !important;
            background-color: rgba(255, 0, 0, 0.03) !important;
            border-radius: 12px !important;
        }
    `;
    document.head.appendChild(style);
}

function processTwitterContent() {
    // FEATURE 1: Block ads completely
    blockAds();
    
    // FEATURE 2: Mark promoted tweets
    markPromotedTweets();
}

function blockAds() {
    // These selectors will be hidden completely
    const hideSelectors = [
        '[data-testid="placementTracking"]', // Promoted tweets (block them)
        '[aria-label="Ad"]', // Explicitly labeled ads
        'div[data-testid="top-impression-pixel"]', // Impression pixels
        'div[data-testid="bottom-impression-pixel"]',
        'div[data-testid="right-impression-pixel"]',
        'div[data-testid="left-impression-pixel"]',
        'a[href*="premium_sign_up"]', // "Subscribe to Premium" ads
        'div[data-testid="inlinePrompt"]', // Inline prompts
        'aside[aria-label="Subscribe to Premium"]', // Premium sidebar
        'aside[aria-label="Who to follow"]', // Who to follow sidebar
        'div[aria-label="Timeline: Trending now"]', // Trending sidebar
        'a[href*="referring_page=ad_static_general"]' // Ad tracking links
    ];
    
    // Hide ads completely
    hideSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(ad => {
            if (!ad.dataset.hidden) {
                // For promoted tweets, we need to hide the entire tweet container
                if (selector === '[data-testid="placementTracking"]' || selector === '[aria-label="Ad"]') {
                    const tweetContainer = ad.closest('article') || ad.closest('[data-testid="tweet"]');
                    if (tweetContainer && !tweetContainer.dataset.hidden) {
                        console.log(`❌ Blocking Twitter/X Ad: "${tweetContainer.innerText.slice(0, 50)}..."`);
                        tweetContainer.style.display = "none";
                        tweetContainer.dataset.hidden = "true";
                        
                        // Increment counter and update storage
                        adsBlockedCount++;
                        browser.storage.local.set({ 'adsBlocked': adsBlockedCount });
                        
                        // Report to background script
                        browser.runtime.sendMessage({ adBlocked: tweetContainer.innerText.slice(0, 50) });
                    }
                } else {
                    // For other ad elements, just hide the element itself
                    console.log(`❌ Hiding Twitter/X Ad element: ${selector}`);
                    ad.style.display = "none";
                    ad.dataset.hidden = "true";
                    
                    // Increment counter and update storage
                    adsBlockedCount++;
                    browser.storage.local.set({ 'adsBlocked': adsBlockedCount });
                    
                    // Report to background script
                    browser.runtime.sendMessage({ adBlocked: "Hidden Ad Element" });
                }
            }
        });
    });
    
    // Check for promoted content in spans
    const promotedElements = document.querySelectorAll('span');
    promotedElements.forEach(element => {
        if (element.textContent.includes('Promoted') && !element.dataset.hidden) {
            const tweetContainer = element.closest('article') || element.closest('[data-testid="tweet"]');
            if (tweetContainer && !tweetContainer.dataset.hidden) {
                console.log(`❌ Blocking Twitter/X Ad with "Promoted" text: "${tweetContainer.innerText.slice(0, 50)}..."`);
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
}

function markPromotedTweets() {
    // This is a separate feature that marks promoted tweets with a badge
    // We'll use a different dataset attribute to avoid conflicts with the blocking feature
    
    // Find all promoted tweets that haven't been marked yet
    const promotedTweets = document.querySelectorAll('[data-testid="placementTracking"], [aria-label="Ad"]');
    promotedTweets.forEach(tweet => {
        if (!tweet.dataset.adMarked) {
            // Find the tweet container
            const tweetContainer = tweet.closest('article') || tweet.closest('[data-testid="tweet"]') || tweet;
            
            // Skip if this tweet is already hidden by the ad blocker
            if (tweetContainer.dataset.hidden) return;
            
            // Mark the tweet container
            tweetContainer.dataset.adMarked = "true";
            
            // Find the username container to add our badge
            const userNameContainer = tweetContainer.querySelector('[data-testid="User-Name"]');
            if (userNameContainer && !userNameContainer.querySelector('.twitter-ad-blocker-badge')) {
                // Create badge container
                const badgeContainer = document.createElement('div');
                badgeContainer.className = 'twitter-ad-blocker-badge-container';
                
                // Create badge
                const badge = document.createElement('div');
                badge.className = 'twitter-ad-blocker-badge';
                badge.textContent = 'Promoted Tweet';
                
                // Add badge to container
                badgeContainer.appendChild(badge);
                
                // Add badge after username
                userNameContainer.appendChild(badgeContainer);
                
                console.log(`🏷️ Marked Twitter/X Ad: "${tweetContainer.innerText.slice(0, 50)}..."`);
                
                // Increment counter and update storage
                adsMarkedCount++;
                browser.storage.local.set({ 'adsMarked': adsMarkedCount });
                
                // Report to background script
                browser.runtime.sendMessage({ adMarked: tweetContainer.innerText.slice(0, 50) });
            }
        }
    });
    
    // Check for promoted content in spans
    const promotedElements = document.querySelectorAll('span');
    promotedElements.forEach(element => {
        if (element.textContent.includes('Promoted') && !element.dataset.adMarked) {
            element.dataset.adMarked = "true";
            
            // Find the tweet container
            const tweetContainer = element.closest('article') || element.closest('[data-testid="tweet"]');
            
            // Skip if this tweet is already hidden by the ad blocker
            if (tweetContainer && tweetContainer.dataset.hidden) return;
            
            if (tweetContainer && !tweetContainer.dataset.adMarked) {
                // Mark the tweet container
                tweetContainer.dataset.adMarked = "true";
                
                // Find the username container to add our badge
                const userNameContainer = tweetContainer.querySelector('[data-testid="User-Name"]');
                if (userNameContainer && !userNameContainer.querySelector('.twitter-ad-blocker-badge')) {
                    // Create badge container
                    const badgeContainer = document.createElement('div');
                    badgeContainer.className = 'twitter-ad-blocker-badge-container';
                    
                    // Create badge
                    const badge = document.createElement('div');
                    badge.className = 'twitter-ad-blocker-badge';
                    badge.textContent = 'Promoted Tweet';
                    
                    // Add badge to container
                    badgeContainer.appendChild(badge);
                    
                    // Add badge after username
                    userNameContainer.appendChild(badgeContainer);
                    
                    console.log(`🏷️ Marked Twitter/X Ad: "${tweetContainer.innerText.slice(0, 50)}..."`);
                    
                    // Increment counter and update storage
                    adsMarkedCount++;
                    browser.storage.local.set({ 'adsMarked': adsMarkedCount });
                    
                    // Report to background script
                    browser.runtime.sendMessage({ adMarked: tweetContainer.innerText.slice(0, 50) });
                }
            }
        }
    });
}

// Get existing counts from storage
browser.storage.local.get(['adsBlocked', 'adsMarked']).then(result => {
    adsBlockedCount = result.adsBlocked || 0;
    adsMarkedCount = result.adsMarked || 0;
}).catch(error => {
    console.error('Error getting ad counts:', error);
});

// Inject our custom styles
injectStyles();

// Monitor Twitter's dynamically loaded feed
const observer = new MutationObserver(processTwitterContent);
observer.observe(document.body, { childList: true, subtree: true });

// Initial execution to catch existing ads
processTwitterContent();

console.log("🚀 Twitter/X Ad Blocker & Marker is active!");
